
const express = require('express');
const router = express.Router();
let crossChainController;

try {
  crossChainController = require('../controllers/crossChainController');
} catch (err) {
  console.error('⚠️ Failed to load crossChainController:', err.message);
  crossChainController = {
    swapTokens: (req, res) => {
      res.status(501).json({ message: 'swapTokens temporarily unavailable. Controller not loaded.' });
    }
  };
}

// Safe routing with fallback
router.post('/api/crosschain/swap', (req, res, next) => {
  try {
    if (typeof crossChainController.swapTokens === 'function') {
      return crossChainController.swapTokens(req, res, next);
    } else {
      throw new Error('swapTokens handler is not defined');
    }
  } catch (err) {
    console.error('Route handler error:', err.message);
    res.status(500).json({ error: 'Internal server error on swap route.' });
  }
});

module.exports = router;
