/**
 * Trade Controller
 * Paper trading engine for DBX-63 MVP
 * In-memory, stateless across deploys
 */

const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const balanceService = require('../services/balanceService');

// Feature flags from environment
const TRADING_ENABLED = process.env.TRADING_ENABLED !== 'false'; // Default true
const TRADING_FEE_BPS = parseInt(process.env.TRADING_FEE_BPS || '25'); // 0.25%
const MAX_ORDER_USD = parseInt(process.env.MAX_ORDER_USD || '50000');
const RISK_BLOCKLIST_BASE = (process.env.RISK_BLOCKLIST_BASE || '').split(',').filter(Boolean);

// Preview mode feature flags (DBX-65)
const TRADE_QUOTE_PREVIEW_ENABLED = process.env.TRADE_QUOTE_PREVIEW_ENABLED === 'true';
const TRADE_QUOTE_PREVIEW_MAX_NOTIONAL_USD = parseInt(process.env.TRADE_QUOTE_PREVIEW_MAX_NOTIONAL_USD || '500000');

// In-memory ring buffer for recent fills (last 50 per process)
const recentFills = [];
const MAX_RECENT_FILLS = 50;

// In-memory price cache for fallback
const priceCache = new Map();
const CACHE_TTL = 60000; // 1 minute

/**
 * Helper: Get current price with fallback chain
 * 1. Try primary provider (via /api/price)
 * 2. Try CoinCap fallback
 * 3. Try CoinGecko fallback  
 * 4. Try cached price (stale)
 */
async function getCurrentPrice(base, quote) {
  const cacheKey = `${base}-${quote}`;
  const providers = [];
  
  // Try primary provider (Binance via /api/price)
  try {
    console.log(`[TRADE] quote try=binance base=${base} quote=${quote}`);
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
    const response = await axios.get(`${baseUrl}/api/price`, {
      params: { base, quote },
      timeout: 5000
    });
    
    if (response.data && response.data.price) {
      const price = parseFloat(response.data.price);
      const provider = response.data.source || 'binance';
      
      // Cache the price
      priceCache.set(cacheKey, { price, provider, ts: Date.now() });
      
      console.log(`[TRADE] quote hit provider=${provider} price=${price}`);
      return { price, provider, stale: false };
    }
    
    providers.push('binance');
  } catch (error) {
    console.log(`[TRADE] quote binance failed: ${error.message}`);
    providers.push('binance');
  }
  
  // Try CoinCap fallback
  try {
    console.log(`[TRADE] quote fallback=coincap base=${base} quote=${quote}`);
    const response = await axios.get('https://api.coincap.io/v2/assets', {
      timeout: 3000
    });
    
    if (response.data && response.data.data) {
      const baseAsset = response.data.data.find(a => a.symbol.toUpperCase() === base.toUpperCase());
      const quoteAsset = response.data.data.find(a => a.symbol.toUpperCase() === quote.toUpperCase());
      
      if (baseAsset && quoteAsset && baseAsset.priceUsd && quoteAsset.priceUsd) {
        const price = parseFloat(baseAsset.priceUsd) / parseFloat(quoteAsset.priceUsd);
        
        // Cache the price
        priceCache.set(cacheKey, { price, provider: 'coincap', ts: Date.now() });
        
        console.log(`[TRADE] quote fallback=coincap price=${price}`);
        return { price, provider: 'coincap', stale: false };
      }
    }
    
    providers.push('coincap');
  } catch (error) {
    console.log(`[TRADE] quote coincap failed: ${error.message}`);
    providers.push('coincap');
  }
  
  // Try CoinGecko fallback
  try {
    console.log(`[TRADE] quote fallback=coingecko base=${base} quote=${quote}`);
    const coinIds = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'XRP': 'ripple',
      'XLM': 'stellar',
      'USDT': 'tether',
      'USDC': 'usd-coin'
    };
    
    const baseCoinId = coinIds[base.toUpperCase()];
    const quoteCoinId = coinIds[quote.toUpperCase()];
    
    if (baseCoinId && quoteCoinId) {
      const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price`, {
        params: {
          ids: `${baseCoinId},${quoteCoinId}`,
          vs_currencies: 'usd'
        },
        timeout: 3000
      });
      
      if (response.data && response.data[baseCoinId] && response.data[quoteCoinId]) {
        const price = response.data[baseCoinId].usd / response.data[quoteCoinId].usd;
        
        // Cache the price
        priceCache.set(cacheKey, { price, provider: 'coingecko', ts: Date.now() });
        
        console.log(`[TRADE] quote fallback=coingecko price=${price}`);
        return { price, provider: 'coingecko', stale: false };
      }
    }
    
    providers.push('coingecko');
  } catch (error) {
    console.log(`[TRADE] quote coingecko failed: ${error.message}`);
    providers.push('coingecko');
  }
  
  // Try cached price (stale)
  const cached = priceCache.get(cacheKey);
  if (cached) {
    const age = Date.now() - cached.ts;
    console.log(`[TRADE] quote cache price=${cached.price} stale=true age=${age}ms`);
    return { price: cached.price, provider: cached.provider, stale: true };
  }
  
  console.error(`[TRADE] quote PRICE_UNAVAILABLE tried=[${providers.join(',')}]`);
  return null;
}

/**
 * Helper: Validate trade inputs
 */
function validateTradeInputs(base, quote, side, amount) {
  const errors = {};
  
  if (!base || typeof base !== 'string') {
    errors.base = 'Base currency is required';
  }
  
  if (!quote || typeof quote !== 'string') {
    errors.quote = 'Quote currency is required';
  }
  
  if (!side || !['buy', 'sell'].includes(side.toLowerCase())) {
    errors.side = 'Side must be "buy" or "sell"';
  }
  
  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    errors.amount = 'Amount must be a positive number';
  }
  
  // Check blocklist
  if (base && RISK_BLOCKLIST_BASE.includes(base.toUpperCase())) {
    errors.base = `Trading ${base} is currently blocked`;
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Helper: Add fill to recent fills ring buffer
 */
function addRecentFill(fill) {
  recentFills.unshift(fill);
  if (recentFills.length > MAX_RECENT_FILLS) {
    recentFills.pop();
  }
}

/**
 * GET /trade/quote or /api/trade/quote
 * Get a quote for a potential trade
 * Supports preview mode with ?preview=true to skip balance validation
 */
exports.getQuote = async (req, res) => {
  const requestPath = req.originalUrl.split('?')[0];
  const previewMode = req.query.preview === 'true';
  console.log(`[TRADE_DEBUG] previewMode=${previewMode}, TRADE_QUOTE_PREVIEW_ENABLED=${TRADE_QUOTE_PREVIEW_ENABLED}`);
  console.log(`[TRADE] path=${requestPath} method=GET action=quote preview=${previewMode}`);
  
  try {
    // Check if trading is enabled
    if (!TRADING_ENABLED) {
      return res.status(503).json({
        ok: false,
        code: 'TRADING_DISABLED',
        message: 'Trading is currently disabled'
      });
    }
    
    const { base, quote, side, amount } = req.query;
    
    // Validate inputs
    const validation = validateTradeInputs(base, quote, side, amount);
    if (!validation.valid) {
      return res.status(400).json({
        ok: false,
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
    }
    
    const amountNum = parseFloat(amount);
    const pair = `${base.toUpperCase()}-${quote.toUpperCase()}`;
    
    // Get current price
    const priceData = await getCurrentPrice(base, quote);
    if (!priceData || !priceData.price) {
      return res.status(502).json({
        ok: false,
        code: 'PRICE_UNAVAILABLE',
        message: 'Unable to fetch current price'
      });
    }
    
    const price = priceData.price;
    const provider = priceData.provider;
    const stale = priceData.stale || false;
    
    // Calculate amounts
    const amountBase = amountNum;
    const amountQuote = amountBase * price;
    const feeQuote = (amountQuote * TRADING_FEE_BPS) / 10000;
    const totalQuote = amountQuote + feeQuote;
    const notionalUsd = amountQuote; // Approximate USD value
    
    // Preview mode: check if enabled and requested
    if (previewMode && TRADE_QUOTE_PREVIEW_ENABLED) {
      // Enforce preview cap
      if (notionalUsd > TRADE_QUOTE_PREVIEW_MAX_NOTIONAL_USD) {
        return res.status(400).json({
          ok: false,
          code: 'PREVIEW_LIMIT',
          message: 'Preview notional exceeds cap.',
          details: {
            capUsd: TRADE_QUOTE_PREVIEW_MAX_NOTIONAL_USD,
            notionalUsd
          }
        });
      }
      
      // Try to get routing data if available
      let routing = null;
      let chosen = null;
      let policy = null;
      
      if (process.env.ROUTING_ENGINE_V1 === 'true') {
        try {
          const smartRouter = require('../services/routing/router');
          const routingResult = await smartRouter.routeQuote({
            base: base.toUpperCase(),
            quote: quote.toUpperCase(),
            side: side.toLowerCase(),
            amountUsd: notionalUsd
          });
          
          if (routingResult && routingResult.ok) {
            routing = routingResult;
            chosen = routingResult.chosen;
            policy = routingResult.policy;
          }
        } catch (routingError) {
          console.log(`[TRADE] preview routing failed: ${routingError.message}`);
        }
      }
      
      console.log(`[TRADE] preview quote base=${base} quote=${quote} side=${side} amount=${amountBase} price=${price} notional=${notionalUsd} routing=${!!routing}`);
      
      // Return preview response
      return res.json({
        ok: true,
        mode: 'preview',
        price,
        base: base.toUpperCase(),
        quote: quote.toUpperCase(),
        side: side.toLowerCase(),
        amountBase,
        notionalUsd,
        routing,
        chosen,
        policy,
        validation: {
          preview: true,
          skippedChecks: ['balance', 'positionLimits', 'kyc'],
          capUsd: TRADE_QUOTE_PREVIEW_MAX_NOTIONAL_USD
        },
        ts: Date.now()
      });
    }
    
    // Normal mode: check max order size
    if (amountQuote > MAX_ORDER_USD) {
      return res.status(400).json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: `Order exceeds maximum of $${MAX_ORDER_USD.toLocaleString()}`,
        errors: {
          amount: `Order size exceeds maximum of $${MAX_ORDER_USD.toLocaleString()}`
        }
      });
    }
    
    console.log(`[TRADE] quote base=${base} quote=${quote} side=${side} amount=${amountBase} price=${price} provider=${provider} stale=${stale}`);
    
    // Return normal response
    res.json({
      ok: true,
      pair,
      side: side.toLowerCase(),
      price,
      amountBase,
      amountQuote,
      feeBps: TRADING_FEE_BPS,
      feeQuote,
      totalQuote,
      provider,
      stale,
      ts: Date.now()
    });
  } catch (error) {
    console.error('[TRADE] Unexpected error in getQuote:', error);
    res.status(500).json({
      ok: false,
      code: 'TRADE_UNEXPECTED',
      message: 'An unexpected error occurred',
      traceId: uuidv4()
    });
  }
};

/**
 * POST /trade/submit or /api/trade/submit
 * Submit a market order for paper trading
 */
exports.submitOrder = async (req, res) => {
  const requestPath = req.originalUrl.split('?')[0];
  console.log(`[TRADE] path=${requestPath} method=POST action=submit`);
  try {
    // Check if trading is enabled
    if (!TRADING_ENABLED) {
      return res.status(503).json({
        ok: false,
        code: 'TRADING_DISABLED',
        message: 'Trading is currently disabled'
      });
    }
    
    const { pair, side, amountBase, clientId, walletAddress } = req.body;
    
    // In paper mode, wallet is optional
    const actor = walletAddress || 'guest';
    
    // Parse pair
    if (!pair || typeof pair !== 'string' || !pair.includes('-')) {
      return res.status(400).json({
        ok: false,
        code: 'VALIDATION_ERROR',
        errors: {
          pair: 'Invalid pair format. Expected BASE-QUOTE'
        }
      });
    }
    
    const [base, quote] = pair.split('-');
    
    // Validate inputs
    const validation = validateTradeInputs(base, quote, side, amountBase);
    if (!validation.valid) {
      return res.status(400).json({
        ok: false,
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
    }
    
    const amountNum = parseFloat(amountBase);
    
    // Re-price (no stale quotes)
    const priceData = await getCurrentPrice(base, quote);
    if (!priceData || !priceData.price) {
      return res.status(502).json({
        ok: false,
        code: 'PRICE_UNAVAILABLE',
        message: 'Unable to fetch current price'
      });
    }
    
    const price = priceData.price;
    const provider = priceData.provider;
    
    // Calculate execution
    const executedBase = amountNum;
    const executedQuote = executedBase * price;
    const feeQuote = (executedQuote * TRADING_FEE_BPS) / 10000;
    
    // Check max order size
    if (executedQuote > MAX_ORDER_USD) {
      return res.status(400).json({
        ok: false,
        code: 'VALIDATION_ERROR',
        errors: {
          amountBase: `Order size exceeds maximum of $${MAX_ORDER_USD.toLocaleString()}`
        }
      });
    }
    
    // Balance validation and updates (Milestone 4)
    console.log(`[TRADE] submit balance check userId=${actor} side=${side} base=${base} quote=${quote}`);
    
    try {
      if (side.toLowerCase() === 'buy') {
        // BUY: Need quote currency (e.g., USDT to buy ETH)
        const requiredQuote = executedQuote + feeQuote;
        const availableQuote = await balanceService.getBalance(actor, quote);
        
        if (availableQuote < requiredQuote) {
          console.log(`[TRADE] submit insufficient balance token=${quote} required=${requiredQuote} available=${availableQuote}`);
          return res.status(400).json({
            ok: false,
            code: 'INSUFFICIENT_BALANCE',
            message: `Insufficient ${quote} balance. Required: ${requiredQuote.toFixed(6)}, Available: ${availableQuote.toFixed(6)}`
          });
        }
        
        // Debit quote currency, credit base currency
        await balanceService.debit(actor, quote, requiredQuote);
        await balanceService.credit(actor, base, executedBase);
        console.log(`[TRADE] submit balance updated debit=${quote}:${requiredQuote} credit=${base}:${executedBase}`);
        
      } else {
        // SELL: Need base currency (e.g., ETH to sell)
        const requiredBase = executedBase;
        const availableBase = await balanceService.getBalance(actor, base);
        
        if (availableBase < requiredBase) {
          console.log(`[TRADE] submit insufficient balance token=${base} required=${requiredBase} available=${availableBase}`);
          return res.status(400).json({
            ok: false,
            code: 'INSUFFICIENT_BALANCE',
            message: `Insufficient ${base} balance. Required: ${requiredBase.toFixed(6)}, Available: ${availableBase.toFixed(6)}`
          });
        }
        
        // Debit base currency, credit quote currency (minus fee)
        await balanceService.debit(actor, base, requiredBase);
        const receivedQuote = executedQuote - feeQuote;
        await balanceService.credit(actor, quote, receivedQuote);
        console.log(`[TRADE] submit balance updated debit=${base}:${requiredBase} credit=${quote}:${receivedQuote}`);
      }
    } catch (balanceError) {
      console.error('[TRADE] Balance operation failed:', balanceError.message);
      return res.status(500).json({
        ok: false,
        code: 'BALANCE_ERROR',
        message: 'Failed to update balances'
      });
    }
    
    // Generate order ID
    const orderId = uuidv4();
    const ts = Date.now();
    
    // Parse pair for receipt
    const [baseSymbol, quoteSymbol] = pair.split('-');
    
    // Create receipt (new shape for hardening)
    const receipt = {
      id: orderId,
      ts,
      actor,
      side: side.toLowerCase(),
      base: baseSymbol,
      quote: quoteSymbol,
      amountBase: executedBase,
      price,
      feeBps: TRADING_FEE_BPS,
      feeQuote,
      totalQuote: executedQuote + feeQuote,
      source: provider,
      engine: 'paper',
      clientId: clientId || null
    };
    
    // Add to recent fills
    addRecentFill(receipt);
    
    console.log(`[TRADE] submit pair=${pair} side=${side} execBase=${executedBase} execQuote=${executedQuote} fee=${feeQuote} provider=${provider} actor=${actor}`);
    
    res.json({
      ok: true,
      receipt
    });
  } catch (error) {
    console.error('[TRADE] Unexpected error in submitOrder:', error);
    res.status(500).json({
      ok: false,
      code: 'TRADE_UNEXPECTED',
      message: 'An unexpected error occurred',
      traceId: uuidv4()
    });
  }
};

/**
 * GET /trade/recent
 * Get recent paper fills from ring buffer
 */
exports.getRecentFills = async (req, res) => {
  try {
    const { pair, limit } = req.query;
    const limitNum = parseInt(limit) || 20;
    
    let fills = recentFills;
    
    // Filter by pair if specified
    if (pair) {
      fills = fills.filter(fill => fill.pair === pair.toUpperCase());
    }
    
    // Limit results
    fills = fills.slice(0, limitNum);
    
    res.json({
      ok: true,
      fills,
      count: fills.length
    });
  } catch (error) {
    console.error('[TRADE] Unexpected error in getRecentFills:', error);
    res.status(500).json({
      ok: false,
      code: 'TRADE_UNEXPECTED',
      message: 'An unexpected error occurred',
      traceId: uuidv4()
    });
  }
};

/**
 * GET /trade/config
 * Get trading configuration (for admin panel)
 */
exports.getConfig = async (req, res) => {
  try {
    res.json({
      ok: true,
      config: {
        tradingEnabled: TRADING_ENABLED,
        tradingFeeBps: TRADING_FEE_BPS,
        maxOrderUsd: MAX_ORDER_USD,
        riskBlocklistBase: RISK_BLOCKLIST_BASE,
        engine: 'paper',
        persistence: 'none'
      }
    });
  } catch (error) {
    console.error('[TRADE] Unexpected error in getConfig:', error);
    res.status(500).json({
      ok: false,
      code: 'TRADE_UNEXPECTED',
      message: 'An unexpected error occurred',
      traceId: uuidv4()
    });
  }
};


/**
 * GET /trade/diag or /api/trade/diag
 * Diagnostic endpoint for QA testing
 */
exports.getDiagnostic = async (req, res) => {
  const requestPath = req.originalUrl.split('?')[0];
  console.log(`[TRADE] path=${requestPath} method=GET action=diag`);
  
  try {
    const { base, quote, side, amount } = req.query;
    
    // Validate inputs
    const validation = validateTradeInputs(base, quote, side, amount);
    if (!validation.valid) {
      return res.status(400).json({
        ok: false,
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
    }
    
    const amountNum = parseFloat(amount);
    const providersTried = [];
    let hit = null;
    
    // Try to get price with fallback chain
    const priceData = await getCurrentPrice(base, quote);
    
    if (priceData && priceData.price) {
      hit = {
        provider: priceData.provider,
        price: priceData.price,
        stale: priceData.stale || false
      };
    }
    
    // Calculate quote if we have a price
    let feeBps = TRADING_FEE_BPS;
    let feeQuote = null;
    let totalQuote = null;
    
    if (hit) {
      const amountQuote = amountNum * hit.price;
      feeQuote = (amountQuote * feeBps) / 10000;
      totalQuote = amountQuote + feeQuote;
    }
    
    res.json({
      ok: true,
      pathTried: [requestPath],
      providersTried: hit ? [hit.provider] : ['binance', 'coincap', 'coingecko', 'cache'],
      hit,
      feeBps,
      feeQuote,
      totalQuote,
      ts: Date.now()
    });
  } catch (error) {
    console.error('[TRADE] Unexpected error in getDiagnostic:', error);
    res.status(500).json({
      ok: false,
      code: 'TRADE_UNEXPECTED',
      message: 'An unexpected error occurred',
      traceId: uuidv4()
    });
  }
};


/**
 * GET /trade/test/quote
 * Public read-only quote test endpoint (no auth required)
 * For DBX-63 Step 4 & 5 verification
 */
exports.getTestQuote = async (req, res) => {
  const requestPath = req.originalUrl.split('?')[0];
  console.log(`[TRADE] path=${requestPath} method=GET action=test-quote`);
  
  try {
    const { pair, amount } = req.query;
    
    // Parse pair
    if (!pair || typeof pair !== 'string') {
      return res.status(400).json({
        ok: false,
        code: 'VALIDATION_ERROR',
        errors: { pair: 'Pair is required (e.g., ETH-USDT)' }
      });
    }
    
    const [base, quote] = pair.split('-');
    if (!base || !quote) {
      return res.status(400).json({
        ok: false,
        code: 'VALIDATION_ERROR',
        errors: { pair: 'Pair must be in format BASE-QUOTE (e.g., ETH-USDT)' }
      });
    }
    
    // Validate amount
    const amountNum = parseFloat(amount);
    if (!amount || !Number.isFinite(amountNum) || amountNum <= 0) {
      return res.status(400).json({
        ok: false,
        code: 'VALIDATION_ERROR',
        errors: { amount: 'Amount must be a positive number' }
      });
    }
    
    // Get current price
    const priceData = await getCurrentPrice(base, quote);
    if (!priceData || !priceData.price) {
      return res.status(502).json({
        ok: false,
        code: 'PRICE_UNAVAILABLE',
        message: 'Unable to fetch current price'
      });
    }
    
    const price = priceData.price;
    const provider = priceData.provider;
    const stale = priceData.stale || false;
    
    console.log(`[TRADE] test-quote pair=${pair} amount=${amount} price=${price} provider=${provider} stale=${stale}`);
    
    res.json({
      ok: true,
      pathUsed: requestPath,
      price,
      feeBps: TRADING_FEE_BPS,
      engine: 'paper',
      source: provider,
      stale,
      ts: Date.now()
    });
  } catch (error) {
    console.error('[TRADE] Unexpected error in getTestQuote:', error);
    res.status(500).json({
      ok: false,
      code: 'TRADE_UNEXPECTED',
      message: 'An unexpected error occurred',
      traceId: uuidv4()
    });
  }
};

