const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
  proposalId: {
    type: Number,
    required: true,
    index: true
  },
  marketType: {
    type: String,
    enum: ['approve', 'reject'],
    required: true,
    index: true
  },
  price: {
    type: String,
    required: true
  },
  volume: {
    type: String,
    default: '0'
  },
  totalCollateral: {
    type: String,
    default: '0'
  },
  totalSupply: {
    type: String,
    default: '0'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  blockNumber: {
    type: Number,
    index: true
  },
  transactionHash: {
    type: String,
    lowercase: true
  },
  // Event that triggered this price update
  eventType: {
    type: String,
    enum: ['buy', 'sell', 'initialization', 'periodic_update'],
    required: true
  },
  // Additional data from the event
  eventData: {
    user: {
      type: String,
      lowercase: true
    },
    amount: String,
    tokensTraded: String
  }
}, {
  timestamps: false, // We use our own timestamp field
  collection: 'price_history'
});

// Compound indexes for efficient queries
priceHistorySchema.index({ proposalId: 1, marketType: 1, timestamp: -1 });
priceHistorySchema.index({ proposalId: 1, timestamp: -1 });
priceHistorySchema.index({ marketType: 1, timestamp: -1 });
priceHistorySchema.index({ blockNumber: 1 });

// Static method to get price history for a proposal
priceHistorySchema.statics.getProposalHistory = function(proposalId, marketType = null, limit = 100) {
  const query = { proposalId };
  if (marketType) {
    query.marketType = marketType;
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit);
};

// Static method to get price history within a time range
priceHistorySchema.statics.getHistoryInRange = function(proposalId, startTime, endTime, marketType = null) {
  const query = {
    proposalId,
    timestamp: {
      $gte: new Date(startTime),
      $lte: new Date(endTime)
    }
  };
  
  if (marketType) {
    query.marketType = marketType;
  }
  
  return this.find(query).sort({ timestamp: 1 });
};

// Static method to get latest prices for a proposal
priceHistorySchema.statics.getLatestPrices = async function(proposalId) {
  const approvePrice = await this.findOne({
    proposalId,
    marketType: 'approve'
  }).sort({ timestamp: -1 });
  
  const rejectPrice = await this.findOne({
    proposalId,
    marketType: 'reject'
  }).sort({ timestamp: -1 });
  
  return {
    approve: approvePrice,
    reject: rejectPrice
  };
};

// Static method to get aggregated data for charts
priceHistorySchema.statics.getAggregatedData = function(proposalId, interval = '1h') {
  const groupStage = {
    $group: {
      _id: {
        proposalId: '$proposalId',
        marketType: '$marketType',
        date: {
          $dateToString: {
            format: interval === '1h' ? '%Y-%m-%d %H:00:00' : '%Y-%m-%d',
            date: '$timestamp'
          }
        }
      },
      avgPrice: { $avg: { $toDouble: '$price' } },
      maxPrice: { $max: { $toDouble: '$price' } },
      minPrice: { $min: { $toDouble: '$price' } },
      totalVolume: { $sum: { $toDouble: '$volume' } },
      count: { $sum: 1 },
      firstTimestamp: { $first: '$timestamp' },
      lastTimestamp: { $last: '$timestamp' }
    }
  };

  return this.aggregate([
    { $match: { proposalId } },
    { $sort: { timestamp: 1 } },
    groupStage,
    { $sort: { '_id.date': 1 } }
  ]);
};

module.exports = mongoose.model('PriceHistory', priceHistorySchema);
