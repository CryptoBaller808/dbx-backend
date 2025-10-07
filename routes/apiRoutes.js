const express = require('express');
const router = express.Router();

// Mock data for development/testing
const mockBanners = {
  home: [{ id: 1, title: 'Home Banner', imageUrl: 'https://via.placeholder.com/800x400/0066cc/ffffff?text=Home+Banner', linkUrl: '/', status: 'active' }],
  buysell: [{ id: 2, title: 'Buy/Sell Banner', imageUrl: 'https://via.placeholder.com/800x400/00cc66/ffffff?text=Buy%2FSell+Banner', linkUrl: '/buysell', status: 'active' }],
  nft: [{ id: 3, title: 'NFT Banner', imageUrl: 'https://via.placeholder.com/800x400/cc6600/ffffff?text=NFT+Banner', linkUrl: '/nft', status: 'active' }]
};

const mockTokens = {
  ETH: [
    { symbol: 'ETH', name: 'Ethereum', address: null, decimals: 18, logoUrl: 'https://via.placeholder.com/32x32/627eea/ffffff?text=ETH', network: 'ETH' },
    { symbol: 'USDC', name: 'USD Coin', address: '0xA0b86a33E6441E6C6F6a3b4C6C6C6C6C6C6C6C6C', decimals: 6, logoUrl: 'https://via.placeholder.com/32x32/2775ca/ffffff?text=USDC', network: 'ETH' },
    { symbol: 'USDT', name: 'Tether', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, logoUrl: 'https://via.placeholder.com/32x32/26a17b/ffffff?text=USDT', network: 'ETH' }
  ],
  BTC: [
    { symbol: 'BTC', name: 'Bitcoin', address: null, decimals: 8, logoUrl: 'https://via.placeholder.com/32x32/f7931a/ffffff?text=BTC', network: 'BTC' }
  ],
  XRP: [
    { symbol: 'XRP', name: 'XRP', address: null, decimals: 6, logoUrl: 'https://via.placeholder.com/32x32/000000/ffffff?text=XRP', network: 'XRP' }
  ],
  XLM: [
    { symbol: 'XLM', name: 'Stellar Lumens', address: null, decimals: 7, logoUrl: 'https://via.placeholder.com/32x32/14b6e7/ffffff?text=XLM', network: 'XLM' }
  ]
};

const mockExchangeRates = [
  { pair: 'XRP/USD', rate: 0.52, change24h: 2.5, volume24h: 1250000 },
  { pair: 'ETH/USD', rate: 2650.00, change24h: -1.2, volume24h: 8500000 },
  { pair: 'BTC/USD', rate: 43500.00, change24h: 0.8, volume24h: 15000000 }
];

// CORS middleware for API routes
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Banner endpoints
router.get('/banners', (req, res) => {
  const { page } = req.query;
  const banners = mockBanners[page] || [];
  res.json(banners);
});

// Token endpoints
router.get('/tokens', (req, res) => {
  const { network } = req.query;
  if (network && mockTokens[network.toUpperCase()]) {
    res.json(mockTokens[network.toUpperCase()]);
  } else {
    // Return all tokens if no network specified
    const allTokens = Object.values(mockTokens).flat();
    res.json(allTokens);
  }
});

// Exchange rates endpoint - Updated for TradingView compatibility
router.get('/exchangeRates', (req, res) => {
  // Always set JSON content type
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    const { base='ETH', quote='USDT', resolution='60', from, to } = req.query;

    // TODO: plug real provider here; for now return empty bars gracefully
    const bars = []; // or build mock bars [{time: 1696200000000, open:..., high:..., low:..., close:..., volume:...}]

    return res.status(200).json({ bars, meta: { base, quote, resolution, from, to }});
  } catch (e) {
    console.error('exchangeRates error', e);
    return res.status(200).json({ bars: [], error: 'no_data' });
  }
});

module.exports = router;
