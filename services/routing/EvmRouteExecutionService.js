/**
 * EvmRouteExecutionService.js
 * Stage 6A: EVM Route Execution Service
 * 
 * Responsibilities:
 * - Execute EVM routes (ETH, BSC, AVAX, MATIC)
 * - Support demo mode with demo wallets
 * - Build and broadcast EVM transactions
 * - Wait for confirmations
 * - Return structured execution results
 * - Handle errors robustly
 */

const { ethers } = require('ethers');
const evmConfig = require('../../config/evmConfig');

class EvmRouteExecutionService {
  constructor() {
    this.config = evmConfig;
    console.log('[EvmRouteExecution] Initialized');
  }
  
  /**
   * Execute an EVM route
   * @param {Object} route - Route object from RoutePlanner
   * @param {Object} params - Execution parameters
   * @returns {Promise<Object>} Execution result
   */
  async executeRoute(route, params) {
    const startTime = Date.now();
    const {
      base,
      quote,
      amount,
      side,
      executionMode = 'demo',
      routeId = `route_${Date.now()}`
    } = params;
    
    const chain = route.chain;
    
    console.log('[EvmRouteExecution] Executing EVM route:', {
      chain,
      base,
      quote,
      amount,
      side,
      executionMode,
      pathType: route.pathType
    });
    
    try {
      // Step 1: Validate execution mode
      if (!this.config.isExecutionEnabled()) {
        return this._errorResponse('EXECUTION_DISABLED', 'EVM route execution is currently disabled');
      }
      
      // Step 2: Validate chain is supported
      if (!this.config.isChainSupported(chain)) {
        console.error(`[EvmRouteExecution] Unsupported chain: ${chain}`);
        return this._errorResponse(
          'EXECUTION_FAILED',
          `EVM demo is not available for ${chain}. Supported chains: ${this.config.getSupportedChains().join(', ')}`,
          {
            chain,
            supportedChains: this.config.getSupportedChains()
          }
        );
      }
      
      // Step 3: Validate configuration for chain
      const configValidation = this.config.validateChainConfig(chain, executionMode);
      if (!configValidation.valid) {
        console.error(`[EvmRouteExecution] Config validation failed for chain=${chain}:`, configValidation.errors);
        return this._errorResponse(
          'EXECUTION_FAILED',
          'EVM demo is temporarily unavailable for this chain. Please try again later.',
          {
            chain,
            executionMode,
            configErrors: configValidation.errors,
            note: 'Chain configuration is incomplete or missing required parameters'
          }
        );
      }
      
      // Step 4: Validate execution mode
      if (executionMode === 'production') {
        return this._errorResponse('NOT_IMPLEMENTED', 'Production execution mode is not implemented yet for EVM chains', {
          executionMode,
          supportedModes: ['demo']
        });
      }
      
      if (executionMode !== 'demo') {
        return this._errorResponse('INVALID_EXECUTION_MODE', `Invalid execution mode: ${executionMode}`, {
          executionMode,
          supportedModes: ['demo']
        });
      }
      
      // Step 5: Validate route path type (only single-hop for now)
      if (route.pathType !== 'direct' && route.hops && route.hops.length > 1) {
        return this._errorResponse('UNSUPPORTED_ROUTE', 'Multi-hop EVM routes are not supported yet in Stage 6A', {
          pathType: route.pathType,
          hops: route.hops?.length || 0,
          supportedPathTypes: ['direct']
        });
      }
      
      // Step 6: Execute demo transaction
      console.log('[EvmRouteExecution] Executing demo transaction...');
      const txResult = await this._executeDemoTransaction(chain, route, params);
      
      const executionTime = Date.now() - startTime;
      
      // Step 7: Build success response
      return {
        success: true,
        chain,
        executionMode,
        route: {
          pathType: route.pathType,
          expectedOutput: route.expectedOutput,
          hops: route.hops,
          fees: route.fees,
          slippage: route.slippage,
          fromChain: chain,
          toChain: chain
        },
        transaction: txResult.transaction,
        settlement: txResult.settlement,
        timestamp: new Date().toISOString(),
        executionTimeMs: executionTime
      };
      
    } catch (error) {
      console.error('[EvmRouteExecution] Execution failed:', error);
      
      // Map common errors to structured error codes
      if (error.code === 'INSUFFICIENT_FUNDS') {
        return this._errorResponse('EVM_INSUFFICIENT_FUNDS', 'Insufficient funds in demo wallet', {
          error: error.message
        });
      }
      
      if (error.code === 'NETWORK_ERROR' || error.code === 'SERVER_ERROR') {
        return this._errorResponse('EVM_RPC_ERROR', 'RPC network error', {
          error: error.message
        });
      }
      
      if (error.message && error.message.includes('gas')) {
        return this._errorResponse('EVM_GAS_ESTIMATION_FAILED', 'Gas estimation failed', {
          error: error.message
        });
      }
      
      return this._errorResponse('EXECUTION_FAILED', error.message, {
        error: error.toString(),
        stack: error.stack
      });
    }
  }
  
  /**
   * Execute demo transaction on EVM chain
   * Stage 6B Fix #2: Fully simulated - no real Sepolia funds required
   * @private
   */
  async _executeDemoTransaction(chain, route, params) {
    const { base, quote, amount, side, routeId } = params;
    
    console.log('[EvmRouteExecution][Demo] Preparing SIMULATED demo transaction for chain:', chain);
    console.log('[EvmRouteExecution][Demo] Stage 6B Fix #2: Using fully simulated execution (no real Sepolia broadcast)');
    
    // Stage 6B Fix #2: Fully simulated execution
    // No real RPC calls, no wallet balance checks, no Sepolia broadcast
    // This eliminates EVM_INSUFFICIENT_FUNDS errors and faucet dependencies
    
    const nativeCurrency = this.config.getNativeCurrency(chain);
    const demoAmount = '0.001'; // Small amount for demo
    
    // Generate deterministic pseudo transaction hash
    // Use keccak256(routeId + timestamp) for uniqueness
    const hashInput = `${routeId}_${Date.now()}_${base}_${quote}_${amount}`;
    const pseudoHash = ethers.keccak256(ethers.toUtf8Bytes(hashInput));
    
    // Generate pseudo block number (current timestamp in seconds)
    const pseudoBlockNumber = Math.floor(Date.now() / 1000);
    
    // Simulated wallet address (demo address, not real)
    const demoWalletAddress = '0xDEMO1234567890123456789012345678901234';
    
    console.log('[EvmRouteExecution][Demo] Simulated transaction:', {
      hash: pseudoHash,
      from: demoWalletAddress,
      to: demoWalletAddress,
      value: demoAmount,
      currency: nativeCurrency,
      blockNumber: pseudoBlockNumber,
      note: 'SIMULATED - No real Sepolia broadcast'
    });
    
    // Build simulated transaction result
    return {
      transaction: {
        hash: pseudoHash,
        chainId: this.config.getChainId(chain),
        from: demoWalletAddress,
        to: demoWalletAddress,
        value: demoAmount,
        gasUsed: '21000', // Standard ETH transfer gas
        gasPrice: '1 gwei', // Simulated gas price
        nonce: Math.floor(Math.random() * 1000), // Random nonce for demo
        blockNumber: pseudoBlockNumber,
        network: this._getNetworkLabel(chain), // Chain-specific demo label
        currency: nativeCurrency,
        memo: routeId,
        // Include route execution details
        routeDetails: {
          base,
          quote,
          amount,
          side,
          executionType: 'simulated_demo',
          note: 'Stage 6B Fix #2: Fully simulated execution - no real Sepolia funds required'
        }
      },
      settlement: {
        status: 'confirmed',
        blockNumber: pseudoBlockNumber,
        confirmations: 1,
        timestamp: new Date().toISOString(),
        note: 'Simulated settlement - no real blockchain state change'
      }
    };
  }
  
  /**
   * Get network label for a chain
   * Stage 6C: Chain-specific demo labels
   * @private
   */
  _getNetworkLabel(chain) {
    // Try to get network label from config first
    const networkConfig = this.config.networkConfig.networks[chain];
    if (networkConfig && networkConfig.networkLabel) {
      return networkConfig.networkLabel;
    }
    
    // Fallback to default labels
    const labels = {
      'ETH': 'Sepolia – Demo',
      'BSC': 'BSC Testnet – Demo',
      'AVAX': 'Fuji – Demo',
      'MATIC': 'Mumbai – Demo'
    };
    return labels[chain] || `${chain} – Demo`;
  }
  
  /**
   * Build error response
   * @private
   */
  _errorResponse(errorCode, message, details = {}) {
    return {
      success: false,
      errorCode,
      message,
      details,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = EvmRouteExecutionService;
