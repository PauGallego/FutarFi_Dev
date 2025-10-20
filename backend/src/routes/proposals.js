const express = require('express');
const router = express.Router();
const Proposal = require('../models/Proposal');
const OrderBook = require('../models/OrderBook');
const { notifyProposalUpdate } = require('../middleware/websocket');
const { validateProposal } = require('../middleware/validation');

/**
 * @swagger
 * tags:
 *   name: Proposals
 *   description: Proposal management endpoints
 */

/**
 * @swagger
 * /api/proposals:
 *   get:
 *     summary: Get all proposals
 *     tags: [Proposals]
 *     responses:
 *       200:
 *         description: List of all proposals
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Proposal'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', async (req, res) => {
  try {
    const proposals = await Proposal.find().sort({ createdAt: -1 });
    res.json(proposals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/proposals/{id}:
 *   get:
 *     summary: Get proposal by ID
 *     tags: [Proposals]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Proposal ID
 *     responses:
 *       200:
 *         description: Proposal details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Proposal'
 *       404:
 *         description: Proposal not found
 *       500:
 *         description: Server error
 */
router.get('/:id', async (req, res) => {
  try {
    const proposal = await Proposal.findOne({ id: req.params.id });
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    res.json(proposal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/proposals:
 *   post:
 *     summary: Create a new proposal
 *     tags: [Proposals]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Proposal'
 *     responses:
 *       201:
 *         description: Proposal created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Proposal'
 *       400:
 *         description: Invalid proposal data
 *       500:
 *         description: Server error
 */
router.post('/', validateProposal, async (req, res) => {
  try {
    const io = req.app.get('io');
    
    // Calculate startTime and endTime if not provided
    const now = Math.floor(Date.now() / 1000);
    const proposalData = {
      ...req.body,
      startTime: req.body.startTime || now,
      endTime: req.body.endTime || (now + (req.body.duration || 86400))
    };
    
    // Ensure duration is present
    if (!proposalData.duration) {
      proposalData.duration = proposalData.endTime - proposalData.startTime;
    }
    
    const proposal = new Proposal(proposalData);
    await proposal.save();

    // Create order books for both sides
    const approveOrderBook = new OrderBook({
      proposalId: proposal.id,
      side: 'approve',
      bids: [],
      asks: []
    });

    const rejectOrderBook = new OrderBook({
      proposalId: proposal.id,
      side: 'reject',
      bids: [],
      asks: []
    });

    await Promise.all([
      approveOrderBook.save(),
      rejectOrderBook.save()
    ]);

    // Notify clients about new proposal
    if (io) {
      io.emit('new-proposal', {
        proposal,
        timestamp: new Date().toISOString()
      });
    }

    res.status(201).json({
      proposal,
      orderBooks: {
        approve: approveOrderBook,
        reject: rejectOrderBook
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const io = req.app.get('io');
    const proposal = await Proposal.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true }
    );
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Notify clients about proposal update
    if (io) {
      notifyProposalUpdate(io, proposal);
    }

    res.json(proposal);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/stats', async (req, res) => {
  try {
    const proposal = await Proposal.findOne({ id: req.params.id });
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Get order books
    const orderBooks = await OrderBook.find({ proposalId: req.params.id });
    const approveBook = orderBooks.find(ob => ob.side === 'approve');
    const rejectBook = orderBooks.find(ob => ob.side === 'reject');

    // Calculate total volumes
    const approveTotalBids = approveBook ? approveBook.bids.reduce((total, bid) => total + BigInt(bid.amount), BigInt(0)) : BigInt(0);
    const approveTotalAsks = approveBook ? approveBook.asks.reduce((total, ask) => total + BigInt(ask.amount), BigInt(0)) : BigInt(0);
    const rejectTotalBids = rejectBook ? rejectBook.bids.reduce((total, bid) => total + BigInt(bid.amount), BigInt(0)) : BigInt(0);
    const rejectTotalAsks = rejectBook ? rejectBook.asks.reduce((total, ask) => total + BigInt(ask.amount), BigInt(0)) : BigInt(0);

    // Get 24h volumes
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const approveVolume24h = await get24hVolume(req.params.id, 'approve');
    const rejectVolume24h = await get24hVolume(req.params.id, 'reject');

    // Get price changes
    const approvePriceChange24h = await get24hPriceChange(req.params.id, 'approve');
    const rejectPriceChange24h = await get24hPriceChange(req.params.id, 'reject');

    // Get last prices
    const approveLastPrice = await getLastTradePrice(req.params.id, 'approve');
    const rejectLastPrice = await getLastTradePrice(req.params.id, 'reject');

    res.json({
      proposal,
      statistics: {
        approve: {
          lastPrice: approveLastPrice || '0',
          volume24h: approveVolume24h || '0',
          priceChange24h: approvePriceChange24h || '0',
          totalBids: approveTotalBids.toString(),
          totalAsks: approveTotalAsks.toString(),
          spread: approveBook ? calculateSpread(approveBook.bids, approveBook.asks) : '0'
        },
        reject: {
          lastPrice: rejectLastPrice || '0',
          volume24h: rejectVolume24h || '0',
          priceChange24h: rejectPriceChange24h || '0',
          totalBids: rejectTotalBids.toString(),
          totalAsks: rejectTotalAsks.toString(),
          spread: rejectBook ? calculateSpread(rejectBook.bids, rejectBook.asks) : '0'
        },
        totalVolume24h: (BigInt(approveVolume24h || '0') + BigInt(rejectVolume24h || '0')).toString(),
        isActive: proposal.isActive && Date.now() < proposal.endTime * 1000,
        timeRemaining: Math.max(0, proposal.endTime * 1000 - Date.now())
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/with-market-data', async (req, res) => {
  try {
    const { limit = 20, offset = 0, sortBy = 'createdAt', order = 'desc' } = req.query;
    
    const proposals = await Proposal.find()
      .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit));

    const proposalsWithMarketData = await Promise.all(
      proposals.map(async (proposal) => {
        const orderBooks = await OrderBook.find({ proposalId: proposal.id });
        const approveBook = orderBooks.find(ob => ob.side === 'approve');
        const rejectBook = orderBooks.find(ob => ob.side === 'reject');

        const approveLastPrice = await getLastTradePrice(proposal.id, 'approve');
        const rejectLastPrice = await getLastTradePrice(proposal.id, 'reject');
        const approveVolume24h = await get24hVolume(proposal.id, 'approve');
        const rejectVolume24h = await get24hVolume(proposal.id, 'reject');

        return {
          ...proposal.toObject(),
          marketData: {
            approve: {
              lastPrice: approveLastPrice || '0',
              volume24h: approveVolume24h || '0',
              bidCount: approveBook ? approveBook.bids.length : 0,
              askCount: approveBook ? approveBook.asks.length : 0
            },
            reject: {
              lastPrice: rejectLastPrice || '0',
              volume24h: rejectVolume24h || '0',
              bidCount: rejectBook ? rejectBook.bids.length : 0,
              askCount: rejectBook ? rejectBook.asks.length : 0
            },
            totalVolume24h: (BigInt(approveVolume24h || '0') + BigInt(rejectVolume24h || '0')).toString(),
            isActive: proposal.isActive && Date.now() < proposal.endTime * 1000
          }
        };
      })
    );

    res.json(proposalsWithMarketData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper functions (if not already imported)
async function getLastTradePrice(proposalId, side) {
  const Order = require('../models/Order');
  const lastOrder = await Order.findOne({
    proposalId,
    side,
    status: { $in: ['filled', 'partial'] },
    filledAmount: { $gt: '0' }
  }).sort({ updatedAt: -1 });

  return lastOrder ? lastOrder.price : null;
}

async function get24hVolume(proposalId, side) {
  const Order = require('../models/Order');
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const orders = await Order.find({
    proposalId,
    side,
    updatedAt: { $gte: yesterday },
    filledAmount: { $gt: '0' }
  });

  let totalVolume = BigInt(0);
  orders.forEach(order => {
    totalVolume += BigInt(order.filledAmount);
  });

  return totalVolume.toString();
}

async function get24hPriceChange(proposalId, side) {
  const Order = require('../models/Order');
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const oldestOrder = await Order.findOne({
    proposalId,
    side,
    updatedAt: { $gte: yesterday },
    filledAmount: { $gt: '0' }
  }).sort({ updatedAt: 1 });

  const newestOrder = await Order.findOne({
    proposalId,
    side,
    filledAmount: { $gt: '0' }
  }).sort({ updatedAt: -1 });

  if (!oldestOrder || !newestOrder) return '0';

  const oldPrice = parseFloat(oldestOrder.price);
  const newPrice = parseFloat(newestOrder.price);
  
  if (oldPrice === 0) return '0';
  
  const change = ((newPrice - oldPrice) / oldPrice) * 100;
  return change.toFixed(2);
}

function calculateSpread(bids, asks) {
  if (bids.length === 0 || asks.length === 0) return '0';
  
  const highestBid = parseFloat(bids[0].price);
  const lowestAsk = parseFloat(asks[0].price);
  
  if (lowestAsk === 0) return '0';
  
  const spread = ((lowestAsk - highestBid) / lowestAsk) * 100;
  return spread.toFixed(4);
}

module.exports = router;
