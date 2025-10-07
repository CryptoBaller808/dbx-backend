const express = require('express');
const router = express.Router();

// CORS allowlist for TradingView datafeed
const allowedOrigins = [
  'https://dbx-frontend-staging.onrender.com',
  'https://dbx-frontend.onrender.com',
  'http://localhost:3000' // for local testing
];

// CORS middleware for exchange routes
router.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Check if origin is in allowlist
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    console.log('📊 [ExchangeRates] OPTIONS preflight:', {
      origin,
      allowed: allowedOrigins.includes(origin)
    });
    return res.status(204).end();
  }
  
  next();
});

// GET /api/exchangeRates - Public endpoint for TradingView chart data
router.get('/', async (req, res) => {
  // Always set JSON content type
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    console.log('📊 [ExchangeRates] Request received:', {
      query: req.query,
      origin: req.headers.origin,
      allowed: allowedOrigins.includes(req.headers.origin)
    });

    const { base='ETH', quote='USDT', resolution='60', from, to } = req.query;

    // TODO: plug real provider here; for now return empty bars gracefully
    const bars = []; // or build mock bars [{time: 1696200000000, open:..., high:..., low:..., close:..., volume:...}]
    
    console.log('📊 [ExchangeRates] Returning data:', { 
      base, quote, resolution, 
      dataPoints: bars.length 
    });

    return res.status(200).json({ bars, meta: { base, quote, resolution, from, to }});
  } catch (e) {
    console.error('❌ [ExchangeRates] Error:', e);
    // Always return JSON, never HTML
    return res.status(200).json({ bars: [], error: 'no_data' });
  }
});

module.exports = router;
