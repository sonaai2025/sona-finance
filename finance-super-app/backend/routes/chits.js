const express = require('express');
const { ChitGroupModel, ChitSubscriptionModel, AuctionModel, UserModel } = require('../models/firestoreModels');
const { verifyFirebaseToken, requireRole } = require('../middlewares/auth');
const { chitGroupSchema, chitSubscriptionSchema, auctionSchema, validate } = require('../models/validationSchemas');

const router = express.Router();
const chitGroupModel = new ChitGroupModel();
const chitSubscriptionModel = new ChitSubscriptionModel();
const auctionModel = new AuctionModel();
const userModel = new UserModel();

// Create a new Chit Group (Admin/Manager only)
router.post('/', verifyFirebaseToken, requireRole(['Admin', 'Manager']), validate(chitGroupSchema), async (req, res) => {
  try {
    const chitData = {
      ...req.body,
      status: 'Upcoming',
      currentMembers: 0,
      createdAt: new Date()
    };

    const chitGroup = await chitGroupModel.create(chitData);
    
    res.status(201).json({
      success: true,
      message: 'Chit group created successfully',
      data: chitGroup
    });
  } catch (error) {
    console.error('Create chit group error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating chit group',
      error: error.message
    });
  }
});

// Get all Chit Groups
router.get('/', verifyFirebaseToken, async (req, res) => {
  try {
    const { status, limit } = req.query;
    const filters = status ? { status } : {};
    const limitNum = limit ? parseInt(limit) : null;
    
    const chitGroups = await chitGroupModel.getAll(filters, { field: 'createdAt', direction: 'desc' }, limitNum);
    
    res.json({
      success: true,
      data: chitGroups,
      count: chitGroups.length
    });
  } catch (error) {
    console.error('Get chit groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching chit groups',
      error: error.message
    });
  }
});

// Get specific Chit Group details
router.get('/:groupId', verifyFirebaseToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const chitGroup = await chitGroupModel.getById(groupId);
    if (!chitGroup) {
      return res.status(404).json({
        success: false,
        message: 'Chit group not found'
      });
    }

    // Get all subscriptions for this group
    const subscriptions = await chitSubscriptionModel.getByGroupId(groupId);
    
    // Get all auctions for this group
    const auctions = await auctionModel.getByGroupId(groupId);

    res.json({
      success: true,
      data: {
        ...chitGroup,
        subscriptions,
        auctions
      }
    });
  } catch (error) {
    console.error('Get chit group error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching chit group',
      error: error.message
    });
  }
});

// Subscribe to a Chit Group
router.post('/:groupId/subscribe', verifyFirebaseToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { uid } = req.user;
    
    // Check if chit group exists and is available for subscription
    const chitGroup = await chitGroupModel.getById(groupId);
    if (!chitGroup) {
      return res.status(404).json({
        success: false,
        message: 'Chit group not found'
      });
    }

    if (chitGroup.status !== 'Upcoming') {
      return res.status(400).json({
        success: false,
        message: 'Chit group is not available for subscription'
      });
    }

    if (chitGroup.currentMembers >= chitGroup.totalMembers) {
      return res.status(400).json({
        success: false,
        message: 'Chit group is full'
      });
    }

    // Check if user is already subscribed
    const existingSubscriptions = await chitSubscriptionModel.getByMultipleFields({
      groupId,
      userId: uid
    });

    if (existingSubscriptions.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User is already subscribed to this chit group'
      });
    }

    // Create subscription
    const subscriptionData = {
      groupId,
      userId: uid,
      joinDate: new Date(),
      totalPaid: 0,
      isWinner: false,
      winningMonth: null
    };

    const subscription = await chitSubscriptionModel.create(subscriptionData);

    // Update chit group member count
    await chitGroupModel.update(groupId, {
      currentMembers: chitGroup.currentMembers + 1
    });

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to chit group',
      data: subscription
    });
  } catch (error) {
    console.error('Subscribe to chit error:', error);
    res.status(500).json({
      success: false,
      message: 'Error subscribing to chit group',
      error: error.message
    });
  }
});

// Conduct a new auction
router.post('/:groupId/auctions', verifyFirebaseToken, requireRole(['Admin', 'Manager', 'Accountant']), validate(auctionSchema), async (req, res) => {
  try {
    const { groupId } = req.params;
    const { auctionDate, auctionMonth, winningBid, winnerUserId } = req.body;
    
    // Check if chit group exists and is active
    const chitGroup = await chitGroupModel.getById(groupId);
    if (!chitGroup) {
      return res.status(404).json({
        success: false,
        message: 'Chit group not found'
      });
    }

    if (chitGroup.status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: 'Chit group is not active'
      });
    }

    // Check if winner is subscribed to this group
    const subscriptions = await chitSubscriptionModel.getByMultipleFields({
      groupId,
      userId: winnerUserId
    });

    if (subscriptions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Winner is not subscribed to this chit group'
      });
    }

    // Check if user has already won
    const winnerSubscription = subscriptions[0];
    if (winnerSubscription.isWinner) {
      return res.status(400).json({
        success: false,
        message: 'User has already won this chit group'
      });
    }

    // Calculate dividend amount
    const dividendAmount = chitGroup.chitValue - winningBid;

    // Create auction record
    const auctionData = {
      groupId,
      auctionDate: new Date(auctionDate),
      auctionMonth,
      winningBid,
      winnerUserId,
      dividendAmount,
      createdAt: new Date()
    };

    const auction = await auctionModel.create(auctionData);

    // Update winner subscription
    await chitSubscriptionModel.update(winnerSubscription.id, {
      isWinner: true,
      winningMonth: auctionMonth
    });

    // Check if this was the last auction
    const totalAuctions = await auctionModel.getByGroupId(groupId);
    if (totalAuctions.length >= chitGroup.durationMonths) {
      await chitGroupModel.update(groupId, { status: 'Completed' });
    }

    res.status(201).json({
      success: true,
      message: 'Auction conducted successfully',
      data: auction
    });
  } catch (error) {
    console.error('Conduct auction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error conducting auction',
      error: error.message
    });
  }
});

// Get user's chit subscriptions
router.get('/user/subscriptions', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.user;
    
    const subscriptions = await chitSubscriptionModel.getByUserId(uid);
    
    // Get chit group details for each subscription
    const subscriptionsWithDetails = await Promise.all(
      subscriptions.map(async (subscription) => {
        const chitGroup = await chitGroupModel.getById(subscription.groupId);
        return {
          ...subscription,
          chitGroup
        };
      })
    );

    res.json({
      success: true,
      data: subscriptionsWithDetails,
      count: subscriptionsWithDetails.length
    });
  } catch (error) {
    console.error('Get user subscriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user subscriptions',
      error: error.message
    });
  }
});

// Start a chit group (change status from Upcoming to Active)
router.put('/:groupId/start', verifyFirebaseToken, requireRole(['Admin', 'Manager']), async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const chitGroup = await chitGroupModel.getById(groupId);
    if (!chitGroup) {
      return res.status(404).json({
        success: false,
        message: 'Chit group not found'
      });
    }

    if (chitGroup.status !== 'Upcoming') {
      return res.status(400).json({
        success: false,
        message: 'Chit group is not in Upcoming status'
      });
    }

    if (chitGroup.currentMembers < chitGroup.totalMembers) {
      return res.status(400).json({
        success: false,
        message: 'Chit group is not full yet'
      });
    }

    await chitGroupModel.update(groupId, {
      status: 'Active',
      startDate: new Date()
    });

    res.json({
      success: true,
      message: 'Chit group started successfully'
    });
  } catch (error) {
    console.error('Start chit group error:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting chit group',
      error: error.message
    });
  }
});

module.exports = router;