/**
 * LiquidityOracle.js
 * Stage 5 - Phase 1: Multi-Provider Liquidity Oracle
 * 
 * Orchestrates multiple liquidity providers (simulated, xrpl, evm, etc.)
 * with configurable fallback and mode selection.
 */

const fs = require('fs');
const path = require('path');
const SimulatedLiquidityProvider = require('./liquidity/SimulatedLiquidityProvider');
const XrplLiquidityProvider = require('./liquidity/XrplLiquidityProvider');
const EvmLiquidityProvider = require('./liquidity/EvmLiquidityProvider');

class LiquidityOracle {
  constructor() {
    this.providers = new Map();
    this.providerConfig = null;
    this.mode = process.env.ROUTING_LIQUIDITY_MODE || 'auto'; // 'simulated' | 'live' | 'auto'
    
    this.loadProviderConfig();
    this.initializeProviders();
    
    console.log(`[LiquidityOracle] Initialized in '${this.mode}' mode with ${this.providers.size} providers`);
  }

  /**
   * Load provider configuration
   */
  loadProviderConfig() {
    try {
      const configPath = path.join(__dirname, '../../config/liquidity_providers.json');
      const rawData = fs.readFileSync(configPath, 'utf8');
      this.providerConfig = JSON.parse(rawData);
      
      // Override mode from config if not set via env var
      if (!process.env.ROUTING_LIQUIDITY_MODE && this.providerConfig.mode) {
        this.mode = this.providerConfig.mode;
      }
      
      console.log('[LiquidityOracle] Loaded provider configuration');
    } catch (error) {
      console.error('[LiquidityOracle] Failed to load provider config:', error.message);
      this.providerConfig = {
        mode: 'simulated',
        providers: {
          simulated: { enabled: true, priority: 999 }
        },
        chainPriorities: {}
      };
    }
  }

  /**
   * Initialize all enabled providers
   */
  initializeProviders() {
    // Always initialize simulated provider
    const simulatedProvider = new SimulatedLiquidityProvider(
      this.providerConfig.providers.simulated || {}
    );
    this.providers.set('simulated', simulatedProvider);
    
    // Initialize XRPL provider if enabled
    if (this.providerConfig.providers.xrpl?.enabled) {
      try {
        const xrplProvider = new XrplLiquidityProvider(
          this.providerConfig.providers.xrpl.config || {}
        );
        this.providers.set('xrpl', xrplProvider);
        console.log('[LiquidityOracle] XRPL provider initialized');
      } catch (error) {
        console.error('[LiquidityOracle] Failed to initialize XRPL provider:', error.message);
      }
    }
    
    // Initialize EVM provider if enabled
    if (this.providerConfig.providers.evm?.enabled) {
      try {
        const evmProvider = new EvmLiquidityProvider(
          this.providerConfig.providers.evm.config || {}
        );
        this.providers.set('evm', evmProvider);
        console.log('[LiquidityOracle] EVM provider initialized');
      } catch (error) {
        console.error('[LiquidityOracle] Failed to initialize EVM provider:', error.message);
      }
    }
  }

  /**
   * Register a new provider
   * @param {string} name - Provider name
   * @param {BaseLiquidityProvider} provider - Provider instance
   */
  registerProvider(name, provider) {
    this.providers.set(name, provider);
    console.log(`[LiquidityOracle] Registered provider: ${name}`);
  }

  /**
   * Get provider by name
   * @param {string} name - Provider name
   * @returns {BaseLiquidityProvider|null} Provider instance
   */
  getProvider(name) {
    return this.providers.get(name) || null;
  }

  /**
   * Get ordered list of providers to try for a given context
   * @param {Object} opts - Context options (chain, etc.)
   * @returns {Array<string>} Ordered provider names
   */
  getProviderPriority(opts = {}) {
    const { chain, mode } = opts;
    const effectiveMode = mode || this.mode;

    // In 'simulated' mode, only use simulated provider
    if (effectiveMode === 'simulated') {
      return ['simulated'];
    }

    // In 'live' mode, exclude simulated provider
    if (effectiveMode === 'live') {
      const liveProviders = [];
      
      // Get chain-specific priorities
      if (chain && this.providerConfig.chainPriorities[chain]) {
        const chainPriorities = this.providerConfig.chainPriorities[chain]
          .filter(p => p !== 'simulated' && this.providers.has(p));
        liveProviders.push(...chainPriorities);
      }
      
      // Add any other enabled live providers
      for (const [name, provider] of this.providers.entries()) {
        if (name !== 'simulated' && provider.isEnabled() && !liveProviders.includes(name)) {
          liveProviders.push(name);
        }
      }
      
      return liveProviders;
    }

    // In 'auto' mode, try live providers first, then simulated
    const autoProviders = [];
    
    // Get chain-specific priorities
    if (chain && this.providerConfig.chainPriorities[chain]) {
      autoProviders.push(...this.providerConfig.chainPriorities[chain]);
    } else {
      // Default priority: all enabled providers sorted by priority
      const sortedProviders = Array.from(this.providers.entries())
        .filter(([_, provider]) => provider.isEnabled())
        .map(([name, _]) => ({
          name,
          priority: this.providerConfig.providers[name]?.priority || 999
        }))
        .sort((a, b) => a.priority - b.priority)
        .map(p => p.name);
      
      autoProviders.push(...sortedProviders);
    }
    
    // Ensure simulated is always last in auto mode
    const filtered = autoProviders.filter(p => this.providers.has(p));
    if (!filtered.includes('simulated')) {
      filtered.push('simulated');
    }
    
    return filtered;
  }

  /**
   * Get spot price for a token pair
   * @param {string} base - Base token
   * @param {string} quote - Quote token
   * @param {Object} opts - Options (chain, mode, etc.)
   * @returns {Promise<Object>} Price result with metadata
   */
  async getSpotPrice(base, quote, opts = {}) {
    const startTime = Date.now();
    const providerPriority = this.getProviderPriority(opts);
    const providersTried = [];

    for (const providerName of providerPriority) {
      const provider = this.providers.get(providerName);
      if (!provider || !provider.isEnabled()) continue;

      try {
        providersTried.push(providerName);
        const price = await provider.getSpotPrice(base, quote, opts);
        
        if (price !== null) {
          const timing = Date.now() - startTime;
          console.log(`[LiquidityOracle] getSpotPrice(${base}/${quote}) -> ${price} via ${providerName} (${timing}ms)`);
          
          return {
            price,
            provider: providerName,
            providersTried,
            timing,
            mode: opts.mode || this.mode
          };
        }
      } catch (error) {
        console.warn(`[LiquidityOracle] Provider ${providerName} failed for ${base}/${quote}:`, error.message);
      }
    }

    // No provider succeeded
    const timing = Date.now() - startTime;
    console.error(`[LiquidityOracle] No provider found for ${base}/${quote} (tried: ${providersTried.join(', ')})`);
    
    return {
      price: null,
      provider: null,
      providersTried,
      timing,
      mode: opts.mode || this.mode,
      error: 'NO_LIQUIDITY_PROVIDER'
    };
  }

  /**
   * Get market depth for a token pair
   * @param {string} base - Base token
   * @param {string} quote - Quote token
   * @param {Object} opts - Options (chain, notionalHint, mode, etc.)
   * @returns {Promise<Object>} Depth result with metadata
   */
  async getDepth(base, quote, opts = {}) {
    const startTime = Date.now();
    const providerPriority = this.getProviderPriority(opts);
    const providersTried = [];

    for (const providerName of providerPriority) {
      const provider = this.providers.get(providerName);
      if (!provider || !provider.isEnabled()) continue;

      try {
        providersTried.push(providerName);
        const depth = await provider.getDepth(base, quote, opts);
        
        if (depth !== null) {
          const timing = Date.now() - startTime;
          console.log(`[LiquidityOracle] getDepth(${base}/${quote}) via ${providerName} (${timing}ms)`);
          
          return {
            depth,
            provider: providerName,
            providersTried,
            timing,
            mode: opts.mode || this.mode
          };
        }
      } catch (error) {
        console.warn(`[LiquidityOracle] Provider ${providerName} failed for ${base}/${quote} depth:`, error.message);
      }
    }

    // No provider succeeded
    const timing = Date.now() - startTime;
    console.error(`[LiquidityOracle] No depth provider found for ${base}/${quote} (tried: ${providersTried.join(', ')})`);
    
    return {
      depth: null,
      provider: null,
      providersTried,
      timing,
      mode: opts.mode || this.mode,
      error: 'NO_LIQUIDITY_PROVIDER'
    };
  }

  /**
   * Get slippage curve for a token pair
   * @param {string} base - Base token
   * @param {string} quote - Quote token
   * @param {Object} opts - Options (chain, amounts, mode, etc.)
   * @returns {Promise<Object>} Slippage curve result with metadata
   */
  async getSlippageCurve(base, quote, opts = {}) {
    const startTime = Date.now();
    const providerPriority = this.getProviderPriority(opts);
    const providersTried = [];

    for (const providerName of providerPriority) {
      const provider = this.providers.get(providerName);
      if (!provider || !provider.isEnabled()) continue;

      try {
        providersTried.push(providerName);
        const curve = await provider.getSlippageCurve(base, quote, opts);
        
        if (curve !== null) {
          const timing = Date.now() - startTime;
          console.log(`[LiquidityOracle] getSlippageCurve(${base}/${quote}) via ${providerName} (${timing}ms)`);
          
          return {
            curve,
            provider: providerName,
            providersTried,
            timing,
            mode: opts.mode || this.mode
          };
        }
      } catch (error) {
        console.warn(`[LiquidityOracle] Provider ${providerName} failed for ${base}/${quote} slippage:`, error.message);
      }
    }

    // No provider succeeded
    const timing = Date.now() - startTime;
    
    return {
      curve: null,
      provider: null,
      providersTried,
      timing,
      mode: opts.mode || this.mode,
      error: 'NO_LIQUIDITY_PROVIDER'
    };
  }

  /**
   * Set liquidity mode
   * @param {string} mode - 'simulated' | 'live' | 'auto'
   */
  setMode(mode) {
    if (!['simulated', 'live', 'auto'].includes(mode)) {
      throw new Error(`Invalid mode: ${mode}. Must be 'simulated', 'live', or 'auto'`);
    }
    this.mode = mode;
    console.log(`[LiquidityOracle] Mode changed to '${mode}'`);
  }

  /**
   * Get current mode
   * @returns {string} Current mode
   */
  getMode() {
    return this.mode;
  }

  /**
   * Reload provider configuration
   */
  reload() {
    this.loadProviderConfig();
    
    // Reload simulated provider data
    const simulatedProvider = this.providers.get('simulated');
    if (simulatedProvider && simulatedProvider.reload) {
      simulatedProvider.reload();
    }
    
    console.log('[LiquidityOracle] Reloaded configuration');
  }

  // ============================================
  // BACKWARD COMPATIBILITY METHODS (Stage 4)
  // ============================================

  /**
   * Get pool (backward compatible with Stage 4)
   */
  getPool(chain, token0, token1) {
    const simulatedProvider = this.providers.get('simulated');
    return simulatedProvider ? simulatedProvider.getPool(chain, token0, token1) : null;
  }

  /**
   * Calculate swap output (backward compatible with Stage 4)
   */
  calculateSwapOutput(chain, tokenIn, tokenOut, amountIn) {
    const simulatedProvider = this.providers.get('simulated');
    return simulatedProvider ? simulatedProvider.calculateSwapOutput(chain, tokenIn, tokenOut, amountIn) : null;
  }

  /**
   * Calculate VWAP (backward compatible with Stage 4)
   */
  calculateVWAP(chain, tokenIn, tokenOut, amountIn) {
    const result = this.calculateSwapOutput(chain, tokenIn, tokenOut, amountIn);
    return result ? parseFloat(result.effectivePrice) : null;
  }

  /**
   * Get bridge (backward compatible with Stage 4)
   */
  getBridge(fromChain, toChain) {
    const simulatedProvider = this.providers.get('simulated');
    return simulatedProvider ? simulatedProvider.getBridge(fromChain, toChain) : null;
  }

  /**
   * Can bridge (backward compatible with Stage 4)
   */
  canBridge(fromChain, toChain, token) {
    const bridge = this.getBridge(fromChain, toChain);
    if (!bridge) return false;
    return bridge.supportedTokens.includes(token);
  }

  /**
   * Get chain pools (backward compatible with Stage 4)
   */
  getChainPools(chain) {
    const simulatedProvider = this.providers.get('simulated');
    return simulatedProvider ? simulatedProvider.getChainPools(chain) : [];
  }

  /**
   * Get token price USD (backward compatible with Stage 4)
   */
  getTokenPriceUSD(token) {
    const simulatedProvider = this.providers.get('simulated');
    if (!simulatedProvider) return null;
    return simulatedProvider.liquidityData.priceOracles[token] || null;
  }

  /**
   * Get market depth (backward compatible with Stage 4)
   */
  getMarketDepth(chain, token0, token1) {
    const simulatedProvider = this.providers.get('simulated');
    if (!simulatedProvider) return null;
    
    const pool = simulatedProvider.getPool(chain, token0, token1);
    if (!pool) return null;
    
    return simulatedProvider.calculateDepth(pool, token0, token1);
  }

  /**
   * Get slippage curve (backward compatible with Stage 4)
   */
  getSlippageCurve(chain, tokenIn, tokenOut, amounts) {
    const simulatedProvider = this.providers.get('simulated');
    if (!simulatedProvider) return [];
    
    const curve = [];
    for (const amount of amounts) {
      const result = simulatedProvider.calculateSwapOutput(chain, tokenIn, tokenOut, amount);
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
   * Check liquidity (backward compatible with Stage 4)
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

    // Check if amount exceeds 50% of pool reserve
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
}

module.exports = LiquidityOracle;
