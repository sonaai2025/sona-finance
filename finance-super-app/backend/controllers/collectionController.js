const admin = require('firebase-admin');
const { z } = require('zod');
const { db, COLLECTIONS } = require('../models/firestore');

const paymentSchema = z.object({
  userId: z.string(),
  amount: z.number().positive(),
  paymentFor: z.enum(['Chit', 'Loan']),
  referenceId: z.string(),
  collectedBy: z.string().optional(),
  transactionId: z.string().optional(),
});

async function recordPayment(req, res) {
  try {
    const payload = paymentSchema.parse(req.body);

    const ref = db.collection(COLLECTIONS.PAYMENTS).doc();
    const record = {
      paymentId: ref.id,
      ...payload,
      paymentDate: admin.firestore.FieldValue.serverTimestamp(),
    };
    await ref.set(record);
    return res.status(201).json(record);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    return res.status(500).json({ error: err.message || 'Failed to record payment' });
  }
}

async function dailyReport(req, res) {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const snap = await db
      .collection(COLLECTIONS.PAYMENTS)
      .where('paymentDate', '>=', start)
      .where('paymentDate', '<=', end)
      .get();

    const payments = snap.docs.map((d) => d.data());
    const total = payments.reduce((s, p) => s + (p.amount || 0), 0);

    return res.json({ date: start.toISOString().slice(0, 10), count: payments.length, total, payments });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch daily report' });
  }
}

module.exports = { recordPayment, dailyReport };
