const express = require('express');
const { LoanApplicationModel, UserModel, PaymentModel } = require('../models/firestoreModels');
const { verifyFirebaseToken, requireRole } = require('../middlewares/auth');
const { loanApplicationSchema, loanStatusUpdateSchema, validate } = require('../models/validationSchemas');
const { calculateCreditScore } = require('../services/aiService');

const router = express.Router();
const loanApplicationModel = new LoanApplicationModel();
const userModel = new UserModel();
const paymentModel = new PaymentModel();

// Apply for a loan
router.post('/apply', verifyFirebaseToken, validate(loanApplicationSchema), async (req, res) => {
  try {
    const { uid } = req.user;
    const loanData = {
      ...req.body,
      userId: uid,
      status: 'Pending',
      appliedDate: new Date(),
      creditScore: 0 // Will be calculated by AI service
    };

    // Calculate credit score using AI service
    try {
      const creditScore = await calculateCreditScore(uid);
      loanData.creditScore = creditScore;
    } catch (error) {
      console.warn('Credit score calculation failed, using default:', error.message);
      loanData.creditScore = 500; // Default score
    }

    const loanApplication = await loanApplicationModel.create(loanData);
    
    res.status(201).json({
      success: true,
      message: 'Loan application submitted successfully',
      data: loanApplication
    });
  } catch (error) {
    console.error('Loan application error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting loan application',
      error: error.message
    });
  }
});

// Get all loan applications (Admin/Manager/Accountant)
router.get('/', verifyFirebaseToken, requireRole(['Admin', 'Manager', 'Accountant']), async (req, res) => {
  try {
    const { status, limit, userId } = req.query;
    const filters = {};
    
    if (status) filters.status = status;
    if (userId) filters.userId = userId;
    
    const limitNum = limit ? parseInt(limit) : null;
    
    const loanApplications = await loanApplicationModel.getAll(
      filters, 
      { field: 'appliedDate', direction: 'desc' }, 
      limitNum
    );

    // Get user details for each application
    const applicationsWithUserDetails = await Promise.all(
      loanApplications.map(async (application) => {
        const user = await userModel.getById(application.userId);
        return {
          ...application,
          user: user ? {
            fullName: user.fullName,
            contactNumber: user.contactNumber,
            email: user.email
          } : null
        };
      })
    );
    
    res.json({
      success: true,
      data: applicationsWithUserDetails,
      count: applicationsWithUserDetails.length
    });
  } catch (error) {
    console.error('Get loan applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching loan applications',
      error: error.message
    });
  }
});

// Get specific loan application
router.get('/:applicationId', verifyFirebaseToken, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { uid, role } = req.user;
    
    const loanApplication = await loanApplicationModel.getById(applicationId);
    if (!loanApplication) {
      return res.status(404).json({
        success: false,
        message: 'Loan application not found'
      });
    }

    // Check if user has permission to view this application
    if (role === 'customer' && loanApplication.userId !== uid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get user details
    const user = await userModel.getById(loanApplication.userId);
    
    res.json({
      success: true,
      data: {
        ...loanApplication,
        user: user ? {
          fullName: user.fullName,
          contactNumber: user.contactNumber,
          email: user.email,
          address: user.address,
          trustScore: user.trustScore
        } : null
      }
    });
  } catch (error) {
    console.error('Get loan application error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching loan application',
      error: error.message
    });
  }
});

// Update loan application status (Approve/Reject)
router.put('/:applicationId/status', verifyFirebaseToken, requireRole(['Admin', 'Manager', 'Accountant']), validate(loanStatusUpdateSchema), async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status, approvedAmount, interestRate, remarks } = req.body;
    const { uid } = req.user;
    
    const loanApplication = await loanApplicationModel.getById(applicationId);
    if (!loanApplication) {
      return res.status(404).json({
        success: false,
        message: 'Loan application not found'
      });
    }

    if (loanApplication.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'Loan application has already been processed'
      });
    }

    const updateData = {
      status,
      approvedBy: uid,
      processedDate: new Date(),
      remarks
    };

    if (status === 'Approved') {
      if (!approvedAmount || !interestRate) {
        return res.status(400).json({
          success: false,
          message: 'Approved amount and interest rate are required for approval'
        });
      }
      updateData.approvedAmount = approvedAmount;
      updateData.interestRate = interestRate;
    }

    const updatedApplication = await loanApplicationModel.update(applicationId, updateData);
    
    res.json({
      success: true,
      message: `Loan application ${status.toLowerCase()} successfully`,
      data: updatedApplication
    });
  } catch (error) {
    console.error('Update loan status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating loan status',
      error: error.message
    });
  }
});

// Get user's loan applications
router.get('/user/:userId', verifyFirebaseToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { uid, role } = req.user;
    
    // Check if user has permission to view these applications
    if (role === 'customer' && userId !== uid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const loanApplications = await loanApplicationModel.getByUserId(userId);
    
    res.json({
      success: true,
      data: loanApplications,
      count: loanApplications.length
    });
  } catch (error) {
    console.error('Get user loans error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user loan applications',
      error: error.message
    });
  }
});

// Get loan payment history
router.get('/:applicationId/payments', verifyFirebaseToken, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { uid, role } = req.user;
    
    // Check if user has permission to view this application
    const loanApplication = await loanApplicationModel.getById(applicationId);
    if (!loanApplication) {
      return res.status(404).json({
        success: false,
        message: 'Loan application not found'
      });
    }

    if (role === 'customer' && loanApplication.userId !== uid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const payments = await paymentModel.getByMultipleFields({
      referenceId: applicationId,
      paymentFor: 'Loan'
    });
    
    res.json({
      success: true,
      data: payments,
      count: payments.length
    });
  } catch (error) {
    console.error('Get loan payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching loan payments',
      error: error.message
    });
  }
});

// Calculate loan EMI
router.post('/calculate-emi', verifyFirebaseToken, async (req, res) => {
  try {
    const { principal, interestRate, tenureMonths } = req.body;
    
    if (!principal || !interestRate || !tenureMonths) {
      return res.status(400).json({
        success: false,
        message: 'Principal, interest rate, and tenure are required'
      });
    }

    const monthlyRate = interestRate / 100 / 12;
    const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / 
                (Math.pow(1 + monthlyRate, tenureMonths) - 1);
    
    const totalAmount = emi * tenureMonths;
    const totalInterest = totalAmount - principal;

    res.json({
      success: true,
      data: {
        emi: Math.round(emi),
        totalAmount: Math.round(totalAmount),
        totalInterest: Math.round(totalInterest),
        principal,
        interestRate,
        tenureMonths
      }
    });
  } catch (error) {
    console.error('Calculate EMI error:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating EMI',
      error: error.message
    });
  }
});

// Get loan statistics (Admin/Manager)
router.get('/stats/overview', verifyFirebaseToken, requireRole(['Admin', 'Manager']), async (req, res) => {
  try {
    const allApplications = await loanApplicationModel.getAll();
    
    const stats = {
      total: allApplications.length,
      pending: allApplications.filter(app => app.status === 'Pending').length,
      approved: allApplications.filter(app => app.status === 'Approved').length,
      rejected: allApplications.filter(app => app.status === 'Rejected').length,
      disbursed: allApplications.filter(app => app.status === 'Disbursed').length,
      totalAmountRequested: allApplications.reduce((sum, app) => sum + (app.amountRequested || 0), 0),
      totalAmountApproved: allApplications.reduce((sum, app) => sum + (app.approvedAmount || 0), 0),
      averageCreditScore: allApplications.length > 0 ? 
        allApplications.reduce((sum, app) => sum + (app.creditScore || 0), 0) / allApplications.length : 0
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get loan stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching loan statistics',
      error: error.message
    });
  }
});

module.exports = router;