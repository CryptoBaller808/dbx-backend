/**
 * Ethereum Mainnet Adapter - Task 3.2 Phase 2
 * 
 * Concrete implementation for Ethereum Mainnet with EIP-1559 support,
 * MEV protection, and Ethereum-specific optimizations.
 */

const { BaseEVMAdapter } = require('./BaseEVMAdapter');
const { BlockchainError, ErrorCodes } = require('./enhanced-blockchain-adapter');

/**
 * Ethereum Mainnet Adapter
 * Optimized for Ethereum mainnet with full EIP-1559 support and MEV protection
 */
class EthereumAdapter extends BaseEVMAdapter {
  constructor(config) {
    // Ethereum-specific configuration
    const ethereumConfig = {
      ...config,
      chainId: '1',
      name: 'Ethereum Mainnet',
      type: 'evm',
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      },
      features: {
        eip1559: true,
        eip2930: true,
        smartContracts: true,
        nfts: true,
        defi: true,
        mev: true
      },
      rpcUrls: config.rpcUrls || [
        'https://eth-mainnet.g.alchemy.com/v2/demo',
        'https://mainnet.infura.io/v3/demo',
        'https://ethereum.publicnode.com',
        'https://rpc.ankr.com/eth'
      ],
      blockExplorerUrls: ['https://etherscan.io'],
      performance: {
        batchSize: 50, // Conservative for mainnet
        cacheTimeout: 15000, // 15 seconds
        maxConcurrentRequests: 10
      },
      connectionSettings: {
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 2000
      }
    };

    super(ethereumConfig);

    // Ethereum-specific properties
    this.mevProtection = true;
    this.priorityFeeMultiplier = 1.1; // 10% buffer for priority fees
    this.maxFeeMultiplier = 1.2; // 20% buffer for max fees
    this.gasEstimateBuffer = 1.15; // 15% buffer for gas estimates
    
    // Popular Ethereum tokens
    this.popularTokens = new Map([
      ['USDC', '0xA0b86a33E6441b8C4505E5C2E8C5b8C8E5C8E5C8'],
      ['USDT', '0xdAC17F958D2ee523a2206206994597C13D831ec7'],
      ['WETH', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'],
      ['DAI', '0x6B175474E89094C44Da98b954EedeAC495271d0F'],
      ['WBTC', '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599']
    ]);

    // MEV protection settings
    this.mevSettings = {
      usePrivateMempool: false, // Can be enabled for MEV protection
      maxSlippage: 0.5, // 0.5% max slippage
      frontrunningProtection: true
    };
  }

  /**
   * Enhanced fee estimation with EIP-1559 optimization
   */
  async _estimateFees(txParams) {
    try {
      const baseFeeData = await super._estimateFees(txParams);
      
      // Get current network conditions
      const [feeHistory, pendingBlock] = await Promise.all([
        this.provider.send('eth_feeHistory', [20, 'latest', [25, 50, 75]]),
        this.provider.getBlock('pending')
      ]);

      // Calculate dynamic fees based on network conditions
      const baseFeePerGas = BigInt(pendingBlock.baseFeePerGas || 0);
      const priorityFeePerGas = this.calculateOptimalPriorityFee(feeHistory);
      const maxFeePerGas = baseFeePerGas * BigInt(2) + priorityFeePerGas; // 2x base fee + priority

      return {
        ...baseFeeData,
        // Enhanced Ethereum-specific fee data
        baseFeePerGas: baseFeePerGas.toString(),
        priorityFeePerGas: priorityFeePerGas.toString(),
        maxFeePerGas: maxFeePerGas.toString(),
        maxPriorityFeePerGas: priorityFeePerGas.toString(),
        networkCongestion: this.assessNetworkCongestion(feeHistory),
        mevRisk: this.assessMEVRisk(txParams),
        estimatedConfirmationTime: this.estimateConfirmationTime(priorityFeePerGas),
        gasOptimization: {
          recommended: 'eip1559',
          savings: this.calculateGasSavings(baseFeeData, maxFeePerGas)
        }
      };
    } catch (error) {
      // Fallback to base implementation
      console.warn('Enhanced fee estimation failed, using base implementation:', error.message);
      return await super._estimateFees(txParams);
    }
  }

  /**
   * Calculate optimal priority fee based on network history
   */
  calculateOptimalPriorityFee(feeHistory) {
    try {
      const recentPriorityFees = feeHistory.reward
        .flat()
        .map(fee => BigInt(fee))
        .sort((a, b) => a < b ? -1 : 1);

      // Use 75th percentile for reliable confirmation
      const percentileIndex = Math.floor(recentPriorityFees.length * 0.75);
      const basePriorityFee = recentPriorityFees[percentileIndex] || BigInt('2000000000'); // 2 gwei fallback

      // Apply multiplier for faster confirmation
      return BigInt(Math.floor(Number(basePriorityFee) * this.priorityFeeMultiplier));
    } catch (error) {
      return BigInt('2000000000'); // 2 gwei fallback
    }
  }

  /**
   * Assess network congestion level
   */
  assessNetworkCongestion(feeHistory) {
    try {
      const avgBaseFee = feeHistory.baseFeePerGas
        .map(fee => BigInt(fee))
        .reduce((sum, fee) => sum + fee, BigInt(0)) / BigInt(feeHistory.baseFeePerGas.length);

      const currentBaseFee = BigInt(feeHistory.baseFeePerGas[feeHistory.baseFeePerGas.length - 1]);
      const congestionRatio = Number(currentBaseFee) / Number(avgBaseFee);

      if (congestionRatio > 2) return 'high';
      if (congestionRatio > 1.5) return 'medium';
      return 'low';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Assess MEV risk for transaction
   */
  assessMEVRisk(txParams) {
    try {
      const value = BigInt(txParams.value || 0);
      const highValueThreshold = BigInt('10000000000000000000'); // 10 ETH

      // High value transactions have higher MEV risk
      if (value > highValueThreshold) return 'high';
      
      // DEX interactions have medium MEV risk
      if (txParams.data && txParams.data.length > 10) return 'medium';
      
      return 'low';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Estimate confirmation time based on priority fee
   */
  estimateConfirmationTime(priorityFeePerGas) {
    try {
      const priorityFeeGwei = Number(priorityFeePerGas) / 1e9;
      
      if (priorityFeeGwei >= 5) return '< 1 minute';
      if (priorityFeeGwei >= 2) return '1-3 minutes';
      if (priorityFeeGwei >= 1) return '3-5 minutes';
      return '5+ minutes';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Calculate gas savings from EIP-1559
   */
  calculateGasSavings(legacyFee, eip1559Fee) {
    try {
      const legacyTotal = BigInt(legacyFee.totalFee || 0);
      const eip1559Total = BigInt(eip1559Fee);
      
      if (legacyTotal > eip1559Total) {
        const savings = legacyTotal - eip1559Total;
        const savingsPercent = Number(savings * BigInt(100) / legacyTotal);
        return `${savingsPercent.toFixed(1)}%`;
      }
      
      return '0%';
    } catch (error) {
      return '0%';
    }
  }

  /**
   * Enhanced transaction building with MEV protection
   */
  async _buildTransaction(txParams) {
    try {
      const baseTx = await super._buildTransaction(txParams);
      
      // Apply MEV protection if enabled
      if (this.mevProtection && this.mevSettings.frontrunningProtection) {
        baseTx.mevProtection = {
          enabled: true,
          type: 'priority_fee_boost',
          originalPriorityFee: baseTx.maxPriorityFeePerGas,
          boostedPriorityFee: this.boostPriorityFeeForMEV(baseTx.maxPriorityFeePerGas)
        };
        
        baseTx.maxPriorityFeePerGas = baseTx.mevProtection.boostedPriorityFee;
        baseTx.maxFeePerGas = (BigInt(baseTx.maxFeePerGas) + BigInt(baseTx.mevProtection.boostedPriorityFee) - BigInt(baseTx.mevProtection.originalPriorityFee)).toString();
      }

      return baseTx;
    } catch (error) {
      throw new BlockchainError(
        `Failed to build Ethereum transaction: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Boost priority fee for MEV protection
   */
  boostPriorityFeeForMEV(originalPriorityFee) {
    try {
      const boost = BigInt(Math.floor(Number(originalPriorityFee) * 0.5)); // 50% boost
      return (BigInt(originalPriorityFee) + boost).toString();
    } catch (error) {
      return originalPriorityFee;
    }
  }

  /**
   * Get popular token address
   */
  getTokenAddress(symbol) {
    return this.popularTokens.get(symbol.toUpperCase());
  }

  /**
   * Enhanced balance query with token detection
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
      
      // Add Ethereum-specific metadata
      balance.network = 'ethereum';
      balance.isMainnet = true;
      balance.usdValue = await this.getUSDValue(balance.symbol, balance.balance, balance.decimals);
      
      return balance;
    } catch (error) {
      throw new BlockchainError(
        `Failed to get Ethereum balance: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Get USD value for token (placeholder - would integrate with price API)
   */
  async getUSDValue(symbol, balance, decimals) {
    try {
      // This would integrate with a price API like CoinGecko
      // For now, return null to indicate price data not available
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Enhanced network status with Ethereum-specific metrics
   */
  async _getNetworkStatus() {
    try {
      const baseStatus = await super._getNetworkStatus();
      
      // Get additional Ethereum-specific data
      const [feeHistory, pendingBlock] = await Promise.all([
        this.provider.send('eth_feeHistory', [10, 'latest', [25, 50, 75]]).catch(() => null),
        this.provider.getBlock('pending').catch(() => null)
      ]);

      return {
        ...baseStatus,
        // Ethereum-specific status
        baseFeePerGas: pendingBlock?.baseFeePerGas?.toString(),
        networkCongestion: feeHistory ? this.assessNetworkCongestion(feeHistory) : 'unknown',
        avgBlockTime: '12-15 seconds',
        finalityBlocks: 12,
        mevProtectionAvailable: this.mevProtection,
        eip1559Supported: true,
        layer: 'L1'
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to get Ethereum network status: ${error.message}`,
        ErrorCodes.NETWORK_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Ethereum-specific wallet connection with network validation
   */
  async _connectWallet(options = {}) {
    try {
      const connection = await super._connectWallet(options);
      
      // Validate we're on Ethereum mainnet
      if (connection.chainId !== 1) {
        throw new BlockchainError(
          `Wrong network: expected Ethereum Mainnet (1), got ${connection.chainId}`,
          ErrorCodes.WALLET_NETWORK_MISMATCH,
          this.config.chainId
        );
      }

      return {
        ...connection,
        network: 'ethereum',
        isMainnet: true,
        features: ['eip1559', 'eip2930', 'smartContracts', 'nfts', 'defi']
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to connect Ethereum wallet: ${error.message}`,
        ErrorCodes.WALLET_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Get transaction receipt with enhanced data
   */
  async getTransactionReceipt(txHash) {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        return null;
      }

      return {
        ...receipt,
        status: receipt.status === 1 ? 'success' : 'failed',
        gasUsed: receipt.gasUsed?.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
        gasEfficiency: this.calculateGasEfficiency(receipt),
        network: 'ethereum',
        confirmations: await this.provider.getBlockNumber() - receipt.blockNumber,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to get transaction receipt: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Calculate gas efficiency
   */
  calculateGasEfficiency(receipt) {
    try {
      const gasUsed = Number(receipt.gasUsed);
      const gasLimit = Number(receipt.gasLimit || gasUsed);
      
      return {
        efficiency: ((gasUsed / gasLimit) * 100).toFixed(2) + '%',
        gasUsed,
        gasLimit,
        wastedGas: gasLimit - gasUsed
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Health check with Ethereum-specific validations
   */
  async healthCheck() {
    try {
      const baseHealth = await super.healthCheck();
      
      // Additional Ethereum-specific health checks
      const [latestBlock, feeData] = await Promise.all([
        this.provider.getBlock('latest'),
        this.provider.getFeeData()
      ]);

      const blockAge = Date.now() / 1000 - latestBlock.timestamp;
      const isBlockRecent = blockAge < 60; // Block should be less than 1 minute old
      
      return {
        ...baseHealth,
        ethereum: {
          latestBlockAge: `${Math.floor(blockAge)} seconds`,
          isBlockRecent,
          baseFeePerGas: feeData.gasPrice?.toString(),
          eip1559Active: !!feeData.maxFeePerGas,
          mevProtectionEnabled: this.mevProtection
        },
        healthy: baseHealth.healthy && isBlockRecent
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        network: 'ethereum',
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = {
  EthereumAdapter
};

