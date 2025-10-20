const mongoose = require('mongoose');

const proposalSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: true
  },
  admin: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  startTime: {
    type: Number,
    required: true
  },
  endTime: {
    type: Number,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  collateralToken: {
    type: String,
    required: true
  },
  maxSupply: {
    type: String,
    required: true
  },
  target: {
    type: String,
    required: true
  },
  data: {
    type: String,
    required: true
  },
  marketAddress: {
    type: String,
    required: false
  },
  proposalExecuted: {
    type: Boolean,
    default: false
  },
  proposalEnded: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: function() {
      const now = Date.now() / 1000;
      return now >= this.startTime && now <= this.endTime && !this.proposalEnded;
    }
  }
}, {
  timestamps: true
});

// Virtual fields for compatibility
proposalSchema.virtual('approveToken').get(function() {
  return this.marketAddress ? `${this.marketAddress}-approve` : null;
});

proposalSchema.virtual('rejectToken').get(function() {
  return this.marketAddress ? `${this.marketAddress}-reject` : null;
});

proposalSchema.set('toJSON', { virtuals: true });

// Check if proposal is active
proposalSchema.methods.checkIsActive = function() {
  const now = Date.now() / 1000;
  return now >= this.startTime && now <= this.endTime && !this.proposalEnded;
};

// Update isActive before saving
proposalSchema.pre('save', function(next) {
  this.isActive = this.checkIsActive();
  next();
});

module.exports = mongoose.model('Proposal', proposalSchema);
