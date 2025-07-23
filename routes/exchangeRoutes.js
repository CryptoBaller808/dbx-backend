const express = require('express');
const router = express.Router();
const exchangeController = require('../controllers/exchangeController');
const tokenController = require('../controllers/tokenController');

// Exchange Routes
router.get('/exchange/list', exchangeController.getAllPairs);
router.get('/tokens/list', tokenController.getAllTokens);

module.exports = router;

