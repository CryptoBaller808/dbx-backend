/**
 * Admin Routing Routes
 * Path: /api/admin/routing/*
 * Purpose: Monitor and manage routing engine
 */

const express = require('express');
const router = express.Router();
const { getRecentDecisions } = require('../services/routing/decisionsBuffer');

/**
 * @route GET /api/admin/routing/last
 * @desc Get last N routing decisions
 * @query {number} [limit=50] - Number of decisions to return
 * @returns {Array} Recent routing decisions
 */
router.get('/last', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const decisions = getRecentDecisions(limit);
  
  return res.json({
    ok: true,
    count: decisions.length,
    decisions
  });
});

/**
 * @route GET /api/admin/routing/config
 * @desc Get current routing configuration
 * @returns {Object} Routing engine configuration
 */
router.get('/config', (req, res) => {
  return res.json({
    ok: true,
    config: {
      enabled: process.env.ROUTING_ENGINE_V1 === 'true',
      logLevel: process.env.ROUTING_ENGINE_LOG || 'info',
      thresholds: {
        large: parseInt(process.env.ROUTING_THRESHOLD_LARGE_USD) || 1000,
        split: parseInt(process.env.ROUTING_THRESHOLD_SPLIT_USD) || 25000
      }
    }
  });
});

module.exports = router;
