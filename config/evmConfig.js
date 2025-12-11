/**
 * evmConfig.js
 * Stage 6A: EVM Execution Configuration Helper
 * 
 * Provides configuration resolution for EVM execution:
 * - Chain → RPC URL mapping
 * - Chain → Demo private key mapping
 * - Execution mode validation
 * - Testnet/mainnet network details
 */

const fs = require('fs');
const path = require('path');

class EvmConfig {
  constructor() {
    // Load EVM network configuration
    this.networkConfig = this._loadNetworkConfig();
    
    // Execution mode from environment
    this.executionMode = process.env.EVM_EXECUTION_MODE || 'disabled';
    
    // Validate execution mode
    const validModes = ['disabled', 'demo', 'production'];
    if (!validModes.includes(this.executionMode)) {
      console.warn(`[EvmConfig] Invalid EVM_EXECUTION_MODE: ${this.executionMode}. Defaulting to 'disabled'.`);
      this.executionMode = 'disabled';
    }
    
    console.log('[EvmConfig] Initialized with execution mode:', this.executionMode);
  }
  
  /**
   * Load EVM network configuration from JSON file
   * @private
   */
  _loadNetworkConfig() {
    try {
      const configPath = path.join(__dirname, 'evm_networks.json');
      const rawData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(rawData);
      console.log('[EvmConfig] Loaded EVM network configuration');
      return config;
    } catch (error) {
      console.error('[EvmConfig] Failed to load network config:', error.message);
      return { networks: {}, tokenMappings: {} };
    }
  }
  
  /**
   * Get RPC URL for a chain
   * @param {string} chain - Chain identifier (ETH, BSC, AVAX, MATIC)
   * @returns {string|null} RPC URL or null if not configured
   */
  getRpcUrl(chain) {
    // Check environment variable first (overrides config file)
    const envKey = `${chain}_RPC_URL`;
    const envUrl = process.env[envKey];
    
    if (envUrl) {
      return envUrl;
    }
    
    // Fallback to config file
    const networkConfig = this.networkConfig.networks[chain];
    if (networkConfig && networkConfig.rpcUrl) {
      return networkConfig.rpcUrl;
    }
    
    console.warn(`[EvmConfig] No RPC URL configured for chain: ${chain}`);
    return null;
  }
  
  /**
   * Get demo private key for a chain
   * @param {string} chain - Chain identifier (ETH, BSC, AVAX, MATIC)
   * @returns {string|null} Private key or null if not configured
   */
  getDemoPrivateKey(chain) {
    const envKey = `EVM_DEMO_PRIVATE_KEY_${chain}`;
    const privateKey = process.env[envKey];
    
    if (!privateKey) {
      console.warn(`[EvmConfig] No demo private key configured for chain: ${chain} (env: ${envKey})`);
      return null;
    }
    
    // Validate private key format (should start with 0x and be 66 chars)
    if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
      console.warn(`[EvmConfig] Invalid private key format for chain: ${chain}`);
      return null;
    }
    
    return privateKey;
  }
  
  /**
   * Get chain ID for a chain
   * @param {string} chain - Chain identifier (ETH, BSC, AVAX, MATIC)
   * @returns {number|null} Chain ID or null if not configured
   */
  getChainId(chain) {
    const networkConfig = this.networkConfig.networks[chain];
    if (networkConfig && networkConfig.chainId) {
      return networkConfig.chainId;
    }
    
    console.warn(`[EvmConfig] No chain ID configured for chain: ${chain}`);
    return null;
  }
  
  /**
   * Get native currency for a chain
   * @param {string} chain - Chain identifier (ETH, BSC, AVAX, MATIC)
   * @returns {string|null} Native currency symbol or null if not configured
   */
  getNativeCurrency(chain) {
    const networkConfig = this.networkConfig.networks[chain];
    if (networkConfig && networkConfig.nativeCurrency) {
      return networkConfig.nativeCurrency;
    }
    
    console.warn(`[EvmConfig] No native currency configured for chain: ${chain}`);
    return null;
  }
  
  /**
   * Get token address for a token on a chain
   * @param {string} chain - Chain identifier (ETH, BSC, AVAX, MATIC)
   * @param {string} token - Token symbol (USDT, USDC, etc.)
   * @returns {string|null} Token address or 'native' or null if not configured
   */
  getTokenAddress(chain, token) {
    const tokenMappings = this.networkConfig.tokenMappings[chain];
    if (tokenMappings && tokenMappings[token]) {
      return tokenMappings[token];
    }
    
    console.warn(`[EvmConfig] No token address configured for ${token} on ${chain}`);
    return null;
  }
  
  /**
   * Check if execution is enabled
   * @returns {boolean} True if execution mode is not 'disabled'
   */
  isExecutionEnabled() {
    return this.executionMode !== 'disabled';
  }
  
  /**
   * Check if demo mode is active
   * @returns {boolean} True if execution mode is 'demo'
   */
  isDemoMode() {
    return this.executionMode === 'demo';
  }
  
  /**
   * Check if production mode is active
   * @returns {boolean} True if execution mode is 'production'
   */
  isProductionMode() {
    return this.executionMode === 'production';
  }
  
  /**
   * Validate configuration for a chain
   * @param {string} chain - Chain identifier (ETH, BSC, AVAX, MATIC)
   * @param {string} executionMode - Execution mode ('demo' or 'production')
   * @returns {Object} Validation result { valid: boolean, errors: string[] }
   */
  validateChainConfig(chain, executionMode) {
    const errors = [];
    
    // Check RPC URL (not required for simulated demo mode)
    const rpcUrl = this.getRpcUrl(chain);
    if (!rpcUrl && executionMode !== 'demo') {
      errors.push(`Missing RPC URL for chain: ${chain}`);
    }
    
    // Stage 6D: Demo mode uses fully simulated execution
    // No private key or RPC required - all transactions are simulated
    // Private key validation only needed for production mode
    if (executionMode === 'production') {
      const privateKey = this.getDemoPrivateKey(chain);
      if (!privateKey) {
        errors.push(`Missing private key for chain: ${chain}`);
      }
    }
    
    // Check chain ID
    const chainId = this.getChainId(chain);
    if (!chainId) {
      errors.push(`Missing chain ID for chain: ${chain}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Get supported EVM chains
   * @returns {string[]} Array of supported chain identifiers
   */
  getSupportedChains() {
    return ['ETH', 'BSC', 'AVAX', 'MATIC'];
  }
  
  /**
   * Check if a chain is supported
   * @param {string} chain - Chain identifier
   * @returns {boolean} True if chain is supported
   */
  isChainSupported(chain) {
    return this.getSupportedChains().includes(chain);
  }
}

// Export singleton instance
module.exports = new EvmConfig();
