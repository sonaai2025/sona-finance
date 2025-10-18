const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');

async function verifyAuth(req, res, next) {
  try {
    if (process.env.BYPASS_AUTH === 'true') {
      req.user = { uid: 'dev-user', role: 'Admin' };
      return next();
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    // Try Firebase ID token first
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      req.user = { uid: decoded.uid, role: decoded.role || decoded.claims?.role || 'User' };
      return next();
    } catch (firebaseErr) {
      // Fallback to local JWT (optional)
      if (process.env.JWT_SECRET) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          req.user = { uid: decoded.uid, role: decoded.role || 'User' };
          return next();
        } catch (jwtErr) {
          // continue to error below
        }
      }
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Auth verification failed' });
  }
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return next();
  }

  admin
    .auth()
    .verifyIdToken(token)
    .then((decoded) => {
      req.user = { uid: decoded.uid, role: decoded.role || decoded.claims?.role || 'User' };
      next();
    })
    .catch(() => next());
}

module.exports = { verifyAuth, optionalAuth };
