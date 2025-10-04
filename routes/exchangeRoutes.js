const express = require('express');
const router = express.Router();

// GET /api/exchangeRates - Public endpoint for TradingView chart data
router.get('/', async (req, res) => {
  try {
    console.log('📊 [ExchangeRates] Request received:', {
      query: req.query,
      origin: req.headers.origin
    });

    const { base, quote, resolution, from, to } = req.query;
    
    // For now, return empty array (TradingView will show "no data")
    // In production, this would fetch real market data
    const mockData = [];
    
    console.log('📊 [ExchangeRates] Returning data:', { 
      base, quote, resolution, 
      dataPoints: mockData.length 
    });
    
    res.json(mockData);
  } catch (error) {
    console.error('❌ [ExchangeRates] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
