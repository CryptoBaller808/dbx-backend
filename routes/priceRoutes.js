const express = require('express');
const router = express.Router();
const coinGeckoService = require('../services/coinGeckoService');

/**
 * @swagger
 * /api/price:
 *   get:
 *     summary: Get current price for a token
 *     tags: [Price]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token symbol (e.g., bitcoin, ethereum, BTC, ETH)
 *       - in: query
 *         name: vs_currency
 *         schema:
 *           type: string
 *           default: usd
 *         description: Currency to get price in
 *     responses:
 *       200:
 *         description: Current token price
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     price:
 *                       type: number
 *                     change_24h:
 *                       type: number
 *                     volume_24h:
 *                       type: number
 *                     last_updated:
 *                       type: number
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.get('/price', async (req, res) => {
  try {
    const { token, vs_currency = 'usd' } = req.query;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token parameter is required'
      });
    }

    console.log(`🔍 [Price API] Fetching price for ${token} in ${vs_currency}`);
    
    const priceData = await coinGeckoService.getCurrentPrice(token, vs_currency);
    
    res.json({
      success: true,
      data: {
        token: token.toUpperCase(),
        ...priceData
      }
    });
  } catch (error) {
    console.error('❌ [Price API] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch token price',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/prices:
 *   get:
 *     summary: Get current prices for multiple tokens
 *     tags: [Price]
 *     parameters:
 *       - in: query
 *         name: tokens
 *         required: true
 *         schema:
 *           type: string
 *         description: Comma-separated token symbols (e.g., BTC,ETH,XRP)
 *       - in: query
 *         name: vs_currency
 *         schema:
 *           type: string
 *           default: usd
 *         description: Currency to get prices in
 *     responses:
 *       200:
 *         description: Current token prices
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.get('/prices', async (req, res) => {
  try {
    const { tokens, vs_currency = 'usd' } = req.query;
    
    if (!tokens) {
      return res.status(400).json({
        success: false,
        message: 'Tokens parameter is required'
      });
    }

    const tokenArray = tokens.split(',').map(t => t.trim());
    console.log(`🔍 [Price API] Fetching prices for ${tokenArray.join(', ')} in ${vs_currency}`);
    
    const pricesData = await coinGeckoService.getMultiplePrices(tokenArray, vs_currency);
    
    res.json({
      success: true,
      data: pricesData
    });
  } catch (error) {
    console.error('❌ [Price API] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch token prices',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/convert:
 *   get:
 *     summary: Convert amount from one token to another
 *     tags: [Price]
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *         description: Source token symbol
 *       - in: query
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *         description: Target token symbol
 *       - in: query
 *         name: amount
 *         required: true
 *         schema:
 *           type: number
 *         description: Amount to convert
 *     responses:
 *       200:
 *         description: Conversion result
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.get('/convert', async (req, res) => {
  try {
    const { from, to, amount } = req.query;
    
    if (!from || !to || !amount) {
      return res.status(400).json({
        success: false,
        message: 'from, to, and amount parameters are required'
      });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    console.log(`🔄 [Convert API] Converting ${amount} ${from} to ${to}`);
    
    const conversionData = await coinGeckoService.convertTokens(from, to, amountNum);
    
    res.json({
      success: true,
      data: conversionData
    });
  } catch (error) {
    console.error('❌ [Convert API] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to convert tokens',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/chart:
 *   get:
 *     summary: Get historical price data for charts
 *     tags: [Price]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token symbol
 *       - in: query
 *         name: vs_currency
 *         schema:
 *           type: string
 *           default: usd
 *         description: Currency to get prices in
 *       - in: query
 *         name: days
 *         schema:
 *           type: number
 *           default: 7
 *         description: Number of days (1, 7, 14, 30, 90, 180, 365)
 *     responses:
 *       200:
 *         description: Historical price data
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.get('/chart', async (req, res) => {
  try {
    const { token, vs_currency = 'usd', days = 7 } = req.query;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token parameter is required'
      });
    }

    console.log(`📈 [Chart API] Fetching ${days}d chart data for ${token}`);
    
    const chartData = await coinGeckoService.getHistoricalPrices(token, vs_currency, parseInt(days));
    
    res.json({
      success: true,
      data: {
        token: token.toUpperCase(),
        vs_currency: vs_currency.toUpperCase(),
        days: parseInt(days),
        prices: chartData
      }
    });
  } catch (error) {
    console.error('❌ [Chart API] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chart data',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/ohlc:
 *   get:
 *     summary: Get OHLC data for TradingView charts
 *     tags: [Price]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token symbol
 *       - in: query
 *         name: vs_currency
 *         schema:
 *           type: string
 *           default: usd
 *         description: Currency to get prices in
 *       - in: query
 *         name: days
 *         schema:
 *           type: number
 *           default: 7
 *         description: Number of days
 *     responses:
 *       200:
 *         description: OHLC data
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.get('/ohlc', async (req, res) => {
  try {
    const { token, vs_currency = 'usd', days = 7 } = req.query;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token parameter is required'
      });
    }

    console.log(`📊 [OHLC API] Fetching ${days}d OHLC data for ${token}`);
    
    const ohlcData = await coinGeckoService.getOHLCData(token, vs_currency, parseInt(days));
    
    res.json({
      success: true,
      data: {
        token: token.toUpperCase(),
        vs_currency: vs_currency.toUpperCase(),
        days: parseInt(days),
        ohlc: ohlcData
      }
    });
  } catch (error) {
    console.error('❌ [OHLC API] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch OHLC data',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/market:
 *   get:
 *     summary: Get detailed market data for a token
 *     tags: [Price]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token symbol
 *     responses:
 *       200:
 *         description: Detailed market data
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.get('/market', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token parameter is required'
      });
    }

    console.log(`🏪 [Market API] Fetching market data for ${token}`);
    
    const marketData = await coinGeckoService.getMarketData(token);
    
    res.json({
      success: true,
      data: marketData
    });
  } catch (error) {
    console.error('❌ [Market API] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch market data',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/trending:
 *   get:
 *     summary: Get trending tokens
 *     tags: [Price]
 *     responses:
 *       200:
 *         description: List of trending tokens
 *       500:
 *         description: Server error
 */
router.get('/trending', async (req, res) => {
  try {
    console.log('🔥 [Trending API] Fetching trending tokens');
    
    const trendingData = await coinGeckoService.getTrendingTokens();
    
    res.json({
      success: true,
      data: trendingData
    });
  } catch (error) {
    console.error('❌ [Trending API] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trending tokens',
      error: error.message
    });
  }
});

module.exports = router;

