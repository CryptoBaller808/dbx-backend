/**
 * Portfolio Controller
 * Manages user portfolio and demo faucet
 */

const balanceService = require('../services/balanceService');

// Demo faucet amounts
const DEMO_FAUCET_AMOUNTS = {
  'BTC': 0.1,
  'ETH': 2.0,
  'XRP': 1000,
  'XLM': 1000,
  'USDT': 10000,
  'USDC': 10000
};

/**
 * GET /portfolio
 * Get user portfolio (all balances)
 */
exports.getPortfolio = async (req, res) => {
  try {
    // Get user ID from query or default to 'guest'
    const userId = req.query.userId || req.query.walletAddress || 'guest';
    
    console.log(`[PORTFOLIO] getPortfolio userId=${userId}`);
    
    // Get all balances
    const balances = await balanceService.getBalances(userId);
    
    // Filter out zero balances
    const nonZeroBalances = balances.filter(b => b.amount > 0);
    
    res.json({
      ok: true,
      userId,
      balances: nonZeroBalances,
      totalBalances: nonZeroBalances.length,
      ts: Date.now()
    });
  } catch (error) {
    console.error('[PORTFOLIO] getPortfolio error:', error);
    res.status(500).json({
      ok: false,
      code: 'PORTFOLIO_ERROR',
      message: 'Failed to fetch portfolio'
    });
  }
};

/**
 * POST /portfolio/deposit
 * Demo faucet - add demo funds to user balance
 */
exports.depositDemoFunds = async (req, res) => {
  try {
    const { userId, walletAddress, token, amount } = req.body;
    
    // Get user ID
    const user = userId || walletAddress || 'guest';
    
    // Validate inputs
    if (!token) {
      return res.status(400).json({
        ok: false,
        code: 'VALIDATION_ERROR',
        errors: {
          token: 'Token is required'
        }
      });
    }
    
    const tokenUpper = token.toUpperCase();
    
    // If amount is provided, use it (admin override)
    // Otherwise, use demo faucet amount
    let depositAmount;
    if (amount !== undefined && amount !== null) {
      depositAmount = parseFloat(amount);
      if (isNaN(depositAmount) || depositAmount <= 0) {
        return res.status(400).json({
          ok: false,
          code: 'VALIDATION_ERROR',
          errors: {
            amount: 'Amount must be a positive number'
          }
        });
      }
    } else {
      // Use demo faucet amount
      depositAmount = DEMO_FAUCET_AMOUNTS[tokenUpper];
      if (!depositAmount) {
        return res.status(400).json({
          ok: false,
          code: 'VALIDATION_ERROR',
          errors: {
            token: `Token ${tokenUpper} not supported by demo faucet. Supported: ${Object.keys(DEMO_FAUCET_AMOUNTS).join(', ')}`
          }
        });
      }
    }
    
    console.log(`[PORTFOLIO] depositDemoFunds userId=${user} token=${tokenUpper} amount=${depositAmount}`);
    
    // Credit the balance
    const newBalance = await balanceService.credit(user, tokenUpper, depositAmount, 'demo_faucet');
    
    res.json({
      ok: true,
      userId: user,
      token: tokenUpper,
      depositAmount,
      newBalance,
      ts: Date.now()
    });
  } catch (error) {
    console.error('[PORTFOLIO] depositDemoFunds error:', error);
    res.status(500).json({
      ok: false,
      code: 'DEPOSIT_ERROR',
      message: 'Failed to deposit demo funds'
    });
  }
};

/**
 * POST /portfolio/reset
 * Reset all balances for a user (admin function)
 */
exports.resetPortfolio = async (req, res) => {
  try {
    const { userId, walletAddress } = req.body;
    
    // Get user ID
    const user = userId || walletAddress;
    
    if (!user) {
      return res.status(400).json({
        ok: false,
        code: 'VALIDATION_ERROR',
        errors: {
          userId: 'User ID or wallet address is required'
        }
      });
    }
    
    console.log(`[PORTFOLIO] resetPortfolio userId=${user}`);
    
    // Reset all balances
    const deleted = await balanceService.resetBalances(user);
    
    res.json({
      ok: true,
      userId: user,
      balancesDeleted: deleted,
      ts: Date.now()
    });
  } catch (error) {
    console.error('[PORTFOLIO] resetPortfolio error:', error);
    res.status(500).json({
      ok: false,
      code: 'RESET_ERROR',
      message: 'Failed to reset portfolio'
    });
  }
};

module.exports = {
  getPortfolio,
  depositDemoFunds,
  resetPortfolio
};

