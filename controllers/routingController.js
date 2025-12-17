/**
 * routingController.js
 * Stage 4 - Phase 4: Routing API Controller
 * 
 * Handles routing quote requests and integrates with RoutePlanner.
 */

const RoutePlanner = require('../services/routing/RoutePlanner');
const RouteExecutionService = require('../services/routing/RouteExecutionService');
const executionConfig = require('../config/executionConfig');
const { recordTrade } = require('../middleware/rateLimiter');

const routePlanner = new RoutePlanner();
const routeExecutionService = new RouteExecutionService();

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

/**
 * POST /api/routing/execute
 * Execute a route end-to-end (Stage 6)
 * Stage 7.0: Enhanced to support live execution with wallet
 */
exports.executeRoute = async (req, res) => {
  try {
    const {
      base,
      quote,
      amount,
      side = 'sell',
      fromChain,
      toChain,
      mode = 'auto',
      routeId,
      preview = true,
      executionMode = 'demo',
      walletAddress // Stage 7.0: Wallet address for live execution
    } = req.body;

    console.log('[Routing API] Execute request:', {
      base,
      quote,
      amount,
      side,
      fromChain,
      toChain,
      mode,
      executionMode
    });

    // Validate required parameters
    if (!base || !quote || !amount) {
      return res.status(400).json({
        success: false,
        errorCode: 'MISSING_PARAMETERS',
        message: 'Missing required parameters: base, quote, amount'
      });
    }

    // Validate amount
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_AMOUNT',
        message: 'Invalid amount: must be a positive number'
      });
    }

    // Validate side
    if (!['sell', 'buy'].includes(side)) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_SIDE',
        message: 'Invalid side: must be "sell" or "buy"'
      });
    }

    // Stage 7.1: Validate live execution requirements
    if (executionMode === 'live') {
      // Validate wallet address
      if (!walletAddress) {
        return res.status(400).json({
          success: false,
          errorCode: 'WALLET_NOT_CONNECTED',
          message: 'Wallet address is required for live execution'
        });
      }

      // Validate chain allowlist
      const chain = fromChain || base; // Use fromChain if specified, otherwise base token
      console.log('[CHAIN DEBUG] Resolved chain for live execution:', {
        fromChain,
        base,
        resolvedChain: chain,
        allowedChains: executionConfig.liveEvmChains
      });
      
      if (!executionConfig.isChainAllowedForLive(chain)) {
        return res.status(403).json({
          success: false,
          errorCode: 'CHAIN_NOT_ENABLED_FOR_LIVE',
          message: `Chain ${chain} is not enabled for live execution. Allowed chains: ${executionConfig.liveEvmChains.join(', ')}`
        });
      }

      // Validate execution mode
      const validation = executionConfig.validateExecution(chain, executionMode);
      if (!validation.allowed) {
        return res.status(403).json({
          success: false,
          errorCode: validation.code,
          message: validation.reason
        });
      }
    }

    // Execute route
    const result = await routeExecutionService.executeRoute({
      base,
      quote,
      amount,
      side,
      fromChain,
      toChain,
      mode,
      routeId,
      preview,
      executionMode,
      walletAddress // Stage 7.0: Pass wallet address for live execution
    });

    // Return result (success or error)
    if (result.success) {
      // Stage 7.1: Record trade for rate limiting (live execution only)
      if (executionMode === 'live' && walletAddress) {
        recordTrade(walletAddress);
        console.log(`[Rate Limiter] Recorded trade for wallet ${walletAddress}`);
      }
      
      return res.json(result);
    } else {
      // Map error codes to HTTP status codes
      const statusCode = {
        'MISSING_PARAMETERS': 400,
        'INVALID_AMOUNT': 400,
        'INVALID_SIDE': 400,
        'INVALID_EXECUTION_MODE': 400,
        'WALLET_NOT_CONNECTED': 400,
        'INSUFFICIENT_FUNDS': 400,
        'RPC_NOT_CONFIGURED': 503,
        'UNSUPPORTED_CHAIN': 501,
        'NO_ROUTE': 422, // Changed from 404 to 422 (Unprocessable Entity)
        'UNSUPPORTED_PATH_TYPE': 501,
        'EXECUTION_DISABLED': 503,
        'EXECUTION_FAILED': 500
      }[result.errorCode] || 500;

      return res.status(statusCode).json(result);
    }

  } catch (error) {
    console.error('[Routing API] Error executing route:', error);
    return res.status(500).json({
      success: false,
      errorCode: 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: {
        error: error.message
      }
    });
  }
};

/**
 * POST /api/routing/broadcast
 * Broadcast signed transaction (Stage 7.0)
 */
exports.broadcastTransaction = async (req, res) => {
  try {
    const {
      chain,
      signedTransaction,
      metadata
    } = req.body;

    console.log('[Routing API] Broadcast request:', {
      chain,
      signedTxLength: signedTransaction?.length,
      metadata
    });

    // Validate required parameters
    if (!chain || !signedTransaction) {
      return res.status(400).json({
        success: false,
        errorCode: 'MISSING_PARAMETERS',
        message: 'Missing required parameters: chain, signedTransaction'
      });
    }

    // Validate chain is ETH (Stage 7.0 only)
    if (chain !== 'ETH') {
      return res.status(400).json({
        success: false,
        errorCode: 'UNSUPPORTED_CHAIN',
        message: 'Broadcast is only supported for ETH in Stage 7.0'
      });
    }

    // Broadcast signed transaction
    const result = await routeExecutionService.broadcastSignedTransaction(
      chain,
      signedTransaction,
      metadata
    );

    // Return result
    if (result.success) {
      return res.json(result);
    } else {
      const statusCode = {
        'BROADCAST_FAILED': 500,
        'RPC_ERROR': 502,
        'INVALID_TRANSACTION': 400
      }[result.errorCode] || 500;

      return res.status(statusCode).json(result);
    }

  } catch (error) {
    console.error('[Routing API] Error broadcasting transaction:', error);
    return res.status(500).json({
      success: false,
      errorCode: 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: {
        error: error.message
      }
    });
  }
};
