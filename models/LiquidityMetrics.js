const mongoose = require('mongoose');

const liquidityMetricsSchema = new mongoose.Schema({
  provider: {
    type: String,
    required: true,
    index: true
  },
  pair: {
    type: String,
    required: true,
    index: true
  },
  strategy: {
    type: String,
    required: true,
    enum: ['direct', 'smart-split', 'auto']
  },
  volume: {
    type: Number,
    required: true
  },
  fee_bps: {
    type: Number,
    required: true
  },
  latency_ms: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Index for efficient querying by time period
liquidityMetricsSchema.index({ timestamp: -1, provider: 1 });

module.exports = mongoose.model('LiquidityMetrics', liquidityMetricsSchema);
