const express = require('express');
const router = express.Router();
const { verifyAuth } = require('../middlewares/authMiddleware');
const { applyLoan, listLoans, listUserLoans, updateLoanStatus } = require('../controllers/loanController');

router.post('/apply', verifyAuth, applyLoan);
router.get('/', verifyAuth, listLoans);
router.get('/user/:userId', verifyAuth, listUserLoans);
router.put('/:applicationId/status', verifyAuth, updateLoanStatus);

module.exports = router;
