const express = require('express');
const router = express.Router();
const Proposal = require('../models/Proposal');

// GET /api/proposals
// Get all proposals with optional filtering
router.get('/', async (req, res) => {
  try {
    const { 
      admin, 
      status, 
      limit = 50, 
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    // Build query
    const query = {};
    if (admin) {
      query.admin = admin.toLowerCase();
    }
    if (status) {
      query.status = status;
    }
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const proposals = await Proposal.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip(parseInt(offset));
    
    const total = await Proposal.countDocuments(query);
    
    res.json({
      proposals,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      }
    });
    
  } catch (error) {
    console.error('Error fetching proposals:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET /api/proposals/:proposalId
// Get a specific proposal by ID
router.get('/:proposalId', async (req, res) => {
  try {
    const proposalId = parseInt(req.params.proposalId);
    
    if (isNaN(proposalId)) {
      return res.status(400).json({
        error: 'Invalid proposal ID'
      });
    }
    
    const proposal = await Proposal.findOne({ proposalId });
    
    if (!proposal) {
      return res.status(404).json({
        error: 'Proposal not found',
        proposalId
      });
    }
    
    res.json(proposal);
    
  } catch (error) {
    console.error('Error fetching proposal:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET /api/proposals/:proposalId/prices
// Get price history for a specific proposal
router.get('/:proposalId/prices', async (req, res) => {
  try {
    const proposalId = parseInt(req.params.proposalId);
    const { limit = 100, timeframe = '24h' } = req.query;
    
    if (isNaN(proposalId)) {
      return res.status(400).json({
        error: 'Invalid proposal ID'
      });
    }
    
    const proposal = await Proposal.findOne({ proposalId });
    
    if (!proposal) {
      return res.status(404).json({
        error: 'Proposal not found',
        proposalId
      });
    }
    
    // Filter price history based on timeframe
    let sinceDate = new Date();
    switch (timeframe) {
      case '1h':
        sinceDate.setHours(sinceDate.getHours() - 1);
        break;
      case '24h':
        sinceDate.setHours(sinceDate.getHours() - 24);
        break;
      case '7d':
        sinceDate.setDate(sinceDate.getDate() - 7);
        break;
      case 'all':
        sinceDate = new Date(0);
        break;
      default:
        sinceDate.setHours(sinceDate.getHours() - 24);
    }
    
    const filteredHistory = proposal.priceHistory
      .filter(entry => entry.timestamp >= sinceDate)
      .slice(-parseInt(limit))
      .sort((a, b) => a.timestamp - b.timestamp);
    
    res.json({
      proposalId,
      priceHistory: filteredHistory,
      currentPrices: {
        approve: proposal.currentApprovePrice,
        reject: proposal.currentRejectPrice
      },
      timeframe,
      count: filteredHistory.length
    });
    
  } catch (error) {
    console.error('Error fetching price history:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;
