const axios = require('axios');

// Supported base currencies mapping to CoinGecko IDs
const SUPPORTED_BASES = {
  'ETH': 'ethereum',
  'BTC': 'bitcoin',
  'XRP': 'ripple',
  'XLM': 'stellar',
  'BNB': 'binancecoin',
  'MATIC': 'matic-network',
  'SOL': 'solana',
  'XDC': 'xdce-crowd-sale'
};

// Quote currency aliases (all treated as USD)
const QUOTE_ALIASES = {
  'USD': 'usd',
  'USDT': 'usd',
  'USDC': 'usd'
};

/**
 * Get spot price for a trading pair
 * Route: GET /api/price?base=ETH&quote=USDT
 */
exports.getSpotPrice = async (req, res) => {
  const startTime = Date.now();
  const { base, quote } = req.query;
  const pair = `${base}-${quote}`;
  
  console.log(`[DBX API] /api/price pair=${pair} request started`);

  // Validate required parameters
  if (!base || !quote) {
    const result = {
      pair,
      lastPrice: null,
      ts: Date.now(),
      source: 'none',
      error: 'Missing base or quote parameter'
    };
    console.log(`[DBX API] /api/price pair=${pair} result=error (missing params)`);
    return res.status(200).json(result);
  }

  // Validate supported base currency
  const baseUpper = base.toUpperCase();
  const quoteUpper = quote.toUpperCase();
  
  if (!SUPPORTED_BASES[baseUpper]) {
    const result = {
      pair: `${baseUpper}-${quoteUpper}`,
      lastPrice: null,
      ts: Date.now(),
      source: 'none',
      error: `Unsupported base currency: ${baseUpper}`
    };
    console.log(`[DBX API] /api/price pair=${pair} result=error (unsupported base)`);
    return res.status(200).json(result);
  }

  try {
    // Get CoinGecko ID for base currency
    const baseCoinId = SUPPORTED_BASES[baseUpper];
    
    // Determine target quote currency
    const targetQuote = QUOTE_ALIASES[quoteUpper] || quoteUpper.toLowerCase();
    
    let finalPrice = null;
    
    if (targetQuote === 'usd') {
      // Direct USD price fetch
      finalPrice = await fetchCoinGeckoPrice(baseCoinId, 'usd');
    } else {
      // Cross-rate calculation for non-USD quotes
      const quoteCoinId = SUPPORTED_BASES[quoteUpper];
      
      if (!quoteCoinId) {
        const result = {
          pair: `${baseUpper}-${quoteUpper}`,
          lastPrice: null,
          ts: Date.now(),
          source: 'none',
          error: `Unsupported quote currency: ${quoteUpper}`
        };
        console.log(`[DBX API] /api/price pair=${pair} result=error (unsupported quote)`);
        return res.status(200).json(result);
      }
      
      // Fetch both prices and calculate cross rate
      const [basePrice, quotePrice] = await Promise.all([
        fetchCoinGeckoPrice(baseCoinId, 'usd'),
        fetchCoinGeckoPrice(quoteCoinId, 'usd')
      ]);
      
      if (basePrice && quotePrice && quotePrice > 0) {
        finalPrice = basePrice / quotePrice;
      }
    }
    
    const duration = Date.now() - startTime;
    
    if (finalPrice !== null) {
      const result = {
        pair: `${baseUpper}-${quoteUpper}`,
        lastPrice: parseFloat(finalPrice.toFixed(8)),
        ts: Date.now(),
        source: 'coingecko'
      };
      console.log(`[DBX API] /api/price pair=${pair} result=success price=${finalPrice} duration=${duration}ms`);
      return res.status(200).json(result);
    } else {
      const result = {
        pair: `${baseUpper}-${quoteUpper}`,
        lastPrice: null,
        ts: Date.now(),
        source: 'none',
        error: 'Price data not available from CoinGecko'
      };
      console.log(`[DBX API] /api/price pair=${pair} result=null duration=${duration}ms`);
      return res.status(200).json(result);
    }
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const result = {
      pair: `${baseUpper}-${quoteUpper}`,
      lastPrice: null,
      ts: Date.now(),
      source: 'none',
      error: error.message
    };
    console.error(`[DBX API] /api/price pair=${pair} result=error duration=${duration}ms error=${error.message}`);
    return res.status(200).json(result);
  }
};

/**
 * Fetch price from CoinGecko API
 * @param {string} coinId - CoinGecko coin ID
 * @param {string} vsCurrency - Target currency (usually 'usd')
 * @returns {Promise<number|null>} Price or null if failed
 */
async function fetchCoinGeckoPrice(coinId, vsCurrency = 'usd') {
  try {
    const apiKey = process.env.COINGECKO_API_KEY;
    
    if (!apiKey) {
      console.warn('[DBX API] CoinGecko API key not configured');
      return null;
    }
    
    const url = `https://pro-api.coingecko.com/api/v3/simple/price`;
    const params = {
      ids: coinId,
      vs_currencies: vsCurrency,
      precision: 8
    };
    
    const headers = {
      'x-cg-pro-api-key': apiKey,
      'Accept': 'application/json'
    };
    
    console.log(`[DBX API] CoinGecko request: ${coinId}/${vsCurrency}`);
    
    const response = await axios.get(url, { 
      params, 
      headers,
      timeout: 10000 // 10 second timeout
    });
    
    if (response.data && response.data[coinId] && response.data[coinId][vsCurrency]) {
      const price = response.data[coinId][vsCurrency];
      console.log(`[DBX API] CoinGecko response: ${coinId}=${price} ${vsCurrency}`);
      return price;
    }
    
    console.warn(`[DBX API] CoinGecko: No price data for ${coinId}/${vsCurrency}`);
    return null;
    
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
        testResult = await fetchCoinGeckoPrice('bitcoin', 'usd');
      } catch (error) {
        testResult = `Error: ${error.message}`;
      }
    }
    
    const result = {
      service: 'price',
      status: hasApiKey ? 'configured' : 'missing_api_key',
      timestamp: Date.now(),
      supportedBases: Object.keys(SUPPORTED_BASES),
      supportedQuotes: Object.keys(QUOTE_ALIASES),
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
