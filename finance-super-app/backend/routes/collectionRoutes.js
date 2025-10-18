const express = require('express');
const router = express.Router();
const { verifyAuth } = require('../middlewares/authMiddleware');
const { recordPayment, dailyReport } = require('../controllers/collectionController');

router.post('/record-payment', verifyAuth, recordPayment);
router.get('/daily-report', verifyAuth, dailyReport);

module.exports = router;
