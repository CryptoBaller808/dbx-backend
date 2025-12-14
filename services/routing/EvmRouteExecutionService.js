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
const executionConfig = require('../../config/executionConfig');

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
      // Step 1: Validate execution mode (Stage 7.1: Use unified execution config)
      // Note: Execution mode validation already done in RouteExecutionService
      // This is a secondary check for safety
      const validation = executionConfig.validateExecution(chain, executionMode);
      if (!validation.allowed) {
        console.log('[EvmRouteExecution] Execution rejected:', validation);
        return this._errorResponse(validation.code, validation.reason);
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
      const modeValidation = executionConfig.validateExecution(chain, executionMode);
      if (!modeValidation.allowed) {
        return this._errorResponse(
          modeValidation.code || 'EXECUTION_NOT_ALLOWED',
          modeValidation.reason,
          { chain, executionMode }
        );
      }
      
      // Step 4b: Route to appropriate execution path
      if (executionMode === 'live') {
        // Live execution path (Stage 7.0)
        console.log('[EvmRouteExecution] Routing to LIVE execution...');
        return await this._executeLiveTransaction(chain, route, params);
      } else if (executionMode === 'demo') {
        // Demo execution path (Stage 6D - unchanged)
        console.log('[EvmRouteExecution] Routing to DEMO execution...');
        // Continue to demo execution below
      } else {
        return this._errorResponse('INVALID_EXECUTION_MODE', `Invalid execution mode: ${executionMode}`, {
          executionMode,
          supportedModes: ['demo', 'live']
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
   * Execute LIVE transaction on EVM chain
   * Stage 7.0: Real wallet-connected execution
   * @private
   */
  async _executeLiveTransaction(chain, route, params) {
    const { base, quote, amount, side, walletAddress, routeId } = params;
    
    // Debug logging for wallet validation (Stage 7.1)
    const walletPrefix = walletAddress ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}` : 'none';
    const isValidAddress = walletAddress ? ethers.isAddress(walletAddress) : false;
    
    console.log('[LiveExecute] Validation:', {
      chain,
      executionMode: 'live',
      walletProvided: !!walletAddress,
      wallet: walletPrefix,
      isAddress: isValidAddress,
      amount,
      base,
      quote
    });
    
    try {
      // Step 1: Validate wallet address
      if (!walletAddress) {
        console.log('[LiveExecute] Rejected: No wallet address provided');
        throw {
          code: 'WALLET_NOT_CONNECTED',
          message: 'Wallet address is required for live execution'
        };
      }
      
      if (!ethers.isAddress(walletAddress)) {
        console.log('[LiveExecute] Rejected: Invalid wallet address format');
        throw {
          code: 'WALLET_NOT_CONNECTED',
          message: 'Invalid wallet address format'
        };
      }
      
      // Normalize wallet address
      const normalizedWallet = ethers.getAddress(walletAddress);
      console.log('[LiveExecute] Wallet validated:', normalizedWallet);
      
      // Step 2: Validate chain is ETH (Stage 7.0 only supports ETH)
      if (chain !== 'ETH') {
        throw {
          code: 'UNSUPPORTED_CHAIN',
          message: `Live execution is only supported for ETH in Stage 7.0. Requested chain: ${chain}`
        };
      }
      
      // Step 3: Get RPC provider for chain
      const rpcUrl = this.config.getRpcUrl(chain);
      if (!rpcUrl) {
        throw {
          code: 'RPC_NOT_CONFIGURED',
          message: `RPC URL not configured for chain: ${chain}`
        };
      }
      
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // Step 4: Fetch on-chain balance
      console.log('[EvmRouteExecution][Live] Fetching on-chain balance...');
      const balance = await provider.getBalance(normalizedWallet);
      const balanceEth = ethers.formatEther(balance);
      
      console.log('[EvmRouteExecution][Live] Wallet balance:', balanceEth, 'ETH');
      
      // Step 5: Validate sufficient balance
      const requiredAmount = ethers.parseEther(amount.toString());
      if (balance < requiredAmount) {
        throw {
          code: 'INSUFFICIENT_FUNDS',
          message: `Insufficient balance. Required: ${amount} ETH, Available: ${balanceEth} ETH`
        };
      }
      
      // Step 6: Estimate gas
      console.log('[EvmRouteExecution][Live] Estimating gas...');
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice;
      const gasLimit = 21000n; // Standard ETH transfer
      const gasCost = gasPrice * gasLimit;
      const gasCostEth = ethers.formatEther(gasCost);
      
      console.log('[EvmRouteExecution][Live] Gas estimate:', {
        gasPrice: ethers.formatUnits(gasPrice, 'gwei') + ' gwei',
        gasLimit: gasLimit.toString(),
        gasCost: gasCostEth + ' ETH'
      });
      
      // Step 7: Validate balance covers amount + gas
      const totalRequired = requiredAmount + gasCost;
      if (balance < totalRequired) {
        throw {
          code: 'INSUFFICIENT_FUNDS',
          message: `Insufficient balance for amount + gas. Required: ${ethers.formatEther(totalRequired)} ETH, Available: ${balanceEth} ETH`
        };
      }
      
      // Step 8: Build unsigned transaction
      const nonce = await provider.getTransactionCount(normalizedWallet);
      const chainId = await provider.getNetwork().then(n => n.chainId);
      
      // For Stage 7.0, we're doing a simple ETH transfer
      // In future stages, this would be a DEX swap transaction
      const unsignedTx = {
        from: normalizedWallet,
        to: normalizedWallet, // For demo, send to self (in production, this would be DEX contract)
        value: requiredAmount.toString(),
        gasLimit: gasLimit.toString(),
        gasPrice: gasPrice.toString(),
        nonce,
        chainId: Number(chainId),
        data: '0x' // No data for simple transfer
      };
      
      console.log('[EvmRouteExecution][Live] Unsigned transaction prepared:', {
        from: unsignedTx.from,
        to: unsignedTx.to,
        value: ethers.formatEther(unsignedTx.value) + ' ETH',
        gasLimit: unsignedTx.gasLimit,
        gasPrice: ethers.formatUnits(unsignedTx.gasPrice, 'gwei') + ' gwei',
        nonce: unsignedTx.nonce,
        chainId: unsignedTx.chainId
      });
      
      // Step 9: Return unsigned transaction for MetaMask signing
      return {
        success: true,
        requiresSignature: true,
        unsignedTransaction: unsignedTx,
        metadata: {
          chain,
          base,
          quote,
          amount,
          side,
          walletAddress: normalizedWallet,
          balance: balanceEth,
          gasEstimate: {
            gasPrice: ethers.formatUnits(gasPrice, 'gwei') + ' gwei',
            gasLimit: gasLimit.toString(),
            gasCost: gasCostEth + ' ETH'
          },
          routeId
        },
        message: 'Transaction prepared. Please sign with MetaMask.'
      };
      
    } catch (error) {
      console.error('[EvmRouteExecution][Live] Error:', error);
      
      // Map error codes
      const errorCode = error.code || 'EXECUTION_FAILED';
      const errorMessage = error.message || 'Live execution failed';
      
      return this._errorResponse(errorCode, errorMessage, {
        chain,
        error: error.message || error.toString()
      });
    }
  }
  
  /**
   * Broadcast signed transaction and wait for confirmation
   * Stage 7.0: Accept signed tx from MetaMask and broadcast
   * @param {string} chain - Chain identifier
   * @param {string} signedTx - Signed transaction hex
   * @param {Object} metadata - Transaction metadata
   * @returns {Promise<Object>} Execution result
   */
  async broadcastSignedTransaction(chain, signedTx, metadata) {
    console.log('[EvmRouteExecution][Live] Broadcasting signed transaction...');
    
    try {
      // Get RPC provider
      const rpcUrl = this.config.getRpcUrl(chain);
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // Broadcast transaction
      const txResponse = await provider.broadcastTransaction(signedTx);
      console.log('[EvmRouteExecution][Live] Transaction broadcasted:', txResponse.hash);
      
      // Wait for confirmation (1 block)
      console.log('[EvmRouteExecution][Live] Waiting for confirmation...');
      const receipt = await txResponse.wait(1);
      
      console.log('[EvmRouteExecution][Live] Transaction confirmed:', {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status === 1 ? 'success' : 'failed'
      });
      
      // Build success response
      return {
        success: true,
        chain,
        executionMode: 'live',
        transaction: {
          hash: receipt.hash,
          chainId: this.config.getChainId(chain),
          from: receipt.from,
          to: receipt.to,
          value: ethers.formatEther(metadata.amount || '0'),
          gasUsed: receipt.gasUsed.toString(),
          gasPrice: ethers.formatUnits(receipt.gasPrice || 0n, 'gwei') + ' gwei',
          blockNumber: receipt.blockNumber,
          network: this._getNetworkLabel(chain),
          status: receipt.status === 1 ? 'confirmed' : 'failed'
        },
        settlement: {
          status: receipt.status === 1 ? 'confirmed' : 'failed',
          blockNumber: receipt.blockNumber,
          confirmations: 1,
          timestamp: new Date().toISOString()
        },
        metadata,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('[EvmRouteExecution][Live] Broadcast failed:', error);
      
      return this._errorResponse('BROADCAST_FAILED', error.message, {
        chain,
        error: error.toString()
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
