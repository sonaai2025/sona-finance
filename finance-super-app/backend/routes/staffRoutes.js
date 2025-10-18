const express = require('express');
const router = express.Router();
const { verifyAuth } = require('../middlewares/authMiddleware');
const { listStaff, assignTask, performance } = require('../controllers/staffController');

router.get('/', verifyAuth, listStaff);
router.post('/:staffId/assign-task', verifyAuth, assignTask);
router.get('/:staffId/performance', verifyAuth, performance);

module.exports = router;
