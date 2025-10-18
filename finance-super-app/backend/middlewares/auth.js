const { getAuth } = require('../services/firebaseService');
const jwt = require('jsonwebtoken');

// Verify Firebase ID token
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.split(' ')[1];
    const auth = getAuth();
    
    // Verify the Firebase ID token
    const decodedToken = await auth.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      email_verified: decodedToken.email_verified
    };
    
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

// Verify JWT token (for internal API calls)
const verifyJWT = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('JWT verification error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

// Role-based access control
const requireRole = (roles) => {
  return async (req, res, next) => {
    try {
      const { getFirestore } = require('../services/firebaseService');
      const db = getFirestore();
      
      // Get user role from Firestore
      const userDoc = await db.collection('users').doc(req.user.uid).get();
      const staffDoc = await db.collection('staff').doc(req.user.uid).get();
      
      let userRole = 'customer';
      if (staffDoc.exists) {
        userRole = staffDoc.data().role;
      }
      
      if (!roles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions.'
        });
      }
      
      req.user.role = userRole;
      next();
    } catch (error) {
      console.error('Role verification error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error verifying user role'
      });
    }
  };
};

module.exports = {
  verifyFirebaseToken,
  verifyJWT,
  requireRole
};