const express = require('express');
const router = express.Router();
const { register } = require('../controllers/authController');
const { verifyAuth } = require('../middlewares/authMiddleware');

router.post('/register', verifyAuth, register);

module.exports = router;
