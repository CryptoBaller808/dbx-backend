/**
 * Portfolio Controller
 * Manages user balances and demo fund operations
 */

const balanceService = require('../services/balanceService');

// Default deposit amounts for demo faucet
const DEFAULT_DEPOSITS = {
  BTC: 1.0,
  ETH: 10.0,
  XRP: 10000.0,
  XLM: 10000.0,
  USDT: 50000.0,
  USDC: 50000.0
};

/**
 * GET /api/portfolio
 * Get all balances for a user
 * Hardened to prevent 500 errors - returns empty balances on failure
 */
async function getPortfolio(req, res) {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        ok: false,
        code: 'MISSING_USER_ID',
        message: 'userId query parameter is required'
      });
    }
    
    console.log(`[PORTFOLIO] getPortfolio userId=${userId}`);
    
    const balances = await balanceService.getBalances(userId);
    
    res.json({
      ok: true,
      userId,
      balances
    });
  } catch (error) {
    console.error('[PORTFOLIO] ERROR getPortfolio:', error.message);
    console.error('[PORTFOLIO] Stack trace:', error.stack);
    
    // Prevent UI from breaking – return empty balances instead of 500
    // This ensures the frontend can still render even if the backend has issues
    const userId = req.query.userId || 'unknown';
    res.status(200).json({
      ok: true,
      userId,
      balances: []
    });
  }
}

/**
 * POST /api/portfolio/deposit
 * Add demo funds to user balance (faucet)
 */
async function deposit(req, res) {
  try {
    const { userId, token, amount } = req.body;
    
    if (!userId || !token) {
      return res.status(400).json({
        ok: false,
        code: 'MISSING_PARAMETERS',
        message: 'userId and token are required'
      });
    }
    
    // Use provided amount or default
    const depositAmount = amount || DEFAULT_DEPOSITS[token.toUpperCase()] || 1.0;
    
    console.log(`[PORTFOLIO] deposit userId=${userId} token=${token} amount=${depositAmount}`);
    
    const newBalance = await balanceService.credit(userId, token.toUpperCase(), depositAmount);
    
    res.json({
      ok: true,
      depositAmount,
      token: token.toUpperCase(),
      newBalance
    });
  } catch (error) {
    console.error('[PORTFOLIO] ERROR deposit:', error.message);
    res.status(500).json({
      ok: false,
      code: 'SERVER_ERROR',
      message: 'Failed to deposit funds'
    });
  }
}

/**
 * POST /api/portfolio/reset
 * Delete all balances for a user (reset demo funds)
 */
async function reset(req, res) {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        ok: false,
        code: 'MISSING_USER_ID',
        message: 'userId is required'
      });
    }
    
    console.log(`[PORTFOLIO] reset userId=${userId}`);
    
    const balancesDeleted = await balanceService.resetDemo(userId);
    
    res.json({
      ok: true,
      balancesDeleted
    });
  } catch (error) {
    console.error('[PORTFOLIO] ERROR reset:', error.message);
    res.status(500).json({
      ok: false,
      code: 'SERVER_ERROR',
      message: 'Failed to reset portfolio'
    });
  }
}

module.exports = {
  getPortfolio,
  deposit,
  reset
};
