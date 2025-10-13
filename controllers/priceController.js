const axios = require('axios');

// Supported base currencies
const SUPPORTED_BASES = ['ETH', 'BTC', 'XRP', 'XLM', 'MATIC', 'BNB', 'SOL', 'XDC'];

// CoinGecko ID mapping (only if CoinGecko is available)
const COINGECKO_IDS = {
  'ETH': 'ethereum',
  'BTC': 'bitcoin',
  'XRP': 'ripple',
  'XLM': 'stellar',
  'BNB': 'binancecoin',
  'MATIC': 'polygon-pos',
  'SOL': 'solana',
  'XDC': 'xdc-network'
};

// CoinCap ID mapping
const COINCAP_IDS = {
  'ETH': 'ethereum',
  'BTC': 'bitcoin',
  'XRP': 'xrp',
  'XLM': 'stellar',
  'MATIC': 'polygon',
  'BNB': 'binance-coin',
  'SOL': 'solana',
  'XDC': 'xinfin-network'
};

// 60-second in-memory cache
const priceCache = new Map();
const CACHE_TTL = 60 * 1000; // 60 seconds

/**
 * Get spot price for a trading pair
 * Route: GET /api/price?base=ETH&quote=USDT
 */
exports.getSpotPrice = async (req, res) => {
  const { base, quote } = req.query;
  
  // Validate parameters
  if (!base || !quote) {
    return res.status(200).json({
      price: null,
      base: base || '',
      quote: quote || '',
      source: 'none',
      ts: Date.now()
    });
  }

  const baseUpper = base.toUpperCase();
  const quoteUpper = quote.toUpperCase();
  
  // Validate supported base
  if (!SUPPORTED_BASES.includes(baseUpper)) {
    return res.status(200).json({
      price: null,
      base: baseUpper,
      quote: quoteUpper,
      source: 'none',
      ts: Date.now()
    });
  }
  
  // Validate supported quote
  if (!['USD', 'USDT', 'USDC'].includes(quoteUpper)) {
    return res.status(200).json({
      price: null,
      base: baseUpper,
      quote: quoteUpper,
      source: 'none',
      ts: Date.now()
    });
  }

  const cacheKey = `${baseUpper}-${quoteUpper}`;
  
  // Check cache first (only return cached if price is numeric)
  const cached = priceCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL && Number.isFinite(cached.price)) {
    return res.status(200).json({
      price: cached.price,
      base: baseUpper,
      quote: quoteUpper,
      source: cached.source,
      ts: Date.now()
    });
  }

  try {
    let price = null;
    let source = 'none';
    
    // Try Binance first (no key required)
    if (quoteUpper === 'USDT' || quoteUpper === 'USD') {
      price = await fetchBinancePrice(baseUpper);
      if (Number.isFinite(price)) {
        source = 'binance';
      }
    } else if (quoteUpper === 'USDC') {
      // For USDC, get USDT price and mark as binance_cross
      price = await fetchBinancePrice(baseUpper);
      if (Number.isFinite(price)) {
        source = 'binance_cross';
      }
    }
    
    // If Binance failed, try CoinCap (no key required)
    if (!Number.isFinite(price)) {
      if (quoteUpper === 'USDT' || quoteUpper === 'USD') {
        price = await fetchCoinCapPrice(baseUpper);
        if (Number.isFinite(price)) {
          source = 'coincap';
        }
      } else if (quoteUpper === 'USDC') {
        // For USDC, get USD price and mark as coincap_cross
        price = await fetchCoinCapPrice(baseUpper);
        if (Number.isFinite(price)) {
          source = 'coincap_cross';
        }
      }
    }
    
    // If CoinCap failed, try CoinGecko (if API key is available)
    if (!Number.isFinite(price) && process.env.COINGECKO_API_KEY) {
      price = await fetchCoinGeckoPrice(baseUpper);
      if (Number.isFinite(price)) {
        source = 'coingecko';
      }
    }
    
    // Cache only finite numbers
    if (Number.isFinite(price)) {
      priceCache.set(cacheKey, {
        price: price,
        source: source,
        timestamp: Date.now()
      });
    }
    
    return res.status(200).json({
      price: price,
      base: baseUpper,
      quote: quoteUpper,
      source: source,
      ts: Date.now()
    });
    
  } catch (error) {
    // Never throw - always return 200 with null price
    return res.status(200).json({
      price: null,
      base: baseUpper,
      quote: quoteUpper,
      source: 'none',
      ts: Date.now()
    });
  }
};

/**
 * Fetch price from Binance (no API key required)
 * @param {string} base - Base currency symbol
 * @returns {Promise<number|null>} Price or null
 */
async function fetchBinancePrice(base) {
  try {
    const symbol = `${base}USDT`;
    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
    
    const response = await axios.get(url, { timeout: 2500 });
    
    if (response.data && response.data.price) {
      const price = parseFloat(response.data.price);
      return Number.isFinite(price) ? price : null;
    }
    
    return null;
    
  } catch (error) {
    return null;
  }
}

/**
 * Fetch price from CoinCap (no API key required)
 * @param {string} base - Base currency symbol
 * @returns {Promise<number|null>} Price or null
 */
async function fetchCoinCapPrice(base) {
  try {
    const coinId = COINCAP_IDS[base];
    if (!coinId) {
      return null;
    }
    
    const url = `https://api.coincap.io/v2/assets/${coinId}`;
    
    // Use AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    
    const response = await axios.get(url, { 
      signal: controller.signal,
      timeout: 2500
    });
    
    clearTimeout(timeoutId);
    
    if (response.data && response.data.data && response.data.data.priceUsd) {
      const price = parseFloat(response.data.data.priceUsd);
      return Number.isFinite(price) ? price : null;
    }
    
    return null;
    
  } catch (error) {
    return null;
  }
}

/**
 * Fetch price from CoinGecko (requires API key)
 * @param {string} base - Base currency symbol
 * @returns {Promise<number|null>} Price or null
 */
async function fetchCoinGeckoPrice(base) {
  try {
    const coinId = COINGECKO_IDS[base];
    if (!coinId) {
      return null;
    }
    
    const apiKey = process.env.COINGECKO_API_KEY;
    if (!apiKey) {
      return null;
    }
    
    const url = `https://api.coingecko.com/api/v3/simple/price`;
    const params = {
      ids: coinId,
      vs_currencies: 'usd'
    };
    
    const headers = {
      'x-cg-pro-api-key': apiKey,
      'Accept': 'application/json'
    };
    
    const response = await axios.get(url, { 
      params, 
      headers,
      timeout: 2500
    });
    
    if (response.data && response.data[coinId] && response.data[coinId].usd) {
      const price = response.data[coinId].usd;
      return Number.isFinite(price) ? price : null;
    }
    
    return null;
    
  } catch (error) {
    return null;
  }
}

// Keep the health check for compatibility
exports.healthCheck = async (req, res) => {
  const providers = {
    binance: "configured",
    coincap: "configured"
  };
  
  if (process.env.COINGECKO_API_KEY) {
    providers.coingecko = "configured";
  }
  
  res.status(200).json({
    status: 'ok',
    service: 'price',
    providers,
    ts: Date.now()
  });
};
