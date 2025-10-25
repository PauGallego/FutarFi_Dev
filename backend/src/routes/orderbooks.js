const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const OrderBook = require('../models/OrderBook');
const Proposal = require('../models/Proposal');
const { verifyWalletSignature, requireWalletAddress } = require('../middleware/walletAuth');
const { 
  notifyOrderBookUpdate, 
  notifyNewOrder, 
  notifyOrderStatusChange,
  notifyOrderMatched,
  notifyMarketData,
  notifyUserOrdersUpdate
} = require('../middleware/websocket');
const PriceHistory = require('../models/PriceHistory');
const TWAP = require('../models/TWAP');
const { ethers } = require('ethers');
const { getProvider } = require('../config/ethers');
// New: chain apply-batch service
const { submitFillToChain } = require('../services/applyBatchService');


// Minimal ERC20 ABI for balance/decimals
const ERC20_MIN_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

function normalizeSide(side) { if (side === 'yes') return 'approve'; if (side === 'no') return 'reject'; return side; }
function isValidSide(side) { return ['approve', 'reject'].includes(side); }
function isValidOrderType(orderType) { return ['buy', 'sell'].includes(orderType); }
function isValidOrderExecution(orderExecution) { return ['limit', 'market'].includes(orderExecution); }
function sendError(res, status, message) { return res.status(status).json({ error: message }); }
function sideToKey(side) { return side === 'approve' ? 'yes' : 'no'; }

async function getBestSellPrice(proposalId, side) {
  try {
    const sells = await Order.find({
      proposalId,
      side,
      orderType: 'sell',
      status: { $in: ['open', 'partial'] }
    }).select('price').lean();
    if (!sells || sells.length === 0) return null;
    const min = sells.reduce((m, o) => Math.min(m, Number(o.price || 0)), Number.POSITIVE_INFINITY);
    return Number.isFinite(min) ? String(min) : null;
  } catch (_) { return null; }
}

async function ensureSufficientBalance({ proposal, proposalId, side, orderType, orderExecution, price, amount, userAddress }) {
  const provider = getProvider();
  if (!proposal || !proposal.auctions) {
    throw new Error('Proposal data missing token addresses. Try again shortly.');
  }

  const key = sideToKey(side);
  const tokenAddr = proposal?.auctions?.[key]?.marketToken;
  const pyusdAddr = proposal?.auctions?.yes?.pyusd || proposal?.auctions?.no?.pyusd;

  if (!tokenAddr || !pyusdAddr) {
    throw new Error('Token addresses not available for this proposal yet');
  }

  const token = new ethers.Contract(tokenAddr, ERC20_MIN_ABI, provider);
  const pyusd = new ethers.Contract(pyusdAddr, ERC20_MIN_ABI, provider);

  const [tokenDec, pyusdDec] = await Promise.all([
    token.decimals().catch(() => 18),
    pyusd.decimals().catch(() => 18)
  ]);

  // SELL: user must have enough market tokens
  if (orderType === 'sell') {
    const requiredToken = ethers.parseUnits(String(amount), Number(tokenDec));
    const userTokenBal = await token.balanceOf(userAddress).catch(() => 0n);
    if (userTokenBal < requiredToken) {
      const need = ethers.formatUnits(requiredToken, Number(tokenDec));
      const have = ethers.formatUnits(userTokenBal, Number(tokenDec));
      throw new Error(`Insufficient market token balance. Required: ${need}, Available: ${have}`);
    }
    return; // sell check done
  }

  // BUY: user must have enough PYUSD for price*amount
  // Determine effective price: use provided price; for market order, try best sell price
  let effectivePrice = price;
  if ((!effectivePrice || Number(effectivePrice) <= 0) && orderExecution === 'market') {
    effectivePrice = await getBestSellPrice(proposalId, side);
  }

  if (!effectivePrice || Number(effectivePrice) <= 0) {
    // If we still don't have a price (e.g., empty order book), skip strict check
    // but ensure the user has a positive PYUSD balance
    const bal = await pyusd.balanceOf(userAddress).catch(() => 0n);
    if (bal <= 0n) throw new Error('Insufficient PYUSD balance');
    return;
  }

  const priceUnits = ethers.parseUnits(String(effectivePrice), Number(pyusdDec));
  const amountUnits = ethers.parseUnits(String(amount), Number(tokenDec));
  const scale = 10n ** BigInt(Number(tokenDec));
  const requiredPyusd = (priceUnits * amountUnits) / scale;
  const userPyusdBal = await pyusd.balanceOf(userAddress).catch(() => 0n);

  if (userPyusdBal < requiredPyusd) {
    const need = ethers.formatUnits(requiredPyusd, Number(pyusdDec));
    const have = ethers.formatUnits(userPyusdBal, Number(pyusdDec));
    throw new Error(`Insufficient PYUSD balance. Required: ${need}, Available: ${have}`);
  }
}

/**
 * @swagger
 * tags:
 *   name: Orderbooks
 *   description: Order book and trading endpoints
 */

// ===== PUBLIC MARKET DATA ENDPOINTS =====

/**
 * @swagger
 * /api/orderbooks/{proposalId}/{side}/market-data:
 *   get:
 *     summary: Get public market data (price, volume, TWAP only)
 *     description: Returns aggregated market data without exposing individual orders
 *     tags: [Orderbooks]
 *     parameters:
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: side
 *         required: true
 *         schema:
 *           type: string
 *           enum: [approve, reject]
 *     responses:
 *       200:
 *         description: Public market data
 */
router.get('/:proposalId/:side/market-data', async (req, res) => {
  try {
    const { proposalId } = req.params;
    let { side } = req.params;
    side = normalizeSide(side);
    if (!isValidSide(side)) return sendError(res, 400, 'Invalid side. Must be approve or reject');

    const orderBook = await OrderBook.findOne({ proposalId, side });
    if (!orderBook) {
      return res.json({
        proposalId,
        side,
        lastPrice: '0',
        volume24h: '0',
        high24h: '0',
        low24h: '0',
        priceChange24h: '0',
        priceChangePercent24h: '0',
        twap1h: '0',
        twap4h: '0',
        twap24h: '0',
        twapLastUpdate: null,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      proposalId,
      side,
      lastPrice: orderBook.lastPrice || '0',
      volume24h: orderBook.volume24h || '0',
      high24h: orderBook.high24h || '0',
      low24h: orderBook.low24h || '0',
      priceChange24h: orderBook.priceChange24h || '0',
      priceChangePercent24h: orderBook.priceChangePercent24h || '0',
      twap1h: orderBook?.twap1h || '0',
      twap4h: orderBook?.twap4h || '0',
      twap24h: orderBook?.twap24h || '0',
      twapLastUpdate: orderBook?.twapLastUpdate || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    sendError(res, 500, error.message);
  }
});

/**
 * @swagger
 * /api/orderbooks/{proposalId}/{side}/twap:
 *   get:
 *     summary: Get TWAP data
 *     description: Time-weighted average price data
 *     tags: [Orderbooks]
 *     parameters:
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: side
 *         required: true
 *         schema:
 *           type: string
 *           enum: [approve, reject]
 *     responses:
 *       200:
 *         description: TWAP data
 */
router.get('/:proposalId/:side/twap', async (req, res) => {
  try {
    const { proposalId } = req.params;
    let { side } = req.params;
    side = normalizeSide(side);
    if (!isValidSide(side)) return sendError(res, 400, 'Invalid side. Must be approve or reject');

    const orderBook = await OrderBook.findOne({ proposalId, side });
    res.json({
      proposalId,
      side,
      twap1h: orderBook?.twap1h || '0',
      twap4h: orderBook?.twap4h || '0',
      twap24h: orderBook?.twap24h || '0',
      lastUpdate: orderBook?.twapLastUpdate || orderBook?.updatedAt,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    sendError(res, 500, error.message);
  }
});

/**
 * @swagger
 * /api/orderbooks/{proposalId}/{side}/twap/history:
 *   get:
 *     summary: Get TWAP history data
 *     description: Time-weighted average price data for a range of timestamps
 *     tags: [Orderbooks]
 *     parameters:
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: side
 *         required: true
 *         schema:
 *           type: string
 *           enum: [approve, reject]
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [1m, 5m, 15m, 1h, 4h, 1d, 1w, 1M, all]
 *           default: 1h
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: TWAP history data
 */
router.get('/:proposalId/:side/twap/history', async (req, res) => {
  try {
    const { proposalId } = req.params;
    let { side } = req.params;
    const { timeframe = '1m', limit = 300, from, to } = req.query;
    side = normalizeSide(side);
    if (!isValidSide(side)) return sendError(res, 400, 'Invalid side. Must be approve or reject');

    let tf = String(timeframe);
    if (tf === '24h') tf = '1d';
    if (tf === '1mo') tf = '1M';

    const allowed = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M', 'all'];
    if (!allowed.includes(tf)) {
      return sendError(res, 400, `Invalid timeframe. Allowed: ${allowed.join(', ')}`);
    }

    const filter = { proposalId, side, timeframe: tf };
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(isNaN(from) ? from : Number(from));
      if (to) filter.timestamp.$lte = new Date(isNaN(to) ? to : Number(to));
    }

    const items = await TWAP.find(filter)
      .sort({ timestamp: 1 })
      .limit(parseInt(limit));

    res.json({ proposalId, side, timeframe: tf, count: items.length, items });
  } catch (error) {
    sendError(res, 500, error.message);
  }
});

/**
 * @swagger
 * /api/orderbooks/{proposalId}/{side}/candles:
 *   get:
 *     summary: Get candlestick data
 *     description: Price history in candlestick format
 *     tags: [Orderbooks]
 *     parameters:
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: side
 *         required: true
 *         schema:
 *           type: string
 *           enum: [approve, reject]
 *       - in: query
 *         name: interval
 *         schema:
 *           type: string
 *           enum: [1m, 5m, 15m, 1h, 4h, 1d]
 *           default: 1h
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *     responses:
 *       200:
 *         description: Candlestick data
 */
router.get('/:proposalId/:side/candles', async (req, res) => {
  try {
    const { proposalId } = req.params;
    let { side } = req.params;
    const { interval = '1h', limit = 100 } = req.query;
    side = normalizeSide(side);
    if (!isValidSide(side)) return sendError(res, 400, 'Invalid side. Must be approve or reject');

    const intervalMs = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    }[interval];

    if (!intervalMs) {
      return sendError(res, 400, 'Invalid interval');
    }

    const priceData = await PriceHistory.find({
      proposalId,
      side,
      timestamp: { $gte: new Date(Date.now() - parseInt(limit) * intervalMs) }
    }).sort({ timestamp: 1 });

    const candles = [];
    let currentTime = Date.now() - parseInt(limit) * intervalMs;
    for (let i = 0; i < parseInt(limit); i++) {
      const candleStart = new Date(currentTime);
      const candleEnd = new Date(currentTime + intervalMs);
      const candleData = priceData.filter(data => data.timestamp >= candleStart && data.timestamp < candleEnd);
      if (candleData.length > 0) {
        const prices = candleData.map(d => parseFloat(d.price));
        candles.push({
          timestamp: candleStart.toISOString(),
          open: prices[0],
          high: Math.max(...prices),
          low: Math.min(...prices),
          close: prices[prices.length - 1],
          volume: candleData.reduce((sum, d) => sum + parseFloat(d.volume), 0)
        });
      }
      currentTime += intervalMs;
    }

    res.json({ proposalId, side, interval, candles });
  } catch (error) {
    sendError(res, 500, error.message);
  }
});

/**
 * @swagger
 * /api/orderbooks/{proposalId}/{side}/orders:
 *   post:
 *     summary: Create order (requires wallet signature)
 *     description: Creates a new order. User must provide wallet signature for authentication.
 *     tags: [Orderbooks]
 *     security:
 *       - WalletSignature: []
 *     parameters:
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: side
 *         required: true
 *         schema:
 *           type: string
 *           enum: [approve, reject]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address, signature, message, timestamp, orderType, price, amount]
 *             properties:
 *               address:
 *                 type: string
 *                 description: Wallet address
 *               signature:
 *                 type: string
 *                 description: Wallet signature
 *               message:
 *                 type: string
 *                 description: Signed message
 *               timestamp:
 *                 type: number
 *                 description: Message timestamp
 *               orderType:
 *                 type: string
 *                 enum: [buy, sell]
 *               price:
 *                 type: number
 *               amount:
 *                 type: number
 *     responses:
 *       201:
 *         description: Order created successfully
 *       401:
 *         description: Invalid wallet signature
 */
router.post('/:proposalId/:side/orders', verifyWalletSignature, async (req, res) => {
  try {
    const { proposalId, side } = req.params;
    const { orderType, orderExecution = 'limit', price, amount } = req.body;
    const userAddress = req.userAddress; // From wallet authentication
    const io = req.app.get('io');

    // Validate inputs
    if (!proposalId) {
      return res.status(400).json({ error: 'Proposal ID is required' });
    }

    if (!userAddress) {
      return res.status(401).json({ error: 'User address not found in authentication' });
    }

    if (!['approve', 'reject'].includes(side)) {
      return res.status(400).json({ error: 'Invalid side. Must be approve or reject' });
    }

    if (!['buy', 'sell'].includes(orderType)) {
      return res.status(400).json({ error: 'Invalid orderType. Must be buy or sell' });
    }

    if (!['limit', 'market'].includes(orderExecution)) {
      return res.status(400).json({ error: 'Invalid orderExecution. Must be limit or market' });
    }

    // Verify that the proposal exists using on-chain contract id (string)
    const proposal = await Proposal.findOne({ proposalContractId: proposalId });
    if (!proposal) {
      return res.status(404).json({ error: `Proposal with id ${proposalId} not found` });
    }

    // Check if proposal has required fields
    if (!proposal.id || !proposal.admin) {
      return res.status(400).json({ error: 'Proposal data is incomplete' });
    }

    // Check if proposal is active
    if (!proposal.isActive) {
      return res.status(400).json({ error: 'Proposal is not active for trading' });
    }

    // For market orders, price is not required but we'll calculate it
    if (orderExecution === 'limit' && (!price || parseFloat(price) <= 0)) {
      return res.status(400).json({ error: 'Price required for limit orders and must be greater than 0' });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Amount is required and must be greater than 0' });
    }

    // NEW: Balance checks based on proposal-specific token addresses
    try {
      await ensureSufficientBalance({
        proposal,
        proposalId,
        side,
        orderType,
        orderExecution,
        price,
        amount,
        userAddress
      });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    const order = new Order({
      proposalId,
      side,
      orderType,
      orderExecution,
      price: price?.toString() || '0',
      amount: amount.toString(),
      userAddress,
      filledAmount: '0',
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await order.save();

    if (!order || !order._id) {
      return res.status(500).json({ error: 'Failed to create order' });
    }

    // NEW: notify this user that their orders changed
    try { if (io) notifyUserOrdersUpdate(io, userAddress, { reason: 'order-created', changedOrderId: order._id.toString() }); } catch (e) {}

    // Update order book (with error handling)
    try {
      await updateOrderBook(proposalId, side, io);
    } catch (updateError) {
      console.error('Error updating order book after creation:', updateError);
      // Don't fail the whole operation if order book update fails
    }

    // Execute order if it's a market order or if there are matching orders (with error handling)
    try {
      await executeOrder(order, io);
      
      // Also try to execute existing orders that might now have a match
      const existingOrders = await Order.find({
        proposalId: order.proposalId,
        side: order.side,
        orderType: order.orderType === 'buy' ? 'sell' : 'buy', // Opposite type
        status: 'open',
        _id: { $ne: order._id } // Exclude the order we just created
      }).sort({ createdAt: 1 }); // Oldest first
      
      console.log(`Found ${existingOrders.length} existing orders to re-check for matching`);
      
      for (const existingOrder of existingOrders) {
        try {
          await executeOrder(existingOrder, io);
        } catch (existingExecuteError) {
          console.error('Error executing existing order:', existingExecuteError);
        }
      }
    } catch (executeError) {
      console.error('Error executing order:', executeError);
      // Don't fail the whole operation if order execution fails
    }

    // Notify clients (with error handling)
    try {
      if (io && typeof notifyNewOrder === 'function') {
        notifyNewOrder(io, order);
      }
    } catch (notifyError) {
      console.error('Error notifying new order:', notifyError);
      // Don't fail the whole operation if notification fails
    }

    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/orderbooks/orders/{orderId}:
 *   delete:
 *     summary: Cancel order (requires wallet signature)
 *     description: Cancels an order. Only the order creator can cancel it.
 *     tags: [Orderbooks]
 *     security:
 *       - WalletSignature: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address, signature, message, timestamp]
 *             properties:
 *               address:
 *                 type: string
 *               signature:
 *                 type: string
 *               message:
 *                 type: string
 *               timestamp:
 *                 type: number
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 *       401:
 *         description: Invalid wallet signature
 *       403:
 *         description: Not authorized to cancel this order
 *       404:
 *         description: Order not found
 */
router.delete('/orders/:orderId', verifyWalletSignature, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userAddress = req.userAddress;
    const io = req.app.get('io');

    if (!orderId) return sendError(res, 400, 'Order ID is required');
    if (!userAddress) return sendError(res, 401, 'User address not found in authentication');

    const existingOrder = await Order.findById(orderId);
    if (!existingOrder) return sendError(res, 404, 'Order not found');
    if (!existingOrder.userAddress) return sendError(res, 400, 'Order userAddress is missing');
    if (!existingOrder.proposalId || !existingOrder.side) return sendError(res, 400, 'Order data is incomplete');
    if (existingOrder.userAddress.toLowerCase() !== userAddress.toLowerCase()) return sendError(res, 403, 'Not authorized to cancel this order');
    if (existingOrder.status === 'cancelled') return sendError(res, 400, 'Order is already cancelled');
    if (existingOrder.status === 'filled') return sendError(res, 400, 'Cannot cancel a filled order');

    const order = await Order.findByIdAndUpdate(orderId, { status: 'cancelled', updatedAt: new Date() }, { new: true });
    if (!order) return sendError(res, 500, 'Failed to update order status');

    try { if (io) notifyUserOrdersUpdate(io, order.userAddress, { reason: 'order-cancelled', changedOrderId: order._id.toString() }); } catch (e) {}
    try { await updateOrderBook(order.proposalId, order.side, io); } catch (updateError) { console.error('Error updating order book after cancellation:', updateError); }
    try { if (io && typeof notifyOrderStatusChange === 'function') { notifyOrderStatusChange(io, order, 'cancelled'); } } catch (notifyError) { console.error('Error notifying order status change:', notifyError); }

    res.json(order);
  } catch (error) {
    console.error('Error cancelling order:', error);
    sendError(res, 500, error.message);
  }
});

/**
 * @swagger
 * /api/orderbooks/my-orders:
 *   post:
 *     summary: Get my orders (requires wallet signature)
 *     description: Get all orders for the authenticated user
 *     tags: [Orderbooks]
 *     security:
 *       - WalletSignature: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address, signature, message, timestamp]
 *             properties:
 *               address:
 *                 type: string
 *               signature:
 *                 type: string
 *               message:
 *                 type: string
 *               timestamp:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [open, filled, cancelled, partial]
 *               proposalId:
 *                 type: string
 *     responses:
 *       200:
 *         description: User orders
 *       401:
 *         description: Authentication required
 */
router.post('/my-orders', verifyWalletSignature, async (req, res) => {
  try {
    const { status, proposalId } = req.body;
    const filter = { userAddress: req.userAddress };
    
    if (status) filter.status = status;
    if (proposalId) filter.proposalId = proposalId;
    
    const orders = await Order.find(filter).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/orderbooks/my-orders/{proposalId}:
 *   post:
 *     summary: Get my orders for specific proposal (requires wallet signature)
 *     tags: [Orderbooks]
 *     security:
 *       - WalletSignature: []
 *     parameters:
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address, signature, message, timestamp]
 *             properties:
 *               address:
 *                 type: string
 *               signature:
 *                 type: string
 *               message:
 *                 type: string
 *               timestamp:
 *                 type: number
 *     responses:
 *       200:
 *         description: User orders for proposal
 */
router.post('/my-orders/:proposalId', verifyWalletSignature, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const orders = await Order.find({ 
      userAddress: req.userAddress,
      proposalId 
    }).sort({ createdAt: -1 });
    
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/orderbooks/my-trades:
 *   post:
 *     summary: Get my trading history (requires wallet signature)
 *     tags: [Orderbooks]
 *     security:
 *       - WalletSignature: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address, signature, message, timestamp]
 *             properties:
 *               address:
 *                 type: string
 *               signature:
 *                 type: string
 *               message:
 *                 type: string
 *               timestamp:
 *                 type: number
 *     responses:
 *       200:
 *         description: User trading history
 */
router.post('/my-trades', verifyWalletSignature, async (req, res) => {
  try {
    const trades = await Order.find({ 
      userAddress: req.userAddress,
      status: { $in: ['filled', 'partial'] }
    }).sort({ updatedAt: -1 });
    
    res.json(trades);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/orderbooks/{proposalId}/{side}/orders:
 *   get:
 *     summary: Get public list of open/partial orders (addresses redacted)
 *     description: Returns orders with status open or partial for the given proposal and side. User addresses are not included.
 *     tags: [Orderbooks]
 *     parameters:
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: side
 *         required: true
 *         schema:
 *           type: string
 *           enum: [approve, reject, yes, no]
 *     responses:
 *       200:
 *         description: List of orders
 */
router.get('/:proposalId/:side/orders', async (req, res) => {
  try {
    const { proposalId } = req.params;
    let { side } = req.params;

    // Normalize yes/no to approve/reject
    if (side === 'yes') side = 'approve';
    if (side === 'no') side = 'reject';

    if (!['approve', 'reject'].includes(side)) {
      return res.status(400).json({ error: 'Invalid side. Must be approve/reject (or yes/no alias)' });
    }

    // Verify proposal exists using on-chain contract id (string)
    const proposal = await Proposal.findOne({ proposalContractId: proposalId });
    if (!proposal) {
      return res.status(404).json({ error: `Proposal with id ${proposalId} not found` });
    }

    const raw = await Order.find({
      proposalId,
      side,
      status: { $in: ['open', 'partial'] }
    })
      .sort({ createdAt: -1 })
      .select('-userAddress -txHash -__v -_id -fills.matchedOrderId')
      .lean();

    // Sanitize nested fills and remove any subdocument _id
    const orders = raw.map(o => ({
      ...o,
      fills: Array.isArray(o.fills)
        ? o.fills.map(f => ({ price: f.price, amount: f.amount, timestamp: f.timestamp }))
        : []
    }));

    res.json({ proposalId, side, count: orders.length, orders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PROTECTED ENDPOINTS (REQUIRE WALLET SIGNATURE) =====

/**
 * @swagger
 * /api/orderbooks/{proposalId}/{side}/orders:
 *   post:
 *     summary: Create order (requires wallet signature)
 *     description: Creates a new order. User must provide wallet signature for authentication.
 *     tags: [Orderbooks]
 *     security:
 *       - WalletSignature: []
 *     parameters:
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: side
 *         required: true
 *         schema:
 *           type: string
 *           enum: [approve, reject]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address, signature, message, timestamp, orderType, price, amount]
 *             properties:
 *               address:
 *                 type: string
 *                 description: Wallet address
 *               signature:
 *                 type: string
 *                 description: Wallet signature
 *               message:
 *                 type: string
 *                 description: Signed message
 *               timestamp:
 *                 type: number
 *                 description: Message timestamp
 *               orderType:
 *                 type: string
 *                 enum: [buy, sell]
 *               price:
 *                 type: number
 *               amount:
 *                 type: number
 *     responses:
 *       201:
 *         description: Order created successfully
 *       401:
 *         description: Invalid wallet signature
 */
router.post('/:proposalId/:side/orders', verifyWalletSignature, async (req, res) => {
  try {
    const { proposalId, side } = req.params;
    const { orderType, orderExecution = 'limit', price, amount } = req.body;
    const userAddress = req.userAddress; // From wallet authentication
    const io = req.app.get('io');

    // Validate inputs
    if (!proposalId) {
      return res.status(400).json({ error: 'Proposal ID is required' });
    }

    if (!userAddress) {
      return res.status(401).json({ error: 'User address not found in authentication' });
    }

    if (!['approve', 'reject'].includes(side)) {
      return res.status(400).json({ error: 'Invalid side. Must be approve or reject' });
    }

    if (!['buy', 'sell'].includes(orderType)) {
      return res.status(400).json({ error: 'Invalid orderType. Must be buy or sell' });
    }

    if (!['limit', 'market'].includes(orderExecution)) {
      return res.status(400).json({ error: 'Invalid orderExecution. Must be limit or market' });
    }

    // Verify that the proposal exists using on-chain contract id (string)
    const proposal = await Proposal.findOne({ proposalContractId: proposalId });
    if (!proposal) {
      return res.status(404).json({ error: `Proposal with id ${proposalId} not found` });
    }

    // Check if proposal has required fields
    if (!proposal.id || !proposal.admin) {
      return res.status(400).json({ error: 'Proposal data is incomplete' });
    }

    // Check if proposal is active
    if (!proposal.isActive) {
      return res.status(400).json({ error: 'Proposal is not active for trading' });
    }

    // For market orders, price is not required but we'll calculate it
    if (orderExecution === 'limit' && (!price || parseFloat(price) <= 0)) {
      return res.status(400).json({ error: 'Price required for limit orders and must be greater than 0' });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Amount is required and must be greater than 0' });
    }

    // NEW: Balance checks based on proposal-specific token addresses
    try {
      await ensureSufficientBalance({
        proposal,
        proposalId,
        side,
        orderType,
        orderExecution,
        price,
        amount,
        userAddress
      });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    const order = new Order({
      proposalId,
      side,
      orderType,
      orderExecution,
      price: price?.toString() || '0',
      amount: amount.toString(),
      userAddress,
      filledAmount: '0',
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await order.save();

    if (!order || !order._id) {
      return res.status(500).json({ error: 'Failed to create order' });
    }

    // NEW: notify this user that their orders changed
    try { if (io) notifyUserOrdersUpdate(io, userAddress, { reason: 'order-created', changedOrderId: order._id.toString() }); } catch (e) {}

    // Update order book (with error handling)
    try {
      await updateOrderBook(proposalId, side, io);
    } catch (updateError) {
      console.error('Error updating order book after creation:', updateError);
      // Don't fail the whole operation if order book update fails
    }

    // Execute order if it's a market order or if there are matching orders (with error handling)
    try {
      await executeOrder(order, io);
      
      // Also try to execute existing orders that might now have a match
      const existingOrders = await Order.find({
        proposalId: order.proposalId,
        side: order.side,
        orderType: order.orderType === 'buy' ? 'sell' : 'buy', // Opposite type
        status: 'open',
        _id: { $ne: order._id } // Exclude the order we just created
      }).sort({ createdAt: 1 }); // Oldest first
      
      console.log(`Found ${existingOrders.length} existing orders to re-check for matching`);
      
      for (const existingOrder of existingOrders) {
        try {
          await executeOrder(existingOrder, io);
        } catch (existingExecuteError) {
          console.error('Error executing existing order:', existingExecuteError);
        }
      }
    } catch (executeError) {
      console.error('Error executing order:', executeError);
      // Don't fail the whole operation if order execution fails
    }

    // Notify clients (with error handling)
    try {
      if (io && typeof notifyNewOrder === 'function') {
        notifyNewOrder(io, order);
      }
    } catch (notifyError) {
      console.error('Error notifying new order:', notifyError);
      // Don't fail the whole operation if notification fails
    }

    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/orderbooks/orders/{orderId}:
 *   delete:
 *     summary: Cancel order (requires wallet signature)
 *     description: Cancels an order. Only the order creator can cancel it.
 *     tags: [Orderbooks]
 *     security:
 *       - WalletSignature: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address, signature, message, timestamp]
 *             properties:
 *               address:
 *                 type: string
 *               signature:
 *                 type: string
 *               message:
 *                 type: string
 *               timestamp:
 *                 type: number
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 *       401:
 *         description: Invalid wallet signature
 *       403:
 *         description: Not authorized to cancel this order
 *       404:
 *         description: Order not found
 */
router.delete('/orders/:orderId', verifyWalletSignature, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userAddress = req.userAddress;
    const io = req.app.get('io');

    if (!orderId) return sendError(res, 400, 'Order ID is required');
    if (!userAddress) return sendError(res, 401, 'User address not found in authentication');

    const existingOrder = await Order.findById(orderId);
    if (!existingOrder) return sendError(res, 404, 'Order not found');
    if (!existingOrder.userAddress) return sendError(res, 400, 'Order userAddress is missing');
    if (!existingOrder.proposalId || !existingOrder.side) return sendError(res, 400, 'Order data is incomplete');
    if (existingOrder.userAddress.toLowerCase() !== userAddress.toLowerCase()) return sendError(res, 403, 'Not authorized to cancel this order');
    if (existingOrder.status === 'cancelled') return sendError(res, 400, 'Order is already cancelled');
    if (existingOrder.status === 'filled') return sendError(res, 400, 'Cannot cancel a filled order');

    const order = await Order.findByIdAndUpdate(orderId, { status: 'cancelled', updatedAt: new Date() }, { new: true });
    if (!order) return sendError(res, 500, 'Failed to update order status');

    try { if (io) notifyUserOrdersUpdate(io, order.userAddress, { reason: 'order-cancelled', changedOrderId: order._id.toString() }); } catch (e) {}
    try { await updateOrderBook(order.proposalId, order.side, io); } catch (updateError) { console.error('Error updating order book after cancellation:', updateError); }
    try { if (io && typeof notifyOrderStatusChange === 'function') { notifyOrderStatusChange(io, order, 'cancelled'); } } catch (notifyError) { console.error('Error notifying order status change:', notifyError); }

    res.json(order);
  } catch (error) {
    console.error('Error cancelling order:', error);
    sendError(res, 500, error.message);
  }
});

/**
 * @swagger
 * /api/orderbooks/my-orders:
 *   post:
 *     summary: Get my orders (requires wallet signature)
 *     description: Get all orders for the authenticated user
 *     tags: [Orderbooks]
 *     security:
 *       - WalletSignature: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address, signature, message, timestamp]
 *             properties:
 *               address:
 *                 type: string
 *               signature:
 *                 type: string
 *               message:
 *                 type: string
 *               timestamp:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [open, filled, cancelled, partial]
 *               proposalId:
 *                 type: string
 *     responses:
 *       200:
 *         description: User orders
 *       401:
 *         description: Authentication required
 */
router.post('/my-orders', verifyWalletSignature, async (req, res) => {
  try {
    const { status, proposalId } = req.body;
    const filter = { userAddress: req.userAddress };
    
    if (status) filter.status = status;
    if (proposalId) filter.proposalId = proposalId;
    
    const orders = await Order.find(filter).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/orderbooks/my-orders/{proposalId}:
 *   post:
 *     summary: Get my orders for specific proposal (requires wallet signature)
 *     tags: [Orderbooks]
 *     security:
 *       - WalletSignature: []
 *     parameters:
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address, signature, message, timestamp]
 *             properties:
 *               address:
 *                 type: string
 *               signature:
 *                 type: string
 *               message:
 *                 type: string
 *               timestamp:
 *                 type: number
 *     responses:
 *       200:
 *         description: User orders for proposal
 */
router.post('/my-orders/:proposalId', verifyWalletSignature, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const orders = await Order.find({ 
      userAddress: req.userAddress,
      proposalId 
    }).sort({ createdAt: -1 });
    
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/orderbooks/my-trades:
 *   post:
 *     summary: Get my trading history (requires wallet signature)
 *     tags: [Orderbooks]
 *     security:
 *       - WalletSignature: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address, signature, message, timestamp]
 *             properties:
 *               address:
 *                 type: string
 *               signature:
 *                 type: string
 *               message:
 *                 type: string
 *               timestamp:
 *                 type: number
 *     responses:
 *       200:
 *         description: User trading history
 */
router.post('/my-trades', verifyWalletSignature, async (req, res) => {
  try {
    const trades = await Order.find({ 
      userAddress: req.userAddress,
      status: { $in: ['filled', 'partial'] }
    }).sort({ updatedAt: -1 });
    
    res.json(trades);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/orderbooks/{proposalId}/{side}/orders:
 *   get:
 *     summary: Get public list of open/partial orders (addresses redacted)
 *     description: Returns orders with status open or partial for the given proposal and side. User addresses are not included.
 *     tags: [Orderbooks]
 *     parameters:
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: side
 *         required: true
 *         schema:
 *           type: string
 *           enum: [approve, reject, yes, no]
 *     responses:
 *       200:
 *         description: List of orders
 */
router.get('/:proposalId/:side/orders', async (req, res) => {
  try {
    const { proposalId } = req.params;
    let { side } = req.params;

    // Normalize yes/no to approve/reject
    if (side === 'yes') side = 'approve';
    if (side === 'no') side = 'reject';

    if (!['approve', 'reject'].includes(side)) {
      return res.status(400).json({ error: 'Invalid side. Must be approve/reject (or yes/no alias)' });
    }

    // Verify proposal exists using on-chain contract id (string)
    const proposal = await Proposal.findOne({ proposalContractId: proposalId });
    if (!proposal) {
      return res.status(404).json({ error: `Proposal with id ${proposalId} not found` });
    }

    const raw = await Order.find({
      proposalId,
      side,
      status: { $in: ['open', 'partial'] }
    })
      .sort({ createdAt: -1 })
      .select('-userAddress -txHash -__v -_id -fills.matchedOrderId')
      .lean();

    // Sanitize nested fills and remove any subdocument _id
    const orders = raw.map(o => ({
      ...o,
      fills: Array.isArray(o.fills)
        ? o.fills.map(f => ({ price: f.price, amount: f.amount, timestamp: f.timestamp }))
        : []
    }));

    res.json({ proposalId, side, count: orders.length, orders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PROTECTED ENDPOINTS (REQUIRE WALLET SIGNATURE) =====

/**
 * @swagger
 * /api/orderbooks/{proposalId}/{side}/orders:
 *   post:
 *     summary: Create order (requires wallet signature)
 *     description: Creates a new order. User must provide wallet signature for authentication.
 *     tags: [Orderbooks]
 *     security:
 *       - WalletSignature: []
 *     parameters:
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: side
 *         required: true
 *         schema:
 *           type: string
 *           enum: [approve, reject]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address, signature, message, timestamp, orderType, price, amount]
 *             properties:
 *               address:
 *                 type: string
 *                 description: Wallet address
 *               signature:
 *                 type: string
 *                 description: Wallet signature
 *               message:
 *                 type: string
 *                 description: Signed message
 *               timestamp:
 *                 type: number
 *                 description: Message timestamp
 *               orderType:
 *                 type: string
 *                 enum: [buy, sell]
 *               price:
 *                 type: number
 *               amount:
 *                 type: number
 *     responses:
 *       201:
 *         description: Order created successfully
 *       401:
 *         description: Invalid wallet signature
 */
router.post('/:proposalId/:side/orders', verifyWalletSignature, async (req, res) => {
  try {
    const { proposalId, side } = req.params;
    const { orderType, orderExecution = 'limit', price, amount } = req.body;
    const userAddress = req.userAddress; // From wallet authentication
    const io = req.app.get('io');

    // Validate inputs
    if (!proposalId) {
      return res.status(400).json({ error: 'Proposal ID is required' });
    }

    if (!userAddress) {
      return res.status(401).json({ error: 'User address not found in authentication' });
    }

    if (!['approve', 'reject'].includes(side)) {
      return res.status(400).json({ error: 'Invalid side. Must be approve or reject' });
    }

    if (!['buy', 'sell'].includes(orderType)) {
      return res.status(400).json({ error: 'Invalid orderType. Must be buy or sell' });
    }

    if (!['limit', 'market'].includes(orderExecution)) {
      return res.status(400).json({ error: 'Invalid orderExecution. Must be limit or market' });
    }

    // Verify that the proposal exists using on-chain contract id (string)
    const proposal = await Proposal.findOne({ proposalContractId: proposalId });
    if (!proposal) {
      return res.status(404).json({ error: `Proposal with id ${proposalId} not found` });
    }

    // Check if proposal has required fields
    if (!proposal.id || !proposal.admin) {
      return res.status(400).json({ error: 'Proposal data is incomplete' });
    }

    // Check if proposal is active
    if (!proposal.isActive) {
      return res.status(400).json({ error: 'Proposal is not active for trading' });
    }

    // For market orders, price is not required but we'll calculate it
    if (orderExecution === 'limit' && (!price || parseFloat(price) <= 0)) {
      return res.status(400).json({ error: 'Price required for limit orders and must be greater than 0' });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Amount is required and must be greater than 0' });
    }

    // NEW: Balance checks based on proposal-specific token addresses
    try {
      await ensureSufficientBalance({
        proposal,
        proposalId,
        side,
        orderType,
        orderExecution,
        price,
        amount,
        userAddress
      });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    const order = new Order({
      proposalId,
      side,
      orderType,
      orderExecution,
      price: price?.toString() || '0',
      amount: amount.toString(),
      userAddress,
      filledAmount: '0',
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await order.save();

    if (!order || !order._id) {
      return res.status(500).json({ error: 'Failed to create order' });
    }

    // NEW: notify this user that their orders changed
    try { if (io) notifyUserOrdersUpdate(io, userAddress, { reason: 'order-created', changedOrderId: order._id.toString() }); } catch (e) {}

    // Update order book (with error handling)
    try {
      await updateOrderBook(proposalId, side, io);
    } catch (updateError) {
      console.error('Error updating order book after creation:', updateError);
      // Don't fail the whole operation if order book update fails
    }

    // Execute order if it's a market order or if there are matching orders (with error handling)
    try {
      await executeOrder(order, io);
      
      // Also try to execute existing orders that might now have a match
      const existingOrders = await Order.find({
        proposalId: order.proposalId,
        side: order.side,
        orderType: order.orderType === 'buy' ? 'sell' : 'buy', // Opposite type
        status: 'open',
        _id: { $ne: order._id } // Exclude the order we just created
      }).sort({ createdAt: 1 }); // Oldest first
      
      console.log(`Found ${existingOrders.length} existing orders to re-check for matching`);
      
      for (const existingOrder of existingOrders) {
        try {
          await executeOrder(existingOrder, io);
        } catch (existingExecuteError) {
          console.error('Error executing existing order:', existingExecuteError);
        }
      }
    } catch (executeError) {
      console.error('Error executing order:', executeError);
      // Don't fail the whole operation if order execution fails
    }

    // Notify clients (with error handling)
    try {
      if (io && typeof notifyNewOrder === 'function') {
        notifyNewOrder(io, order);
      }
    } catch (notifyError) {
      console.error('Error notifying new order:', notifyError);
      // Don't fail the whole operation if notification fails
    }

    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/orderbooks/orders/{orderId}:
 *   delete:
 *     summary: Cancel order (requires wallet signature)
 *     description: Cancels an order. Only the order creator can cancel it.
 *     tags: [Orderbooks]
 *     security:
 *       - WalletSignature: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address, signature, message, timestamp]
 *             properties:
 *               address:
 *                 type: string
 *               signature:
 *                 type: string
 *               message:
 *                 type: string
 *               timestamp:
 *                 type: number
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 *       401:
 *         description: Invalid wallet signature
 *       403:
 *         description: Not authorized to cancel this order
 *       404:
 *         description: Order not found
 */
router.delete('/orders/:orderId', verifyWalletSignature, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userAddress = req.userAddress;
    const io = req.app.get('io');

    if (!orderId) return sendError(res, 400, 'Order ID is required');
    if (!userAddress) return sendError(res, 401, 'User address not found in authentication');

    const existingOrder = await Order.findById(orderId);
    if (!existingOrder) return sendError(res, 404, 'Order not found');
    if (!existingOrder.userAddress) return sendError(res, 400, 'Order userAddress is missing');
    if (!existingOrder.proposalId || !existingOrder.side) return sendError(res, 400, 'Order data is incomplete');
    if (existingOrder.userAddress.toLowerCase() !== userAddress.toLowerCase()) return sendError(res, 403, 'Not authorized to cancel this order');
    if (existingOrder.status === 'cancelled') return sendError(res, 400, 'Order is already cancelled');
    if (existingOrder.status === 'filled') return sendError(res, 400, 'Cannot cancel a filled order');

    const order = await Order.findByIdAndUpdate(orderId, { status: 'cancelled', updatedAt: new Date() }, { new: true });
    if (!order) return sendError(res, 500, 'Failed to update order status');

    try { if (io) notifyUserOrdersUpdate(io, order.userAddress, { reason: 'order-cancelled', changedOrderId: order._id.toString() }); } catch (e) {}
    try { await updateOrderBook(order.proposalId, order.side, io); } catch (updateError) { console.error('Error updating order book after cancellation:', updateError); }
    try { if (io && typeof notifyOrderStatusChange === 'function') { notifyOrderStatusChange(io, order, 'cancelled'); } } catch (notifyError) { console.error('Error notifying order status change:', notifyError); }

    res.json(order);
  } catch (error) {
    console.error('Error cancelling order:', error);
    sendError(res, 500, error.message);
  }
});

/**
 * @swagger
 * /api/orderbooks/my-orders:
 *   post:
 *     summary: Get my orders (requires wallet signature)
 *     description: Get all orders for the authenticated user
 *     tags: [Orderbooks]
 *     security:
 *       - WalletSignature: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address, signature, message, timestamp]
 *             properties:
 *               address:
 *                 type: string
 *               signature:
 *                 type: string
 *               message:
 *                 type: string
 *               timestamp:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [open, filled, cancelled, partial]
 *               proposalId:
 *                 type: string
 *     responses:
 *       200:
 *         description: User orders
 *       401:
 *         description: Authentication required
 */
router.post('/my-orders', verifyWalletSignature, async (req, res) => {
  try {
    const { status, proposalId } = req.body;
    const filter = { userAddress: req.userAddress };
    
    if (status) filter.status = status;
    if (proposalId) filter.proposalId = proposalId;
    
    const orders = await Order.find(filter).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/orderbooks/my-orders/{proposalId}:
 *   post:
 *     summary: Get my orders for specific proposal (requires wallet signature)
 *     tags: [Orderbooks]
 *     security:
 *       - WalletSignature: []
 *     parameters:
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address, signature, message, timestamp]
 *             properties:
 *               address:
 *                 type: string
 *               signature:
 *                 type: string
 *               message:
 *                 type: string
 *               timestamp:
 *                 type: number
 *     responses:
 *       200:
 *         description: User orders for proposal
 */
router.post('/my-orders/:proposalId', verifyWalletSignature, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const orders = await Order.find({ 
      userAddress: req.userAddress,
      proposalId 
    }).sort({ createdAt: -1 });
    
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/orderbooks/my-trades:
 *   post:
 *     summary: Get my trading history (requires wallet signature)
 *     tags: [Orderbooks]
 *     security:
 *       - WalletSignature: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address, signature, message, timestamp]
 *             properties:
 *               address:
 *                 type: string
 *               signature:
 *                 type: string
 *               message:
 *                 type: string
 *               timestamp:
 *                 type: number
 *     responses:
 *       200:
 *         description: User trading history
 */
router.post('/my-trades', verifyWalletSignature, async (req, res) => {
  try {
    const trades = await Order.find({ 
      userAddress: req.userAddress,
      status: { $in: ['filled', 'partial'] }
    }).sort({ updatedAt: -1 });
    
    res.json(trades);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/orderbooks/{proposalId}/{side}/orders:
 *   get:
 *     summary: Get public list of open/partial orders (addresses redacted)
 *     description: Returns orders with status open or partial for the given proposal and side. User addresses are not included.
 *     tags: [Orderbooks]
 *     parameters:
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: side
 *         required: true
 *         schema:
 *           type: string
 *           enum: [approve, reject, yes, no]
 *     responses:
 *       200:
 *         description: List of orders
 */
router.get('/:proposalId/:side/orders', async (req, res) => {
  try {
    const { proposalId } = req.params;
    let { side } = req.params;

    // Normalize yes/no to approve/reject
    if (side === 'yes') side = 'approve';
    if (side === 'no') side = 'reject';

    if (!['approve', 'reject'].includes(side)) {
      return res.status(400).json({ error: 'Invalid side. Must be approve/reject (or yes/no alias)' });
    }

    // Verify proposal exists using on-chain contract id (string)
    const proposal = await Proposal.findOne({ proposalContractId: proposalId });
    if (!proposal) {
      return res.status(404).json({ error: `Proposal with id ${proposalId} not found` });
    }

    const raw = await Order.find({
      proposalId,
      side,
      status: { $in: ['open', 'partial'] }
    })
      .sort({ createdAt: -1 })
      .select('-userAddress -txHash -__v -_id -fills.matchedOrderId')
      .lean();

    // Sanitize nested fills and remove any subdocument _id
    const orders = raw.map(o => ({
      ...o,
      fills: Array.isArray(o.fills)
        ? o.fills.map(f => ({ price: f.price, amount: f.amount, timestamp: f.timestamp }))
        : []
    }));

    res.json({ proposalId, side, count: orders.length, orders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


async function executeOrder(order, io) {
  try {
    if (!order || !order.proposalId || !order.side) {
      console.error('Invalid order data for executeOrder');
      return;
    }

    console.log(`Executing order: ${order._id}, side: ${order.side}, type: ${order.orderType}, execution: ${order.orderExecution}, price: ${order.price}, amount: ${order.amount}`);

    const oppositeOrderType = order.orderType === 'buy' ? 'sell' : 'buy';

    // Build price filter for limit orders
    let priceFilter = {};
    if (order.orderExecution === 'limit') {
      priceFilter = order.orderType === 'buy'
        ? { $expr: { $lte: [{ $toDouble: '$price' }, parseFloat(order.price)] } }
        : { $expr: { $gte: [{ $toDouble: '$price' }, parseFloat(order.price)] } };
    }

    // Find matching orders
    const matchingOrders = await Order.find({
      proposalId: order.proposalId,
      side: order.side,
      orderType: oppositeOrderType,
      status: { $in: ['open', 'partial'] },
      ...(order.orderExecution === 'limit' ? { ...priceFilter } : {})
    }).sort({
      price: order.orderType === 'buy' ? 1 : -1, // Best price first
      createdAt: 1
    });

    let remainingAmount = parseFloat(order.amount);
    let totalExecuted = 0;

    for (const matchingOrder of matchingOrders) {
      if (remainingAmount <= 0) break;

      const availableAmount = parseFloat(matchingOrder.amount) - parseFloat(matchingOrder.filledAmount || '0');
      const tradeAmount = Math.min(remainingAmount, availableAmount);

      if (tradeAmount <= 0) continue;

      console.log(`Executing trade: ${tradeAmount} at price ${matchingOrder.price}`);

      // Update matching order
      const newFilledAmount = parseFloat(matchingOrder.filledAmount || '0') + tradeAmount;
      matchingOrder.filledAmount = newFilledAmount.toString();
      matchingOrder.status = newFilledAmount >= parseFloat(matchingOrder.amount) ? 'filled' : 'partial';
      matchingOrder.updatedAt = new Date();

      // Record fill for matching order
      matchingOrder.fills.push({
        price: matchingOrder.price,
        amount: tradeAmount.toString(),
        timestamp: new Date(),
        matchedOrderId: order._id.toString()
      });

      await matchingOrder.save();

      // NEW: notify counterparty user about their order update
      try { if (io) notifyUserOrdersUpdate(io, matchingOrder.userAddress, { reason: 'order-updated', changedOrderId: matchingOrder._id.toString() }); } catch (e) {}

      // Update our order
      remainingAmount -= tradeAmount;
      totalExecuted += tradeAmount;

      if (order.orderExecution === 'market') {
        order.price = matchingOrder.price; // Use matching order price for market
      }

      // Record fill for original order
      order.fills.push({
        price: matchingOrder.price,
        amount: tradeAmount.toString(),
        timestamp: new Date(),
        matchedOrderId: matchingOrder._id.toString()
      });

      console.log(`Trade executed: ${tradeAmount}, remaining: ${remainingAmount}`);

      // NEW: send on-chain applyBatch per fill (buyer/seller inferred)
      try {
        const buyOrder = order.orderType === 'buy' ? order : matchingOrder;
        const sellOrder = order.orderType === 'sell' ? order : matchingOrder;
        const tx = await submitFillToChain({
          proposalId: order.proposalId,
          side: order.side,
          buyOrder,
          sellOrder,
          price: matchingOrder.price,
          amount: tradeAmount.toString()
        });
        console.log(`[applyBatch] tx sent: ${tx.hash}`);
        // Save tx hash on both orders
        try {
          matchingOrder.txHash = tx.hash;
          await matchingOrder.save();
        } catch (_) {}
        order.txHash = tx.hash; // will be persisted on final save
      } catch (e) {
        console.error('[applyBatch] send error:', e.message);
      }
    }

    // Finalize original order
    order.filledAmount = totalExecuted.toString();
    if (totalExecuted >= parseFloat(order.amount)) {
      order.status = 'filled';
    } else if (totalExecuted > 0) {
      order.status = 'partial';
    }
    order.updatedAt = new Date();
    await order.save();

    console.log(`Order ${order._id} final status: ${order.status}, filled: ${order.filledAmount}/${order.amount}`);

    // NEW: notify original user if anything executed or changed
    try { if (io && totalExecuted > 0) notifyUserOrdersUpdate(io, order.userAddress, { reason: 'order-updated', changedOrderId: order._id.toString() }); } catch (e) {}

    // Notify clients if any execution happened
    if (io && typeof notifyOrderMatched === 'function' && totalExecuted > 0) {
      // keep existing behavior (signature mismatch tolerated elsewhere)
      try { notifyOrderMatched(io, order); } catch (e) {}
    }

  } catch (error) {
    console.error('Error executing order:', error);
  }
}

module.exports = router;