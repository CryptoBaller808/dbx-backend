/**
 * Admin Routing Routes
 * Path: /api/admin/routing/*
 * Purpose: Monitor and manage routing engine
 */

const express = require('express');
const router = express.Router();
const { getRecentDecisions } = require('../services/routing/decisionsBuffer');
const { routeQuote } = require('../services/routing/router');

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

/**
 * @route GET /api/admin/routing/diag
 * @desc Run routing diagnostics without executing trade
 * @query {string} base - Base currency
 * @query {string} quote - Quote currency
 * @query {number} amountUsd - Trade amount in USD
 * @query {string} side - Trade side (buy/sell)
 * @returns {Object} Diagnostic results with raw provider responses
 */
router.get('/diag', async (req, res) => {
  const { base, quote, amountUsd, side } = req.query;
  
  if (!base || !quote || !amountUsd || !side) {
    return res.status(400).json({
      ok: false,
      code: 'MISSING_PARAMS',
      message: 'Required params: base, quote, amountUsd, side'
    });
  }
  
  try {
    const result = await routeQuote({
      base: String(base).toUpperCase(),
      quote: String(quote).toUpperCase(),
      amountUsd: parseFloat(amountUsd),
      side: String(side).toLowerCase()
    });
    
    return res.json({
      ok: true,
      diagnostic: true,
      params: { base, quote, amountUsd: parseFloat(amountUsd), side },
      result
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      code: 'DIAG_ERROR',
      message: error.message
    });
  }
});

module.exports = router;
