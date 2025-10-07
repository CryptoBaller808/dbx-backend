const express = require('express');
const router = express.Router();

// CORS allowlist for TradingView datafeed
const allowedOrigins = [
  'https://dbx-frontend-staging.onrender.com',
  'https://dbx-frontend.onrender.com',
  'http://localhost:3000' // for local testing
];

// Cryptocurrency ID mapping for CoinGecko API
const COIN_ID_MAP = {
  'ETH': 'ethereum',
  'BTC': 'bitcoin',
  'XRP': 'ripple',
  'XLM': 'stellar',
  'BNB': 'binancecoin',
  'MATIC': 'matic-network',
  'SOL': 'solana',
  'XDC': 'xdce-crowd-sale'
};

// Resolution to days mapping for CoinGecko
const RESOLUTION_TO_DAYS = {
  '1': 1,     // 1 minute -> 1 day
  '5': 1,     // 5 minutes -> 1 day
  '15': 1,    // 15 minutes -> 1 day
  '60': 7,    // 1 hour -> 7 days
  '240': 30,  // 4 hours -> 30 days
  '1D': 365   // 1 day -> 365 days
};

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

// Helper function to fetch OHLC data from CoinGecko
async function fetchCoinGeckoOHLC(coinId, days) {
  const apiKey = process.env.COINGECKO_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️ [CoinGecko] API key not configured');
    return null;
  }

  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
    console.log('📈 [CoinGecko] Fetching:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-cg-pro-api-key': apiKey
      },
      timeout: 10000 // 10 second timeout
    });

    if (!response.ok) {
      console.error('❌ [CoinGecko] HTTP error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    console.log('✅ [CoinGecko] Received data points:', data?.length || 0);
    
    return data;
  } catch (error) {
    console.error('❌ [CoinGecko] Fetch error:', error.message);
    return null;
  }
}

// Helper function to transform CoinGecko OHLC data to TradingView format
function transformOHLCData(coinGeckoData, fromTimestamp, toTimestamp) {
  if (!Array.isArray(coinGeckoData)) {
    return [];
  }

  const fromMs = fromTimestamp * 1000;
  const toMs = toTimestamp * 1000;

  return coinGeckoData
    .filter(item => {
      // CoinGecko OHLC format: [timestamp, open, high, low, close]
      const timestamp = item[0];
      return timestamp >= fromMs && timestamp <= toMs;
    })
    .map(item => {
      const [timestamp, open, high, low, close] = item;
      return {
        time: timestamp, // TradingView expects milliseconds
        open: parseFloat(open),
        high: parseFloat(high),
        low: parseFloat(low),
        close: parseFloat(close),
        volume: 0 // CoinGecko OHLC doesn't include volume
      };
    })
    .filter(bar => {
      // Filter out invalid data
      return (
        Number.isFinite(bar.time) &&
        Number.isFinite(bar.open) &&
        Number.isFinite(bar.high) &&
        Number.isFinite(bar.low) &&
        Number.isFinite(bar.close) &&
        bar.open > 0 && bar.high > 0 && bar.low > 0 && bar.close > 0
      );
    })
    .sort((a, b) => a.time - b.time); // Sort by timestamp ascending
}

// GET /api/exchangeRates - Enhanced endpoint with CoinGecko integration
router.get('/', async (req, res) => {
  // Always set JSON content type
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    console.log('📊 [ExchangeRates] Request received:', {
      query: req.query,
      origin: req.headers.origin,
      allowed: allowedOrigins.includes(req.headers.origin)
    });

    const { 
      base = 'ETH', 
      quote = 'USDT', 
      resolution = '60', 
      from, 
      to 
    } = req.query;

    // Convert timestamps
    const fromTimestamp = from ? parseInt(from) : Math.floor(Date.now() / 1000) - 86400; // Default: 24h ago
    const toTimestamp = to ? parseInt(to) : Math.floor(Date.now() / 1000); // Default: now

    let bars = [];

    // Check if we support this base currency and quote is USD-based
    const coinId = COIN_ID_MAP[base.toUpperCase()];
    const isUSDQuote = ['USDT', 'USDC', 'USD'].includes(quote.toUpperCase());

    if (coinId && isUSDQuote) {
      // Determine days parameter based on resolution
      const days = RESOLUTION_TO_DAYS[resolution] || 7;
      
      console.log('📈 [ExchangeRates] Fetching CoinGecko data:', {
        base,
        coinId,
        quote,
        resolution,
        days,
        from: new Date(fromTimestamp * 1000).toISOString(),
        to: new Date(toTimestamp * 1000).toISOString()
      });

      // Fetch OHLC data from CoinGecko
      const coinGeckoData = await fetchCoinGeckoOHLC(coinId, days);
      
      if (coinGeckoData) {
        // Transform to TradingView format
        bars = transformOHLCData(coinGeckoData, fromTimestamp, toTimestamp);
        console.log('📊 [ExchangeRates] Transformed bars:', bars.length);
      } else {
        console.warn('⚠️ [ExchangeRates] No data from CoinGecko, returning empty bars');
      }
    } else {
      console.log('📊 [ExchangeRates] Unsupported pair or non-USD quote:', { base, quote, coinId, isUSDQuote });
    }

    console.log('📊 [ExchangeRates] Returning data:', { 
      base, 
      quote, 
      resolution, 
      dataPoints: bars.length,
      timeRange: bars.length > 0 ? {
        first: new Date(bars[0].time).toISOString(),
        last: new Date(bars[bars.length - 1].time).toISOString()
      } : null
    });

    return res.status(200).json({ 
      bars, 
      meta: { 
        base, 
        quote, 
        resolution, 
        from: fromTimestamp.toString(), 
        to: toTimestamp.toString(),
        source: coinId ? 'coingecko' : 'mock'
      }
    });

  } catch (e) {
    console.error('❌ [ExchangeRates] Error:', e);
    // Always return JSON, never HTML
    return res.status(200).json({ 
      bars: [], 
      error: 'no_data',
      meta: { 
        base: req.query.base || 'ETH', 
        quote: req.query.quote || 'USDT', 
        resolution: req.query.resolution || '60',
        source: 'error'
      }
    });
  }
});

module.exports = router;
