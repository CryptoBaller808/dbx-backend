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

// Binance configuration
const BINANCE_BASE_URL = 'https://api.binance.com';
const BINANCE_CACHE_TTL = 60 * 1000; // 60 seconds for rate limit compliance
const binanceCache = new Map();

// Binance symbol mapping - supported pairs
const BINANCE_SYMBOLS = {
  'BTC': ['BTCUSDT', 'BTCUSDC'],
  'ETH': ['ETHUSDT', 'ETHUSDC'], 
  'XRP': ['XRPUSDT', 'XRPUSDC'],
  'XLM': ['XLMUSDT'],
  'MATIC': ['MATICUSDT'],
  'BNB': ['BNBUSDT', 'BNBUSDC'],
  'SOL': ['SOLUSDT', 'SOLUSDC']
  // XDC not on Binance - will skip to CoinGecko path
};

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
      
      // 1. Try CoinGecko simple/price first
      finalPrice = await fetchSimplePrice([baseCoinId]);
      if (Number.isFinite(finalPrice)) {
        source = 'coingecko';
      } else {
        // 2. Try Binance as secondary provider
        const binanceResult = await fetchBinancePrice(baseUpper, quoteUpper);
        if (Number.isFinite(binanceResult.price)) {
          finalPrice = binanceResult.price;
          source = binanceResult.source; // 'binance' or 'binance_cross'
        } else {
          // 3. Try coins/markets endpoint
          finalPrice = await fetchCoinsMarkets(baseCoinId);
          if (Number.isFinite(finalPrice)) {
            source = 'markets';
          } else {
            // 4. Try market_chart fallback
          finalPrice = await fetchMarketChartFallback(baseCoinId);
          if (Number.isFinite(finalPrice)) {
            source = 'market_chart';
          } else {
            // 5. Try legacy ID fallback (no cache)
            finalPrice = await fetchLegacyIdFallback(baseUpper);
            if (Number.isFinite(finalPrice)) {
              source = 'legacy';
            } else {
              // 6. Try tickers fallback (highest-volume ticker)
              finalPrice = await fetchTickersFallback(baseUpper);
              if (Number.isFinite(finalPrice)) {
                source = 'tickers';
              }
            }
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
        // Try Binance for base currency
        const baseBinanceResult = await fetchBinancePrice(baseUpper, 'USDT');
        if (Number.isFinite(baseBinanceResult.price)) {
          basePrice = baseBinanceResult.price;
        } else {
          basePrice = await fetchCoinsMarkets(baseCoinId);
          if (!Number.isFinite(basePrice)) {
            basePrice = await fetchMarketChartFallback(baseCoinId);
            if (!Number.isFinite(basePrice)) {
              basePrice = await fetchLegacyIdFallback(baseUpper);
              if (!Number.isFinite(basePrice)) {
                basePrice = await fetchTickersFallback(baseUpper);
              }
            }
          }
        }
      }
      
      if (!Number.isFinite(quotePrice)) {
        // Try Binance for quote currency
        const quoteBinanceResult = await fetchBinancePrice(quoteUpper, 'USDT');
        if (Number.isFinite(quoteBinanceResult.price)) {
          quotePrice = quoteBinanceResult.price;
        } else {
          quotePrice = await fetchCoinsMarkets(quoteCoinId);
          if (!Number.isFinite(quotePrice)) {
            quotePrice = await fetchMarketChartFallback(quoteCoinId);
            if (!Number.isFinite(quotePrice)) {
              quotePrice = await fetchLegacyIdFallback(quoteUpper);
              if (!Number.isFinite(quotePrice)) {
                quotePrice = await fetchTickersFallback(quoteUpper);
              }
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
 * Tickers fallback: fetch price from highest-volume ticker
 * @param {string} baseSymbol - Base currency symbol (e.g., 'MATIC', 'XDC')
 * @returns {Promise<number|null>} Price from highest-volume ticker or null
 */
async function fetchTickersFallback(baseSymbol) {
  const primaryId = ID[baseSymbol];
  const legacyIds = {
    'MATIC': 'matic-network',
    'XDC': 'xdce-crowd-sale'
  };
  
  const idsToTry = [primaryId];
  if (legacyIds[baseSymbol]) {
    idsToTry.push(legacyIds[baseSymbol]);
  }
  
  for (const coinId of idsToTry) {
    if (!coinId) continue;
    
    try {
      const apiKey = process.env.COINGECKO_API_KEY;
      
      if (!apiKey) {
        continue;
      }
      
      const url = `https://api.coingecko.com/api/v3/coins/${coinId}/tickers`;
      const params = {
        include_exchange_logo: false
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
      
      if (response.data && response.data.tickers && Array.isArray(response.data.tickers)) {
        const tickers = response.data.tickers;
        
        // Find highest-volume ticker with USD/USDT/USDC target
        let bestTicker = null;
        let highestVolume = 0;
        
        for (const ticker of tickers) {
          if (!ticker.target || !ticker.last || !ticker.volume) continue;
          
          const target = ticker.target.toUpperCase();
          if (['USD', 'USDT', 'USDC'].includes(target)) {
            const volume = parseFloat(ticker.volume);
            const price = parseFloat(ticker.last);
            
            if (volume > highestVolume && Number.isFinite(price) && price > 0) {
              bestTicker = ticker;
              highestVolume = volume;
            }
          }
        }
        
        if (bestTicker) {
          const price = parseFloat(bestTicker.last);
          if (Number.isFinite(price)) {
            return price;
          }
        }
        
        // If no USD quotes, try BTC quotes for cross-rate
        let bestBtcTicker = null;
        let highestBtcVolume = 0;
        
        for (const ticker of tickers) {
          if (!ticker.target || !ticker.last || !ticker.volume) continue;
          
          const target = ticker.target.toUpperCase();
          if (target === 'BTC') {
            const volume = parseFloat(ticker.volume);
            const price = parseFloat(ticker.last);
            
            if (volume > highestBtcVolume && Number.isFinite(price) && price > 0) {
              bestBtcTicker = ticker;
              highestBtcVolume = volume;
            }
          }
        }
        
        if (bestBtcTicker) {
          // Get BTC/USD price for cross-rate calculation
          const btcUsdPrice = await fetchSimplePrice(['bitcoin']);
          if (Number.isFinite(btcUsdPrice) && btcUsdPrice > 0) {
            const btcPrice = parseFloat(bestBtcTicker.last);
            if (Number.isFinite(btcPrice) && btcPrice > 0) {
              const usdPrice = btcPrice * btcUsdPrice;
              if (Number.isFinite(usdPrice)) {
                return usdPrice;
              }
            }
          }
        }
      }
      
    } catch (error) {
      console.error(`[PRICE] tickers fallback error for ${baseSymbol} (${coinId}): ${error.message}`);
      continue;
    }
  }
  
  return null;
}

/**
 * Fetch price from Binance API
 * @param {string} baseSymbol - Base currency symbol (e.g., 'ETH', 'BTC')
 * @param {string} quoteSymbol - Quote currency symbol (e.g., 'USDT', 'USDC')
 * @returns {Promise<{price: number|null, source: string, symbol?: string, note?: string}>}
 */
async function fetchBinancePrice(baseSymbol, quoteSymbol) {
  const startTime = Date.now();
  
  // Check if base is supported on Binance
  if (!BINANCE_SYMBOLS[baseSymbol]) {
    return { price: null, source: 'none' };
  }
  
  // Normalize quote to USDT/USDC for Binance
  let targetQuote = quoteSymbol;
  if (quoteSymbol === 'USD') {
    targetQuote = 'USDT'; // Default USD to USDT on Binance
  }
  
  const supportedSymbols = BINANCE_SYMBOLS[baseSymbol];
  let binanceSymbol = null;
  let usesCross = false;
  
  // Find exact match first
  for (const symbol of supportedSymbols) {
    if (symbol.endsWith(targetQuote)) {
      binanceSymbol = symbol;
      break;
    }
  }
  
  // If no exact match and looking for USDC, try USDT with cross-rate note
  if (!binanceSymbol && targetQuote === 'USDC') {
    for (const symbol of supportedSymbols) {
      if (symbol.endsWith('USDT')) {
        binanceSymbol = symbol;
        usesCross = true;
        break;
      }
    }
  }
  
  if (!binanceSymbol) {
    return { price: null, source: 'none' };
  }
  
  // Check cache first
  const cacheKey = `binance:${binanceSymbol}`;
  const cached = binanceCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < BINANCE_CACHE_TTL) {
    const duration = Date.now() - startTime;
    const result = {
      price: cached.price,
      source: usesCross ? 'binance_cross' : 'binance',
      symbol: binanceSymbol
    };
    if (usesCross) {
      result.note = 'usdt≈usdc';
    }
    console.log(`[PRICE] pair=${baseSymbol}/${quoteSymbol} source=${result.source} symbol=${binanceSymbol} price=${cached.price} cache=hit dur=${duration}ms${result.note ? ` note=${result.note}` : ''}`);
    return result;
  }
  
  try {
    const url = `${BINANCE_BASE_URL}/api/v3/ticker/price`;
    const params = { symbol: binanceSymbol };
    
    // Use AbortController for better timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    
    const response = await axios.get(url, { 
      params,
      timeout: 2500,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.data && response.data.price) {
      const price = parseFloat(response.data.price);
      
      if (Number.isFinite(price) && price > 0) {
        // Cache the result
        binanceCache.set(cacheKey, {
          price: price,
          timestamp: Date.now()
        });
        
        const duration = Date.now() - startTime;
        const result = {
          price: price,
          source: usesCross ? 'binance_cross' : 'binance',
          symbol: binanceSymbol
        };
        if (usesCross) {
          result.note = 'usdt≈usdc';
        }
        
        console.log(`[PRICE] pair=${baseSymbol}/${quoteSymbol} source=${result.source} symbol=${binanceSymbol} price=${price} cache=miss dur=${duration}ms${result.note ? ` note=${result.note}` : ''}`);
        return result;
      }
    }
    
    return { price: null, source: 'none' };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[PRICE] binance error for ${baseSymbol}/${quoteSymbol} (${binanceSymbol}): ${error.message} dur=${duration}ms`);
    return { price: null, source: 'none' };
  }
}

/**
 * Check Binance service health
 * @returns {Promise<string>} Status: 'ok', 'degraded', or 'down'
 */
async function checkBinanceHealth() {
  try {
    const response = await axios.get(`${BINANCE_BASE_URL}/api/v3/ticker/price`, {
      params: { symbol: 'BTCUSDT' },
      timeout: 2500 // Match the timeout used in fetchBinancePrice
    });
    
    if (response.data && response.data.price && Number.isFinite(parseFloat(response.data.price))) {
      return 'ok';
    }
    return 'degraded';
  } catch (error) {
    console.error(`[BINANCE] Health check failed: ${error.message}`);
    return 'down';
  }
}

/**
 * Health check endpoint for price service
 */
exports.healthCheck = async (req, res) => {
  try {
    const apiKey = process.env.COINGECKO_API_KEY;
    const hasApiKey = !!apiKey;
    
    // Provider status (static - no external calls for health endpoint)
    const coinGeckoStatus = hasApiKey ? 'configured' : 'missing_api_key';
    const binanceStatus = 'ok'; // Binance public API doesn't need key
    
    // Get last source per pair from cache
    const lastSources = {};
    for (const [key, value] of priceCache.entries()) {
      if (value && value.source) {
        lastSources[key] = value.source;
      }
    }
    
    // Calculate cache stats
    const cacheStats = {
      coingecko: { hit: 0, miss: 0 },
      binance: { hit: 0, miss: 0 }
    };
    
    // Note: In a production system, you'd track hit/miss stats during operations
    // For now, we'll show cache sizes
    cacheStats.coingecko.size = priceCache.size;
    cacheStats.binance.size = binanceCache.size;
    
    const result = {
      service: 'price',
      status: hasApiKey ? 'configured' : 'missing_api_key',
      timestamp: Date.now(),
      providers: {
        coingecko: coinGeckoStatus,
        binance: binanceStatus
      },
      supportedBases: Object.keys(ID),
      supportedQuotes: Object.keys(QUOTE_ALIAS),
      binanceSymbols: BINANCE_SYMBOLS,
      fallbackTiers: ['coingecko', 'binance', 'markets', 'market_chart', 'legacy', 'tickers', 'cross'],
      cacheSize: priceCache.size,
      cacheStats: cacheStats,
      lastSources: lastSources
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
