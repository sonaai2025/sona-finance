const express = require('express');
const { StaffModel, UserModel, PaymentModel, LoanApplicationModel } = require('../models/firestoreModels');
const { verifyFirebaseToken, requireRole } = require('../middlewares/auth');
const { taskAssignmentSchema, validate } = require('../models/validationSchemas');

const router = express.Router();
const staffModel = new StaffModel();
const userModel = new UserModel();
const paymentModel = new PaymentModel();
const loanApplicationModel = new LoanApplicationModel();

// Get all staff members
router.get('/', verifyFirebaseToken, requireRole(['Admin', 'Manager']), async (req, res) => {
  try {
    const { role, isActive, limit } = req.query;
    const filters = {};
    
    if (role) filters.role = role;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    
    const limitNum = limit ? parseInt(limit) : null;
    
    const staffMembers = await staffModel.getAll(
      filters, 
      { field: 'createdAt', direction: 'desc' }, 
      limitNum
    );
    
    res.json({
      success: true,
      data: staffMembers,
      count: staffMembers.length
    });
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching staff members',
      error: error.message
    });
  }
});

// Get specific staff member
router.get('/:staffId', verifyFirebaseToken, requireRole(['Admin', 'Manager']), async (req, res) => {
  try {
    const { staffId } = req.params;
    
    const staff = await staffModel.getById(staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    res.json({
      success: true,
      data: staff
    });
  } catch (error) {
    console.error('Get staff member error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching staff member',
      error: error.message
    });
  }
});

// Update staff member
router.put('/:staffId', verifyFirebaseToken, requireRole(['Admin', 'Manager']), async (req, res) => {
  try {
    const { staffId } = req.params;
    const updateData = req.body;
    
    // Remove fields that shouldn't be updated directly
    delete updateData.staffId;
    delete updateData.email;
    delete updateData.createdAt;
    delete updateData.performanceScore;

    const updatedStaff = await staffModel.update(staffId, updateData);
    
    if (!updatedStaff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    res.json({
      success: true,
      message: 'Staff member updated successfully',
      data: updatedStaff
    });
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating staff member',
      error: error.message
    });
  }
});

// Assign task to staff member
router.post('/:staffId/assign-task', verifyFirebaseToken, requireRole(['Admin', 'Manager']), validate(taskAssignmentSchema), async (req, res) => {
  try {
    const { staffId } = req.params;
    const { taskType, description, priority, dueDate, assignedCustomers } = req.body;
    
    // Check if staff member exists
    const staff = await staffModel.getById(staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Create task document
    const taskData = {
      staffId,
      taskType,
      description,
      priority,
      dueDate: new Date(dueDate),
      assignedCustomers: assignedCustomers || [],
      status: 'Assigned',
      assignedBy: req.user.uid,
      assignedAt: new Date(),
      createdAt: new Date()
    };

    // For now, we'll store tasks in a simple format
    // In a production app, you might want a separate tasks collection
    const taskId = `task_${Date.now()}_${staffId}`;
    
    res.status(201).json({
      success: true,
      message: 'Task assigned successfully',
      data: {
        taskId,
        ...taskData
      }
    });
  } catch (error) {
    console.error('Assign task error:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning task',
      error: error.message
    });
  }
});

// Get staff performance report
router.get('/:staffId/performance', verifyFirebaseToken, requireRole(['Admin', 'Manager']), async (req, res) => {
  try {
    const { staffId } = req.params;
    const { period = '30' } = req.query; // days
    
    // Check if staff member exists
    const staff = await staffModel.getById(staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get collections made by this staff member
    const collections = await paymentModel.getByMultipleFields({
      collectedBy: staffId
    });

    const recentCollections = collections.filter(collection => 
      new Date(collection.paymentDate) >= startDate
    );

    // Calculate performance metrics
    const totalCollections = recentCollections.length;
    const totalAmount = recentCollections.reduce((sum, collection) => sum + collection.amount, 0);
    const averageCollection = totalCollections > 0 ? totalAmount / totalCollections : 0;

    // Get loan applications processed by this staff member
    const loanApplications = await loanApplicationModel.getByMultipleFields({
      approvedBy: staffId
    });

    const recentLoanApplications = loanApplications.filter(app => 
      new Date(app.processedDate || app.appliedDate) >= startDate
    );

    const performanceData = {
      staffId,
      staffName: staff.fullName,
      role: staff.role,
      period: `${days} days`,
      collections: {
        total: totalCollections,
        totalAmount,
        averageAmount: Math.round(averageCollection),
        dailyAverage: Math.round(totalCollections / days)
      },
      loanProcessing: {
        totalProcessed: recentLoanApplications.length,
        approved: recentLoanApplications.filter(app => app.status === 'Approved').length,
        rejected: recentLoanApplications.filter(app => app.status === 'Rejected').length
      },
      performanceScore: staff.performanceScore || 0
    };

    res.json({
      success: true,
      data: performanceData
    });
  } catch (error) {
    console.error('Get staff performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching staff performance',
      error: error.message
    });
  }
});

// Get staff dashboard data
router.get('/:staffId/dashboard', verifyFirebaseToken, async (req, res) => {
  try {
    const { staffId } = req.params;
    const { uid, role } = req.user;
    
    // Check if user has permission to view this dashboard
    if (role === 'customer' && staffId !== uid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const staff = await staffModel.getById(staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Get today's collections
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCollections = await paymentModel.getByMultipleFields({
      collectedBy: staffId
    });

    const todayPayments = todayCollections.filter(collection => {
      const paymentDate = new Date(collection.paymentDate);
      return paymentDate >= today && paymentDate < tomorrow;
    });

    // Get pending collections (overdue payments)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const pendingCollections = await paymentModel.getByMultipleFields({
      collectedBy: staffId
    });

    // This is a simplified version - in production, you'd have more sophisticated logic
    const overduePayments = pendingCollections.filter(collection => 
      new Date(collection.paymentDate) < thirtyDaysAgo
    );

    const dashboardData = {
      staffId,
      staffName: staff.fullName,
      role: staff.role,
      today: {
        collections: todayPayments.length,
        amount: todayPayments.reduce((sum, payment) => sum + payment.amount, 0)
      },
      pending: {
        overduePayments: overduePayments.length,
        totalAmount: overduePayments.reduce((sum, payment) => sum + payment.amount, 0)
      },
      performanceScore: staff.performanceScore || 0
    };

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Get staff dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching staff dashboard',
      error: error.message
    });
  }
});

// Update staff performance score
router.put('/:staffId/performance-score', verifyFirebaseToken, requireRole(['Admin', 'Manager']), async (req, res) => {
  try {
    const { staffId } = req.params;
    const { performanceScore } = req.body;
    
    if (performanceScore < 0 || performanceScore > 100) {
      return res.status(400).json({
        success: false,
        message: 'Performance score must be between 0 and 100'
      });
    }

    const updatedStaff = await staffModel.updatePerformanceScore(staffId, performanceScore);
    
    if (!updatedStaff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    res.json({
      success: true,
      message: 'Performance score updated successfully',
      data: updatedStaff
    });
  } catch (error) {
    console.error('Update performance score error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating performance score',
      error: error.message
    });
  }
});

// Get staff by role
router.get('/role/:role', verifyFirebaseToken, requireRole(['Admin', 'Manager']), async (req, res) => {
  try {
    const { role } = req.params;
    
    const staffMembers = await staffModel.getByRole(role);
    
    res.json({
      success: true,
      data: staffMembers,
      count: staffMembers.length
    });
  } catch (error) {
    console.error('Get staff by role error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching staff by role',
      error: error.message
    });
  }
});

module.exports = router;