/**
 * SlippageEngine.js
 * Stage 4 - Phase 1: Slippage Calculation Engine
 * 
 * Handles depth-based slippage and multi-hop cumulative slippage.
 * Provides slippage estimates based on liquidity depth and trade size.
 */

class SlippageEngine {
  constructor() {
    // Slippage thresholds
    this.thresholds = {
      warning: 0.01, // 1%
      excessive: 0.05, // 5%
      critical: 0.10 // 10%
    };

    // Default slippage tolerance
    this.defaultTolerance = 0.005; // 0.5%
  }

  /**
   * Calculate slippage for a single hop
   * @param {Object} params - Slippage parameters
   * @param {string} params.amountIn - Input amount
   * @param {string} params.amountOut - Output amount
   * @param {Object} params.pool - Pool information
   * @param {string} params.pool.reserve0 - Reserve of token 0
   * @param {string} params.pool.reserve1 - Reserve of token 1
   * @returns {Object} Slippage details
   */
  calculateHopSlippage(params) {
    const { amountIn, amountOut, pool } = params;

    if (!pool || !pool.reserve0 || !pool.reserve1) {
      // No pool data - use default slippage
      return {
        percentage: this.defaultTolerance,
        minOutput: (parseFloat(amountOut) * (1 - this.defaultTolerance)).toFixed(6),
        isExcessive: false,
        method: 'default'
      };
    }

    // Calculate price impact based on pool depth
    const tradeSize = parseFloat(amountIn);
    const poolDepth = parseFloat(pool.reserve0);
    const tradeSizeRatio = tradeSize / poolDepth;

    // Depth-based slippage model
    // Slippage increases non-linearly with trade size
    let slippagePercentage;
    if (tradeSizeRatio < 0.01) {
      // < 1% of pool - minimal slippage
      slippagePercentage = 0.001; // 0.1%
    } else if (tradeSizeRatio < 0.05) {
      // 1-5% of pool - low slippage
      slippagePercentage = 0.005; // 0.5%
    } else if (tradeSizeRatio < 0.10) {
      // 5-10% of pool - moderate slippage
      slippagePercentage = 0.015; // 1.5%
    } else if (tradeSizeRatio < 0.20) {
      // 10-20% of pool - high slippage
      slippagePercentage = 0.035; // 3.5%
    } else {
      // > 20% of pool - excessive slippage
      slippagePercentage = 0.08; // 8%
    }

    const minOutput = (parseFloat(amountOut) * (1 - slippagePercentage)).toFixed(6);
    const isExcessive = slippagePercentage >= this.thresholds.excessive;

    return {
      percentage: slippagePercentage,
      percentageDisplay: (slippagePercentage * 100).toFixed(2) + '%',
      minOutput,
      isExcessive,
      tradeSizeRatio: tradeSizeRatio.toFixed(4),
      method: 'depth-based'
    };
  }

  /**
   * Calculate cumulative slippage for multi-hop route
   * @param {Array} hops - Array of hop objects with slippage
   * @returns {Object} Cumulative slippage details
   */
  calculateCumulativeSlippage(hops) {
    if (hops.length === 0) {
      return {
        cumulativePercentage: 0,
        minOutput: '0',
        isExcessive: false
      };
    }

    // Cumulative slippage compounds across hops
    let cumulativeSlippage = 1.0;
    for (const hop of hops) {
      const hopSlippage = hop.slippage?.percentage || this.defaultTolerance;
      cumulativeSlippage *= (1 - hopSlippage);
    }

    const cumulativePercentage = 1 - cumulativeSlippage;
    const finalOutput = hops[hops.length - 1].amountOut;
    const minOutput = (parseFloat(finalOutput) * cumulativeSlippage).toFixed(6);
    const isExcessive = cumulativePercentage >= this.thresholds.excessive;

    return {
      cumulativePercentage,
      cumulativePercentageDisplay: (cumulativePercentage * 100).toFixed(2) + '%',
      minOutput,
      isExcessive,
      hopCount: hops.length,
      method: 'cumulative'
    };
  }

  /**
   * Calculate slippage for entire route
   * @param {Array} hops - Array of hop objects
   * @param {Object} liquidityData - Liquidity data for each hop
   * @returns {Object} Route slippage details
   */
  calculateRouteSlippage(hops, liquidityData = {}) {
    // Calculate slippage for each hop
    const hopsWithSlippage = hops.map((hop, index) => {
      const pool = liquidityData[index] || hop.pool;
      const slippage = this.calculateHopSlippage({
        amountIn: hop.amountIn,
        amountOut: hop.amountOut,
        pool
      });
      return { ...hop, slippage };
    });

    // Calculate cumulative slippage
    const cumulative = this.calculateCumulativeSlippage(hopsWithSlippage);

    return {
      hops: hopsWithSlippage.map(h => ({
        hopIndex: h.hopIndex,
        slippage: h.slippage
      })),
      cumulative,
      finalMinOutput: cumulative.minOutput,
      isExcessive: cumulative.isExcessive
    };
  }

  /**
   * Check if slippage exceeds threshold
   * @param {number} slippagePercentage - Slippage percentage (0.01 = 1%)
   * @param {string} threshold - Threshold level ('warning', 'excessive', 'critical')
   * @returns {boolean} Whether threshold is exceeded
   */
  exceedsThreshold(slippagePercentage, threshold = 'excessive') {
    return slippagePercentage >= this.thresholds[threshold];
  }

  /**
   * Get slippage warning level
   * @param {number} slippagePercentage - Slippage percentage
   * @returns {string} Warning level ('none', 'warning', 'excessive', 'critical')
   */
  getWarningLevel(slippagePercentage) {
    if (slippagePercentage >= this.thresholds.critical) {
      return 'critical';
    } else if (slippagePercentage >= this.thresholds.excessive) {
      return 'excessive';
    } else if (slippagePercentage >= this.thresholds.warning) {
      return 'warning';
    } else {
      return 'none';
    }
  }

  /**
   * Calculate minimum output with custom tolerance
   * @param {string} expectedOutput - Expected output amount
   * @param {number} tolerancePercentage - Tolerance percentage (0.01 = 1%)
   * @returns {string} Minimum output amount
   */
  calculateMinOutput(expectedOutput, tolerancePercentage) {
    return (parseFloat(expectedOutput) * (1 - tolerancePercentage)).toFixed(6);
  }

  /**
   * Update slippage thresholds
   * @param {Object} thresholds - New threshold values
   */
  updateThresholds(thresholds) {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }
}

module.exports = SlippageEngine;
