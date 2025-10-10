const axios = require('axios');

// Authoritative CoinGecko ID mapping
const ID = {
  'ETH': 'ethereum',
  'BTC': 'bitcoin',
  'XRP': 'ripple',
  'XLM': 'stellar',
  'BNB': 'binancecoin',
  'MATIC': 'polygon-pos',   // (not matic-network)
  'SOL': 'solana',
  'XDC': 'xdc-network'      // (not xdce-crowd-sale)
};

// Quote currency aliases - USDT/USDC treated as USD
const QUOTE_ALIAS = { 
  'USDT': 'USD', 
  'USDC': 'USD', 
  'USD': 'USD' 
};

// 60-second in-memory cache
const priceCache = new Map();
const CACHE_TTL = 60 * 1000; // 60 seconds

/**
 * Get spot price for a trading pair with robust fallback system
 * Route: GET /api/price?base=ETH&quote=USDT
 */
exports.getSpotPrice = async (req, res) => {
  const startTime = Date.now();
  const { base, quote } = req.query;
  
  // Validate required parameters
  if (!base || !quote) {
    const result = {
      price: null,
      base: base || '',
      quote: quote || '',
      source: 'coingecko',
      ts: Date.now()
    };
    console.log(`[PRICE] pair=${base || ''}/${quote || ''} vs=usd ids=[] price=null source=error cache=miss`);
    return res.status(200).json(result);
  }

  const baseUpper = base.toUpperCase();
  const quoteUpper = quote.toUpperCase();
  const cacheKey = `${baseUpper}-${quoteUpper}`;
  
  // Check cache first
  const cached = priceCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.log(`[PRICE] pair=${baseUpper}/${quoteUpper} vs=usd ids=[cached] price=${cached.price} source=cache cache=hit`);
    return res.status(200).json({
      price: cached.price,
      base: baseUpper,
      quote: quoteUpper,
      source: cached.source || 'coingecko',
      ts: Date.now()
    });
  }

  // Validate supported currencies
  if (!ID[baseUpper]) {
    const result = {
      price: null,
      base: baseUpper,
      quote: quoteUpper,
      source: 'coingecko',
      ts: Date.now()
    };
    console.log(`[PRICE] pair=${baseUpper}/${quoteUpper} vs=usd ids=[] price=null source=unsupported cache=miss`);
    return res.status(200).json(result);
  }

  try {
    const normalizedQuote = QUOTE_ALIAS[quoteUpper] || quoteUpper;
    let finalPrice = null;
    let source = 'coingecko';
    let ids = [];
    
    if (normalizedQuote === 'USD') {
      // Single-asset pricing: BASE / USD(T/C)
      const baseCoinId = ID[baseUpper];
      ids = [baseCoinId];
      
      // Try simple/price first
      finalPrice = await fetchSimplePrice([baseCoinId]);
      
      if (finalPrice === null) {
        // Robust fallback: try market_chart
        finalPrice = await fetchMarketChartFallback(baseCoinId);
        source = 'fallback';
      }
      
    } else {
      // Cross-rate logic: ETH/BTC = (ETH/USD) / (BTC/USD)
      const quoteCoinId = ID[quoteUpper];
      
      if (!quoteCoinId) {
        const result = {
          price: null,
          base: baseUpper,
          quote: quoteUpper,
          source: 'coingecko',
          ts: Date.now()
        };
        console.log(`[PRICE] pair=${baseUpper}/${quoteUpper} vs=usd ids=[] price=null source=unsupported_quote cache=miss`);
        return res.status(200).json(result);
      }
      
      const baseCoinId = ID[baseUpper];
      ids = [baseCoinId, quoteCoinId];
      
      // Fetch both prices for cross-rate calculation
      const prices = await fetchSimplePrice([baseCoinId, quoteCoinId]);
      const basePrice = prices[baseCoinId];
      const quotePrice = prices[quoteCoinId];
      
      if (basePrice !== null && quotePrice !== null && quotePrice > 0) {
        finalPrice = basePrice / quotePrice;
      } else {
        // Try fallback for missing prices
        const fallbackBase = basePrice === null ? await fetchMarketChartFallback(baseCoinId) : basePrice;
        const fallbackQuote = quotePrice === null ? await fetchMarketChartFallback(quoteCoinId) : quotePrice;
        
        if (fallbackBase !== null && fallbackQuote !== null && fallbackQuote > 0) {
          finalPrice = fallbackBase / fallbackQuote;
          source = 'fallback';
        }
      }
    }
    
    // Cache the result (even if null)
    priceCache.set(cacheKey, {
      price: finalPrice,
      source: source,
      timestamp: Date.now()
    });
    
    const result = {
      price: finalPrice,
      base: baseUpper,
      quote: quoteUpper,
      source: source,
      ts: Date.now()
    };
    
    console.log(`[PRICE] pair=${baseUpper}/${quoteUpper} vs=usd ids=[${ids.join(',')}] price=${finalPrice} source=${source} cache=miss`);
    
    // Log warning if price is null with raw payload info
    if (finalPrice === null) {
      console.warn(`[PRICE] WARN price:null for ${baseUpper}/${quoteUpper} - check CoinGecko data availability`);
    }
    
    return res.status(200).json(result);
    
  } catch (error) {
    const result = {
      price: null,
      base: baseUpper,
      quote: quoteUpper,
      source: 'coingecko',
      ts: Date.now()
    };
    console.error(`[PRICE] pair=${baseUpper}/${quoteUpper} vs=usd ids=[] price=null source=error cache=miss error=${error.message}`);
    return res.status(200).json(result);
  }
};

/**
 * Fetch prices using CoinGecko simple/price endpoint
 * @param {string[]} coinIds - Array of CoinGecko coin IDs
 * @returns {Promise<Object>} Object with coinId -> price mapping
 */
async function fetchSimplePrice(coinIds) {
  try {
    const apiKey = process.env.COINGECKO_API_KEY;
    
    if (!apiKey) {
      console.warn('[PRICE] CoinGecko API key not configured');
      const result = {};
      coinIds.forEach(id => result[id] = null);
      return result;
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
    
    const response = await axios.get(url, { 
      params, 
      headers,
      timeout: 10000
    });
    
    const prices = {};
    
    if (response.data) {
      for (const coinId of coinIds) {
        if (response.data[coinId] && typeof response.data[coinId].usd === 'number') {
          prices[coinId] = response.data[coinId].usd;
        } else {
          prices[coinId] = null;
        }
      }
    } else {
      coinIds.forEach(id => prices[id] = null);
    }
    
    // For single coin requests, return the price directly
    if (coinIds.length === 1) {
      return prices[coinIds[0]];
    }
    
    return prices;
    
  } catch (error) {
    console.error(`[PRICE] simple/price error: ${error.message}`);
    const result = {};
    coinIds.forEach(id => result[id] = null);
    return coinIds.length === 1 ? null : result;
  }
}

/**
 * Fallback: fetch price from market_chart endpoint (last close)
 * @param {string} coinId - CoinGecko coin ID
 * @returns {Promise<number|null>} Last close price or null
 */
async function fetchMarketChartFallback(coinId) {
  try {
    const apiKey = process.env.COINGECKO_API_KEY;
    
    if (!apiKey) {
      return null;
    }
    
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`;
    const params = {
      vs_currency: 'usd',
      days: 1
    };
    
    const headers = {
      'x-cg-pro-api-key': apiKey,
      'Accept': 'application/json'
    };
    
    const response = await axios.get(url, { 
      params, 
      headers,
      timeout: 10000
    });
    
    if (response.data && response.data.prices && response.data.prices.length > 0) {
      // Get the last price point [timestamp, price]
      const lastPrice = response.data.prices[response.data.prices.length - 1][1];
      return typeof lastPrice === 'number' ? lastPrice : null;
    }
    
    return null;
    
  } catch (error) {
    console.error(`[PRICE] market_chart fallback error for ${coinId}: ${error.message}`);
    return null;
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
        testResult = await fetchSimplePrice(['bitcoin']);
      } catch (error) {
        testResult = `Error: ${error.message}`;
      }
    }
    
    const result = {
      service: 'price',
      status: hasApiKey ? 'configured' : 'missing_api_key',
      timestamp: Date.now(),
      supportedBases: Object.keys(ID),
      supportedQuotes: Object.keys(QUOTE_ALIAS),
      cacheSize: priceCache.size,
      testPrice: testResult
    };
    
    console.log(`[PRICE] /api/price/health result=${result.status}`);
    return res.status(200).json(result);
    
  } catch (error) {
    console.error(`[PRICE] /api/price/health error=${error.message}`);
    return res.status(500).json({
      service: 'price',
      status: 'error',
      timestamp: Date.now(),
      error: error.message
    });
  }
};
