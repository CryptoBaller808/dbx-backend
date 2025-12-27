/**
 * RoutePlanner.js
 * Stage 4 - Phase 3: Multi-Hop Routing Planner
 * 
 * Multi-hop routing planner that supports XRPL, EVM chains, XDC, and BTC stubs.
 * Generates best routes and fallback routes with comprehensive analysis.
 */

const UniversalRoute = require('./UniversalRoute');
const LiquidityOracle = require('./LiquidityOracle');
const FeeModel = require('./FeeModel');
const SlippageEngine = require('./SlippageEngine');
const RouteValidator = require('./RouteValidator');

class RoutePlanner {
  constructor() {
    this.liquidityOracle = new LiquidityOracle();
    this.feeModel = new FeeModel();
    this.slippageEngine = new SlippageEngine();
    this.routeValidator = new RouteValidator();
    
    // Supported chains
    this.supportedChains = ['XRPL', 'ETH', 'BSC', 'MATIC', 'AVAX', 'XDC', 'SOL'];
    this.stubChains = ['BTC', 'XLM']; // Stubs for future implementation
    
    // Max hops for multi-hop routing
    this.maxHops = 3;
  }

  /**
   * Plan routes for a swap
   * @param {Object} params - Routing parameters
   * @param {string} params.fromToken - Input token
   * @param {string} params.toToken - Output token
   * @param {string} params.amount - Input amount
   * @param {string} params.side - 'buy' or 'sell'
   * @param {string} params.fromChain - Source chain (optional)
   * @param {string} params.toChain - Destination chain (optional)
   * @returns {Object} Routing result with best route and alternatives
   */
  async planRoutes(params) {
    const { fromToken, toToken, amount, side = 'sell', fromChain, toChain } = params;

    console.log(`[RoutePlanner] Planning routes: ${fromToken} → ${toToken}, amount: ${amount}, side: ${side}`);

    // Determine chains
    const sourceChain = fromChain || this.detectChain(fromToken);
    const destChain = toChain || this.detectChain(toToken);

    // Generate possible routes
    const routes = [];

    // 1. Direct routes (same chain)
    if (sourceChain === destChain) {
      const directRoute = this.planDirectRoute(sourceChain, fromToken, toToken, amount);
      if (directRoute) routes.push(directRoute);
    }

    // 2. Cross-chain routes (with bridge)
    if (sourceChain !== destChain) {
      const crossChainRoutes = this.planCrossChainRoutes(sourceChain, destChain, fromToken, toToken, amount);
      routes.push(...crossChainRoutes);
    }

    // 3. Multi-hop routes (via intermediate tokens)
    const multiHopRoutes = this.planMultiHopRoutes(sourceChain, destChain, fromToken, toToken, amount);
    routes.push(...multiHopRoutes);

    // Filter out invalid routes
    const validRoutes = routes.filter(route => {
      const validation = this.routeValidator.validateRoute(route);
      return validation.valid;
    });

    if (validRoutes.length === 0) {
      return {
        success: false,
        error: 'No valid routes found',
        fromToken,
        toToken,
        amount
      };
    }

    // Rank routes by total cost (fees + slippage)
    const rankedRoutes = this.rankRoutes(validRoutes);

    return {
      success: true,
      bestRoute: rankedRoutes[0],
      alternativeRoutes: rankedRoutes.slice(1, 3), // Top 3 alternatives
      totalRoutesFound: validRoutes.length,
      fromToken,
      toToken,
      amount,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Plan a direct route (single chain, single hop)
   * @param {string} chain - Chain name
   * @param {string} fromToken - Input token
   * @param {string} toToken - Output token
   * @param {string} amount - Input amount
   * @returns {UniversalRoute|null} Direct route
   */
  planDirectRoute(chain, fromToken, toToken, amount) {
    const pool = this.liquidityOracle.getPool(chain, fromToken, toToken);
    if (!pool) return null;

    // Calculate swap output
    const swapResult = this.liquidityOracle.calculateSwapOutput(chain, fromToken, toToken, amount);
    if (!swapResult) return null;

    // Create route
    const route = new UniversalRoute({
      chain,
      pathType: 'direct',
      hops: [],
      expectedOutput: swapResult.amountOut,
      oracleSources: ['LiquidityOracle']
    });

    // Add hop
    route.addHop({
      chain,
      protocol: pool.protocol,
      fromToken,
      toToken,
      amountIn: amount,
      amountOut: swapResult.amountOut,
      pool: swapResult.pool
    });

    // Calculate fees
    const fees = this.feeModel.calculateRouteFees(route.hops);
    route.setFees(fees);

    // Calculate slippage
    const slippageResult = this.slippageEngine.calculateRouteSlippage(route.hops, [swapResult.pool]);
    route.setSlippage({
      percentage: slippageResult.cumulative.cumulativePercentage,
      minOutput: slippageResult.finalMinOutput,
      isExcessive: slippageResult.isExcessive
    });

    return route;
  }

  /**
   * Plan cross-chain routes (with bridge)
   * @param {string} fromChain - Source chain
   * @param {string} toChain - Destination chain
   * @param {string} fromToken - Input token
   * @param {string} toToken - Output token
   * @param {string} amount - Input amount
   * @returns {Array} Array of cross-chain routes
   */
  planCrossChainRoutes(fromChain, toChain, fromToken, toToken, amount) {
    const routes = [];

    // Check if direct bridge is available
    const bridge = this.liquidityOracle.getBridge(fromChain, toChain);
    if (!bridge) return routes;

    // Find bridgeable tokens
    const bridgeableTokens = bridge.supportedTokens.filter(token => 
      this.liquidityOracle.canBridge(fromChain, toChain, token)
    );

    for (const bridgeToken of bridgeableTokens) {
      try {
        const route = this.planCrossChainRoute(fromChain, toChain, fromToken, toToken, amount, bridgeToken);
        if (route) routes.push(route);
      } catch (error) {
        console.error(`[RoutePlanner] Error planning cross-chain route via ${bridgeToken}:`, error.message);
      }
    }

    return routes;
  }

  /**
   * Plan a single cross-chain route
   * @param {string} fromChain - Source chain
   * @param {string} toChain - Destination chain
   * @param {string} fromToken - Input token
   * @param {string} toToken - Output token
   * @param {string} amount - Input amount
   * @param {string} bridgeToken - Token to bridge
   * @returns {UniversalRoute|null} Cross-chain route
   */
  planCrossChainRoute(fromChain, toChain, fromToken, toToken, amount, bridgeToken) {
    const route = new UniversalRoute({
      chain: fromChain,
      pathType: 'multi-hop',
      hops: [],
      expectedOutput: '0',
      oracleSources: ['LiquidityOracle']
    });

    let currentAmount = amount;
    let hopIndex = 0;

    // Hop 1: Swap fromToken → bridgeToken on source chain (if needed)
    if (fromToken !== bridgeToken) {
      const swap1 = this.liquidityOracle.calculateSwapOutput(fromChain, fromToken, bridgeToken, currentAmount);
      if (!swap1) return null;

      route.addHop({
        hopIndex: hopIndex++,
        chain: fromChain,
        protocol: this.liquidityOracle.getPool(fromChain, fromToken, bridgeToken)?.protocol || 'UNKNOWN',
        fromToken,
        toToken: bridgeToken,
        amountIn: currentAmount,
        amountOut: swap1.amountOut,
        pool: swap1.pool
      });

      currentAmount = swap1.amountOut;
    }

    // Hop 2: Bridge bridgeToken from source to destination chain
    route.addHop({
      hopIndex: hopIndex++,
      chain: fromChain,
      protocol: 'BRIDGE',
      fromToken: bridgeToken,
      toToken: bridgeToken,
      amountIn: currentAmount,
      amountOut: currentAmount, // 1:1 for bridge (fees handled separately)
      pool: null
    });

    // Hop 3: Swap bridgeToken → toToken on destination chain (if needed)
    if (bridgeToken !== toToken) {
      const swap2 = this.liquidityOracle.calculateSwapOutput(toChain, bridgeToken, toToken, currentAmount);
      if (!swap2) return null;

      route.addHop({
        hopIndex: hopIndex++,
        chain: toChain,
        protocol: this.liquidityOracle.getPool(toChain, bridgeToken, toToken)?.protocol || 'UNKNOWN',
        fromToken: bridgeToken,
        toToken,
        amountIn: currentAmount,
        amountOut: swap2.amountOut,
        pool: swap2.pool
      });

      currentAmount = swap2.amountOut;
    }

    route.expectedOutput = currentAmount;

    // Calculate fees
    const fees = this.feeModel.calculateRouteFees(route.hops);
    route.setFees(fees);

    // Calculate slippage
    const slippageResult = this.slippageEngine.calculateRouteSlippage(route.hops);
    route.setSlippage({
      percentage: slippageResult.cumulative.cumulativePercentage,
      minOutput: slippageResult.finalMinOutput,
      isExcessive: slippageResult.isExcessive,
      cumulativeSlippage: slippageResult.cumulative.cumulativePercentage
    });

    return route;
  }

  /**
   * Plan multi-hop routes (via intermediate tokens)
   * @param {string} fromChain - Source chain
   * @param {string} toChain - Destination chain
   * @param {string} fromToken - Input token
   * @param {string} toToken - Output token
   * @param {string} amount - Input amount
   * @returns {Array} Array of multi-hop routes
   */
  planMultiHopRoutes(fromChain, toChain, fromToken, toToken, amount) {
    const routes = [];

    // Only plan multi-hop for same-chain swaps
    if (fromChain !== toChain) return routes;

    // Common intermediate tokens
    const intermediateTokens = ['USDT', 'USDC', 'USD'];

    for (const intermediateToken of intermediateTokens) {
      if (intermediateToken === fromToken || intermediateToken === toToken) continue;

      try {
        const route = this.planMultiHopRoute(fromChain, fromToken, toToken, amount, [intermediateToken]);
        if (route) routes.push(route);
      } catch (error) {
        console.error(`[RoutePlanner] Error planning multi-hop route via ${intermediateToken}:`, error.message);
      }
    }

    return routes;
  }

  /**
   * Plan a single multi-hop route
   * @param {string} chain - Chain name
   * @param {string} fromToken - Input token
   * @param {string} toToken - Output token
   * @param {string} amount - Input amount
   * @param {Array} intermediateTokens - Array of intermediate tokens
   * @returns {UniversalRoute|null} Multi-hop route
   */
  planMultiHopRoute(chain, fromToken, toToken, amount, intermediateTokens) {
    const route = new UniversalRoute({
      chain,
      pathType: 'multi-hop',
      hops: [],
      expectedOutput: '0',
      oracleSources: ['LiquidityOracle']
    });

    let currentAmount = amount;
    let currentToken = fromToken;
    let hopIndex = 0;

    // Build path: fromToken → intermediate1 → ... → toToken
    const path = [fromToken, ...intermediateTokens, toToken];

    for (let i = 0; i < path.length - 1; i++) {
      const tokenIn = path[i];
      const tokenOut = path[i + 1];

      const swap = this.liquidityOracle.calculateSwapOutput(chain, tokenIn, tokenOut, currentAmount);
      if (!swap) return null;

      route.addHop({
        hopIndex: hopIndex++,
        chain,
        protocol: this.liquidityOracle.getPool(chain, tokenIn, tokenOut)?.protocol || 'UNKNOWN',
        fromToken: tokenIn,
        toToken: tokenOut,
        amountIn: currentAmount,
        amountOut: swap.amountOut,
        pool: swap.pool
      });

      currentAmount = swap.amountOut;
      currentToken = tokenOut;
    }

    route.expectedOutput = currentAmount;

    // Calculate fees
    const fees = this.feeModel.calculateRouteFees(route.hops);
    route.setFees(fees);

    // Calculate slippage
    const slippageResult = this.slippageEngine.calculateRouteSlippage(route.hops);
    route.setSlippage({
      percentage: slippageResult.cumulative.cumulativePercentage,
      minOutput: slippageResult.finalMinOutput,
      isExcessive: slippageResult.isExcessive,
      cumulativeSlippage: slippageResult.cumulative.cumulativePercentage
    });

    return route;
  }

  /**
   * Rank routes by total cost
   * @param {Array} routes - Array of routes
   * @returns {Array} Sorted routes (best first)
   */
  rankRoutes(routes) {
    return routes.sort((a, b) => {
      // Calculate total cost = fees + slippage impact
      const costA = parseFloat(a.fees.totalFeeUSD) + (parseFloat(a.expectedOutput) * a.slippage.percentage);
      const costB = parseFloat(b.fees.totalFeeUSD) + (parseFloat(b.expectedOutput) * b.slippage.percentage);

      // Lower cost = better
      return costA - costB;
    });
  }

  /**
   * Detect chain for a token
   * @param {string} token - Token symbol
   * @returns {string} Chain name
   */
  detectChain(token) {
    // Simple heuristic based on token
    if (token === 'XRP') return 'XRPL';
    if (token === 'ETH') return 'ETH';
    if (token === 'BNB') return 'BSC';
    if (token === 'MATIC') return 'MATIC';
    if (token === 'XDC') return 'XDC';
    if (token === 'BTC') return 'BTC';
    if (token === 'SOL') return 'SOL';
    if (token === 'XLM') return 'XLM';

    // Default to XRPL for stablecoins
    return 'XRPL';
  }

  /**
   * Get route explanation
   * @param {UniversalRoute} route - Route object
   * @returns {string} Human-readable explanation
   */
  getRouteExplanation(route) {
    const metrics = route.getMetrics();
    let explanation = `Route: ${metrics.routeSummary}\n`;
    explanation += `Hops: ${metrics.totalHops}, Chains: ${metrics.uniqueChains}, Protocols: ${metrics.protocols.join(', ')}\n`;
    explanation += `Expected Output: ${route.expectedOutput}\n`;
    explanation += `Total Fee: $${metrics.totalFeeUSD}\n`;
    explanation += `Slippage: ${(metrics.slippagePercentage * 100).toFixed(2)}%`;

    if (route.slippage.isExcessive) {
      explanation += ` (⚠️ EXCESSIVE)`;
    }

    return explanation;
   }

  /**
   * Find the best route (wrapper for Stage 6 compatibility)
   * @param {Object} params - Routing parameters
   * @returns {UniversalRoute|null} Best route or null if no route found
   */
  async findBestRoute(params) {
    const { fromToken, toToken, executionMode } = params;
    
    // Stage 7.1: Generate deterministic single-hop EVM route for enabled EVM pairs
    // Supports both 'demo' and 'live' execution modes
    // Supports: ETH/USDT, BNB/USDT, AVAX/USDT, MATIC/USDT
    if (executionMode === 'demo' || executionMode === 'live') {
      const evmPairs = [
        { base: 'ETH', quote: 'USDT', chain: 'ETH' },
        { base: 'BNB', quote: 'USDT', chain: 'BNB' },
        { base: 'AVAX', quote: 'USDT', chain: 'AVAX' },
        { base: 'MATIC', quote: 'USDT', chain: 'MATIC' },
        { base: 'SOL', quote: 'USDT', chain: 'SOL' }
      ];
      
      for (const pair of evmPairs) {
        if ((fromToken === pair.base && toToken === pair.quote) || 
            (fromToken === pair.quote && toToken === pair.base)) {
          console.log(`[RoutePlanner] Generating single-hop EVM ${executionMode} route for ${pair.base}/${pair.quote}`);
          return this._generateEvmDemoRoute({ ...params, chain: pair.chain, baseToken: pair.base });
        }
      }
    }
    
    const result = await this.planRoutes(params);
    if (!result || !result.bestRoute) {
      return null;
    }
    return result.bestRoute;
  }
  
  /**
   * Generate a deterministic single-hop EVM demo route for all EVM pairs
   * Stage 6C: Supports ETH/USDT, BNB/USDT, AVAX/USDT, MATIC/USDT
   * @private
   * @param {Object} params - Routing parameters
   * @returns {Object} Single-hop EVM demo route
   */
  _generateEvmDemoRoute(params) {
    const { fromToken, toToken, amount, side = 'sell', chain, baseToken: paramBaseToken } = params;
    
    // Determine direction
    const isBuy = side === 'buy';
    const baseToken = paramBaseToken || (isBuy ? toToken : fromToken);
    const quoteToken = isBuy ? fromToken : toToken;
    
    // Demo pricing for each EVM token (approximate market prices)
    // In production, these would come from CoinGecko or other oracle
    const demoPrices = {
      'ETH': 3000,   // 1 ETH = $3000
      'BNB': 600,    // 1 BNB = $600
      'AVAX': 40,    // 1 AVAX = $40
      'MATIC': 1,    // 1 MATIC = $1
      'SOL': 150     // 1 SOL = $150
    };
    
    const baseUsdtPrice = demoPrices[baseToken] || 1;
    
    let amountIn, amountOut;
    if (fromToken === baseToken) {
      // Selling base token for USDT
      if (isBuy) {
        // Buy: amount is in base token, need USDT
        amountOut = parseFloat(amount);
        amountIn = amountOut * baseUsdtPrice;
      } else {
        // Sell: amount is in base token, get USDT
        amountIn = parseFloat(amount);
        amountOut = amountIn * baseUsdtPrice;
      }
    } else {
      // Selling USDT for base token
      if (isBuy) {
        // Buy: amount is in USDT, need base token
        amountOut = parseFloat(amount);
        amountIn = amountOut / baseUsdtPrice;
      } else {
        // Sell: amount is in USDT, get base token
        amountIn = parseFloat(amount);
        amountOut = amountIn / baseUsdtPrice;
      }
    }
    
    // Calculate fees (0.3% for demo, similar to Uniswap V2)
    const feePercentage = 0.003;
    const feeUSD = amountOut * baseUsdtPrice * feePercentage;
    
    // Determine protocol name based on chain
    const protocolNames = {
      'ETH': 'EVM_DEMO_UNISWAP',
      'BNB': 'EVM_DEMO_PANCAKESWAP',
      'AVAX': 'EVM_DEMO_TRADERJOE',
      'MATIC': 'EVM_DEMO_QUICKSWAP'
    };
    
    // Build single-hop EVM demo route
    const demoRoute = {
      routeId: `evm_demo_${Date.now()}`,
      chain: chain || 'ETH',
      pathType: 'direct',
      strategy: 'evm-demo',
      hops: [{
        hopIndex: 0,
        chain: chain || 'ETH',
        protocol: protocolNames[chain] || 'EVM_DEMO_DEX',
        fromToken,
        toToken,
        amountIn: amountIn.toString(),
        amountOut: amountOut.toString(),
        pool: `DEMO_${baseToken}_USDT_POOL`,
        fee: '0.3%'
      }],
      fees: {
        totalFeeUSD: feeUSD,
        totalFeeNative: feeUSD / baseUsdtPrice,
        breakdown: [{
          type: 'swap',
          amount: feeUSD,
          percentage: feePercentage * 100
        }],
        timestamp: new Date().toISOString()
      },
      slippage: {
        percentage: 0.5,
        minOutput: amountOut * 0.995,
        maxInput: amountIn * 1.005
      },
      expectedOutput: amountOut,
      oracleSources: ['Demo_Oracle'],
      timestamp: new Date().toISOString(),
      isDemo: true
    };
    
    console.log('[RoutePlanner] Generated EVM demo route:', {
      fromToken,
      toToken,
      amountIn,
      amountOut,
      chain: chain || 'ETH',
      pathType: 'direct',
      baseToken,
      price: baseUsdtPrice
    });
    
    return demoRoute;
  }
}
module.exports = RoutePlanner;
