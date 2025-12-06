/**
 * LiquidityOracle.js
 * Stage 4 - Phase 1 & 2: Liquidity Oracle
 * 
 * Simulated liquidity + price discovery layer.
 * Pulls from config/liquidity.json and provides price/depth data.
 */

const fs = require('fs');
const path = require('path');

class LiquidityOracle {
  constructor() {
    this.liquidityData = null;
    this.loadLiquidityData();
  }

  /**
   * Load liquidity data from config file
   */
  loadLiquidityData() {
    try {
      const configPath = path.join(__dirname, '../../config/liquidity.json');
      const rawData = fs.readFileSync(configPath, 'utf8');
      this.liquidityData = JSON.parse(rawData);
      console.log('[LiquidityOracle] Loaded liquidity data successfully');
    } catch (error) {
      console.error('[LiquidityOracle] Failed to load liquidity data:', error.message);
      this.liquidityData = { pools: {}, bridges: {}, syntheticPairs: {}, priceOracles: {} };
    }
  }

  /**
   * Get pool for a token pair on a specific chain
   * @param {string} chain - Chain name
   * @param {string} token0 - First token
   * @param {string} token1 - Second token
   * @returns {Object|null} Pool data
   */
  getPool(chain, token0, token1) {
    const chainPools = this.liquidityData.pools[chain];
    if (!chainPools) return null;

    // Try direct pair
    const directKey = `${token0}_${token1}`;
    if (chainPools[directKey] && chainPools[directKey].enabled) {
      return chainPools[directKey];
    }

    // Try reverse pair
    const reverseKey = `${token1}_${token0}`;
    if (chainPools[reverseKey] && chainPools[reverseKey].enabled) {
      // Swap reserves for reverse pair
      const pool = { ...chainPools[reverseKey] };
      [pool.reserve0, pool.reserve1] = [pool.reserve1, pool.reserve0];
      [pool.token0, pool.token1] = [pool.token1, pool.token0];
      pool.spotPrice = 1 / pool.spotPrice;
      return pool;
    }

    return null;
  }

  /**
   * Get spot price for a token pair
   * @param {string} token0 - Base token
   * @param {string} token1 - Quote token
   * @returns {number|null} Spot price
   */
  getSpotPrice(token0, token1) {
    // Check if it's a direct price oracle entry
    if (token1 === 'USD' || token1 === 'USDT' || token1 === 'USDC') {
      return this.liquidityData.priceOracles[token0] || null;
    }

    // Check synthetic pairs
    const syntheticKey = `${token0}_${token1}`;
    if (this.liquidityData.syntheticPairs[syntheticKey]) {
      return this.liquidityData.syntheticPairs[syntheticKey].spotPrice;
    }

    // Calculate from price oracles
    const price0 = this.liquidityData.priceOracles[token0];
    const price1 = this.liquidityData.priceOracles[token1];
    if (price0 && price1) {
      return price0 / price1;
    }

    return null;
  }

  /**
   * Calculate output amount for a swap
   * @param {string} chain - Chain name
   * @param {string} tokenIn - Input token
   * @param {string} tokenOut - Output token
   * @param {string} amountIn - Input amount
   * @returns {Object|null} Swap calculation result
   */
  calculateSwapOutput(chain, tokenIn, tokenOut, amountIn) {
    const pool = this.getPool(chain, tokenIn, tokenOut);
    if (!pool) return null;

    const amountInFloat = parseFloat(amountIn);
    const reserve0 = parseFloat(pool.reserve0);
    const reserve1 = parseFloat(pool.reserve1);
    const fee = pool.fee || 0.003;

    // Constant product formula: (x + Δx * (1 - fee)) * (y - Δy) = x * y
    const amountInWithFee = amountInFloat * (1 - fee);
    const numerator = amountInWithFee * reserve1;
    const denominator = reserve0 + amountInWithFee;
    const amountOut = numerator / denominator;

    // Calculate price impact
    const priceImpact = (amountInFloat / reserve0) * 100;

    return {
      amountOut: amountOut.toFixed(6),
      priceImpact: priceImpact.toFixed(4),
      spotPrice: pool.spotPrice,
      effectivePrice: (amountInFloat / amountOut).toFixed(6),
      pool: {
        reserve0: pool.reserve0,
        reserve1: pool.reserve1,
        fee: pool.fee
      }
    };
  }

  /**
   * Calculate VWAP (Volume-Weighted Average Price)
   * @param {string} chain - Chain name
   * @param {string} tokenIn - Input token
   * @param {string} tokenOut - Output token
   * @param {string} amountIn - Input amount
   * @returns {number|null} VWAP
   */
  calculateVWAP(chain, tokenIn, tokenOut, amountIn) {
    const swapResult = this.calculateSwapOutput(chain, tokenIn, tokenOut, amountIn);
    if (!swapResult) return null;

    // For simulated liquidity, VWAP ≈ effective price
    return parseFloat(swapResult.effectivePrice);
  }

  /**
   * Get bridge information
   * @param {string} fromChain - Source chain
   * @param {string} toChain - Destination chain
   * @returns {Object|null} Bridge data
   */
  getBridge(fromChain, toChain) {
    const bridgeKey = `${fromChain}_${toChain}`;
    const bridge = this.liquidityData.bridges[bridgeKey];
    return (bridge && bridge.enabled) ? bridge : null;
  }

  /**
   * Check if token can be bridged
   * @param {string} fromChain - Source chain
   * @param {string} toChain - Destination chain
   * @param {string} token - Token to bridge
   * @returns {boolean} Whether bridging is supported
   */
  canBridge(fromChain, toChain, token) {
    const bridge = this.getBridge(fromChain, toChain);
    if (!bridge) return false;
    return bridge.supportedTokens.includes(token);
  }

  /**
   * Get all available pools for a chain
   * @param {string} chain - Chain name
   * @returns {Array} Array of pool objects
   */
  getChainPools(chain) {
    const chainPools = this.liquidityData.pools[chain];
    if (!chainPools) return [];

    return Object.entries(chainPools)
      .filter(([_, pool]) => pool.enabled)
      .map(([pairKey, pool]) => ({
        pairKey,
        ...pool
      }));
  }

  /**
   * Get price for a token in USD
   * @param {string} token - Token symbol
   * @returns {number|null} Price in USD
   */
  getTokenPriceUSD(token) {
    return this.liquidityData.priceOracles[token] || null;
  }

  /**
   * Calculate market depth for a pool
   * @param {string} chain - Chain name
   * @param {string} token0 - First token
   * @param {string} token1 - Second token
   * @returns {Object|null} Market depth information
   */
  getMarketDepth(chain, token0, token1) {
    const pool = this.getPool(chain, token0, token1);
    if (!pool) return null;

    const reserve0USD = parseFloat(pool.reserve0) * (this.getTokenPriceUSD(token0) || 0);
    const reserve1USD = parseFloat(pool.reserve1) * (this.getTokenPriceUSD(token1) || 0);
    const totalLiquidityUSD = reserve0USD + reserve1USD;

    return {
      reserve0: pool.reserve0,
      reserve1: pool.reserve1,
      reserve0USD: reserve0USD.toFixed(2),
      reserve1USD: reserve1USD.toFixed(2),
      totalLiquidityUSD: totalLiquidityUSD.toFixed(2),
      depth: pool.depth,
      spotPrice: pool.spotPrice
    };
  }

  /**
   * Simulate slippage curve
   * @param {string} chain - Chain name
   * @param {string} tokenIn - Input token
   * @param {string} tokenOut - Output token
   * @param {Array} amounts - Array of input amounts to test
   * @returns {Array} Slippage curve data points
   */
  getSlippageCurve(chain, tokenIn, tokenOut, amounts) {
    const curve = [];

    for (const amount of amounts) {
      const result = this.calculateSwapOutput(chain, tokenIn, tokenOut, amount);
      if (result) {
        curve.push({
          amountIn: amount,
          amountOut: result.amountOut,
          priceImpact: result.priceImpact,
          effectivePrice: result.effectivePrice
        });
      }
    }

    return curve;
  }

  /**
   * Check if pool has sufficient liquidity
   * @param {string} chain - Chain name
   * @param {string} tokenIn - Input token
   * @param {string} tokenOut - Output token
   * @param {string} amountIn - Input amount
   * @returns {Object} Liquidity check result
   */
  checkLiquidity(chain, tokenIn, tokenOut, amountIn) {
    const pool = this.getPool(chain, tokenIn, tokenOut);
    if (!pool) {
      return {
        sufficient: false,
        reason: 'Pool not found'
      };
    }

    const amountInFloat = parseFloat(amountIn);
    const reserve0 = parseFloat(pool.reserve0);

    // Check if amount exceeds 50% of pool reserve (exhaustion threshold)
    if (amountInFloat > reserve0 * 0.5) {
      return {
        sufficient: false,
        reason: 'Amount exceeds 50% of pool reserve',
        maxAmount: (reserve0 * 0.5).toFixed(6)
      };
    }

    return {
      sufficient: true,
      reserve: pool.reserve0,
      utilizationPercent: ((amountInFloat / reserve0) * 100).toFixed(2)
    };
  }

  /**
   * Reload liquidity data from config file
   */
  reload() {
    this.loadLiquidityData();
  }
}

module.exports = LiquidityOracle;
