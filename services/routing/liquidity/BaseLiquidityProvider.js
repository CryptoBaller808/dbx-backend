/**
 * BaseLiquidityProvider.js
 * Stage 5 - Phase 1: Base Liquidity Provider Interface
 * 
 * Abstract base class for all liquidity providers.
 * Defines the interface that all providers must implement.
 */

class BaseLiquidityProvider {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
    this.enabled = config.enabled !== false;
  }

  /**
   * Get spot price for a token pair
   * @param {string} base - Base token symbol
   * @param {string} quote - Quote token symbol
   * @param {Object} opts - Optional parameters (chain, etc.)
   * @returns {Promise<number|null>} Spot price or null if not available
   */
  async getSpotPrice(base, quote, opts = {}) {
    throw new Error(`${this.name}: getSpotPrice() must be implemented by subclass`);
  }

  /**
   * Get market depth for a token pair
   * @param {string} base - Base token symbol
   * @param {string} quote - Quote token symbol
   * @param {Object} opts - Optional parameters (chain, notionalHint, etc.)
   * @returns {Promise<Object|null>} Depth data or null if not available
   */
  async getDepth(base, quote, opts = {}) {
    throw new Error(`${this.name}: getDepth() must be implemented by subclass`);
  }

  /**
   * Get slippage curve for a token pair
   * @param {string} base - Base token symbol
   * @param {string} quote - Quote token symbol
   * @param {Object} opts - Optional parameters (chain, amounts, etc.)
   * @returns {Promise<Object|null>} Slippage curve data or null if not available
   */
  async getSlippageCurve(base, quote, opts = {}) {
    throw new Error(`${this.name}: getSlippageCurve() must be implemented by subclass`);
  }

  /**
   * Check if this provider supports a given token pair
   * @param {string} base - Base token symbol
   * @param {string} quote - Quote token symbol
   * @param {Object} opts - Optional parameters (chain, etc.)
   * @returns {boolean} True if supported
   */
  supports(base, quote, opts = {}) {
    return false;
  }

  /**
   * Get provider name
   * @returns {string} Provider name
   */
  getName() {
    return this.name;
  }

  /**
   * Check if provider is enabled
   * @returns {boolean} True if enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Enable provider
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable provider
   */
  disable() {
    this.enabled = false;
  }
}

module.exports = BaseLiquidityProvider;
