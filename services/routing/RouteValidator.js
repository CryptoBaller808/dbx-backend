/**
 * RouteValidator.js
 * Stage 4 - Phase 1: Route Validation
 * 
 * Ensures route object integrity and validates multi-hop dependencies.
 * Provides comprehensive validation for all route components.
 */

class RouteValidator {
  constructor() {
    this.supportedChains = ['XRPL', 'ETH', 'BSC', 'MATIC', 'AVAX', 'XDC', 'SOL', 'BTC', 'XLM'];
    this.supportedProtocols = [
      'XRPL_AMM',
      'XRPL_DEX',
      'UNISWAP_V2',
      'UNISWAP_V3',
      'PANCAKESWAP',
      'QUICKSWAP',
      'SUSHISWAP',
      'BRIDGE'
    ];
  }

  /**
   * Validate complete route
   * @param {Object} route - Route object to validate
   * @returns {Object} Validation result
   */
  validateRoute(route) {
    const errors = [];
    const warnings = [];

    // Validate basic structure
    if (!route) {
      return { valid: false, errors: ['Route object is null or undefined'], warnings: [] };
    }

    // Validate chain
    if (!route.chain) {
      errors.push('Route must have a primary chain');
    } else if (!this.supportedChains.includes(route.chain)) {
      errors.push(`Unsupported chain: ${route.chain}`);
    }

    // Validate path type
    if (!route.pathType) {
      errors.push('Route must have a pathType');
    } else if (!['direct', 'multi-hop'].includes(route.pathType)) {
      errors.push(`Invalid pathType: ${route.pathType} (must be "direct" or "multi-hop")`);
    }

    // Validate hops
    if (!route.hops || !Array.isArray(route.hops)) {
      errors.push('Route must have a hops array');
    } else {
      const hopValidation = this.validateHops(route.hops, route.pathType);
      errors.push(...hopValidation.errors);
      warnings.push(...hopValidation.warnings);
    }

    // Validate expected output
    if (!route.expectedOutput) {
      errors.push('Route must have expectedOutput');
    } else if (isNaN(parseFloat(route.expectedOutput))) {
      errors.push('expectedOutput must be a valid number');
    }

    // Validate fees
    if (route.fees) {
      const feeValidation = this.validateFees(route.fees);
      errors.push(...feeValidation.errors);
      warnings.push(...feeValidation.warnings);
    }

    // Validate slippage
    if (route.slippage) {
      const slippageValidation = this.validateSlippage(route.slippage);
      errors.push(...slippageValidation.errors);
      warnings.push(...slippageValidation.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate hops array
   * @param {Array} hops - Array of hop objects
   * @param {string} pathType - Path type ('direct' or 'multi-hop')
   * @returns {Object} Validation result
   */
  validateHops(hops, pathType) {
    const errors = [];
    const warnings = [];

    if (hops.length === 0) {
      errors.push('Route must have at least 1 hop');
      return { errors, warnings };
    }

    if (pathType === 'multi-hop' && hops.length < 2) {
      errors.push('Multi-hop route must have at least 2 hops');
    }

    if (pathType === 'direct' && hops.length > 1) {
      warnings.push('Direct route has multiple hops - consider changing pathType to "multi-hop"');
    }

    // Validate each hop
    for (let i = 0; i < hops.length; i++) {
      const hop = hops[i];
      const hopErrors = this.validateHop(hop, i);
      errors.push(...hopErrors);
    }

    // Validate hop continuity
    for (let i = 0; i < hops.length - 1; i++) {
      const currentHop = hops[i];
      const nextHop = hops[i + 1];

      if (currentHop.toToken !== nextHop.fromToken) {
        errors.push(`Hop ${i} output (${currentHop.toToken}) does not match hop ${i + 1} input (${nextHop.fromToken})`);
      }

      // Warn about cross-chain hops
      if (currentHop.chain !== nextHop.chain && currentHop.protocol !== 'BRIDGE') {
        warnings.push(`Hop ${i} chain (${currentHop.chain}) differs from hop ${i + 1} chain (${nextHop.chain}) but protocol is not BRIDGE`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate single hop
   * @param {Object} hop - Hop object
   * @param {number} index - Hop index
   * @returns {Array} Validation errors
   */
  validateHop(hop, index) {
    const errors = [];

    if (!hop.chain) {
      errors.push(`Hop ${index}: missing chain`);
    } else if (!this.supportedChains.includes(hop.chain)) {
      errors.push(`Hop ${index}: unsupported chain ${hop.chain}`);
    }

    if (!hop.protocol) {
      errors.push(`Hop ${index}: missing protocol`);
    } else if (!this.supportedProtocols.includes(hop.protocol)) {
      errors.push(`Hop ${index}: unsupported protocol ${hop.protocol}`);
    }

    if (!hop.fromToken) {
      errors.push(`Hop ${index}: missing fromToken`);
    }

    if (!hop.toToken) {
      errors.push(`Hop ${index}: missing toToken`);
    }

    if (!hop.amountIn) {
      errors.push(`Hop ${index}: missing amountIn`);
    } else if (isNaN(parseFloat(hop.amountIn))) {
      errors.push(`Hop ${index}: amountIn must be a valid number`);
    }

    if (!hop.amountOut) {
      errors.push(`Hop ${index}: missing amountOut`);
    } else if (isNaN(parseFloat(hop.amountOut))) {
      errors.push(`Hop ${index}: amountOut must be a valid number`);
    }

    return errors;
  }

  /**
   * Validate fees object
   * @param {Object} fees - Fees object
   * @returns {Object} Validation result
   */
  validateFees(fees) {
    const errors = [];
    const warnings = [];

    if (!fees.totalFeeUSD) {
      warnings.push('Fees object missing totalFeeUSD');
    } else if (isNaN(parseFloat(fees.totalFeeUSD))) {
      errors.push('totalFeeUSD must be a valid number');
    }

    if (fees.breakdown && !Array.isArray(fees.breakdown)) {
      errors.push('fees.breakdown must be an array');
    }

    return { errors, warnings };
  }

  /**
   * Validate slippage object
   * @param {Object} slippage - Slippage object
   * @returns {Object} Validation result
   */
  validateSlippage(slippage) {
    const errors = [];
    const warnings = [];

    if (slippage.percentage === undefined) {
      warnings.push('Slippage object missing percentage');
    } else if (isNaN(parseFloat(slippage.percentage))) {
      errors.push('slippage.percentage must be a valid number');
    } else if (slippage.percentage > 0.20) {
      warnings.push(`Slippage percentage is very high: ${(slippage.percentage * 100).toFixed(2)}%`);
    }

    if (!slippage.minOutput) {
      warnings.push('Slippage object missing minOutput');
    } else if (isNaN(parseFloat(slippage.minOutput))) {
      errors.push('slippage.minOutput must be a valid number');
    }

    if (slippage.isExcessive) {
      warnings.push('Slippage is marked as excessive - user should be warned');
    }

    return { errors, warnings };
  }

  /**
   * Validate route against user constraints
   * @param {Object} route - Route object
   * @param {Object} constraints - User constraints
   * @param {number} constraints.maxSlippage - Maximum acceptable slippage (0.01 = 1%)
   * @param {number} constraints.maxFeeUSD - Maximum acceptable fee in USD
   * @param {number} constraints.maxHops - Maximum number of hops
   * @returns {Object} Validation result
   */
  validateConstraints(route, constraints) {
    const errors = [];
    const warnings = [];

    if (constraints.maxSlippage !== undefined) {
      const slippagePercentage = route.slippage?.percentage || 0;
      if (slippagePercentage > constraints.maxSlippage) {
        errors.push(`Slippage ${(slippagePercentage * 100).toFixed(2)}% exceeds maximum ${(constraints.maxSlippage * 100).toFixed(2)}%`);
      }
    }

    if (constraints.maxFeeUSD !== undefined) {
      const totalFeeUSD = parseFloat(route.fees?.totalFeeUSD || 0);
      if (totalFeeUSD > constraints.maxFeeUSD) {
        errors.push(`Total fee $${totalFeeUSD.toFixed(2)} exceeds maximum $${constraints.maxFeeUSD.toFixed(2)}`);
      }
    }

    if (constraints.maxHops !== undefined) {
      const hopCount = route.hops?.length || 0;
      if (hopCount > constraints.maxHops) {
        errors.push(`Route has ${hopCount} hops, exceeds maximum ${constraints.maxHops}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if route is executable
   * @param {Object} route - Route object
   * @returns {Object} Executability check result
   */
  checkExecutability(route) {
    const issues = [];

    // Check if all chains are supported
    const chains = [...new Set(route.hops.map(h => h.chain))];
    for (const chain of chains) {
      if (!this.supportedChains.includes(chain)) {
        issues.push(`Chain ${chain} is not yet supported for execution`);
      }
    }

    // Check for stub chains (BTC, SOL, XLM)
    const stubChains = ['BTC', 'SOL', 'XLM'];
    for (const chain of chains) {
      if (stubChains.includes(chain)) {
        issues.push(`Chain ${chain} is currently a stub - execution not available`);
      }
    }

    // Check if route requires bridging
    const requiresBridge = route.hops.some(h => h.protocol === 'BRIDGE');
    if (requiresBridge) {
      issues.push('Route requires bridging - bridge execution not yet implemented');
    }

    return {
      executable: issues.length === 0,
      issues
    };
  }
}

module.exports = RouteValidator;
