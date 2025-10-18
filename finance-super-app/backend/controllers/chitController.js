const admin = require('firebase-admin');
const { z } = require('zod');
const { db, COLLECTIONS } = require('../models/firestore');

const chitGroupSchema = z.object({
  groupId: z.string(),
  groupName: z.string(),
  chitValue: z.number(),
  totalMembers: z.number(),
  durationMonths: z.number(),
  monthlyInstallment: z.number(),
  status: z.enum(['Upcoming', 'Active', 'Completed']).default('Upcoming'),
  startDate: z.string().or(z.date()).optional(),
  auctionSchedule: z.string().optional(),
});

async function createChitGroup(req, res) {
  try {
    const payload = chitGroupSchema.parse(req.body);
    const { groupId, ...data } = payload;
    const ref = db.collection(COLLECTIONS.CHIT_GROUPS).doc(groupId);
    await ref.set(data, { merge: true });
    const saved = await ref.get();
    return res.status(201).json({ id: saved.id, ...saved.data() });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    return res.status(500).json({ error: err.message || 'Failed to create chit group' });
  }
}

async function listChitGroups(req, res) {
  try {
    const snap = await db.collection(COLLECTIONS.CHIT_GROUPS).get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.json(items);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch chit groups' });
  }
}

async function getChitGroup(req, res) {
  try {
    const { groupId } = req.params;
    const ref = db.collection(COLLECTIONS.CHIT_GROUPS).doc(groupId);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Chit group not found' });
    return res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch chit group' });
  }
}

const subscriptionSchema = z.object({
  userId: z.string(),
  joinDate: z.string().or(z.date()).optional(),
});

async function subscribeToChit(req, res) {
  try {
    const { groupId } = req.params;
    const payload = subscriptionSchema.parse(req.body);

    const subRef = db.collection(COLLECTIONS.CHIT_SUBSCRIPTIONS).doc();
    const record = {
      subscriptionId: subRef.id,
      groupId,
      userId: payload.userId,
      joinDate: payload.joinDate || admin.firestore.FieldValue.serverTimestamp(),
      totalPaid: 0,
      isWinner: false,
      winingMonth: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await subRef.set(record);
    return res.status(201).json(record);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    return res.status(500).json({ error: err.message || 'Failed to subscribe to chit' });
  }
}

const auctionSchema = z.object({
  auctionDate: z.string().or(z.date()),
  auctionMonth: z.number(),
  winningBid: z.number(),
  winnerUserId: z.string(),
  dividendAmount: z.number(),
});

async function createAuction(req, res) {
  try {
    const { groupId } = req.params;
    const payload = auctionSchema.parse(req.body);
    const ref = db.collection(COLLECTIONS.AUCTIONS).doc();
    const record = {
      auctionId: ref.id,
      groupId,
      ...payload,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await ref.set(record);
    return res.status(201).json(record);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    return res.status(500).json({ error: err.message || 'Failed to create auction' });
  }
}

module.exports = { createChitGroup, listChitGroups, getChitGroup, subscribeToChit, createAuction };
