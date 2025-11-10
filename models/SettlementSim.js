const mongoose = require('mongoose');

const settlementSimSchema = new mongoose.Schema({
  route_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  base: {
    type: String,
    required: true
  },
  quote: {
    type: String,
    required: true
  },
  notional_usd: {
    type: Number,
    required: true
  },
  state: {
    type: String,
    required: true,
    enum: ['quoted', 'routed', 'simulated_settled'],
    default: 'quoted'
  },
  path: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Index for efficient querying by time and state
settlementSimSchema.index({ timestamp: -1, state: 1 });

module.exports = mongoose.model('SettlementSim', settlementSimSchema);
