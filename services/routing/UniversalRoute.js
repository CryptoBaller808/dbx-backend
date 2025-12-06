/**
 * UniversalRoute.js
 * Stage 4 - Phase 1: Universal Route Schema
 * 
 * Defines the universal route schema DBX will use for all cross-chain routing.
 * This schema is chain-agnostic and supports multi-hop routing.
 */

class UniversalRoute {
  /**
   * Create a new Universal Route
   * @param {Object} params - Route parameters
   * @param {string} params.chain - Primary chain for this route (e.g., 'XRPL', 'ETH', 'XDC')
   * @param {string} params.pathType - 'direct' or 'multi-hop'
   * @param {Array} params.hops - Array of hop objects
   * @param {Object} params.fees - Fee breakdown
   * @param {Object} params.slippage - Slippage information
   * @param {string} params.expectedOutput - Expected output amount
   * @param {Array} params.oracleSources - Oracle sources used for pricing
   */
  constructor(params) {
    this.chain = params.chain;
    this.pathType = params.pathType || 'direct';
    this.hops = params.hops || [];
    this.fees = params.fees || {};
    this.slippage = params.slippage || {};
    this.expectedOutput = params.expectedOutput;
    this.oracleSources = params.oracleSources || [];
    this.timestamp = new Date().toISOString();
    this.routeId = this.generateRouteId();
  }

  /**
   * Generate unique route ID
   */
  generateRouteId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `route_${timestamp}_${random}`;
  }

  /**
   * Add a hop to the route
   * @param {Object} hop - Hop object
   * @param {string} hop.chain - Chain for this hop
   * @param {string} hop.protocol - Protocol (e.g., 'XRPL_AMM', 'UNISWAP_V2', 'BRIDGE')
   * @param {string} hop.fromToken - Input token
   * @param {string} hop.toToken - Output token
   * @param {string} hop.amountIn - Input amount
   * @param {string} hop.amountOut - Expected output amount
   * @param {Object} hop.pool - Pool information (if applicable)
   */
  addHop(hop) {
    this.hops.push({
      hopIndex: this.hops.length,
      chain: hop.chain,
      protocol: hop.protocol,
      fromToken: hop.fromToken,
      toToken: hop.toToken,
      amountIn: hop.amountIn,
      amountOut: hop.amountOut,
      pool: hop.pool || null,
      fee: hop.fee || null
    });
  }

  /**
   * Set fee breakdown
   * @param {Object} fees - Fee object
   * @param {string} fees.totalFeeUSD - Total fee in USD
   * @param {Array} fees.breakdown - Array of fee components
   */
  setFees(fees) {
    this.fees = {
      totalFeeUSD: fees.totalFeeUSD,
      totalFeeNative: fees.totalFeeNative,
      breakdown: fees.breakdown || [],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Set slippage information
   * @param {Object} slippage - Slippage object
   * @param {number} slippage.percentage - Slippage percentage
   * @param {string} slippage.minOutput - Minimum output after slippage
   * @param {boolean} slippage.isExcessive - Whether slippage exceeds threshold
   */
  setSlippage(slippage) {
    this.slippage = {
      percentage: slippage.percentage,
      minOutput: slippage.minOutput,
      isExcessive: slippage.isExcessive || false,
      cumulativeSlippage: slippage.cumulativeSlippage || slippage.percentage
    };
  }

  /**
   * Validate route integrity
   * @returns {Object} Validation result
   */
  validate() {
    const errors = [];

    if (!this.chain) {
      errors.push('Route must have a primary chain');
    }

    if (!['direct', 'multi-hop'].includes(this.pathType)) {
      errors.push('Invalid pathType: must be "direct" or "multi-hop"');
    }

    if (this.pathType === 'multi-hop' && this.hops.length < 2) {
      errors.push('Multi-hop route must have at least 2 hops');
    }

    if (this.hops.length === 0) {
      errors.push('Route must have at least 1 hop');
    }

    // Validate hop continuity
    for (let i = 0; i < this.hops.length - 1; i++) {
      const currentHop = this.hops[i];
      const nextHop = this.hops[i + 1];

      if (currentHop.toToken !== nextHop.fromToken) {
        errors.push(`Hop ${i} output (${currentHop.toToken}) does not match hop ${i + 1} input (${nextHop.fromToken})`);
      }
    }

    if (!this.expectedOutput) {
      errors.push('Route must have expectedOutput');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get route summary
   * @returns {string} Human-readable route summary
   */
  getSummary() {
    if (this.pathType === 'direct') {
      const hop = this.hops[0];
      return `${hop.fromToken} → ${hop.toToken} on ${hop.chain} via ${hop.protocol}`;
    } else {
      const tokens = [this.hops[0].fromToken, ...this.hops.map(h => h.toToken)];
      return `${tokens.join(' → ')} (${this.hops.length} hops)`;
    }
  }

  /**
   * Calculate total route value
   * @returns {Object} Value metrics
   */
  getMetrics() {
    const totalHops = this.hops.length;
    const chains = [...new Set(this.hops.map(h => h.chain))];
    const protocols = [...new Set(this.hops.map(h => h.protocol))];

    return {
      totalHops,
      uniqueChains: chains.length,
      chains,
      protocols,
      totalFeeUSD: this.fees.totalFeeUSD || '0',
      slippagePercentage: this.slippage.percentage || 0,
      expectedOutput: this.expectedOutput,
      routeSummary: this.getSummary()
    };
  }

  /**
   * Export route as JSON
   * @returns {Object} Route object
   */
  toJSON() {
    return {
      routeId: this.routeId,
      chain: this.chain,
      pathType: this.pathType,
      hops: this.hops,
      fees: this.fees,
      slippage: this.slippage,
      expectedOutput: this.expectedOutput,
      oracleSources: this.oracleSources,
      timestamp: this.timestamp,
      metrics: this.getMetrics()
    };
  }

  /**
   * Create route from JSON
   * @param {Object} json - Route JSON object
   * @returns {UniversalRoute} Route instance
   */
  static fromJSON(json) {
    const route = new UniversalRoute({
      chain: json.chain,
      pathType: json.pathType,
      hops: json.hops,
      fees: json.fees,
      slippage: json.slippage,
      expectedOutput: json.expectedOutput,
      oracleSources: json.oracleSources
    });
    route.routeId = json.routeId;
    route.timestamp = json.timestamp;
    return route;
  }
}

module.exports = UniversalRoute;
