const axios = require('axios');

// Robust CoinGecko ID mapping with updated identifiers
const COIN_ID_MAP = {
  'ETH': 'ethereum',
  'BTC': 'bitcoin', 
  'XRP': 'ripple',
  'XLM': 'stellar',
  'BNB': 'binancecoin',
  'MATIC': 'polygon-pos', // Updated from matic-network
  'SOL': 'solana',
  'XDC': 'xdc-network' // Updated from xdce-crowd-sale
};

// Quote currency aliases (USDT/USDC treated as USD)
const QUOTE_ALIASES = {
  'USD': 'usd',
  'USDT': 'usd', 
  'USDC': 'usd'
};

// 60-second in-memory cache
const priceCache = new Map();
const CACHE_TTL = 60 * 1000; // 60 seconds

/**
 * Get spot price for a trading pair with caching and cross-rate support
 * Route: GET /api/price?base=ETH&quote=USDT
 */
exports.getSpotPrice = async (req, res) => {
  const startTime = Date.now();
  const { base, quote } = req.query;
  
  console.log(`[DBX API] /api/price base=${base} quote=${quote} request started`);

  // Validate required parameters
  if (!base || !quote) {
    const result = {
      price: null,
      base: base || '',
      quote: quote || '',
      source: 'none',
      ts: Date.now()
    };
    console.log(`[DBX API] /api/price result=error (missing params)`);
    return res.status(200).json(result);
  }

  const baseUpper = base.toUpperCase();
  const quoteUpper = quote.toUpperCase();
  const cacheKey = `${baseUpper}-${quoteUpper}`;
  
  // Check cache first
  const cached = priceCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    const duration = Date.now() - startTime;
    console.log(`[DBX API] /api/price ${cacheKey} result=cached price=${cached.price} duration=${duration}ms`);
    return res.status(200).json({
      price: cached.price,
      base: baseUpper,
      quote: quoteUpper,
      source: 'coingecko',
      ts: Date.now()
    });
  }

  // Validate supported currencies
  if (!COIN_ID_MAP[baseUpper]) {
    const result = {
      price: null,
      base: baseUpper,
      quote: quoteUpper,
      source: 'none',
      ts: Date.now()
    };
    console.log(`[DBX API] /api/price ${cacheKey} result=error (unsupported base)`);
    return res.status(200).json(result);
  }

  try {
    const baseCoinId = COIN_ID_MAP[baseUpper];
    const targetQuote = QUOTE_ALIASES[quoteUpper] || quoteUpper.toLowerCase();
    
    let finalPrice = null;
    
    if (targetQuote === 'usd') {
      // Direct USD price fetch
      finalPrice = await fetchCoinGeckoPriceOptimized([baseCoinId]);
      finalPrice = finalPrice[baseCoinId];
    } else {
      // Cross-rate calculation for non-USD quotes
      const quoteCoinId = COIN_ID_MAP[quoteUpper];
      
      if (!quoteCoinId) {
        const result = {
          price: null,
          base: baseUpper,
          quote: quoteUpper,
          source: 'none',
          ts: Date.now()
        };
        console.log(`[DBX API] /api/price ${cacheKey} result=error (unsupported quote)`);
        return res.status(200).json(result);
      }
      
      // Fetch both prices in single API call
      const prices = await fetchCoinGeckoPriceOptimized([baseCoinId, quoteCoinId]);
      const basePrice = prices[baseCoinId];
      const quotePrice = prices[quoteCoinId];
      
      if (basePrice && quotePrice && quotePrice > 0) {
        finalPrice = basePrice / quotePrice;
      }
    }
    
    const duration = Date.now() - startTime;
    
    // Cache the result (even if null)
    priceCache.set(cacheKey, {
      price: finalPrice,
      timestamp: Date.now()
    });
    
    const result = {
      price: finalPrice,
      base: baseUpper,
      quote: quoteUpper,
      source: finalPrice !== null ? 'coingecko' : 'none',
      ts: Date.now()
    };
    
    console.log(`[DBX API] /api/price ${cacheKey} result=${finalPrice !== null ? 'success' : 'null'} price=${finalPrice} duration=${duration}ms`);
    return res.status(200).json(result);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const result = {
      price: null,
      base: baseUpper,
      quote: quoteUpper,
      source: 'none',
      ts: Date.now()
    };
    console.error(`[DBX API] /api/price ${cacheKey} result=error duration=${duration}ms error=${error.message}`);
    return res.status(200).json(result);
  }
};

/**
 * Fetch multiple prices from CoinGecko API in a single call
 * @param {string[]} coinIds - Array of CoinGecko coin IDs
 * @returns {Promise<Object>} Object with coinId -> price mapping
 */
async function fetchCoinGeckoPriceOptimized(coinIds) {
  try {
    const apiKey = process.env.COINGECKO_API_KEY;
    
    if (!apiKey) {
      console.warn('[DBX API] CoinGecko API key not configured');
      return {};
    }
    
    const url = `https://api.coingecko.com/api/v3/simple/price`;
    const params = {
      ids: coinIds.join(','),
      vs_currencies: 'usd',
      precision: 8
    };
    
    const headers = {
      'x-cg-pro-api-key': apiKey,
      'Accept': 'application/json'
    };
    
    console.log(`[DBX API] CoinGecko batch request: ${coinIds.join(',')}`);
    
    const response = await axios.get(url, { 
      params, 
      headers,
      timeout: 10000 // 10 second timeout
    });
    
    const prices = {};
    
    if (response.data) {
      for (const coinId of coinIds) {
        if (response.data[coinId] && response.data[coinId].usd) {
          prices[coinId] = response.data[coinId].usd;
          console.log(`[DBX API] CoinGecko response: ${coinId}=${prices[coinId]} usd`);
        } else {
          prices[coinId] = null;
          console.warn(`[DBX API] CoinGecko: No price data for ${coinId}`);
        }
      }
    }
    
    return prices;
    
  } catch (error) {
    if (error.response) {
      console.error(`[DBX API] CoinGecko API error: ${error.response.status} ${error.response.statusText}`);
      if (error.response.data) {
        console.error(`[DBX API] CoinGecko error details:`, error.response.data);
      }
    } else if (error.request) {
      console.error(`[DBX API] CoinGecko network error: ${error.message}`);
    } else {
      console.error(`[DBX API] CoinGecko request error: ${error.message}`);
    }
    return {};
  }
}

/**
 * Health check endpoint for price service
 */
exports.healthCheck = async (req, res) => {
  try {
    const apiKey = process.env.COINGECKO_API_KEY;
    const hasApiKey = !!apiKey;
    
    // Test a simple price fetch
    let testResult = null;
    if (hasApiKey) {
      try {
        const prices = await fetchCoinGeckoPriceOptimized(['bitcoin']);
        testResult = prices['bitcoin'];
      } catch (error) {
        testResult = `Error: ${error.message}`;
      }
    }
    
    const result = {
      service: 'price',
      status: hasApiKey ? 'configured' : 'missing_api_key',
      timestamp: Date.now(),
      supportedBases: Object.keys(COIN_ID_MAP),
      supportedQuotes: Object.keys(QUOTE_ALIASES),
      cacheSize: priceCache.size,
      testPrice: testResult
    };
    
    console.log(`[DBX API] /api/price/health result=${result.status}`);
    return res.status(200).json(result);
    
  } catch (error) {
    console.error(`[DBX API] /api/price/health error=${error.message}`);
    return res.status(500).json({
      service: 'price',
      status: 'error',
      timestamp: Date.now(),
      error: error.message
    });
  }
};
