/**
 * executionConfig.js
 * Stage 7.0: Execution Mode Control
 * 
 * Responsibilities:
 * - Manage global execution mode (demo vs live)
 * - Enforce kill switch for live execution
 * - Provide chain-specific mode resolution
 * - Validate execution permissions
 */

class ExecutionConfig {
  constructor() {
    // Global execution mode (default: demo)
    this.globalMode = process.env.EXECUTION_MODE || 'demo';
    
    // Kill switch for live execution (default: false)
    this.liveExecutionEnabled = process.env.LIVE_EXECUTION_ENABLED === 'true';
    
    // Safety limits (Stage 7.1)
    this.maxTradeUSD = parseFloat(process.env.LIVE_MAX_NOTIONAL_USD) || parseFloat(process.env.MAX_TRADE_USD) || 25;
    this.maxSlippageBPS = parseInt(process.env.MAX_SLIPPAGE_BPS) || 50; // 0.5%
    this.maxTradesPerHour = parseInt(process.env.LIVE_MAX_TRADES_PER_HOUR) || 3;
    
    // Chain allowlist (Stage 7.1)
    this.liveEvmChains = (process.env.LIVE_EVM_CHAINS || 'ETH').split(',').map(c => c.trim());
    
    console.log('[ExecutionConfig] Initialized:', {
      globalMode: this.globalMode,
      liveExecutionEnabled: this.liveExecutionEnabled,
      maxTradeUSD: this.maxTradeUSD,
      maxSlippageBPS: this.maxSlippageBPS,
      maxTradesPerHour: this.maxTradesPerHour,
      liveEvmChains: this.liveEvmChains
    });
  }
  
  /**
   * Get execution mode for a specific chain
   * @param {string} chain - Chain identifier (ETH, BNB, XRP, etc.)
   * @returns {string} 'demo' or 'live'
   */
  getMode(chain) {
    // Stage 7.1: Prioritize global mode unless chain-specific override is explicitly set
    // This ensures EXECUTION_MODE=live works without requiring per-chain overrides
    
    // Check chain-specific override (e.g., EVM_EXECUTION_MODE, XRPL_EXECUTION_MODE)
    const chainGroup = this._getChainGroup(chain);
    const chainMode = process.env[`${chainGroup}_EXECUTION_MODE`];
    
    // Only use chain-specific override if it's explicitly set to 'live' or 'demo'
    // If not set or set to other values, fall back to global mode
    if (chainMode === 'live' || chainMode === 'demo') {
      return chainMode;
    }
    
    // Fall back to global mode (EXECUTION_MODE)
    return this.globalMode;
  }
  
  /**
   * Check if live execution is allowed for a chain
   * @param {string} chain - Chain identifier
   * @returns {boolean}
   */
  isLiveAllowed(chain) {
    // Live execution requires BOTH conditions:
    // 1. EXECUTION_MODE=live (or chain-specific override)
    // 2. LIVE_EXECUTION_ENABLED=true
    const mode = this.getMode(chain);
    return mode === 'live' && this.liveExecutionEnabled;
  }
  
  /**
   * Check if demo mode is active for a chain
   * @param {string} chain - Chain identifier
   * @returns {boolean}
   */
  isDemoMode(chain) {
    return this.getMode(chain) === 'demo';
  }
  
  /**
   * Validate if execution can proceed (Stage 7.1 enhanced)
   * @param {string} chain - Chain identifier
   * @param {string} requestedMode - Requested execution mode
   * @returns {Object} { allowed: boolean, reason?: string }
   */
  validateExecution(chain, requestedMode) {
    // Demo mode always allowed
    if (requestedMode === 'demo') {
      return { allowed: true };
    }
    
    // Live mode requires kill switch to be enabled
    if (requestedMode === 'live') {
      if (!this.liveExecutionEnabled) {
        return {
          allowed: false,
          reason: 'Live execution is currently disabled by server.',
          code: 'LIVE_DISABLED_BY_SERVER'
        };
      }
      
      // Check chain allowlist (Stage 7.1)
      if (!this.isChainAllowedForLive(chain)) {
        return {
          allowed: false,
          reason: `Chain ${chain} is not enabled for live execution. Allowed chains: ${this.liveEvmChains.join(', ')}`,
          code: 'CHAIN_NOT_ENABLED_FOR_LIVE'
        };
      }
      
      const configuredMode = this.getMode(chain);
      if (configuredMode !== 'live') {
        return {
          allowed: false,
          reason: `Live execution is not enabled for ${chain}. Current mode: ${configuredMode}`,
          code: 'LIVE_DISABLED'
        };
      }
      
      return { allowed: true };
    }
    
    // Invalid mode
    return {
      allowed: false,
      reason: `Invalid execution mode: ${requestedMode}. Supported modes: demo, live`,
      code: 'INVALID_MODE'
    };
  }
  
  /**
   * Get chain group for env var lookup
   * @param {string} chain - Chain identifier
   * @returns {string} Chain group (EVM, XRPL, XDC, etc.)
   * @private
   */
  _getChainGroup(chain) {
    const evmChains = ['ETH', 'BNB', 'AVAX', 'MATIC'];
    const xrplChains = ['XRP'];
    const xdcChains = ['XDC'];
    
    if (evmChains.includes(chain)) return 'EVM';
    if (xrplChains.includes(chain)) return 'XRPL';
    if (xdcChains.includes(chain)) return 'XDC';
    
    return chain; // Default to chain name
  }
  
  /**
   * Get maximum trade limit in USD
   * @returns {number}
   */
  getMaxTradeUSD() {
    return this.maxTradeUSD;
  }
  
  /**
   * Get maximum slippage in basis points
   * @returns {number}
   */
  getMaxSlippageBPS() {
    return this.maxSlippageBPS;
  }
  
  /**
   * Check if chain is allowed for live execution (Stage 7.1)
   * @param {string} chain - Chain identifier
   * @returns {boolean}
   */
  isChainAllowedForLive(chain) {
    const evmChains = ['ETH', 'BNB', 'AVAX', 'MATIC'];
    if (evmChains.includes(chain)) {
      return this.liveEvmChains.includes(chain);
    }
    
    // For non-EVM chains, check if they have specific allowlist env vars
    // (not implemented yet for XRP, XDC, etc.)
    return false;
  }
  
  /**
   * Get execution config for frontend (Stage 7.1)
   * @returns {Object} Configuration object
   */
  getConfig() {
    return {
      executionMode: this.globalMode,
      liveEnabled: this.liveExecutionEnabled,
      liveChainsEnabled: this.liveEvmChains,
      killSwitch: !this.liveExecutionEnabled,
      maxUsdPerTrade: this.maxTradeUSD,
      maxTradesPerHour: this.maxTradesPerHour,
      maxSlippageBPS: this.maxSlippageBPS
    };
  }
  
  /**
   * Validate trade amount against limits
   * @param {number} amountUSD - Trade amount in USD
   * @returns {Object} { valid: boolean, reason?: string }
   */
  validateTradeAmount(amountUSD) {
    if (amountUSD > this.maxTradeUSD) {
      return {
        valid: false,
        reason: `Trade amount ($${amountUSD.toFixed(2)}) exceeds maximum limit ($${this.maxTradeUSD.toFixed(2)})`,
        code: 'AMOUNT_EXCEEDS_LIMIT'
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Validate slippage against limits
   * @param {number} slippageBPS - Slippage in basis points
   * @returns {Object} { valid: boolean, reason?: string }
   */
  validateSlippage(slippageBPS) {
    if (slippageBPS > this.maxSlippageBPS) {
      return {
        valid: false,
        reason: `Slippage (${(slippageBPS / 100).toFixed(2)}%) exceeds maximum limit (${(this.maxSlippageBPS / 100).toFixed(2)}%)`,
        code: 'SLIPPAGE_EXCEEDED'
      };
    }
    
    return { valid: true };
  }
}

// Export singleton instance
module.exports = new ExecutionConfig();
