/**
 * Enhanced XDC Network Adapter - Task 3.2 Phase 2
 * 
 * Concrete implementation for XDC Network with address format conversion,
 * XDC-specific optimizations, and enterprise features.
 */

const { BaseEVMAdapter } = require('../BaseEVMAdapter');
const { BlockchainError, ErrorCodes } = require('../enhanced-blockchain-adapter');

/**
 * Enhanced XDC Network Adapter
 * Optimized for XDC Network with address format handling and enterprise features
 */
class EnhancedXDCAdapter extends BaseEVMAdapter {
  constructor(config) {
    // XDC-specific configuration
    const xdcConfig = {
      ...config,
      chainId: '50',
      name: 'XDC Network',
      type: 'evm',
      nativeCurrency: {
        name: 'XDC',
        symbol: 'XDC',
        decimals: 18
      },
      features: {
        eip1559: false, // XDC doesn't support EIP-1559 yet
        eip2930: false,
        smartContracts: true,
        nfts: true,
        defi: true,
        enterprise: true,
        lowFees: true
      },
      rpcUrls: config.rpcUrls || [
        'https://rpc.xinfin.network',
        'https://erpc.xinfin.network',
        'https://rpc.xdcrpc.com',
        'https://rpc1.xinfin.network'
      ],
      blockExplorerUrls: ['https://explorer.xinfin.network'],
      performance: {
        batchSize: 100, // XDC can handle larger batches
        cacheTimeout: 10000, // 10 seconds
        maxConcurrentRequests: 20
      },
      connectionSettings: {
        timeout: 15000, // Faster than Ethereum
        retryAttempts: 3,
        retryDelay: 1000
      }
    };

    super(xdcConfig);

    // XDC-specific properties
    this.addressPrefix = 'xdc';
    this.ethPrefix = '0x';
    this.avgBlockTime = 2; // 2 seconds
    this.finalityBlocks = 6; // Faster finality than Ethereum
    
    // Popular XDC tokens and DeFi protocols
    this.popularTokens = new Map([
      ['WXDC', '0x951857744785E80e2De051c32EE7b25f9c458C42'],
      ['USDT', '0xD4B5f10D61916Bd6E0860144a91Ac658dE8a1437'],
      ['USDC', '0xD4B5f10D61916Bd6E0860144a91Ac658dE8a1437'], // Example
      ['PLI', '0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE'],
      ['XDCE', '0x41AB1b6fcbB2fA9DCEd81aCbdeC13Ea6315F2Bf2']
    ]);

    // XDC network features
    this.networkFeatures = {
      instantFinality: false,
      lowGasFees: true,
      enterpriseReady: true,
      delegatedProofOfStake: true,
      interoperability: true
    };
  }

  /**
   * Convert XDC address format to Ethereum format (xdc -> 0x)
   */
  xdcToEthAddress(xdcAddress) {
    if (!xdcAddress) return xdcAddress;
    
    if (typeof xdcAddress !== 'string') {
      throw new BlockchainError(
        'Address must be a string',
        ErrorCodes.INVALID_ADDRESS,
        this.config.chainId
      );
    }

    // If already in 0x format, return as is
    if (xdcAddress.startsWith('0x')) {
      return xdcAddress;
    }

    // Convert xdc format to 0x format
    if (xdcAddress.startsWith('xdc')) {
      const ethAddress = '0x' + xdcAddress.slice(3);
      
      // Validate the converted address
      if (!/^0x[a-fA-F0-9]{40}$/.test(ethAddress)) {
        throw new BlockchainError(
          `Invalid XDC address format: ${xdcAddress}`,
          ErrorCodes.INVALID_ADDRESS,
          this.config.chainId
        );
      }
      
      return ethAddress;
    }

    throw new BlockchainError(
      `Invalid address format: ${xdcAddress}. Expected xdc or 0x prefix`,
      ErrorCodes.INVALID_ADDRESS,
      this.config.chainId
    );
  }

  /**
   * Convert Ethereum address format to XDC format (0x -> xdc)
   */
  ethToXdcAddress(ethAddress) {
    if (!ethAddress) return ethAddress;
    
    if (typeof ethAddress !== 'string') {
      throw new BlockchainError(
        'Address must be a string',
        ErrorCodes.INVALID_ADDRESS,
        this.config.chainId
      );
    }

    // If already in xdc format, return as is
    if (ethAddress.startsWith('xdc')) {
      return ethAddress;
    }

    // Convert 0x format to xdc format
    if (ethAddress.startsWith('0x')) {
      const xdcAddress = 'xdc' + ethAddress.slice(2);
      return xdcAddress;
    }

    throw new BlockchainError(
      `Invalid address format: ${ethAddress}. Expected 0x or xdc prefix`,
      ErrorCodes.INVALID_ADDRESS,
      this.config.chainId
    );
  }

  /**
   * Enhanced address validation for XDC format
   */
  validateAddress(address) {
    try {
      // Convert to 0x format for validation
      const ethAddress = this.xdcToEthAddress(address);
      
      // Use parent validation
      super.validateAddress(ethAddress);
      
      return true;
    } catch (error) {
      throw new BlockchainError(
        `Invalid XDC address: ${address}`,
        ErrorCodes.INVALID_ADDRESS,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Enhanced balance query with XDC address format support
   */
  async _getBalance(address, tokenAddress = null) {
    try {
      // Convert addresses to 0x format for internal use
      const ethAddress = this.xdcToEthAddress(address);
      const ethTokenAddress = tokenAddress ? this.xdcToEthAddress(tokenAddress) : null;

      // If token symbol provided instead of address, resolve it
      if (tokenAddress && !tokenAddress.startsWith('xdc') && !tokenAddress.startsWith('0x')) {
        const resolvedAddress = this.getTokenAddress(tokenAddress);
        if (resolvedAddress) {
          ethTokenAddress = resolvedAddress;
        } else {
          throw new BlockchainError(
            `Unknown token symbol: ${tokenAddress}`,
            ErrorCodes.INVALID_TOKEN,
            this.config.chainId
          );
        }
      }

      const balance = await super._getBalance(ethAddress, ethTokenAddress);
      
      // Convert addresses back to XDC format in response
      balance.address = this.ethToXdcAddress(balance.address);
      if (balance.tokenAddress) {
        balance.tokenAddress = this.ethToXdcAddress(balance.tokenAddress);
      }
      
      // Add XDC-specific metadata
      balance.network = 'xdc';
      balance.isMainnet = true;
      balance.addressFormat = 'xdc';
      balance.lowFeeNetwork = true;
      
      return balance;
    } catch (error) {
      throw new BlockchainError(
        `Failed to get XDC balance: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Enhanced transaction building with XDC optimizations
   */
  async _buildTransaction(txParams) {
    try {
      // Convert addresses to 0x format for internal processing
      const convertedParams = {
        ...txParams,
        to: txParams.to ? this.xdcToEthAddress(txParams.to) : undefined,
        from: txParams.from ? this.xdcToEthAddress(txParams.from) : undefined
      };

      const baseTx = await super._buildTransaction(convertedParams);
      
      // Apply XDC-specific optimizations
      baseTx.xdcOptimizations = {
        lowFeeNetwork: true,
        fastConfirmation: true,
        avgBlockTime: this.avgBlockTime,
        finalityBlocks: this.finalityBlocks
      };

      // Convert addresses back to XDC format in response
      if (baseTx.to) baseTx.to = this.ethToXdcAddress(baseTx.to);
      if (baseTx.from) baseTx.from = this.ethToXdcAddress(baseTx.from);

      return baseTx;
    } catch (error) {
      throw new BlockchainError(
        `Failed to build XDC transaction: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Enhanced transaction retrieval with XDC address format
   */
  async _getTransaction(txHash) {
    try {
      const tx = await super._getTransaction(txHash);
      
      // Convert addresses to XDC format
      if (tx.from) tx.from = this.ethToXdcAddress(tx.from);
      if (tx.to) tx.to = this.ethToXdcAddress(tx.to);
      
      // Add XDC-specific metadata
      tx.network = 'xdc';
      tx.addressFormat = 'xdc';
      tx.avgConfirmationTime = `${this.avgBlockTime * this.finalityBlocks} seconds`;
      
      return tx;
    } catch (error) {
      throw new BlockchainError(
        `Failed to get XDC transaction: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Enhanced fee estimation for XDC network
   */
  async _estimateFees(txParams) {
    try {
      // Convert addresses for internal processing
      const convertedParams = {
        ...txParams,
        to: txParams.to ? this.xdcToEthAddress(txParams.to) : undefined,
        from: txParams.from ? this.xdcToEthAddress(txParams.from) : undefined
      };

      const baseFeeData = await super._estimateFees(convertedParams);
      
      return {
        ...baseFeeData,
        // XDC-specific fee data
        network: 'xdc',
        lowFeeNetwork: true,
        avgTransactionCost: 'Very Low',
        feeStability: 'High',
        gasOptimization: {
          recommended: 'legacy',
          reason: 'XDC uses legacy gas pricing'
        },
        estimatedConfirmationTime: `${this.avgBlockTime} seconds`,
        finalityTime: `${this.avgBlockTime * this.finalityBlocks} seconds`
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to estimate XDC fees: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
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
   * Enhanced network status with XDC-specific metrics
   */
  async _getNetworkStatus() {
    try {
      const baseStatus = await super._getNetworkStatus();
      
      return {
        ...baseStatus,
        // XDC-specific status
        network: 'xdc',
        consensus: 'Delegated Proof of Stake (XDPoS)',
        avgBlockTime: `${this.avgBlockTime} seconds`,
        finalityBlocks: this.finalityBlocks,
        finalityTime: `${this.avgBlockTime * this.finalityBlocks} seconds`,
        enterpriseFeatures: true,
        interoperability: true,
        lowFees: true,
        layer: 'L1',
        addressFormat: 'xdc/0x dual support'
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to get XDC network status: ${error.message}`,
        ErrorCodes.NETWORK_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * XDC-specific wallet connection with address format handling
   */
  async _connectWallet(options = {}) {
    try {
      const connection = await super._connectWallet(options);
      
      // Validate we're on XDC network
      if (connection.chainId !== 50) {
        throw new BlockchainError(
          `Wrong network: expected XDC Network (50), got ${connection.chainId}`,
          ErrorCodes.WALLET_NETWORK_MISMATCH,
          this.config.chainId
        );
      }

      // Convert address to XDC format
      const xdcAddress = this.ethToXdcAddress(connection.address);

      return {
        ...connection,
        address: xdcAddress,
        ethAddress: connection.address, // Keep both formats
        xdcAddress: xdcAddress,
        network: 'xdc',
        isMainnet: true,
        addressFormat: 'xdc',
        features: ['smartContracts', 'lowFees', 'fastConfirmation', 'enterprise']
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to connect XDC wallet: ${error.message}`,
        ErrorCodes.WALLET_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Get nonce with address format conversion
   */
  async getNonce(address) {
    try {
      const ethAddress = this.xdcToEthAddress(address);
      return await super.getNonce(ethAddress);
    } catch (error) {
      throw new BlockchainError(
        `Failed to get nonce for XDC address: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Estimate gas with address format conversion
   */
  async estimateGas(txParams) {
    try {
      const convertedParams = {
        ...txParams,
        to: txParams.to ? this.xdcToEthAddress(txParams.to) : undefined,
        from: txParams.from ? this.xdcToEthAddress(txParams.from) : undefined
      };

      return await super.estimateGas(convertedParams);
    } catch (error) {
      throw new BlockchainError(
        `Failed to estimate gas for XDC transaction: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Health check with XDC-specific validations
   */
  async healthCheck() {
    try {
      const baseHealth = await super.healthCheck();
      
      // Additional XDC-specific health checks
      const [latestBlock, feeData] = await Promise.all([
        this.provider.getBlock('latest'),
        this.provider.getFeeData()
      ]);

      const blockAge = Date.now() / 1000 - latestBlock.timestamp;
      const isBlockRecent = blockAge < 10; // Block should be less than 10 seconds old (faster than Ethereum)
      
      return {
        ...baseHealth,
        xdc: {
          latestBlockAge: `${Math.floor(blockAge)} seconds`,
          isBlockRecent,
          gasPrice: feeData.gasPrice?.toString(),
          avgBlockTime: `${this.avgBlockTime} seconds`,
          finalityBlocks: this.finalityBlocks,
          addressFormatSupport: 'xdc/0x dual',
          enterpriseReady: true
        },
        healthy: baseHealth.healthy && isBlockRecent
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        network: 'xdc',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get transaction receipt with XDC address format
   */
  async getTransactionReceipt(txHash) {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        return null;
      }

      // Convert addresses to XDC format
      const xdcReceipt = {
        ...receipt,
        from: receipt.from ? this.ethToXdcAddress(receipt.from) : receipt.from,
        to: receipt.to ? this.ethToXdcAddress(receipt.to) : receipt.to,
        status: receipt.status === 1 ? 'success' : 'failed',
        gasUsed: receipt.gasUsed?.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
        network: 'xdc',
        addressFormat: 'xdc',
        confirmations: await this.provider.getBlockNumber() - receipt.blockNumber,
        finalityReached: (await this.provider.getBlockNumber() - receipt.blockNumber) >= this.finalityBlocks,
        timestamp: new Date().toISOString()
      };

      return xdcReceipt;
    } catch (error) {
      throw new BlockchainError(
        `Failed to get XDC transaction receipt: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Batch address conversion utility
   */
  convertAddressBatch(addresses, toFormat = 'xdc') {
    try {
      return addresses.map(address => {
        if (toFormat === 'xdc') {
          return this.ethToXdcAddress(address);
        } else {
          return this.xdcToEthAddress(address);
        }
      });
    } catch (error) {
      throw new BlockchainError(
        `Failed to convert address batch: ${error.message}`,
        ErrorCodes.INVALID_ADDRESS,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Get network information with XDC-specific data
   */
  async getNetworkInfo() {
    try {
      const baseInfo = await super.getNetworkInfo();
      
      return {
        ...baseInfo,
        network: 'xdc',
        consensus: 'XDPoS (Delegated Proof of Stake)',
        avgBlockTime: this.avgBlockTime,
        finalityBlocks: this.finalityBlocks,
        addressFormats: ['xdc', '0x'],
        enterpriseFeatures: true,
        interoperability: true,
        lowFeeNetwork: true
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to get XDC network info: ${error.message}`,
        ErrorCodes.NETWORK_ERROR,
        this.config.chainId,
        error
      );
    }
  }
}

module.exports = {
  EnhancedXDCAdapter
};

