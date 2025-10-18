const admin = require('firebase-admin');
const { z } = require('zod');
const { db, COLLECTIONS } = require('../models/firestore');

const userSchema = z.object({
  userId: z.string(),
  fullName: z.string(),
  dob: z.string().or(z.date()).optional(),
  address: z.string().optional(),
  contactNumber: z.string().optional(),
  photoURL: z.string().url().optional(),
  occupation: z.string().optional(),
  kyc: z
    .object({
      aadhar: z.string().optional(),
      pan: z.string().optional(),
      isVerified: z.boolean().optional(),
    })
    .optional(),
  trustScore: z.number().optional(),
});

const staffSchema = z.object({
  staffId: z.string(),
  fullName: z.string(),
  employeeId: z.string().optional(),
  role: z.string().optional(),
  assignedArea: z.string().optional(),
  isActive: z.boolean().optional(),
  performanceScore: z.number().optional(),
});

async function register(req, res) {
  try {
    const profileType = req.body.profileType || 'user';

    if (profileType === 'user') {
      const parsed = userSchema.parse(req.body);
      const { userId, ...data } = parsed;

      const ref = db.collection(COLLECTIONS.USERS).doc(userId);
      await ref.set(
        {
          userId,
          ...data,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      const saved = await ref.get();
      return res.status(201).json({ id: saved.id, ...saved.data() });
    }

    if (profileType === 'staff') {
      const parsed = staffSchema.parse(req.body);
      const { staffId, ...data } = parsed;

      const ref = db.collection(COLLECTIONS.STAFF).doc(staffId);
      await ref.set(
        {
          staffId,
          isActive: true,
          ...data,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      const saved = await ref.get();
      return res.status(201).json({ id: saved.id, ...saved.data() });
    }

    return res.status(400).json({ error: 'Invalid profileType' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    return res.status(500).json({ error: err.message || 'Registration failed' });
  }
}

module.exports = { register };
