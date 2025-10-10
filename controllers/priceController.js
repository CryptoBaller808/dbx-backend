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
 * Get spot price for a trading pair with expanded fallback chain
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
      source: 'none',
      ts: Date.now()
    };
    console.log(`[PRICE] pair=${base || ''}/${quote || ''} vs=usd ids=[] source=error cache=miss price=null dur=0ms`);
    return res.status(200).json(result);
  }

  const baseUpper = base.toUpperCase();
  const quoteUpper = quote.toUpperCase();
  const cacheKey = `${baseUpper}-${quoteUpper}`;
  
  // Check cache first (only return cached if price is numeric)
  const cached = priceCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL && Number.isFinite(cached.price)) {
    const duration = Date.now() - startTime;
    console.log(`[PRICE] pair=${baseUpper}/${quoteUpper} vs=usd ids=[cached] source=cache cache=hit price=${cached.price} dur=${duration}ms`);
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
    const duration = Date.now() - startTime;
    const result = {
      price: null,
      base: baseUpper,
      quote: quoteUpper,
      source: 'none',
      ts: Date.now()
    };
    console.log(`[PRICE] pair=${baseUpper}/${quoteUpper} vs=usd ids=[] source=unsupported cache=miss price=null dur=${duration}ms`);
    return res.status(200).json(result);
  }

  try {
    const normalizedQuote = QUOTE_ALIAS[quoteUpper] || quoteUpper;
    let finalPrice = null;
    let source = 'none';
    let ids = [];
    
    if (normalizedQuote === 'USD') {
      // Single-asset pricing: BASE / USD(T/C) with expanded fallback chain
      const baseCoinId = ID[baseUpper];
      ids = [baseCoinId];
      
      // 1. Try simple/price first
      finalPrice = await fetchSimplePrice([baseCoinId]);
      if (Number.isFinite(finalPrice)) {
        source = 'coingecko';
      } else {
        // 2. Try coins/markets endpoint
        finalPrice = await fetchCoinsMarkets(baseCoinId);
        if (Number.isFinite(finalPrice)) {
          source = 'markets';
        } else {
          // 3. Try market_chart fallback
          finalPrice = await fetchMarketChartFallback(baseCoinId);
          if (Number.isFinite(finalPrice)) {
            source = 'market_chart';
          } else {
            // 4. Try legacy ID fallback (no cache)
            finalPrice = await fetchLegacyIdFallback(baseUpper);
            if (Number.isFinite(finalPrice)) {
              source = 'legacy';
            }
          }
        }
      }
      
    } else {
      // Cross-rate logic: ETH/BTC = (ETH/USD) / (BTC/USD)
      const quoteCoinId = ID[quoteUpper];
      
      if (!quoteCoinId) {
        const duration = Date.now() - startTime;
        const result = {
          price: null,
          base: baseUpper,
          quote: quoteUpper,
          source: 'none',
          ts: Date.now()
        };
        console.log(`[PRICE] pair=${baseUpper}/${quoteUpper} vs=usd ids=[] source=unsupported_quote cache=miss price=null dur=${duration}ms`);
        return res.status(200).json(result);
      }
      
      const baseCoinId = ID[baseUpper];
      ids = [baseCoinId, quoteCoinId];
      
      // Try to get both prices with fallback chain
      let basePrice = await fetchSimplePrice([baseCoinId]);
      let quotePrice = await fetchSimplePrice([quoteCoinId]);
      
      // Apply fallback chain for missing prices
      if (!Number.isFinite(basePrice)) {
        basePrice = await fetchCoinsMarkets(baseCoinId);
        if (!Number.isFinite(basePrice)) {
          basePrice = await fetchMarketChartFallback(baseCoinId);
          if (!Number.isFinite(basePrice)) {
            basePrice = await fetchLegacyIdFallback(baseUpper);
          }
        }
      }
      
      if (!Number.isFinite(quotePrice)) {
        quotePrice = await fetchCoinsMarkets(quoteCoinId);
        if (!Number.isFinite(quotePrice)) {
          quotePrice = await fetchMarketChartFallback(quoteCoinId);
          if (!Number.isFinite(quotePrice)) {
            quotePrice = await fetchLegacyIdFallback(quoteUpper);
          }
        }
      }
      
      if (Number.isFinite(basePrice) && Number.isFinite(quotePrice) && quotePrice > 0) {
        finalPrice = basePrice / quotePrice;
        source = 'cross';
      }
    }
    
    const duration = Date.now() - startTime;
    
    // Only cache numeric prices
    if (Number.isFinite(finalPrice)) {
      priceCache.set(cacheKey, {
        price: finalPrice,
        source: source,
        timestamp: Date.now()
      });
    }
    
    const result = {
      price: finalPrice,
      base: baseUpper,
      quote: quoteUpper,
      source: source,
      ts: Date.now()
    };
    
    console.log(`[PRICE] pair=${baseUpper}/${quoteUpper} vs=usd ids=[${ids.join(',')}] source=${source} cache=miss price=${finalPrice} dur=${duration}ms`);
    
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
    console.error(`[PRICE] pair=${baseUpper}/${quoteUpper} vs=usd ids=[] source=error cache=miss price=null dur=${duration}ms error=${error.message}`);
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
 * Fetch price from CoinGecko coins/markets endpoint
 * @param {string} coinId - CoinGecko coin ID
 * @returns {Promise<number|null>} Current price or null
 */
async function fetchCoinsMarkets(coinId) {
  try {
    const apiKey = process.env.COINGECKO_API_KEY;
    
    if (!apiKey) {
      return null;
    }
    
    const url = `https://api.coingecko.com/api/v3/coins/markets`;
    const params = {
      vs_currency: 'usd',
      ids: coinId,
      order: 'market_cap_desc',
      per_page: 1,
      page: 1,
      sparkline: false
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
    
    if (response.data && response.data.length > 0 && response.data[0].current_price) {
      const price = response.data[0].current_price;
      return typeof price === 'number' ? price : null;
    }
    
    return null;
    
  } catch (error) {
    console.error(`[PRICE] coins/markets error for ${coinId}: ${error.message}`);
    return null;
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
 * Legacy ID fallback for problematic coins (no cache)
 * @param {string} baseSymbol - Base currency symbol (e.g., 'MATIC', 'XDC')
 * @returns {Promise<number|null>} Price from legacy ID or null
 */
async function fetchLegacyIdFallback(baseSymbol) {
  const legacyIds = {
    'MATIC': 'matic-network',
    'XDC': 'xdce-crowd-sale'
  };
  
  const legacyId = legacyIds[baseSymbol];
  if (!legacyId) {
    return null;
  }
  
  try {
    const apiKey = process.env.COINGECKO_API_KEY;
    
    if (!apiKey) {
      return null;
    }
    
    // Try simple/price with legacy ID first
    let price = await fetchSimplePrice([legacyId]);
    if (Number.isFinite(price)) {
      return price;
    }
    
    // Try coins/markets with legacy ID
    price = await fetchCoinsMarkets(legacyId);
    if (Number.isFinite(price)) {
      return price;
    }
    
    // Try market_chart with legacy ID
    price = await fetchMarketChartFallback(legacyId);
    if (Number.isFinite(price)) {
      return price;
    }
    
    return null;
    
  } catch (error) {
    console.error(`[PRICE] legacy ID fallback error for ${baseSymbol} (${legacyId}): ${error.message}`);
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
