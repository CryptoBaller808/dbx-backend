/**
 * routingController.js
 * Stage 4 - Phase 4: Routing API Controller
 * 
 * Handles routing quote requests and integrates with RoutePlanner.
 */

const RoutePlanner = require('../services/routing/RoutePlanner');

const routePlanner = new RoutePlanner();

/**
 * GET /api/routing/quote
 * Get routing quote for a swap
 */
exports.getRoutingQuote = async (req, res) => {
  try {
    const { base, quote, amount, side = 'sell', preview = 'false', fromChain, toChain, mode } = req.query;

    console.log('[Routing API] Quote request:', { base, quote, amount, side, preview, fromChain, toChain, mode });

    // Validate required parameters
    if (!base || !quote || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: base, quote, amount'
      });
    }

    // Validate amount
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount: must be a positive number'
      });
    }

    // Determine tokens based on side
    let fromToken, toToken;
    if (side === 'sell') {
      fromToken = base;
      toToken = quote;
    } else if (side === 'buy') {
      fromToken = quote;
      toToken = base;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid side: must be "sell" or "buy"'
      });
    }

    // Preview mode check
    const isPreview = preview === 'true';
    if (isPreview) {
      console.log('[Routing API] Preview mode enabled - bypassing wallet checks');
    }

    // Plan routes with optional mode override
    const routingResult = await routePlanner.planRoutes({
      fromToken,
      toToken,
      amount,
      side,
      fromChain,
      toChain,
      mode // Pass mode to route planner
    });

    if (!routingResult.success) {
      return res.status(404).json(routingResult);
    }

    // Build response
    const response = {
      success: true,
      bestRoute: routingResult.bestRoute.toJSON(),
      alternativeRoutes: routingResult.alternativeRoutes.map(r => r.toJSON()),
      expectedOutput: routingResult.bestRoute.expectedOutput,
      fees: routingResult.bestRoute.fees,
      slippage: routingResult.bestRoute.slippage,
      routeExplanation: routePlanner.getRouteExplanation(routingResult.bestRoute),
      totalRoutesFound: routingResult.totalRoutesFound,
      preview: isPreview,
      timestamp: routingResult.timestamp
    };

    // Add alternative route explanations
    response.alternativeRoutes = response.alternativeRoutes.map((route, index) => ({
      ...route,
      explanation: routePlanner.getRouteExplanation(routingResult.alternativeRoutes[index])
    }));

    return res.json(response);

  } catch (error) {
    console.error('[Routing API] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * GET /api/routing/pools
 * Get available liquidity pools for a chain
 */
exports.getPools = async (req, res) => {
  try {
    const { chain } = req.query;

    if (!chain) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: chain'
      });
    }

    const pools = routePlanner.liquidityOracle.getChainPools(chain);

    return res.json({
      success: true,
      chain,
      pools,
      count: pools.length
    });

  } catch (error) {
    console.error('[Routing API] Error getting pools:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * GET /api/routing/price
 * Get spot price for a token pair
 */
exports.getPrice = async (req, res) => {
  try {
    const { base, quote, mode } = req.query;

    if (!base || !quote) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: base, quote'
      });
    }

    // Use new async getSpotPrice with mode support
    const result = await routePlanner.liquidityOracle.getSpotPrice(base, quote, { mode });
    const spotPrice = result.price;

    if (spotPrice === null) {
      return res.status(404).json({
        success: false,
        error: `No price data found for ${base}/${quote}`
      });
    }

    return res.json({
      success: true,
      base,
      quote,
      spotPrice,
      provider: result.provider,
      mode: result.mode,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Routing API] Error getting price:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * GET /api/routing/depth
 * Get market depth for a token pair
 */
exports.getMarketDepth = async (req, res) => {
  try {
    const { chain, token0, token1, mode } = req.query;

    if (!chain || !token0 || !token1) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: chain, token0, token1'
      });
    }

    // Use new async getDepth with mode support
    const result = await routePlanner.liquidityOracle.getDepth(token0, token1, { chain, mode });
    const depth = result.depth;

    if (!depth) {
      return res.status(404).json({
        success: false,
        error: `No market depth data found for ${token0}/${token1} on ${chain}`
      });
    }

    return res.json({
      success: true,
      chain,
      token0,
      token1,
      depth,
      provider: result.provider,
      mode: result.mode,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Routing API] Error getting market depth:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * POST /api/routing/reload
 * Reload liquidity data from config
 */
exports.reloadLiquidity = async (req, res) => {
  try {
    routePlanner.liquidityOracle.reload();

    return res.json({
      success: true,
      message: 'Liquidity data reloaded successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Routing API] Error reloading liquidity:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};
