const axios = require('axios');

// Supported base currencies
const SUPPORTED_BASES = ['ETH', 'BTC', 'XRP', 'XLM', 'MATIC', 'BNB', 'SOL', 'XDC', 'AVAX'];

// CoinGecko ID mapping (only if CoinGecko is available)
const COINGECKO_IDS = {
  'ETH': 'ethereum',
  'BTC': 'bitcoin',
  'XRP': 'ripple',
  'XLM': 'stellar',
  'BNB': 'binancecoin',
  'MATIC': 'polygon-pos',
  'SOL': 'solana',
  'XDC': 'xdc-network',
  'AVAX': 'avalanche-2'
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
  'XDC': 'xinfin-network',
  'AVAX': 'avalanche'
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
    return res.status(502).json({
      error: 'missing_parameters',
      detail: 'Both base and quote parameters are required'
    });
  }

  const baseUpper = base.toUpperCase();
  const quoteUpper = quote.toUpperCase();
  
  // Validate supported base
  if (!SUPPORTED_BASES.includes(baseUpper)) {
    return res.status(502).json({
      error: 'unsupported_base',
      detail: `Base currency ${baseUpper} is not supported`
    });
  }
  
  // Validate supported quote
  if (!['USD', 'USDT', 'USDC'].includes(quoteUpper)) {
    return res.status(502).json({
      error: 'unsupported_quote',
      detail: `Quote currency ${quoteUpper} is not supported`
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
    let result = null;
    
    // Binance symbol mapping for direct support
    const binanceMap = {
      'BTC': 'BTCUSDT',
      'ETH': 'ETHUSDT', 
      'XRP': 'XRPUSDT',
      'XLM': 'XLMUSDT',
      'MATIC': 'MATICUSDT',
      'BNB': 'BNBUSDT',
      'SOL': 'SOLUSDT',
      'AVAX': 'AVAXUSDT'
    };
    
    if (quoteUpper === 'USDT' && binanceMap[baseUpper]) {
      // Try Binance first for supported pairs
      try {
        result = await fetchBinancePrice(baseUpper);
      } catch {
        // Binance failed, continue to fallbacks
      }
    } else if (baseUpper === 'XDC' && quoteUpper === 'USDT') {
      // XDC fallback chain: KuCoin -> CoinGecko
      try {
        result = await fetchKuCoinPrice('XDC-USDT');
      } catch {
        try {
          result = await fetchCoinGeckoPrice(baseUpper);
        } catch {
          result = await fetchCoinCapPrice(baseUpper);
        }
      }
    } else {
      // Try CoinCap and CoinGecko for other pairs
      try {
        result = await fetchCoinCapPrice(baseUpper);
      } catch {
        if (process.env.COINGECKO_API_KEY) {
          try {
            result = await fetchCoinGeckoPrice(baseUpper);
          } catch {
            // All providers failed
          }
        }
      }
    }
    
    // Ensure we have a valid result
    if (!result || !Number.isFinite(result.price) || result.price <= 0) {
      throw new Error('no_valid_price_found');
    }
    
    // Cache the successful result
    priceCache.set(cacheKey, {
      price: result.price,
      source: result.source,
      timestamp: Date.now()
    });
    
    return res.status(200).json({
      price: result.price,
      base: baseUpper,
      quote: quoteUpper,
      source: result.source,
      ts: Date.now()
    });
    
  } catch (error) {
    // Return 502 for price fetch failures (not 200 with null)
    return res.status(502).json({
      error: 'price_fetch_failed',
      detail: String(error?.message || error)
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
    // Binance symbol mapping
    const binanceMap = {
      'BTC': 'BTCUSDT',
      'ETH': 'ETHUSDT', 
      'XRP': 'XRPUSDT',
      'XLM': 'XLMUSDT',
      'MATIC': 'MATICUSDT',
      'BNB': 'BNBUSDT',
      'SOL': 'SOLUSDT',
      'AVAX': 'AVAXUSDT'
      // XDC not available on Binance - will fallback to other providers
    };
    
    const symbol = binanceMap[base];
    if (!symbol) {
      return null; // Not available on Binance
    }
    
    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
    
    const response = await axios.get(url, { timeout: 2500 });
    
    if (response.data && response.data.price) {
      const price = parseFloat(response.data.price);
      if (Number.isFinite(price) && price > 0) {
        return { price, source: 'binance' };
      }
    }
    
    throw new Error('binance_no_price');
    
  } catch (error) {
    throw new Error(`http_error_${error.response?.status || 'unknown'}`);
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
      if (Number.isFinite(price) && price > 0) {
        return { price, source: 'coincap' };
      }
    }
    
    throw new Error('cc_no_price');
    
  } catch (error) {
    throw new Error(`http_error_${error.response?.status || 'unknown'}`);
  }
}

/**
 * Fetch price from KuCoin (no API key required)
 * @param {string} symbol - Trading symbol (e.g., 'XDC-USDT')
 * @returns {Promise<{price: number, source: string}>} Price and source
 */
async function fetchKuCoinPrice(symbol) {
  try {
    const url = `https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${symbol}`;
    
    const response = await axios.get(url, { timeout: 5000 });
    
    if (response.data && response.data.data && response.data.data.price) {
      const price = parseFloat(response.data.data.price);
      if (Number.isFinite(price) && price > 0) {
        return { price, source: 'kucoin' };
      }
    }
    
    throw new Error('ku_bad_price');
    
  } catch (error) {
    throw new Error(`ku_http_${error.response?.status || 'error'}`);
  }
}

/**
 * Fetch price from CoinGecko (requires API key)
 * @param {string} base - Base currency symbol
 * @returns {Promise<{price: number, source: string}>} Price and source
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
      if (Number.isFinite(price) && price > 0) {
        return { price, source: 'coingecko' };
      }
    }
    
    // Try alternative XDC IDs for CoinGecko
    if (base === 'XDC') {
      const altIds = ['xinfin-network', 'xdce-crowd-sale'];
      for (const altId of altIds) {
        try {
          const altUrl = `https://api.coingecko.com/api/v3/simple/price`;
          const altParams = { ids: altId, vs_currencies: 'usd' };
          const altResponse = await axios.get(altUrl, { 
            params: altParams, 
            headers,
            timeout: 2500
          });
          
          if (altResponse.data && altResponse.data[altId] && altResponse.data[altId].usd) {
            const altPrice = altResponse.data[altId].usd;
            if (Number.isFinite(altPrice) && altPrice > 0) {
              return { price: altPrice, source: 'coingecko' };
            }
          }
        } catch {
          continue;
        }
      }
    }
    
    throw new Error('cg_no_price');
    
  } catch (error) {
    throw new Error(`http_error_${error.response?.status || 'unknown'}`);
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
