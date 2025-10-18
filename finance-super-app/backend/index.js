require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// Initialize Firebase Admin
(function initFirebaseAdmin() {
  try {
    if (!admin.apps.length) {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log('Firebase Admin initialized with service account JSON');
      } else {
        admin.initializeApp();
        console.log('Firebase Admin initialized with application default credentials');
      }
    }
  } catch (err) {
    console.error('Failed to initialize Firebase Admin:', err.message);
  }
})();

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'finance-super-app-backend' });
});

// Routes
const authRoutes = require('./routes/authRoutes');
const chitRoutes = require('./routes/chitRoutes');
const loanRoutes = require('./routes/loanRoutes');
const staffRoutes = require('./routes/staffRoutes');
const collectionRoutes = require('./routes/collectionRoutes');

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/chits', chitRoutes);
app.use('/api/v1/loans', loanRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/collections', collectionRoutes);

// Not found handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});

module.exports = app;
