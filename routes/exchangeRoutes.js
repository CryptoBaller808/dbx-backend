const express = require('express');
const router = express.Router();

// CORS middleware for exchange routes
router.use((req, res, next) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://dbx-frontend.onrender.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
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
      origin: req.headers.origin
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
    return res.status(200).json({ bars: [], error: 'no_data' });
  }
});

module.exports = router;
