/**
 * Binance Smart Chain Adapter - Task 3.2 Phase 2
 * 
 * Concrete implementation for Binance Smart Chain with high-throughput optimizations,
 * low-cost transactions, and BNB ecosystem support.
 */

const { BaseEVMAdapter } = require('../BaseEVMAdapter');
const { BlockchainError, ErrorCodes } = require('../enhanced-blockchain-adapter');

/**
 * Binance Smart Chain Adapter
 * Optimized for BSC with high throughput, low fees, and BNB ecosystem support
 */
class BinanceSmartChainAdapter extends BaseEVMAdapter {
  constructor(config) {
    // BSC-specific configuration
    const bscConfig = {
      ...config,
      chainId: '56',
      name: 'Binance Smart Chain',
      type: 'evm',
      nativeCurrency: {
        name: 'BNB',
        symbol: 'BNB',
        decimals: 18
      },
      features: {
        eip1559: false, // BSC doesn't support EIP-1559
        eip2930: false,
        smartContracts: true,
        nfts: true,
        defi: true,
        highThroughput: true,
        lowFees: true,
        binanceEcosystem: true
      },
      rpcUrls: config.rpcUrls || [
        'https://bsc-dataseed1.binance.org',
        'https://bsc-dataseed2.binance.org',
        'https://bsc-dataseed3.binance.org',
        'https://bsc-dataseed4.binance.org',
        'https://bsc-dataseed1.defibit.io'
      ],
      blockExplorerUrls: ['https://bscscan.com'],
      performance: {
        batchSize: 200, // BSC can handle large batches
        cacheTimeout: 6000, // 6 seconds
        maxConcurrentRequests: 40
      },
      connectionSettings: {
        timeout: 10000,
        retryAttempts: 3,
        retryDelay: 600
      }
    };

    super(bscConfig);

    // BSC-specific properties
    this.avgBlockTime = 3; // ~3 seconds
    this.finalityBlocks = 15; // BSC finality
    this.maxTPS = 160; // High throughput
    this.consensusProtocol = 'Proof of Staked Authority (PoSA)';
    this.validators = 21; // Active validators
    
    // Popular BSC tokens and DeFi protocols
    this.popularTokens = new Map([
      ['WBNB', '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'],
      ['BUSD', '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'],
      ['USDT', '0x55d398326f99059fF775485246999027B3197955'],
      ['USDC', '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'],
      ['ETH', '0x2170Ed0880ac9A755fd29B2688956BD959F933F8'],
      ['BTCB', '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c'],
      ['CAKE', '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82'],
      ['XVS', '0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63']
    ]);

    // BSC DeFi protocols
    this.defiProtocols = new Map([
      ['PancakeSwap', '0x10ED43C718714eb63d5aA57B78B54704E256024E'],
      ['Venus', '0xfD36E2c2a6789Db23113685031d7F16329158384'],
      ['Biswap', '0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8'],
      ['ApeSwap', '0xcF0feBd3f17CEf5b47b0cD257aCf6025c5BFf3b7'],
      ['Ellipsis', '0x160CAed03795365F3A589f10C379FfA7d75d4E76']
    ]);

    // BSC network features
    this.networkFeatures = {
      highThroughput: true,
      lowFees: true,
      binanceEcosystem: true,
      proofOfStakedAuthority: true,
      ethereumCompatible: true,
      crossChainBridges: true,
      centralizedExchangeIntegration: true
    };

    // Bridge information
    this.bridgeInfo = {
      binanceBridge: 'https://www.binance.org/bridge',
      supportedChains: ['Ethereum', 'Binance Chain'],
      withdrawalTime: 'Instant to few minutes'
    };
  }

  /**
   * Enhanced fee estimation with BSC optimizations
   */
  async _estimateFees(txParams) {
    try {
      const baseFeeData = await super._estimateFees(txParams);
      
      // Get BSC-specific fee data
      const [gasPrice, latestBlock] = await Promise.all([
        this.provider.getGasPrice(),
        this.provider.getBlock('latest')
      ]);

      // BSC uses legacy gas pricing (no EIP-1559)
      const congestion = await this.assessNetworkCongestion(latestBlock);
      const recommendedGasPrice = this.calculateOptimalGasPrice(gasPrice, congestion);

      return {
        ...baseFeeData,
        // BSC-specific fee data
        network: 'bsc',
        gasPrice: recommendedGasPrice.toString(),
        feeType: 'legacy',
        feeStability: 'High',
        avgTransactionCost: 'Very Low',
        networkCongestion: congestion,
        estimatedConfirmationTime: `${this.avgBlockTime} seconds`,
        finalityTime: `${this.avgBlockTime * this.finalityBlocks} seconds`,
        maxTPS: this.maxTPS,
        gasOptimization: {
          recommended: 'legacy',
          reason: 'BSC uses legacy gas pricing model'
        },
        binanceEcosystem: {
          lowCost: true,
          highThroughput: true,
          ceIntegration: true
        }
      };
    } catch (error) {
      console.warn('Enhanced BSC fee estimation failed, using base implementation:', error.message);
      return await super._estimateFees(txParams);
    }
  }

  /**
   * Assess BSC network congestion
   */
  async assessNetworkCongestion(latestBlock) {
    try {
      const gasUsedRatio = Number(latestBlock.gasUsed) / Number(latestBlock.gasLimit);
      
      // BSC has high throughput, so congestion is less common
      if (gasUsedRatio > 0.9) return 'high';
      if (gasUsedRatio > 0.7) return 'medium';
      return 'low';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Calculate optimal gas price based on network conditions
   */
  calculateOptimalGasPrice(currentGasPrice, congestion) {
    try {
      let multiplier = 1;
      
      switch (congestion) {
        case 'high':
          multiplier = 1.2; // 20% increase
          break;
        case 'medium':
          multiplier = 1.1; // 10% increase
          break;
        case 'low':
        default:
          multiplier = 1; // No increase needed
          break;
      }
      
      return BigInt(Math.floor(Number(currentGasPrice) * multiplier));
    } catch (error) {
      return currentGasPrice;
    }
  }

  /**
   * Enhanced balance query with BSC token support
   */
  async _getBalance(address, tokenAddress = null) {
    try {
      // If token symbol provided instead of address, resolve it
      if (tokenAddress && !tokenAddress.startsWith('0x')) {
        const resolvedAddress = this.getTokenAddress(tokenAddress);
        if (resolvedAddress) {
          tokenAddress = resolvedAddress;
        } else {
          throw new BlockchainError(
            `Unknown token symbol: ${tokenAddress}`,
            ErrorCodes.INVALID_TOKEN,
            this.config.chainId
          );
        }
      }

      const balance = await super._getBalance(address, tokenAddress);
      
      // Add BSC-specific metadata
      balance.network = 'bsc';
      balance.isMainnet = true;
      balance.highThroughput = true;
      balance.lowFeeNetwork = true;
      balance.binanceEcosystem = true;
      
      return balance;
    } catch (error) {
      throw new BlockchainError(
        `Failed to get BSC balance: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Enhanced transaction building with BSC optimizations
   */
  async _buildTransaction(txParams) {
    try {
      const baseTx = await super._buildTransaction(txParams);
      
      // Apply BSC-specific optimizations
      baseTx.bscOptimizations = {
        highThroughput: true,
        lowFees: true,
        fastConfirmation: true,
        binanceEcosystem: true,
        avgBlockTime: this.avgBlockTime,
        finalityBlocks: this.finalityBlocks,
        maxTPS: this.maxTPS,
        consensusProtocol: this.consensusProtocol
      };

      // BSC uses legacy gas pricing
      if (baseTx.gasPrice) {
        const congestion = await this.assessNetworkCongestion(
          await this.provider.getBlock('latest')
        );
        const optimizedGasPrice = this.calculateOptimalGasPrice(
          BigInt(baseTx.gasPrice),
          congestion
        );
        baseTx.gasPrice = optimizedGasPrice.toString();
      }

      return baseTx;
    } catch (error) {
      throw new BlockchainError(
        `Failed to build BSC transaction: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Get popular token address
   */
  getTokenAddress(symbol) {
    return this.popularTokens.get(symbol.toUpperCase());
  }

  /**
   * Get DeFi protocol address
   */
  getProtocolAddress(protocol) {
    return this.defiProtocols.get(protocol);
  }

  /**
   * Enhanced network status with BSC-specific metrics
   */
  async _getNetworkStatus() {
    try {
      const baseStatus = await super._getNetworkStatus();
      
      // Get additional BSC-specific data
      const [latestBlock, gasPrice] = await Promise.all([
        this.provider.getBlock('latest'),
        this.provider.getGasPrice()
      ]);

      const congestion = await this.assessNetworkCongestion(latestBlock);

      return {
        ...baseStatus,
        // BSC-specific status
        network: 'bsc',
        consensus: this.consensusProtocol,
        validators: this.validators,
        avgBlockTime: `${this.avgBlockTime} seconds`,
        finalityBlocks: this.finalityBlocks,
        finalityTime: `${this.avgBlockTime * this.finalityBlocks} seconds`,
        maxTPS: this.maxTPS,
        networkCongestion: congestion,
        eip1559Supported: false,
        legacyGasPricing: true,
        binanceEcosystem: true,
        highThroughput: true,
        lowFeeNetwork: true
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to get BSC network status: ${error.message}`,
        ErrorCodes.NETWORK_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * BSC-specific wallet connection with network validation
   */
  async _connectWallet(options = {}) {
    try {
      const connection = await super._connectWallet(options);
      
      // Validate we're on BSC mainnet
      if (connection.chainId !== 56) {
        throw new BlockchainError(
          `Wrong network: expected Binance Smart Chain (56), got ${connection.chainId}`,
          ErrorCodes.WALLET_NETWORK_MISMATCH,
          this.config.chainId
        );
      }

      return {
        ...connection,
        network: 'bsc',
        isMainnet: true,
        features: ['smartContracts', 'lowFees', 'highThroughput', 'binanceEcosystem']
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to connect BSC wallet: ${error.message}`,
        ErrorCodes.WALLET_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Get bridge information
   */
  getBridgeInfo() {
    return {
      binanceBridge: {
        url: this.bridgeInfo.binanceBridge,
        type: 'Official Binance Bridge',
        supportedChains: this.bridgeInfo.supportedChains,
        depositTime: 'Instant',
        withdrawalTime: this.bridgeInfo.withdrawalTime,
        fees: 'Network fees only'
      },
      thirdPartyBridges: [
        {
          name: 'Multichain',
          url: 'https://multichain.org',
          features: ['Multiple chains', 'Fast transfers'],
          supportedChains: ['Ethereum', 'Polygon', 'Avalanche', 'Fantom']
        },
        {
          name: 'cBridge',
          url: 'https://cbridge.celer.network',
          features: ['Low fees', 'Fast transfers'],
          supportedChains: ['Ethereum', 'Polygon', 'Avalanche', 'Arbitrum']
        }
      ]
    };
  }

  /**
   * Get transaction receipt with BSC-specific data
   */
  async getTransactionReceipt(txHash) {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        return null;
      }

      const currentBlock = await this.provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber;
      const isFinalized = confirmations >= this.finalityBlocks;

      return {
        ...receipt,
        status: receipt.status === 1 ? 'success' : 'failed',
        gasUsed: receipt.gasUsed?.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
        network: 'bsc',
        confirmations,
        finalized: isFinalized,
        finalityBlocks: this.finalityBlocks,
        highThroughput: true,
        lowCost: true,
        binanceEcosystem: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to get BSC transaction receipt: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Health check with BSC-specific validations
   */
  async healthCheck() {
    try {
      const baseHealth = await super.healthCheck();
      
      // Additional BSC-specific health checks
      const [latestBlock, gasPrice] = await Promise.all([
        this.provider.getBlock('latest'),
        this.provider.getGasPrice()
      ]);

      const blockAge = Date.now() / 1000 - latestBlock.timestamp;
      const isBlockRecent = blockAge < 15; // Block should be less than 15 seconds old
      const congestion = await this.assessNetworkCongestion(latestBlock);
      
      return {
        ...baseHealth,
        bsc: {
          latestBlockAge: `${Math.floor(blockAge)} seconds`,
          isBlockRecent,
          gasPrice: gasPrice.toString(),
          networkCongestion: congestion,
          avgBlockTime: `${this.avgBlockTime} seconds`,
          finalityBlocks: this.finalityBlocks,
          maxTPS: this.maxTPS,
          validators: this.validators,
          consensusProtocol: this.consensusProtocol,
          binanceEcosystem: true,
          highThroughput: true
        },
        healthy: baseHealth.healthy && isBlockRecent
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        network: 'bsc',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get DeFi ecosystem information
   */
  async getDeFiEcosystem() {
    try {
      return {
        totalValueLocked: 'Dynamic - check DeFiLlama',
        majorProtocols: [
          {
            name: 'PancakeSwap',
            type: 'DEX',
            address: this.getProtocolAddress('PancakeSwap'),
            features: ['Spot Trading', 'Yield Farming', 'Lottery', 'NFTs']
          },
          {
            name: 'Venus',
            type: 'Lending',
            address: this.getProtocolAddress('Venus'),
            features: ['Lending', 'Borrowing', 'Governance']
          },
          {
            name: 'Biswap',
            type: 'DEX',
            address: this.getProtocolAddress('Biswap'),
            features: ['Spot Trading', 'Yield Farming', 'Launchpad']
          },
          {
            name: 'ApeSwap',
            type: 'DEX',
            address: this.getProtocolAddress('ApeSwap'),
            features: ['Spot Trading', 'Yield Farming', 'Lending']
          },
          {
            name: 'Ellipsis',
            type: 'DEX',
            address: this.getProtocolAddress('Ellipsis'),
            features: ['Stablecoin Trading', 'Low Slippage']
          }
        ],
        nativeTokens: Array.from(this.popularTokens.entries()).map(([symbol, address]) => ({
          symbol,
          address,
          network: 'bsc'
        })),
        benefits: [
          'Very low transaction fees',
          'High throughput (160 TPS)',
          'Fast confirmation times',
          'Binance ecosystem integration',
          'Large DeFi ecosystem'
        ]
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get validator information
   */
  async getValidatorInfo() {
    try {
      return {
        totalValidators: this.validators,
        consensusProtocol: this.consensusProtocol,
        validatorRotation: 'Every 24 hours',
        stakingRequirement: '10,000 BNB minimum',
        slashingConditions: [
          'Double signing',
          'Unavailability',
          'Malicious behavior'
        ],
        rewards: {
          blockReward: 'Dynamic',
          transactionFees: 'Shared among validators',
          stakingAPY: 'Variable'
        }
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get Binance ecosystem integration info
   */
  getBinanceEcosystemInfo() {
    return {
      centralizedExchange: {
        name: 'Binance',
        integration: 'Native support',
        features: [
          'Direct deposits/withdrawals',
          'Lower fees for BNB holders',
          'Cross-platform trading'
        ]
      },
      binanceChain: {
        relationship: 'Parallel blockchain',
        bridging: 'Native bridge available',
        useCase: 'Fast trading and transfers'
      },
      bnbToken: {
        utility: [
          'Transaction fees',
          'Staking rewards',
          'Governance participation',
          'DeFi collateral'
        ],
        burnMechanism: 'Quarterly burns',
        totalSupply: 'Decreasing (deflationary)'
      },
      launchpad: {
        name: 'Binance Launchpad',
        integration: 'BSC project launches',
        benefits: 'Early access to new projects'
      }
    };
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics() {
    try {
      const [latestBlock, gasPrice] = await Promise.all([
        this.provider.getBlock('latest'),
        this.provider.getGasPrice()
      ]);

      const blockAge = Date.now() / 1000 - latestBlock.timestamp;
      const congestion = await this.assessNetworkCongestion(latestBlock);

      return {
        network: 'bsc',
        avgBlockTime: this.avgBlockTime,
        currentBlockTime: blockAge,
        maxTPS: this.maxTPS,
        finalityBlocks: this.finalityBlocks,
        networkCongestion: congestion,
        gasPrice: gasPrice.toString(),
        validators: this.validators,
        consensusProtocol: this.consensusProtocol,
        highThroughput: true,
        lowFees: true,
        binanceEcosystem: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to get performance metrics: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        this.config.chainId,
        error
      );
    }
  }
}

module.exports = {
  BinanceSmartChainAdapter
};

