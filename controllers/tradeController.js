/**
 * Trade Controller
 * Paper trading engine for DBX-63 MVP
 * In-memory, stateless across deploys
 */

const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

// Feature flags from environment
const TRADING_ENABLED = process.env.TRADING_ENABLED !== 'false'; // Default true
const TRADING_FEE_BPS = parseInt(process.env.TRADING_FEE_BPS || '25'); // 0.25%
const MAX_ORDER_USD = parseInt(process.env.MAX_ORDER_USD || '50000');
const RISK_BLOCKLIST_BASE = (process.env.RISK_BLOCKLIST_BASE || '').split(',').filter(Boolean);

// In-memory ring buffer for recent fills (last 50 per process)
const recentFills = [];
const MAX_RECENT_FILLS = 50;

/**
 * Helper: Get current price from existing price API
 */
async function getCurrentPrice(base, quote) {
  try {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
    const response = await axios.get(`${baseUrl}/api/price`, {
      params: { base, quote },
      timeout: 5000
    });
    
    if (response.data && response.data.price) {
      return {
        price: parseFloat(response.data.price),
        provider: response.data.source || 'unknown'
      };
    }
    
    return null;
  } catch (error) {
    console.error('[TRADE] Error fetching price:', error.message);
    return null;
  }
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
 */
exports.getQuote = async (req, res) => {
  const requestPath = req.originalUrl.split('?')[0];
  console.log(`[TRADE] path=${requestPath} method=GET action=quote`);
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
    
    // Calculate amounts
    const amountBase = amountNum;
    const amountQuote = amountBase * price;
    const feeQuote = (amountQuote * TRADING_FEE_BPS) / 10000;
    
    // Check max order size
    if (amountQuote > MAX_ORDER_USD) {
      return res.status(400).json({
        ok: false,
        code: 'VALIDATION_ERROR',
        errors: {
          amount: `Order size exceeds maximum of $${MAX_ORDER_USD.toLocaleString()}`
        }
      });
    }
    
    console.log(`[TRADE] quote base=${base} quote=${quote} side=${side} amount=${amountBase} price=${price} provider=${provider}`);
    
    res.json({
      ok: true,
      pair,
      side: side.toLowerCase(),
      price,
      amountBase,
      amountQuote,
      feeQuote,
      provider,
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

