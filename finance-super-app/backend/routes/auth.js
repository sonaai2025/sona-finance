const express = require('express');
const { UserModel, StaffModel } = require('../models/firestoreModels');
const { verifyFirebaseToken } = require('../middlewares/auth');
const { userSchema, staffSchema, validate } = require('../models/validationSchemas');

const router = express.Router();
const userModel = new UserModel();
const staffModel = new StaffModel();

// Register user profile after Firebase authentication
router.post('/register', verifyFirebaseToken, validate(userSchema), async (req, res) => {
  try {
    const { uid, email } = req.user;
    const userData = {
      ...req.body,
      userId: uid,
      email: email,
      trustScore: 500, // Default trust score
      createdAt: new Date()
    };

    // Check if user already exists
    const existingUser = await userModel.getById(uid);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User profile already exists'
      });
    }

    const user = await userModel.create(userData);
    
    res.status(201).json({
      success: true,
      message: 'User profile created successfully',
      data: user
    });
  } catch (error) {
    console.error('User registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating user profile',
      error: error.message
    });
  }
});

// Register staff profile
router.post('/register-staff', verifyFirebaseToken, validate(staffSchema), async (req, res) => {
  try {
    const { uid, email } = req.user;
    const staffData = {
      ...req.body,
      staffId: uid,
      email: email,
      performanceScore: 0, // Default performance score
      createdAt: new Date()
    };

    // Check if staff already exists
    const existingStaff = await staffModel.getById(uid);
    if (existingStaff) {
      return res.status(400).json({
        success: false,
        message: 'Staff profile already exists'
      });
    }

    const staff = await staffModel.create(staffData);
    
    res.status(201).json({
      success: true,
      message: 'Staff profile created successfully',
      data: staff
    });
  } catch (error) {
    console.error('Staff registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating staff profile',
      error: error.message
    });
  }
});

// Get current user profile
router.get('/profile', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.user;
    
    // Try to get user profile first
    let profile = await userModel.getById(uid);
    let profileType = 'user';
    
    // If not found, try staff profile
    if (!profile) {
      profile = await staffModel.getById(uid);
      profileType = 'staff';
    }
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...profile,
        profileType
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error.message
    });
  }
});

// Update user profile
router.put('/profile', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const updateData = req.body;
    
    // Remove fields that shouldn't be updated directly
    delete updateData.userId;
    delete updateData.staffId;
    delete updateData.email;
    delete updateData.createdAt;
    delete updateData.trustScore;
    delete updateData.performanceScore;

    // Try to update user profile first
    let updatedProfile = await userModel.update(uid, updateData);
    let profileType = 'user';
    
    // If user profile doesn't exist, try staff profile
    if (!updatedProfile) {
      updatedProfile = await staffModel.update(uid, updateData);
      profileType = 'staff';
    }
    
    if (!updatedProfile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        ...updatedProfile,
        profileType
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
});

// Get user by ID (for admin use)
router.get('/user/:userId', verifyFirebaseToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await userModel.getById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
});

module.exports = router;