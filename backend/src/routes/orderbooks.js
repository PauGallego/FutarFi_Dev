const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const OrderBook = require('../models/OrderBook');
const { 
  notifyOrderBookUpdate, 
  notifyNewOrder, 
  notifyOrderStatusChange,
  notifyOrderMatched,
  notifyMarketData
} = require('../middleware/websocket');

// Get order book for a proposal side
router.get('/:proposalId/:side', async (req, res) => {
  try {
    const { proposalId, side } = req.params;
    
    if (!['approve', 'reject'].includes(side)) {
      return res.status(400).json({ error: 'Invalid side. Must be approve or reject' });
    }

    const orderBook = await OrderBook.findOne({ proposalId, side });
    if (!orderBook) {
      return res.status(404).json({ error: 'Order book not found' });
    }

    res.json(orderBook);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get both order books for a proposal
router.get('/:proposalId', async (req, res) => {
  try {
    const { proposalId } = req.params;
    
    const orderBooks = await OrderBook.find({ proposalId });
    
    const result = {
      proposalId,
      approve: orderBooks.find(ob => ob.side === 'approve') || null,
      reject: orderBooks.find(ob => ob.side === 'reject') || null
    };

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new order
router.post('/:proposalId/:side/orders', async (req, res) => {
  try {
    const { proposalId, side } = req.params;
    const { orderType, orderExecution = 'limit', price, amount, userAddress } = req.body;
    const io = req.app.get('io');

    if (!['approve', 'reject'].includes(side)) {
      return res.status(400).json({ error: 'Invalid side. Must be approve or reject' });
    }

    if (!['buy', 'sell'].includes(orderType)) {
      return res.status(400).json({ error: 'Invalid orderType. Must be buy or sell' });
    }

    if (!['limit', 'market'].includes(orderExecution)) {
      return res.status(400).json({ error: 'Invalid orderExecution. Must be limit or market' });
    }

    // For market orders, price is not required but we'll calculate it
    let orderPrice = price;
    if (orderExecution === 'market') {
      orderPrice = await getMarketPrice(proposalId, side, orderType);
      if (!orderPrice) {
        return res.status(400).json({ error: 'No market price available for market order' });
      }
    }

    // Create order
    const order = new Order({
      proposalId,
      side,
      orderType,
      orderExecution,
      price: orderPrice,
      amount,
      userAddress
    });

    await order.save();

    // If it's a market order, try to match immediately
    if (orderExecution === 'market') {
      await executeMarketOrder(order, io);
    }

    // Update order book
    await updateOrderBook(proposalId, side, io);

    // Notify clients
    notifyNewOrder(io, order);

    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get orders for a proposal side
router.get('/:proposalId/:side/orders', async (req, res) => {
  try {
    const { proposalId, side } = req.params;
    const { userAddress, status } = req.query;

    const filter = { proposalId, side };
    if (userAddress) filter.userAddress = userAddress;
    if (status) filter.status = status;

    const orders = await Order.find(filter).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel order
router.delete('/orders/:orderId', async (req, res) => {
  try {
    const io = req.app.get('io');
    const order = await Order.findByIdAndUpdate(
      req.params.orderId,
      { status: 'cancelled' },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update order book
    await updateOrderBook(order.proposalId, order.side, io);

    // Notify clients
    notifyOrderStatusChange(io, order, 'open');

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get market data for a proposal side
router.get('/:proposalId/:side/market-data', async (req, res) => {
  try {
    const { proposalId, side } = req.params;
    
    if (!['approve', 'reject'].includes(side)) {
      return res.status(400).json({ error: 'Invalid side. Must be approve or reject' });
    }

    const orderBook = await OrderBook.findOne({ proposalId, side });
    const lastPrice = await getLastTradePrice(proposalId, side);
    const volume24h = await get24hVolume(proposalId, side);
    const priceChange24h = await get24hPriceChange(proposalId, side);
    
    const bids = orderBook ? orderBook.bids : [];
    const asks = orderBook ? orderBook.asks : [];
    const spread = calculateSpread(bids, asks);

    res.json({
      proposalId,
      side,
      lastPrice: lastPrice || '0',
      volume24h: volume24h || '0',
      priceChange24h: priceChange24h || '0',
      spread,
      highestBid: bids.length > 0 ? bids[0].price : '0',
      lowestAsk: asks.length > 0 ? asks[0].price : '0',
      twap1h: orderBook?.twap1h || '0',
      twap4h: orderBook?.twap4h || '0',
      twap24h: orderBook?.twap24h || '0',
      twapLastUpdate: orderBook?.twapLastUpdate || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recent trades for a proposal side
router.get('/:proposalId/:side/trades', async (req, res) => {
  try {
    const { proposalId, side } = req.params;
    const { limit = 50 } = req.query;
    
    if (!['approve', 'reject'].includes(side)) {
      return res.status(400).json({ error: 'Invalid side. Must be approve or reject' });
    }

    const trades = await Order.find({
      proposalId,
      side,
      filledAmount: { $gt: '0' }
    })
    .sort({ updatedAt: -1 })
    .limit(parseInt(limit))
    .select('price filledAmount orderType updatedAt userAddress');

    res.json(trades.map(trade => ({
      price: trade.price,
      amount: trade.filledAmount,
      side: trade.orderType,
      timestamp: trade.updatedAt,
      userAddress: trade.userAddress
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get order book depth
router.get('/:proposalId/:side/depth', async (req, res) => {
  try {
    const { proposalId, side } = req.params;
    const { levels = 20 } = req.query;
    
    if (!['approve', 'reject'].includes(side)) {
      return res.status(400).json({ error: 'Invalid side. Must be approve or reject' });
    }

    const orderBook = await OrderBook.findOne({ proposalId, side });
    if (!orderBook) {
      return res.json({ bids: [], asks: [] });
    }

    const maxLevels = parseInt(levels);
    const bids = orderBook.bids.slice(0, maxLevels);
    const asks = orderBook.asks.slice(0, maxLevels);

    // Calculate cumulative amounts
    let cumulativeBidAmount = BigInt(0);
    let cumulativeAskAmount = BigInt(0);

    const bidsWithCumulative = bids.map(bid => {
      cumulativeBidAmount += BigInt(bid.amount);
      return {
        ...bid,
        cumulative: cumulativeBidAmount.toString()
      };
    });

    const asksWithCumulative = asks.map(ask => {
      cumulativeAskAmount += BigInt(ask.amount);
      return {
        ...ask,
        cumulative: cumulativeAskAmount.toString()
      };
    });

    res.json({
      proposalId,
      side,
      bids: bidsWithCumulative,
      asks: asksWithCumulative,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get price history/candlestick data
router.get('/:proposalId/:side/candles', async (req, res) => {
  try {
    const { proposalId, side } = req.params;
    const { interval = '1h', limit = 100 } = req.query;
    
    if (!['approve', 'reject'].includes(side)) {
      return res.status(400).json({ error: 'Invalid side. Must be approve or reject' });
    }

    // Convert interval to milliseconds
    const intervalMs = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    }[interval] || 60 * 60 * 1000;

    const now = new Date();
    const startTime = new Date(now.getTime() - parseInt(limit) * intervalMs);

    // Get trades in the time range
    const trades = await Order.find({
      proposalId,
      side,
      filledAmount: { $gt: '0' },
      updatedAt: { $gte: startTime }
    }).sort({ updatedAt: 1 });

    // Group trades into candles
    const candles = [];
    let currentTime = startTime.getTime();

    while (currentTime < now.getTime()) {
      const candleStart = new Date(currentTime);
      const candleEnd = new Date(currentTime + intervalMs);
      
      const candleTrades = trades.filter(trade => 
        trade.updatedAt >= candleStart && trade.updatedAt < candleEnd
      );

      if (candleTrades.length > 0) {
        const prices = candleTrades.map(t => parseFloat(t.price));
        const volumes = candleTrades.map(t => parseFloat(t.filledAmount));
        
        candles.push({
          timestamp: currentTime,
          open: prices[0],
          high: Math.max(...prices),
          low: Math.min(...prices),
          close: prices[prices.length - 1],
          volume: volumes.reduce((sum, vol) => sum + vol, 0)
        });
      }

      currentTime += intervalMs;
    }

    res.json({
      proposalId,
      side,
      interval,
      candles
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get TWAP data for a proposal side
router.get('/:proposalId/:side/twap', async (req, res) => {
  try {
    const { proposalId, side } = req.params;
    
    const orderBook = await OrderBook.findOne({ proposalId, side });
    if (!orderBook) {
      return res.status(404).json({ error: 'Order book not found' });
    }

    res.json({
      proposalId,
      side,
      twap1h: orderBook.twap1h || '0',
      twap4h: orderBook.twap4h || '0',
      twap24h: orderBook.twap24h || '0',
      lastUpdate: orderBook.twapLastUpdate || orderBook.updatedAt,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get execution history for an order
router.get('/orders/:orderId/executions', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Get all executions for this order by looking at price history
    const PriceHistory = require('../models/PriceHistory');
    const executions = await PriceHistory.find({
      proposalId: order.proposalId,
      side: order.side,
      timestamp: { 
        $gte: order.createdAt,
        $lte: order.updatedAt 
      }
    }).sort({ timestamp: 1 });

    res.json({
      orderId,
      order: {
        amount: order.amount,
        filledAmount: order.filledAmount,
        status: order.status,
        executedPrice: order.executedPrice
      },
      executions: executions.map(exec => ({
        price: exec.price,
        amount: exec.volume,
        timestamp: exec.timestamp
      })),
      summary: {
        totalExecutions: executions.length,
        averagePrice: order.executedPrice || '0',
        fillPercentage: order.amount !== '0' ? 
          ((BigInt(order.filledAmount) * BigInt(100)) / BigInt(order.amount)).toString() + '%' : '0%'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get filled orders for a proposal side
router.get('/:proposalId/:side/orders/filled', async (req, res) => {
  try {
    const { proposalId, side } = req.params;
    const { userAddress, limit = 50 } = req.query;

    const filter = { 
      proposalId, 
      side, 
      status: 'filled'
    };
    if (userAddress) filter.userAddress = userAddress;

    const orders = await Order.find(filter)
      .sort({ updatedAt: -1 })
      .limit(parseInt(limit));
    
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get open orders (including partial) for a proposal side
router.get('/:proposalId/:side/orders/open', async (req, res) => {
  try {
    const { proposalId, side } = req.params;
    const { userAddress } = req.query;

    const filter = { 
      proposalId, 
      side, 
      status: { $in: ['open', 'partial'] }
    };
    if (userAddress) filter.userAddress = userAddress;

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 });
    
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get only partial orders for a proposal side
router.get('/:proposalId/:side/orders/partial', async (req, res) => {
  try {
    const { proposalId, side } = req.params;
    const { userAddress } = req.query;

    const filter = { 
      proposalId, 
      side, 
      status: 'partial'
    };
    if (userAddress) filter.userAddress = userAddress;

    const orders = await Order.find(filter)
      .sort({ updatedAt: -1 });
    
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get orders by specific status
router.get('/:proposalId/:side/orders/status/:status', async (req, res) => {
  try {
    const { proposalId, side, status } = req.params;
    const { userAddress, limit = 100 } = req.query;

    if (!['open', 'filled', 'cancelled', 'partial'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: open, filled, cancelled, partial' });
    }

    const filter = { proposalId, side, status };
    if (userAddress) filter.userAddress = userAddress;

    const orders = await Order.find(filter)
      .sort({ updatedAt: -1 })
      .limit(parseInt(limit));
    
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's order summary for a proposal side
router.get('/:proposalId/:side/orders/summary/:userAddress', async (req, res) => {
  try {
    const { proposalId, side, userAddress } = req.params;

    const [openOrders, partialOrders, filledOrders, cancelledOrders] = await Promise.all([
      Order.countDocuments({ proposalId, side, userAddress, status: 'open' }),
      Order.countDocuments({ proposalId, side, userAddress, status: 'partial' }),
      Order.countDocuments({ proposalId, side, userAddress, status: 'filled' }),
      Order.countDocuments({ proposalId, side, userAddress, status: 'cancelled' })
    ]);

    // Calculate total volumes
    const volumeStats = await Order.aggregate([
      { $match: { proposalId, side, userAddress } },
      {
        $group: {
          _id: '$status',
          totalAmount: { $sum: { $toDouble: '$amount' } },
          totalFilled: { $sum: { $toDouble: '$filledAmount' } },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      proposalId,
      side,
      userAddress,
      counts: {
        open: openOrders,
        partial: partialOrders,
        filled: filledOrders,
        cancelled: cancelledOrders,
        total: openOrders + partialOrders + filledOrders + cancelledOrders
      },
      volumes: volumeStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to get market price
async function getMarketPrice(proposalId, side, orderType) {
  const orderBook = await OrderBook.findOne({ proposalId, side });
  if (!orderBook) return null;

  // For buy market orders, get the lowest ask price
  // For sell market orders, get the highest bid price
  if (orderType === 'buy' && orderBook.asks.length > 0) {
    return orderBook.asks[0].price;
  } else if (orderType === 'sell' && orderBook.bids.length > 0) {
    return orderBook.bids[0].price;
  }
  
  return null;
}

// Helper function to execute market order
async function executeMarketOrder(order, io) {
  const PriceHistory = require('../models/PriceHistory');
  
  const oppositeOrders = await Order.find({
    proposalId: order.proposalId,
    side: order.side,
    orderType: order.orderType === 'buy' ? 'sell' : 'buy',
    status: 'open'
  }).sort({ 
    price: order.orderType === 'buy' ? 1 : -1, // buy orders want lowest sell prices, sell orders want highest buy prices
    createdAt: 1 
  });

  let remainingAmount = BigInt(order.amount);
  let totalValue = BigInt(0);
  let totalExecutedAmount = BigInt(0);
  
  for (const oppositeOrder of oppositeOrders) {
    if (remainingAmount <= 0) break;

    const currentPrice = parseFloat(oppositeOrder.price);
    const availableAmount = BigInt(oppositeOrder.amount) - BigInt(oppositeOrder.filledAmount);
    const matchedAmount = remainingAmount > availableAmount ? availableAmount : remainingAmount;

    // Update filled amounts
    oppositeOrder.filledAmount = (BigInt(oppositeOrder.filledAmount) + matchedAmount).toString();
    order.filledAmount = (BigInt(order.filledAmount) + matchedAmount).toString();

    // Track execution details for price calculation
    const executionValue = matchedAmount * BigInt(Math.floor(currentPrice * 1000000)) / BigInt(1000000);
    totalValue += executionValue;
    totalExecutedAmount += matchedAmount;

    // Update statuses
    if (BigInt(oppositeOrder.filledAmount) >= BigInt(oppositeOrder.amount)) {
      oppositeOrder.status = 'filled';
    } else {
      oppositeOrder.status = 'partial';
    }

    remainingAmount -= matchedAmount;

    if (BigInt(order.filledAmount) >= BigInt(order.amount)) {
      order.status = 'filled';
    } else {
      order.status = 'partial';
    }

    // Save updated orders
    await oppositeOrder.save();

    // Record price history for TWAP calculation
    if (matchedAmount > 0) {
      await PriceHistory.create({
        proposalId: order.proposalId,
        side: order.side,
        price: oppositeOrder.price,
        volume: matchedAmount.toString(),
        timestamp: new Date()
      });
    }

    // Notify about the match
    notifyOrderMatched(io, 
      order.orderType === 'buy' ? order : oppositeOrder,
      order.orderType === 'buy' ? oppositeOrder : order,
      matchedAmount.toString(),
      oppositeOrder.price
    );

    notifyOrderStatusChange(io, oppositeOrder, 'open');
  }

  // Calculate weighted average execution price
  if (totalExecutedAmount > 0) {
    const avgPrice = Number(totalValue) / Number(totalExecutedAmount);
    order.executedPrice = avgPrice.toFixed(6);
  }

  if (remainingAmount > 0) {
    order.status = BigInt(order.filledAmount) > 0 ? 'partial' : 'open';
  }

  await order.save();
  
  // Update TWAP after execution
  await updateTWAP(order.proposalId, order.side);
}

// Helper function to update order book
async function updateOrderBook(proposalId, side, io) {
  const orders = await Order.find({ 
    proposalId, 
    side, 
    status: { $in: ['open', 'partial'] }
  }).sort({ price: -1 });

  const bids = {};
  const asks = {};

  orders.forEach(order => {
    const book = order.orderType === 'buy' ? bids : asks;
    const key = order.price;
    
    if (!book[key]) {
      book[key] = { price: order.price, amount: '0', orderCount: 0 };
    }
    
    const remainingAmount = BigInt(order.amount) - BigInt(order.filledAmount);
    book[key].amount = (BigInt(book[key].amount) + remainingAmount).toString();
    book[key].orderCount += 1;
  });

  const bidsArray = Object.values(bids)
    .filter(item => BigInt(item.amount) > 0)
    .sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
  const asksArray = Object.values(asks)
    .filter(item => BigInt(item.amount) > 0)
    .sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

  // Calculate market data
  const lastPrice = await getLastTradePrice(proposalId, side);
  const volume24h = await get24hVolume(proposalId, side);
  const priceChange24h = await get24hPriceChange(proposalId, side);

  const updatedOrderBook = await OrderBook.findOneAndUpdate(
    { proposalId, side },
    { 
      bids: bidsArray,
      asks: asksArray,
      lastPrice: lastPrice || '0',
      volume24h: volume24h || '0',
      updatedAt: new Date()
    },
    { upsert: true, new: true }
  );

  // Notify clients about order book update
  if (io) {
    notifyOrderBookUpdate(io, proposalId, side, updatedOrderBook);
    
    // Also send market data
    notifyMarketData(io, proposalId, side, {
      lastPrice: lastPrice || '0',
      volume24h: volume24h || '0',
      priceChange24h: priceChange24h || '0',
      spread: calculateSpread(bidsArray, asksArray)
    });
  }

  return updatedOrderBook;
}

// Helper function to get last trade price
async function getLastTradePrice(proposalId, side) {
  const lastOrder = await Order.findOne({
    proposalId,
    side,
    status: { $in: ['filled', 'partial'] },
    filledAmount: { $gt: '0' }
  }).sort({ updatedAt: -1 });

  return lastOrder ? lastOrder.price : null;
}

// Helper function to get 24h volume
async function get24hVolume(proposalId, side) {
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

// Helper function to get 24h price change
async function get24hPriceChange(proposalId, side) {
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

// Helper function to calculate spread
function calculateSpread(bids, asks) {
  if (bids.length === 0 || asks.length === 0) return '0';
  
  const highestBid = parseFloat(bids[0].price);
  const lowestAsk = parseFloat(asks[0].price);
  
  if (lowestAsk === 0) return '0';
  
  const spread = ((lowestAsk - highestBid) / lowestAsk) * 100;
  return spread.toFixed(4);
}

// Helper function to calculate and update TWAP
async function updateTWAP(proposalId, side) {
  const PriceHistory = require('../models/PriceHistory');
  const OrderBook = require('../models/OrderBook');
  
  const now = new Date();
  const oneHour = new Date(now.getTime() - 60 * 60 * 1000);
  const fourHours = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const twentyFourHours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    // Calculate TWAP for different timeframes
    const twap1h = await calculateTWAP(proposalId, side, oneHour, now);
    const twap4h = await calculateTWAP(proposalId, side, fourHours, now);
    const twap24h = await calculateTWAP(proposalId, side, twentyFourHours, now);

    // Update orderbook with TWAP values
    await OrderBook.findOneAndUpdate(
      { proposalId, side },
      {
        twap1h: twap1h.toFixed(6),
        twap4h: twap4h.toFixed(6),
        twap24h: twap24h.toFixed(6),
        twapLastUpdate: now
      }
    );

    console.log(`TWAP updated for ${proposalId}/${side}: 1h=${twap1h.toFixed(6)}, 4h=${twap4h.toFixed(6)}, 24h=${twap24h.toFixed(6)}`);
  } catch (error) {
    console.error('Error updating TWAP:', error);
  }
}

// Helper function to calculate TWAP for a specific timeframe
async function calculateTWAP(proposalId, side, startTime, endTime) {
  const PriceHistory = require('../models/PriceHistory');
  
  const priceData = await PriceHistory.find({
    proposalId,
    side,
    timestamp: { $gte: startTime, $lte: endTime }
  }).sort({ timestamp: 1 });

  if (priceData.length === 0) {
    return 0;
  }

  let totalWeightedPrice = 0;
  let totalVolume = 0;
  let previousTime = startTime.getTime();

  for (let i = 0; i < priceData.length; i++) {
    const current = priceData[i];
    const currentTime = current.timestamp.getTime();
    const volume = parseFloat(current.volume);
    const price = parseFloat(current.price);
    
    // Weight by volume
    totalWeightedPrice += price * volume;
    totalVolume += volume;
    
    previousTime = currentTime;
  }

  return totalVolume > 0 ? totalWeightedPrice / totalVolume : 0;
}

module.exports = router;
