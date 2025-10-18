const Joi = require('joi');

// User validation schemas
const userSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).required(),
  dob: Joi.date().max('now').required(),
  address: Joi.string().min(10).max(500).required(),
  contactNumber: Joi.string().pattern(/^[6-9]\d{9}$/).required(),
  photoURL: Joi.string().uri().optional(),
  occupation: Joi.string().min(2).max(100).required(),
  kyc: Joi.object({
    aadhar: Joi.string().pattern(/^\d{12}$/).required(),
    pan: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).required(),
    isVerified: Joi.boolean().default(false)
  }).required()
});

const staffSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).required(),
  employeeId: Joi.string().min(3).max(20).required(),
  role: Joi.string().valid('Manager', 'Accountant', 'CollectionAgent', 'Admin').required(),
  assignedArea: Joi.string().min(2).max(100).required(),
  isActive: Joi.boolean().default(true)
});

// Chit validation schemas
const chitGroupSchema = Joi.object({
  groupName: Joi.string().min(3).max(100).required(),
  chitValue: Joi.number().positive().required(),
  totalMembers: Joi.number().integer().min(10).max(100).required(),
  durationMonths: Joi.number().integer().min(6).max(60).required(),
  monthlyInstallment: Joi.number().positive().required(),
  startDate: Joi.date().min('now').required(),
  auctionSchedule: Joi.string().valid('Monthly', 'Weekly').default('Monthly')
});

const chitSubscriptionSchema = Joi.object({
  groupId: Joi.string().required(),
  userId: Joi.string().required()
});

const auctionSchema = Joi.object({
  groupId: Joi.string().required(),
  auctionDate: Joi.date().min('now').required(),
  auctionMonth: Joi.number().integer().min(1).required(),
  winningBid: Joi.number().positive().required(),
  winnerUserId: Joi.string().required()
});

// Loan validation schemas
const loanApplicationSchema = Joi.object({
  userId: Joi.string().required(),
  loanType: Joi.string().valid('Vehicle', 'Gold', 'Property', 'DailyCollection').required(),
  amountRequested: Joi.number().positive().max(10000000).required(),
  tenureMonths: Joi.number().integer().min(1).max(120).required(),
  purpose: Joi.string().min(10).max(500).required(),
  collateralDetails: Joi.object({
    type: Joi.string().required(),
    value: Joi.number().positive().required(),
    description: Joi.string().min(10).max(500).required()
  }).when('loanType', {
    is: Joi.string().valid('Gold', 'Property', 'Vehicle'),
    then: Joi.required(),
    otherwise: Joi.optional()
  })
});

const loanStatusUpdateSchema = Joi.object({
  status: Joi.string().valid('Pending', 'Approved', 'Rejected', 'Disbursed', 'Closed').required(),
  approvedAmount: Joi.number().positive().when('status', {
    is: 'Approved',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  interestRate: Joi.number().positive().max(30).when('status', {
    is: 'Approved',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  remarks: Joi.string().max(500).optional()
});

// Payment validation schemas
const paymentSchema = Joi.object({
  userId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  paymentFor: Joi.string().valid('Chit', 'Loan').required(),
  referenceId: Joi.string().required(),
  paymentMethod: Joi.string().valid('Cash', 'Online', 'Cheque', 'UPI').required(),
  transactionId: Joi.string().when('paymentMethod', {
    is: Joi.string().valid('Online', 'UPI'),
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  collectedBy: Joi.string().required()
});

// Staff task validation schemas
const taskAssignmentSchema = Joi.object({
  staffId: Joi.string().required(),
  taskType: Joi.string().valid('Collection', 'FollowUp', 'NewCustomer', 'DocumentVerification').required(),
  description: Joi.string().min(10).max(500).required(),
  priority: Joi.string().valid('Low', 'Medium', 'High', 'Urgent').default('Medium'),
  dueDate: Joi.date().min('now').required(),
  assignedCustomers: Joi.array().items(Joi.string()).optional()
});

// Validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }
    next();
  };
};

module.exports = {
  userSchema,
  staffSchema,
  chitGroupSchema,
  chitSubscriptionSchema,
  auctionSchema,
  loanApplicationSchema,
  loanStatusUpdateSchema,
  paymentSchema,
  taskAssignmentSchema,
  validate
};