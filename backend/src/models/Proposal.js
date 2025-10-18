const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  approvePrice: {
    type: String,
    required: true
  },
  rejectPrice: {
    type: String,
    required: true
  }
}, { _id: true });

const proposalSchema = new mongoose.Schema({
  proposalId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  admin: {
    type: String,
    required: true,
    lowercase: true
  },
  contractAddress: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  marketAddress: {
    type: String,
    required: true,
    lowercase: true
  },
  approveTokenAddress: {
    type: String,
    required: true,
    lowercase: true
  },
  rejectTokenAddress: {
    type: String,
    required: true,
    lowercase: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'ended', 'executed'],
    default: 'active'
  },
  currentApprovePrice: {
    type: String,
    default: '0'
  },
  currentRejectPrice: {
    type: String,
    default: '0'
  },
  priceHistory: [priceHistorySchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
proposalSchema.index({ status: 1 });
proposalSchema.index({ contractAddress: 1 });
proposalSchema.index({ 'priceHistory.timestamp': 1 });

module.exports = mongoose.model('Proposal', proposalSchema);
