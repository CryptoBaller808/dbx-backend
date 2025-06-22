const { BlockchainError, ErrorCodes } = require('./blockchain-abstraction-layer');

/**
 * Cross-Chain Transaction Service
 * Handles transactions between different blockchain networks
 */
class CrossChainTransactionService {
  constructor(adapterRegistry, walletService, db = null) {
    this.adapterRegistry = adapterRegistry;
    this.walletService = walletService;
    this.db = db;
    this.bridgeConfigurations = this.initializeBridgeConfigurations();
    this.supportedPairs = this.initializeSupportedPairs();
    this.transactionCache = new Map();
    this.bridgeProviders = this.initializeBridgeProviders();
  }

  /**
   * Initialize bridge configurations for cross-chain transfers
   */
  initializeBridgeConfigurations() {
    return {
      // EVM to EVM bridges
      'AVALANCHE_POLYGON': {
        type: 'evm_bridge',
        provider: 'multichain',
        contractAddress: '0x...',
        fee: '0.1%',
        minAmount: '10',
        maxAmount: '100000',
        estimatedTime: '5-15 minutes'
      },
      'AVALANCHE_BSC': {
        type: 'evm_bridge',
        provider: 'multichain',
        contractAddress: '0x...',
        fee: '0.1%',
        minAmount: '10',
        maxAmount: '100000',
        estimatedTime: '5-15 minutes'
      },
      'POLYGON_BSC': {
        type: 'evm_bridge',
        provider: 'multichain',
        contractAddress: '0x...',
        fee: '0.1%',
        minAmount: '10',
        maxAmount: '100000',
        estimatedTime: '5-15 minutes'
      },
      
      // Native to EVM bridges
      'SOLANA_AVALANCHE': {
        type: 'wormhole_bridge',
        provider: 'wormhole',
        fee: '0.2%',
        minAmount: '1',
        maxAmount: '50000',
        estimatedTime: '10-30 minutes'
      },
      'SOLANA_POLYGON': {
        type: 'wormhole_bridge',
        provider: 'wormhole',
        fee: '0.2%',
        minAmount: '1',
        maxAmount: '50000',
        estimatedTime: '10-30 minutes'
      },
      
      // Specialized bridges
      'XRP_AVALANCHE': {
        type: 'specialized_bridge',
        provider: 'allbridge',
        fee: '0.3%',
        minAmount: '20',
        maxAmount: '25000',
        estimatedTime: '15-45 minutes'
      },
      'STELLAR_POLYGON': {
        type: 'specialized_bridge',
        provider: 'allbridge',
        fee: '0.3%',
        minAmount: '10',
        maxAmount: '25000',
        estimatedTime: '15-45 minutes'
      }
    };
  }

  /**
   * Initialize supported trading pairs for cross-chain swaps
   */
  initializeSupportedPairs() {
    return {
      // Stablecoin pairs
      'USDC_AVALANCHE_USDC_POLYGON': {
        fromChain: 'AVALANCHE',
        toChain: 'POLYGON',
        fromToken: 'USDC',
        toToken: 'USDC',
        type: 'stablecoin_bridge',
        slippage: '0.1%'
      },
      'USDT_BSC_USDT_AVALANCHE': {
        fromChain: 'BSC',
        toChain: 'AVALANCHE',
        fromToken: 'USDT',
        toToken: 'USDT',
        type: 'stablecoin_bridge',
        slippage: '0.1%'
      },
      
      // Native token swaps
      'AVAX_AVALANCHE_MATIC_POLYGON': {
        fromChain: 'AVALANCHE',
        toChain: 'POLYGON',
        fromToken: 'AVAX',
        toToken: 'MATIC',
        type: 'cross_chain_swap',
        slippage: '1-3%'
      },
      'SOL_SOLANA_BNB_BSC': {
        fromChain: 'SOLANA',
        toChain: 'BSC',
        fromToken: 'SOL',
        toToken: 'BNB',
        type: 'cross_chain_swap',
        slippage: '1-3%'
      },
      
      // Wrapped token pairs
      'XRP_XRP_WXRP_AVALANCHE': {
        fromChain: 'XRP',
        toChain: 'AVALANCHE',
        fromToken: 'XRP',
        toToken: 'WXRP',
        type: 'wrap_bridge',
        slippage: '0.5%'
      }
    };
  }

  /**
   * Initialize bridge providers
   */
  initializeBridgeProviders() {
    return {
      multichain: {
        name: 'Multichain',
        supportedChains: ['AVALANCHE', 'POLYGON', 'BSC', 'XDC'],
        apiUrl: 'https://bridgeapi.multichain.org',
        fee: '0.1%'
      },
      wormhole: {
        name: 'Wormhole',
        supportedChains: ['SOLANA', 'AVALANCHE', 'POLYGON', 'BSC'],
        apiUrl: 'https://api.wormhole.com',
        fee: '0.2%'
      },
      allbridge: {
        name: 'Allbridge',
        supportedChains: ['SOLANA', 'AVALANCHE', 'POLYGON', 'BSC', 'XRP', 'STELLAR'],
        apiUrl: 'https://api.allbridge.io',
        fee: '0.3%'
      },
      layerzero: {
        name: 'LayerZero',
        supportedChains: ['AVALANCHE', 'POLYGON', 'BSC'],
        apiUrl: 'https://api.layerzero.network',
        fee: '0.15%'
      }
    };
  }

  /**
   * Get supported cross-chain pairs
   */
  getSupportedCrosschainPairs() {
    const pairs = [];
    
    for (const [pairId, config] of Object.entries(this.supportedPairs)) {
      pairs.push({
        id: pairId,
        fromChain: config.fromChain,
        toChain: config.toChain,
        fromToken: config.fromToken,
        toToken: config.toToken,
        type: config.type,
        estimatedSlippage: config.slippage,
        isActive: true
      });
    }
    
    return pairs;
  }

  /**
   * Get cross-chain quote for a transaction
   */
  async getCrosschainQuote(fromChain, toChain, fromToken, toToken, amount, userAddress) {
    try {
      // Validate chains
      if (!this.adapterRegistry.getAdapter(fromChain) || !this.adapterRegistry.getAdapter(toChain)) {
        throw new BlockchainError(
          'Unsupported blockchain in cross-chain pair',
          ErrorCodes.INVALID_PARAMS,
          fromChain
        );
      }

      // Find supported pair
      const pairKey = `${fromToken}_${fromChain}_${toToken}_${toChain}`;
      const pairConfig = this.supportedPairs[pairKey];
      
      if (!pairConfig) {
        throw new BlockchainError(
          'Cross-chain pair not supported',
          ErrorCodes.NOT_SUPPORTED,
          fromChain
        );
      }

      // Get bridge configuration
      const bridgeKey = `${fromChain}_${toChain}`;
      const bridgeConfig = this.bridgeConfigurations[bridgeKey];
      
      if (!bridgeConfig) {
        throw new BlockchainError(
          'No bridge available for this pair',
          ErrorCodes.NOT_SUPPORTED,
          fromChain
        );
      }

      // Validate amount limits
      const amountNum = parseFloat(amount);
      if (amountNum < parseFloat(bridgeConfig.minAmount)) {
        throw new BlockchainError(
          `Amount below minimum: ${bridgeConfig.minAmount}`,
          ErrorCodes.INVALID_PARAMS,
          fromChain
        );
      }
      
      if (amountNum > parseFloat(bridgeConfig.maxAmount)) {
        throw new BlockchainError(
          `Amount above maximum: ${bridgeConfig.maxAmount}`,
          ErrorCodes.INVALID_PARAMS,
          fromChain
        );
      }

      // Calculate fees and output amount
      const bridgeFeePercent = parseFloat(bridgeConfig.fee.replace('%', '')) / 100;
      const bridgeFee = amountNum * bridgeFeePercent;
      const outputAmount = amountNum - bridgeFee;

      // Get current exchange rates (mock implementation)
      const exchangeRate = await this.getExchangeRate(fromToken, toToken);
      const finalOutputAmount = outputAmount * exchangeRate;

      // Calculate gas fees for both chains
      const fromChainGasFee = await this.estimateGasFee(fromChain, 'bridge_out');
      const toChainGasFee = await this.estimateGasFee(toChain, 'bridge_in');

      const quote = {
        id: this.generateQuoteId(),
        fromChain,
        toChain,
        fromToken,
        toToken,
        inputAmount: amount,
        outputAmount: finalOutputAmount.toString(),
        bridgeFee: bridgeFee.toString(),
        bridgeFeePercent: bridgeConfig.fee,
        fromChainGasFee,
        toChainGasFee,
        totalFees: (bridgeFee + parseFloat(fromChainGasFee) + parseFloat(toChainGasFee)).toString(),
        exchangeRate: exchangeRate.toString(),
        estimatedTime: bridgeConfig.estimatedTime,
        slippage: pairConfig.slippage,
        bridgeProvider: bridgeConfig.provider,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
        userAddress,
        timestamp: new Date().toISOString()
      };

      // Cache the quote
      this.transactionCache.set(quote.id, quote);

      return quote;
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to get cross-chain quote: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        fromChain,
        error
      );
    }
  }

  /**
   * Execute cross-chain transaction
   */
  async executeCrosschainTransaction(userId, quoteId, options = {}) {
    try {
      // Get cached quote
      const quote = this.transactionCache.get(quoteId);
      if (!quote) {
        throw new BlockchainError(
          'Quote not found or expired',
          ErrorCodes.INVALID_PARAMS,
          'SYSTEM'
        );
      }

      // Check if quote is still valid
      if (new Date() > new Date(quote.expiresAt)) {
        throw new BlockchainError(
          'Quote has expired',
          ErrorCodes.INVALID_PARAMS,
          'SYSTEM'
        );
      }

      // Verify user has connected wallets for both chains
      const fromWallet = this.walletService.getUserWalletConnection(userId, quote.fromChain);
      const toWallet = this.walletService.getUserWalletConnection(userId, quote.toChain);
      
      if (!fromWallet) {
        throw new BlockchainError(
          `No wallet connected for source chain: ${quote.fromChain}`,
          ErrorCodes.WALLET_ERROR,
          quote.fromChain
        );
      }
      
      if (!toWallet) {
        throw new BlockchainError(
          `No wallet connected for destination chain: ${quote.toChain}`,
          ErrorCodes.WALLET_ERROR,
          quote.toChain
        );
      }

      // Create cross-chain transaction record
      const crossChainTx = {
        id: this.generateTransactionId(),
        userId,
        quoteId,
        status: 'initiated',
        fromChain: quote.fromChain,
        toChain: quote.toChain,
        fromToken: quote.fromToken,
        toToken: quote.toToken,
        inputAmount: quote.inputAmount,
        outputAmount: quote.outputAmount,
        fromAddress: fromWallet.publicKey || fromWallet.accounts?.[0],
        toAddress: toWallet.publicKey || toWallet.accounts?.[0],
        bridgeProvider: quote.bridgeProvider,
        steps: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Execute based on bridge type
      let result;
      
      if (quote.bridgeProvider === 'multichain') {
        result = await this.executeMultichainBridge(crossChainTx, options);
      } else if (quote.bridgeProvider === 'wormhole') {
        result = await this.executeWormholeBridge(crossChainTx, options);
      } else if (quote.bridgeProvider === 'allbridge') {
        result = await this.executeAllbridge(crossChainTx, options);
      } else {
        throw new BlockchainError(
          `Unsupported bridge provider: ${quote.bridgeProvider}`,
          ErrorCodes.NOT_SUPPORTED,
          quote.fromChain
        );
      }

      // Update transaction record
      crossChainTx.status = 'in_progress';
      crossChainTx.steps = result.steps;
      crossChainTx.updatedAt = new Date().toISOString();

      // Save to database if available
      if (this.db) {
        await this.saveCrosschainTransaction(crossChainTx);
      }

      // Remove quote from cache
      this.transactionCache.delete(quoteId);

      return {
        success: true,
        transactionId: crossChainTx.id,
        status: crossChainTx.status,
        steps: crossChainTx.steps,
        estimatedTime: quote.estimatedTime
      };
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to execute cross-chain transaction: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        'SYSTEM',
        error
      );
    }
  }

  /**
   * Execute Multichain bridge transaction
   */
  async executeMultichainBridge(crossChainTx, options) {
    const steps = [];
    
    try {
      // Step 1: Approve token spending (if needed)
      const fromAdapter = this.adapterRegistry.getAdapter(crossChainTx.fromChain);
      
      if (crossChainTx.fromToken !== 'native') {
        const approvalTx = await this.buildApprovalTransaction(
          crossChainTx.fromChain,
          crossChainTx.fromToken,
          crossChainTx.inputAmount,
          crossChainTx.fromAddress
        );
        
        steps.push({
          step: 1,
          type: 'approval',
          chain: crossChainTx.fromChain,
          transaction: approvalTx,
          status: 'pending',
          description: 'Approve token spending'
        });
      }

      // Step 2: Bridge transaction
      const bridgeTx = await this.buildBridgeTransaction(
        crossChainTx.fromChain,
        crossChainTx.toChain,
        crossChainTx.fromToken,
        crossChainTx.inputAmount,
        crossChainTx.fromAddress,
        crossChainTx.toAddress
      );
      
      steps.push({
        step: steps.length + 1,
        type: 'bridge',
        chain: crossChainTx.fromChain,
        transaction: bridgeTx,
        status: 'pending',
        description: 'Bridge tokens to destination chain'
      });

      return { steps };
    } catch (error) {
      throw new BlockchainError(
        `Multichain bridge execution failed: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        crossChainTx.fromChain,
        error
      );
    }
  }

  /**
   * Execute Wormhole bridge transaction
   */
  async executeWormholeBridge(crossChainTx, options) {
    const steps = [];
    
    try {
      // Wormhole-specific implementation
      // This would integrate with Wormhole SDK
      
      steps.push({
        step: 1,
        type: 'wormhole_lock',
        chain: crossChainTx.fromChain,
        status: 'pending',
        description: 'Lock tokens in Wormhole contract'
      });
      
      steps.push({
        step: 2,
        type: 'wormhole_attest',
        chain: 'wormhole',
        status: 'pending',
        description: 'Attest transaction on Wormhole network'
      });
      
      steps.push({
        step: 3,
        type: 'wormhole_redeem',
        chain: crossChainTx.toChain,
        status: 'pending',
        description: 'Redeem tokens on destination chain'
      });

      return { steps };
    } catch (error) {
      throw new BlockchainError(
        `Wormhole bridge execution failed: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        crossChainTx.fromChain,
        error
      );
    }
  }

  /**
   * Execute Allbridge transaction
   */
  async executeAllbridge(crossChainTx, options) {
    const steps = [];
    
    try {
      // Allbridge-specific implementation
      
      steps.push({
        step: 1,
        type: 'allbridge_deposit',
        chain: crossChainTx.fromChain,
        status: 'pending',
        description: 'Deposit tokens to Allbridge'
      });
      
      steps.push({
        step: 2,
        type: 'allbridge_transfer',
        chain: 'allbridge',
        status: 'pending',
        description: 'Process cross-chain transfer'
      });
      
      steps.push({
        step: 3,
        type: 'allbridge_withdraw',
        chain: crossChainTx.toChain,
        status: 'pending',
        description: 'Withdraw tokens on destination chain'
      });

      return { steps };
    } catch (error) {
      throw new BlockchainError(
        `Allbridge execution failed: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        crossChainTx.fromChain,
        error
      );
    }
  }

  /**
   * Get cross-chain transaction status
   */
  async getCrosschainTransactionStatus(transactionId) {
    try {
      // This would query the database and bridge providers for status
      // Mock implementation for now
      
      return {
        id: transactionId,
        status: 'in_progress',
        currentStep: 2,
        totalSteps: 3,
        estimatedTimeRemaining: '10-15 minutes',
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to get transaction status: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        'SYSTEM',
        error
      );
    }
  }

  /**
   * Helper methods
   */
  async getExchangeRate(fromToken, toToken) {
    // Mock implementation - would integrate with price feeds
    if (fromToken === toToken) return 1;
    
    // Mock rates
    const rates = {
      'AVAX_MATIC': 2.5,
      'SOL_BNB': 0.3,
      'XRP_WXRP': 1.0,
      'USDC_USDT': 1.0
    };
    
    return rates[`${fromToken}_${toToken}`] || 1;
  }

  async estimateGasFee(chainId, operationType) {
    // Mock implementation - would query actual gas prices
    const gasFees = {
      'AVALANCHE': '0.01',
      'POLYGON': '0.001',
      'BSC': '0.005',
      'SOLANA': '0.0001',
      'XRP': '0.00001',
      'STELLAR': '0.00001',
      'XDC': '0.001'
    };
    
    return gasFees[chainId] || '0.01';
  }

  async buildApprovalTransaction(chainId, tokenAddress, amount, userAddress) {
    // Mock implementation - would build actual approval transaction
    return {
      type: 'approval',
      to: tokenAddress,
      data: '0x...',
      value: '0',
      gasLimit: '50000'
    };
  }

  async buildBridgeTransaction(fromChain, toChain, token, amount, fromAddress, toAddress) {
    // Mock implementation - would build actual bridge transaction
    return {
      type: 'bridge',
      to: '0x...', // Bridge contract address
      data: '0x...',
      value: token === 'native' ? amount : '0',
      gasLimit: '200000'
    };
  }

  generateQuoteId() {
    return `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateTransactionId() {
    return `crosschain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async saveCrosschainTransaction(transaction) {
    // Database implementation would go here
    console.log('[Cross-Chain Service] Saving transaction:', transaction.id);
  }
}

module.exports = CrossChainTransactionService;

