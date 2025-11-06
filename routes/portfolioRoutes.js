/**
 * Portfolio Routes
 * API endpoints for user balance management
 */

const express = require('express');
const router = express.Router();
const portfolioController = require('../controllers/portfolioController');

// GET /api/portfolio - Get user balances
router.get('/', portfolioController.getPortfolio);

// POST /api/portfolio/deposit - Add demo funds
router.post('/deposit', portfolioController.deposit);

// POST /api/portfolio/reset - Reset all balances
router.post('/reset', portfolioController.reset);

module.exports = router;

