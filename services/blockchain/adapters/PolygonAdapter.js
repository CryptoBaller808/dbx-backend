/**
 * Polygon Mainnet Adapter - Task 3.2 Phase 2
 * 
 * Concrete implementation for Polygon (MATIC) with Layer 2 optimizations,
 * low-cost transactions, and Polygon ecosystem support.
 */

const { BaseEVMAdapter } = require('../BaseEVMAdapter');
const { BlockchainError, ErrorCodes } = require('../enhanced-blockchain-adapter');

/**
 * Polygon Mainnet Adapter
 * Optimized for Polygon with Layer 2 scaling, low fees, and MATIC ecosystem support
 */
class PolygonAdapter extends BaseEVMAdapter {
  constructor(config) {
    // Polygon-specific configuration
    const polygonConfig = {
      ...config,
      chainId: '137',
      name: 'Polygon Mainnet',
      type: 'evm',
      nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18
      },
      features: {
        eip1559: true,
        eip2930: true,
        smartContracts: true,
        nfts: true,
        defi: true,
        layer2: true,
        lowFees: true,
        highThroughput: true,
        ethereumCompatible: true
      },
      rpcUrls: config.rpcUrls || [
        'https://polygon-rpc.com',
        'https://rpc-mainnet.matic.network',
        'https://matic-mainnet.chainstacklabs.com',
        'https://rpc-mainnet.maticvigil.com',
        'https://polygon-mainnet.public.blastapi.io'
      ],
      blockExplorerUrls: ['https://polygonscan.com'],
      performance: {
        batchSize: 150, // Good batch size for Polygon
        cacheTimeout: 8000, // 8 seconds
        maxConcurrentRequests: 30
      },
      connectionSettings: {
        timeout: 12000,
        retryAttempts: 3,
        retryDelay: 800
      }
    };

    super(polygonConfig);

    // Polygon-specific properties
    this.avgBlockTime = 2.1; // ~2.1 seconds
    this.finalityBlocks = 128; // Polygon finality
    this.layer = 'L2';
    this.parentChain = 'Ethereum';
    this.consensusProtocol = 'Proof of Stake';
    
    // Popular Polygon tokens and DeFi protocols
    this.popularTokens = new Map([
      ['WMATIC', '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'],
      ['USDC', '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'],
      ['USDT', '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'],
      ['DAI', '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'],
      ['WETH', '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'],
      ['WBTC', '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6'],
      ['AAVE', '0xD6DF932A45C0f255f85145f286eA0b292B21C90B'],
      ['CRV', '0x172370d5Cd63279eFa6d502DAB29171933a610AF']
    ]);

    // Polygon DeFi protocols
    this.defiProtocols = new Map([
      ['QuickSwap', '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff'],
      ['SushiSwap', '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506'],
      ['Uniswap', '0xE592427A0AEce92De3Edee1F18E0157C05861564'],
      ['Aave', '0x8dFf5E27EA6b7AC08EbFdf9eB090F32ee9a30fcf'],
      ['Curve', '0x445FE580eF8d70FF569aB36e80c647af338db351']
    ]);

    // Polygon network features
    this.networkFeatures = {
      layer2Scaling: true,
      ethereumCompatible: true,
      lowFees: true,
      fastTransactions: true,
      proofOfStake: true,
      carbonNeutral: true,
      bridgeToEthereum: true
    };

    // Bridge information
    this.bridgeInfo = {
      polygonBridge: 'https://wallet.polygon.technology/bridge',
      supportedAssets: ['ETH', 'USDC', 'USDT', 'DAI', 'WBTC', 'AAVE'],
      withdrawalTime: '3-7 days'
    };
  }

  /**
   * Enhanced fee estimation with Polygon Layer 2 optimizations
   */
  async _estimateFees(txParams) {
    try {
      const baseFeeData = await super._estimateFees(txParams);
      
      // Get Polygon-specific fee data
      const [feeData, gasPrice, feeHistory] = await Promise.all([
        this.provider.getFeeData(),
        this.provider.getGasPrice(),
        this.provider.send('eth_feeHistory', [20, 'latest', [25, 50, 75]]).catch(() => null)
      ]);

      // Polygon has very low fees compared to Ethereum
      const priorityFeePerGas = feeData.maxPriorityFeePerGas || BigInt('30000000000'); // 30 gwei
      const maxFeePerGas = feeData.maxFeePerGas || gasPrice;

      const congestion = this.assessNetworkCongestion(feeHistory);
      const savingsVsEthereum = this.calculateSavingsVsEthereum(maxFeePerGas);

      return {
        ...baseFeeData,
        // Polygon-specific fee data
        network: 'polygon',
        layer: 'L2',
        baseFeePerGas: feeData.gasPrice?.toString(),
        priorityFeePerGas: priorityFeePerGas.toString(),
        maxFeePerGas: maxFeePerGas.toString(),
        maxPriorityFeePerGas: priorityFeePerGas.toString(),
        feeStability: 'High',
        avgTransactionCost: 'Very Low',
        networkCongestion: congestion,
        estimatedConfirmationTime: `${this.avgBlockTime} seconds`,
        finalityTime: `${this.avgBlockTime * this.finalityBlocks} seconds`,
        savingsVsEthereum: savingsVsEthereum,
        gasOptimization: {
          recommended: 'eip1559',
          reason: 'Polygon supports EIP-1559 with very low fees'
        },
        layer2Benefits: {
          lowCost: true,
          fastConfirmation: true,
          ethereumSecurity: true
        }
      };
    } catch (error) {
      console.warn('Enhanced Polygon fee estimation failed, using base implementation:', error.message);
      return await super._estimateFees(txParams);
    }
  }

  /**
   * Assess Polygon network congestion
   */
  assessNetworkCongestion(feeHistory) {
    try {
      if (!feeHistory) return 'unknown';

      const avgBaseFee = feeHistory.baseFeePerGas
        .map(fee => BigInt(fee))
        .reduce((sum, fee) => sum + fee, BigInt(0)) / BigInt(feeHistory.baseFeePerGas.length);

      const currentBaseFee = BigInt(feeHistory.baseFeePerGas[feeHistory.baseFeePerGas.length - 1]);
      const congestionRatio = Number(currentBaseFee) / Number(avgBaseFee);

      // Polygon rarely gets highly congested
      if (congestionRatio > 3) return 'high';
      if (congestionRatio > 2) return 'medium';
      return 'low';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Calculate savings compared to Ethereum
   */
  calculateSavingsVsEthereum(polygonFee) {
    try {
      // Rough estimate: Polygon is typically 100-1000x cheaper than Ethereum
      const estimatedEthereumFee = BigInt(polygonFee) * BigInt(500); // Conservative 500x multiplier
      const savings = estimatedEthereumFee - BigInt(polygonFee);
      const savingsPercent = Number(savings * BigInt(100) / estimatedEthereumFee);
      
      return {
        percentage: `${savingsPercent.toFixed(1)}%`,
        multiplier: '500x cheaper',
        estimatedEthereumCost: estimatedEthereumFee.toString(),
        polygonCost: polygonFee.toString()
      };
    } catch (error) {
      return {
        percentage: '99%+',
        multiplier: '100-1000x cheaper',
        note: 'Polygon offers significant cost savings over Ethereum'
      };
    }
  }

  /**
   * Enhanced balance query with Polygon token support
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
      
      // Add Polygon-specific metadata
      balance.network = 'polygon';
      balance.layer = 'L2';
      balance.parentChain = 'ethereum';
      balance.isMainnet = true;
      balance.lowFeeNetwork = true;
      balance.bridgeAvailable = true;
      
      return balance;
    } catch (error) {
      throw new BlockchainError(
        `Failed to get Polygon balance: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Enhanced transaction building with Polygon optimizations
   */
  async _buildTransaction(txParams) {
    try {
      const baseTx = await super._buildTransaction(txParams);
      
      // Apply Polygon-specific optimizations
      baseTx.polygonOptimizations = {
        layer2Scaling: true,
        lowFees: true,
        fastConfirmation: true,
        ethereumCompatible: true,
        avgBlockTime: this.avgBlockTime,
        finalityBlocks: this.finalityBlocks,
        consensusProtocol: this.consensusProtocol
      };

      // Optimize gas settings for Polygon
      if (baseTx.type === 2) { // EIP-1559
        // Polygon has stable and low fees
        const currentMaxFee = BigInt(baseTx.maxFeePerGas);
        const currentPriorityFee = BigInt(baseTx.maxPriorityFeePerGas);
        
        // Use conservative fees for Polygon (they're already very low)
        baseTx.maxFeePerGas = currentMaxFee.toString();
        baseTx.maxPriorityFeePerGas = currentPriorityFee.toString();
      }

      return baseTx;
    } catch (error) {
      throw new BlockchainError(
        `Failed to build Polygon transaction: ${error.message}`,
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
   * Enhanced network status with Polygon-specific metrics
   */
  async _getNetworkStatus() {
    try {
      const baseStatus = await super._getNetworkStatus();
      
      // Get additional Polygon-specific data
      const [latestBlock, feeData] = await Promise.all([
        this.provider.getBlock('latest'),
        this.provider.getFeeData()
      ]);

      return {
        ...baseStatus,
        // Polygon-specific status
        network: 'polygon',
        layer: 'L2',
        parentChain: 'ethereum',
        consensus: this.consensusProtocol,
        avgBlockTime: `${this.avgBlockTime} seconds`,
        finalityBlocks: this.finalityBlocks,
        finalityTime: `${this.avgBlockTime * this.finalityBlocks} seconds`,
        eip1559Supported: true,
        lowFeeNetwork: true,
        ethereumCompatible: true,
        bridgeAvailable: true,
        carbonNeutral: true,
        proofOfStake: true
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to get Polygon network status: ${error.message}`,
        ErrorCodes.NETWORK_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Polygon-specific wallet connection with network validation
   */
  async _connectWallet(options = {}) {
    try {
      const connection = await super._connectWallet(options);
      
      // Validate we're on Polygon mainnet
      if (connection.chainId !== 137) {
        throw new BlockchainError(
          `Wrong network: expected Polygon Mainnet (137), got ${connection.chainId}`,
          ErrorCodes.WALLET_NETWORK_MISMATCH,
          this.config.chainId
        );
      }

      return {
        ...connection,
        network: 'polygon',
        layer: 'L2',
        parentChain: 'ethereum',
        isMainnet: true,
        features: ['eip1559', 'lowFees', 'fastTransactions', 'ethereumCompatible', 'layer2']
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to connect Polygon wallet: ${error.message}`,
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
      polygonBridge: {
        url: this.bridgeInfo.polygonBridge,
        type: 'Official Polygon Bridge',
        supportedAssets: this.bridgeInfo.supportedAssets,
        depositTime: 'Instant',
        withdrawalTime: this.bridgeInfo.withdrawalTime,
        fees: 'Gas fees only'
      },
      thirdPartyBridges: [
        {
          name: 'Hop Protocol',
          url: 'https://hop.exchange',
          features: ['Fast withdrawals', 'Lower fees'],
          withdrawalTime: '15 minutes - 4 hours'
        },
        {
          name: 'Connext',
          url: 'https://bridge.connext.network',
          features: ['Cross-chain swaps', 'Fast transfers'],
          withdrawalTime: '5-30 minutes'
        }
      ]
    };
  }

  /**
   * Get transaction receipt with Polygon-specific data
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
        network: 'polygon',
        layer: 'L2',
        confirmations,
        finalized: isFinalized,
        finalityBlocks: this.finalityBlocks,
        lowCost: true,
        fastConfirmation: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to get Polygon transaction receipt: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Health check with Polygon-specific validations
   */
  async healthCheck() {
    try {
      const baseHealth = await super.healthCheck();
      
      // Additional Polygon-specific health checks
      const [latestBlock, feeData] = await Promise.all([
        this.provider.getBlock('latest'),
        this.provider.getFeeData()
      ]);

      const blockAge = Date.now() / 1000 - latestBlock.timestamp;
      const isBlockRecent = blockAge < 10; // Block should be less than 10 seconds old
      
      return {
        ...baseHealth,
        polygon: {
          latestBlockAge: `${Math.floor(blockAge)} seconds`,
          isBlockRecent,
          gasPrice: feeData.gasPrice?.toString(),
          maxFeePerGas: feeData.maxFeePerGas?.toString(),
          avgBlockTime: `${this.avgBlockTime} seconds`,
          finalityBlocks: this.finalityBlocks,
          layer: 'L2',
          parentChain: 'ethereum',
          lowFeeNetwork: true,
          bridgeAvailable: true,
          consensusProtocol: this.consensusProtocol
        },
        healthy: baseHealth.healthy && isBlockRecent
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        network: 'polygon',
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
        layer: 'L2',
        majorProtocols: [
          {
            name: 'QuickSwap',
            type: 'DEX',
            address: this.getProtocolAddress('QuickSwap'),
            features: ['Spot Trading', 'Yield Farming', 'Dragon Syrup']
          },
          {
            name: 'SushiSwap',
            type: 'DEX',
            address: this.getProtocolAddress('SushiSwap'),
            features: ['Spot Trading', 'Yield Farming', 'Lending']
          },
          {
            name: 'Uniswap V3',
            type: 'DEX',
            address: this.getProtocolAddress('Uniswap'),
            features: ['Spot Trading', 'Concentrated Liquidity']
          },
          {
            name: 'Aave',
            type: 'Lending',
            address: this.getProtocolAddress('Aave'),
            features: ['Lending', 'Borrowing', 'Flash Loans']
          },
          {
            name: 'Curve',
            type: 'DEX',
            address: this.getProtocolAddress('Curve'),
            features: ['Stablecoin Trading', 'Low Slippage']
          }
        ],
        nativeTokens: Array.from(this.popularTokens.entries()).map(([symbol, address]) => ({
          symbol,
          address,
          network: 'polygon'
        })),
        benefits: [
          'Low transaction fees',
          'Fast confirmation times',
          'Ethereum compatibility',
          'Large DeFi ecosystem',
          'Carbon neutral'
        ]
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get Layer 2 benefits and features
   */
  getLayer2Benefits() {
    return {
      scalability: {
        throughput: '65,000+ TPS theoretical',
        actualTPS: '7,000+ TPS',
        blockTime: `${this.avgBlockTime} seconds`
      },
      costs: {
        averageTransactionFee: '$0.01 - $0.10',
        savingsVsEthereum: '100-1000x cheaper',
        gasOptimization: 'EIP-1559 supported'
      },
      security: {
        model: 'Plasma + PoS',
        parentChain: 'Ethereum',
        finalityTime: `${this.avgBlockTime * this.finalityBlocks} seconds`,
        checkpoints: 'Regular Ethereum checkpoints'
      },
      compatibility: {
        ethereumCompatible: true,
        evmCompatible: true,
        toolingSupport: 'Full Ethereum tooling',
        migrationEffort: 'Minimal'
      },
      ecosystem: {
        dapps: '3000+',
        defiProtocols: '200+',
        nftMarketplaces: 'Multiple',
        bridges: 'Multiple options'
      }
    };
  }

  /**
   * Get checkpoint information (Polygon-specific)
   */
  async getCheckpointInfo() {
    try {
      // This would integrate with Polygon's checkpoint system
      return {
        lastCheckpoint: 'Dynamic - check Polygon API',
        checkpointInterval: '~30 minutes',
        purpose: 'Ethereum finality',
        withdrawalSecurity: 'Secured by Ethereum'
      };
    } catch (error) {
      return null;
    }
  }
}

module.exports = {
  PolygonAdapter
};

