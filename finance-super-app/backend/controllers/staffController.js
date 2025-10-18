const admin = require('firebase-admin');
const { z } = require('zod');
const { db, COLLECTIONS } = require('../models/firestore');

async function listStaff(req, res) {
  try {
    const snap = await db.collection(COLLECTIONS.STAFF).get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.json(items);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch staff' });
  }
}

const assignTaskSchema = z.object({
  date: z.string().optional(),
  area: z.string().optional(),
  targetAmount: z.number().optional(),
  notes: z.string().optional(),
});

async function assignTask(req, res) {
  try {
    const { staffId } = req.params;
    const payload = assignTaskSchema.parse(req.body);

    const ref = db.collection(COLLECTIONS.STAFF_TASKS).doc();
    const record = {
      taskId: ref.id,
      staffId,
      status: 'Assigned',
      ...payload,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await ref.set(record);
    return res.status(201).json(record);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    return res.status(500).json({ error: err.message || 'Failed to assign task' });
  }
}

async function performance(req, res) {
  try {
    const { staffId } = req.params;
    const paymentsSnap = await db
      .collection(COLLECTIONS.PAYMENTS)
      .where('collectedBy', '==', staffId)
      .get();

    const totalCollected = paymentsSnap.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0);
    const count = paymentsSnap.size;
    const score = Math.round((totalCollected / (count || 1)) * 10) / 10;

    return res.json({ staffId, totalCollected, count, performanceScore: score });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to get performance' });
  }
}

module.exports = { listStaff, assignTask, performance };
