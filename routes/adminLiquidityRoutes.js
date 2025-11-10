const express = require('express');
const router = express.Router();
const LiquidityMetrics = require('../models/LiquidityMetrics');
const SettlementSim = require('../models/SettlementSim');

// Feature flag check middleware
const checkLiquidityDashboard = (req, res, next) => {
  if (process.env.LIQUIDITY_DASHBOARD_V1 !== 'true') {
    return res.status(503).json({
      ok: false,
      code: 'FEATURE_DISABLED',
      message: 'Liquidity dashboard feature is not enabled'
    });
  }
  next();
};

// GET /api/admin/liquidity/metrics?period=24h
router.get('/metrics', checkLiquidityDashboard, async (req, res) => {
  try {
    const period = req.query.period || '24h';
    
    // Calculate time threshold
    const now = new Date();
    let timeThreshold;
    
    switch (period) {
      case '1h':
        timeThreshold = new Date(now - 60 * 60 * 1000);
        break;
      case '24h':
        timeThreshold = new Date(now - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        timeThreshold = new Date(now - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        timeThreshold = new Date(now - 24 * 60 * 60 * 1000);
    }
    
    // Aggregate metrics by provider
    const metrics = await LiquidityMetrics.aggregate([
      {
        $match: {
          timestamp: { $gte: timeThreshold }
        }
      },
      {
        $group: {
          _id: '$provider',
          total_volume: { $sum: '$volume' },
          avg_latency_ms: { $avg: '$latency_ms' },
          p95_latency_ms: { $max: '$latency_ms' },
          avg_fee_bps: { $avg: '$fee_bps' },
          request_count: { $sum: 1 },
          success_rate: { $avg: 1 } // Simplified - all recorded requests are successful
        }
      },
      {
        $project: {
          provider: '$_id',
          total_volume: 1,
          avg_latency_ms: { $round: ['$avg_latency_ms', 2] },
          p95_latency_ms: { $round: ['$p95_latency_ms', 2] },
          avg_fee_bps: { $round: ['$avg_fee_bps', 2] },
          request_count: 1,
          success_rate: { $multiply: ['$success_rate', 100] },
          liquidity_score: {
            $cond: {
              if: { $lt: ['$avg_latency_ms', 300] },
              then: 'high',
              else: {
                $cond: {
                  if: { $lt: ['$avg_latency_ms', 500] },
                  then: 'medium',
                  else: 'low'
                }
              }
            }
          },
          _id: 0
        }
      },
      {
        $sort: { total_volume: -1 }
      }
    ]);
    
    res.json({
      ok: true,
      period,
      metrics,
      timestamp: now.toISOString()
    });
  } catch (error) {
    console.error('[AdminLiquidity] Error fetching metrics:', error);
    res.status(500).json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

// GET /api/admin/settlement/simulated
router.get('/settlement/simulated', checkLiquidityDashboard, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    
    const settlements = await SettlementSim.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    
    res.json({
      ok: true,
      count: settlements.length,
      settlements,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[AdminLiquidity] Error fetching simulated settlements:', error);
    res.status(500).json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

// POST /api/internal/settlement/simulate
router.post('/settlement/simulate', async (req, res) => {
  try {
    if (process.env.SETTLEMENT_SIM_MODE !== 'true') {
      return res.status(503).json({
        ok: false,
        code: 'FEATURE_DISABLED',
        message: 'Settlement simulation is not enabled'
      });
    }
    
    const { route_id, base, quote, notional_usd, path } = req.body;
    
    if (!route_id || !base || !quote || !notional_usd || !path) {
      return res.status(400).json({
        ok: false,
        code: 'MISSING_PARAMS',
        message: 'Missing required parameters'
      });
    }
    
    // Create settlement simulation
    const settlement = new SettlementSim({
      route_id,
      base,
      quote,
      notional_usd,
      state: 'simulated_settled',
      path
    });
    
    await settlement.save();
    
    res.json({
      ok: true,
      settlement_id: settlement._id,
      route_id: settlement.route_id
    });
  } catch (error) {
    console.error('[AdminLiquidity] Error creating settlement simulation:', error);
    res.status(500).json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

module.exports = router;
