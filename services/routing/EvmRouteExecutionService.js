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
        return this._errorResponse('UNSUPPORTED_CHAIN', `Chain ${chain} is not supported for EVM execution`, {
          chain,
          supportedChains: this.config.getSupportedChains()
        });
      }
      
      // Step 3: Validate configuration for chain
      const configValidation = this.config.validateChainConfig(chain, executionMode);
      if (!configValidation.valid) {
        return this._errorResponse('INVALID_CONFIG', `Configuration validation failed for chain ${chain}`, {
          errors: configValidation.errors
        });
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
   * @private
   */
  async _executeDemoTransaction(chain, route, params) {
    const { base, quote, amount, side, routeId } = params;
    
    console.log('[EvmRouteExecution][Demo] Preparing demo transaction for chain:', chain);
    
    // Step 1: Get RPC URL and private key
    const rpcUrl = this.config.getRpcUrl(chain);
    const privateKey = this.config.getDemoPrivateKey(chain);
    
    if (!rpcUrl) {
      throw new Error(`RPC URL not configured for chain: ${chain}`);
    }
    
    if (!privateKey) {
      throw new Error(`Demo private key not configured for chain: ${chain}`);
    }
    
    // Step 2: Create provider and wallet
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log('[EvmRouteExecution][Demo] Demo wallet address:', wallet.address);
    
    // Step 3: Get wallet balance
    const balance = await provider.getBalance(wallet.address);
    const balanceEth = ethers.formatEther(balance);
    
    console.log('[EvmRouteExecution][Demo] Wallet balance:', balanceEth, this.config.getNativeCurrency(chain));
    
    // Step 4: Build demo transaction (simple native token transfer)
    // For Stage 6A, we'll do a simple self-transfer to demonstrate execution
    // In Stage 6B, this will be replaced with actual swap transactions
    
    const nativeCurrency = this.config.getNativeCurrency(chain);
    const demoAmount = '0.001'; // Small amount for demo
    
    console.log('[EvmRouteExecution][Demo] Building demo transaction:', {
      from: wallet.address,
      to: wallet.address, // Self-transfer for demo
      value: demoAmount,
      currency: nativeCurrency
    });
    
    // Build transaction
    const tx = {
      to: wallet.address, // Self-transfer
      value: ethers.parseEther(demoAmount),
      // Gas limit will be estimated automatically
      // Gas price will be determined by provider
    };
    
    // Step 5: Estimate gas
    console.log('[EvmRouteExecution][Demo] Estimating gas...');
    const gasEstimate = await wallet.estimateGas(tx);
    tx.gasLimit = gasEstimate;
    
    console.log('[EvmRouteExecution][Demo] Gas estimate:', gasEstimate.toString());
    
    // Step 6: Get current gas price
    const feeData = await provider.getFeeData();
    if (feeData.gasPrice) {
      tx.gasPrice = feeData.gasPrice;
      console.log('[EvmRouteExecution][Demo] Gas price:', ethers.formatUnits(feeData.gasPrice, 'gwei'), 'gwei');
    }
    
    // Step 7: Send transaction
    console.log('[EvmRouteExecution][Demo] Sending transaction...');
    const txResponse = await wallet.sendTransaction(tx);
    
    console.log('[EvmRouteExecution][Demo] Transaction sent:', {
      hash: txResponse.hash,
      nonce: txResponse.nonce,
      from: txResponse.from,
      to: txResponse.to
    });
    
    // Step 8: Wait for confirmation
    console.log('[EvmRouteExecution][Demo] Waiting for confirmation...');
    const receipt = await txResponse.wait(1); // Wait for 1 confirmation
    
    console.log('[EvmRouteExecution][Demo] Transaction confirmed:', {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status
    });
    
    // Step 9: Build transaction result
    return {
      transaction: {
        hash: receipt.hash,
        chainId: this.config.getChainId(chain),
        from: receipt.from,
        to: receipt.to,
        value: demoAmount,
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: receipt.gasPrice ? ethers.formatUnits(receipt.gasPrice, 'gwei') + ' gwei' : 'N/A',
        nonce: txResponse.nonce,
        blockNumber: receipt.blockNumber,
        network: `${chain.toLowerCase()}-testnet`,
        currency: nativeCurrency,
        memo: routeId,
        // Include route execution details
        routeDetails: {
          base,
          quote,
          amount,
          side,
          executionType: 'demo_self_transfer',
          note: 'Stage 6A demo execution - simple native token self-transfer'
        }
      },
      settlement: {
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        blockNumber: receipt.blockNumber,
        confirmations: 1,
        timestamp: new Date().toISOString()
      }
    };
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
