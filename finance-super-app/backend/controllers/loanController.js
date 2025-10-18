const admin = require('firebase-admin');
const { z } = require('zod');
const { db, COLLECTIONS } = require('../models/firestore');
const { scoreCredit, predictDefault } = require('../services/aiService');

const loanApplySchema = z.object({
  userId: z.string(),
  loanType: z.enum(['Vehicle', 'Gold', 'Property', 'DailyCollection']),
  amountRequested: z.number().positive(),
});

async function applyLoan(req, res) {
  try {
    const payload = loanApplySchema.parse(req.body);

    const applications = db.collection(COLLECTIONS.LOAN_APPLICATIONS);
    const ref = applications.doc();

    // Fetch data needed for AI scoring
    const [paymentsSnap, existingLoansSnap] = await Promise.all([
      db
        .collection(COLLECTIONS.PAYMENTS)
        .where('userId', '==', payload.userId)
        .get(),
      applications.where('userId', '==', payload.userId).get(),
    ]);

    const userPayments = paymentsSnap.docs.map((d) => d.data());
    const existingLoans = existingLoansSnap.docs.map((d) => d.data());

    const creditScore = await scoreCredit({ userId: payload.userId, userPayments, existingLoans });

    const record = {
      applicationId: ref.id,
      userId: payload.userId,
      loanType: payload.loanType,
      amountRequested: payload.amountRequested,
      status: 'Pending',
      creditScore,
      approvedAmount: 0,
      interestRate: 0,
      tenureMonths: 0,
      appliedDate: admin.firestore.FieldValue.serverTimestamp(),
    };

    await ref.set(record);
    return res.status(201).json(record);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    return res.status(500).json({ error: err.message || 'Loan application failed' });
  }
}

async function listLoans(req, res) {
  try {
    const snap = await db.collection(COLLECTIONS.LOAN_APPLICATIONS).get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.json(items);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch loan applications' });
  }
}

async function listUserLoans(req, res) {
  try {
    const { userId } = req.params;
    const snap = await db
      .collection(COLLECTIONS.LOAN_APPLICATIONS)
      .where('userId', '==', userId)
      .get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.json(items);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch user loans' });
  }
}

const updateStatusSchema = z.object({
  status: z.enum(['Pending', 'Approved', 'Rejected']),
  approvedAmount: z.number().nonnegative().optional(),
  interestRate: z.number().nonnegative().optional(),
  tenureMonths: z.number().nonnegative().optional(),
  approvedBy: z.string().optional(),
});

async function updateLoanStatus(req, res) {
  try {
    const { applicationId } = req.params;
    const payload = updateStatusSchema.parse(req.body);

    const ref = db.collection(COLLECTIONS.LOAN_APPLICATIONS).doc(applicationId);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Application not found' });

    const updates = {
      ...payload,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Predict default risk when approving
    if (payload.status === 'Approved') {
      const appData = { id: doc.id, ...doc.data(), ...payload };
      const risk = await predictDefault({ application: appData });
      updates.defaultRisk = risk?.default_chance ?? null;
    }

    await ref.update(updates);
    const saved = await ref.get();
    return res.json({ id: saved.id, ...saved.data() });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    return res.status(500).json({ error: err.message || 'Failed to update loan status' });
  }
}

module.exports = { applyLoan, listLoans, listUserLoans, updateLoanStatus };
