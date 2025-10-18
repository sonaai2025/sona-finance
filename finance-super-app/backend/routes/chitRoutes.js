const express = require('express');
const router = express.Router();
const { verifyAuth } = require('../middlewares/authMiddleware');
const { createChitGroup, listChitGroups, getChitGroup, subscribeToChit, createAuction } = require('../controllers/chitController');

router.post('/', verifyAuth, createChitGroup);
router.get('/', verifyAuth, listChitGroups);
router.get('/:groupId', verifyAuth, getChitGroup);
router.post('/:groupId/subscribe', verifyAuth, subscribeToChit);
router.post('/:groupId/auctions', verifyAuth, createAuction);

module.exports = router;
