const express = require('express');
const router = express.Router();
const portfolioController = require('../controllers/portfolioController');

// GET /portfolio - Get user portfolio
router.get('/', portfolioController.getPortfolio);

// POST /portfolio/deposit - Demo faucet
router.post('/deposit', portfolioController.depositDemoFunds);

// POST /portfolio/reset - Reset portfolio (admin)
router.post('/reset', portfolioController.resetPortfolio);

module.exports = router;

