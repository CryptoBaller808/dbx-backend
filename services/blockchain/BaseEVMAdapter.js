/**
 * Base EVM Adapter Implementation - Task 3.2 Phase 1
 * 
 * Concrete implementation of the Enhanced Blockchain Adapter for EVM-compatible networks
 * using ethers.js v6 with comprehensive EVM functionality and optimizations.
 */

const { ethers } = require('ethers');
const { EnhancedBlockchainAdapter, BlockchainError, ErrorCodes } = require('./enhanced-blockchain-adapter');

/**
 * Base EVM Adapter Class
 * Provides concrete implementation for all EVM-compatible blockchain networks
 */
class BaseEVMAdapter extends EnhancedBlockchainAdapter {
  constructor(config) {
    super(config);
    
    // EVM-specific properties
    this.provider = null;
    this.signer = null;
    this.wallet = null;
    this.gasSettings = {
      gasLimit: null,
      gasPrice: null,
      maxFeePerGas: null,
      maxPriorityFeePerGas: null
    };
    
    // EVM network features
    this.supportsEIP1559 = config.features?.eip1559 || false;
    this.supportsEIP2930 = config.features?.eip2930 || false;
    this.chainId = parseInt(config.chainId);
    
    // Connection settings
    this.connectionTimeout = config.connectionSettings?.timeout || 30000;
    this.maxRetries = config.connectionSettings?.retryAttempts || 3;
    this.retryDelay = config.connectionSettings?.retryDelay || 1000;
    
    // Performance settings
    this.batchSize = config.performance?.batchSize || 100;
    this.cacheTimeout = config.performance?.cacheTimeout || 30000;
    this.balanceCache = new Map();
    this.nonceCache = new Map();
    
    // Event listeners
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for provider events
   */
  setupEventListeners() {
    this.on('providerConnected', (provider) => {
      console.log(`[${this.config.name}] Provider connected:`, provider.connection?.url);
    });
    
    this.on('providerDisconnected', () => {
      console.log(`[${this.config.name}] Provider disconnected`);
    });
    
    this.on('blockReceived', (blockNumber) => {
      this.emit('newBlock', { chainId: this.config.chainId, blockNumber });
    });
  }

  /**
   * Connect to RPC endpoint
   */
  async connectToRpc(rpcUrl) {
    try {
      console.log(`[${this.config.name}] Connecting to RPC: ${rpcUrl}`);
      
      // Create provider with timeout and retry settings
      const providerOptions = {
        timeout: this.connectionTimeout,
        throttleLimit: 10,
        throttleSlotInterval: 100
      };
      
      this.provider = new ethers.JsonRpcProvider(rpcUrl, this.chainId, providerOptions);
      
      // Test connection
      const network = await this.provider.getNetwork();
      
      if (Number(network.chainId) !== this.chainId) {
        throw new BlockchainError(
          `Chain ID mismatch: expected ${this.chainId}, got ${network.chainId}`,
          ErrorCodes.NETWORK_ERROR,
          this.config.chainId
        );
      }
      
      // Setup block listener for real-time updates
      this.provider.on('block', (blockNumber) => {
        this.emit('blockReceived', blockNumber);
      });
      
      // Setup error listener
      this.provider.on('error', (error) => {
        console.error(`[${this.config.name}] Provider error:`, error);
        this.emit('providerError', error);
      });
      
      this.emit('providerConnected', this.provider);
      
      console.log(`[${this.config.name}] Successfully connected to ${network.name} (Chain ID: ${network.chainId})`);
      
      return true;
    } catch (error) {
      console.error(`[${this.config.name}] Failed to connect to RPC:`, error.message);
      throw new BlockchainError(
        `Failed to connect to RPC ${rpcUrl}: ${error.message}`,
        ErrorCodes.CONNECTION_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Get network information
   */
  async getNetworkInfo() {
    try {
      if (!this.provider) {
        throw new BlockchainError(
          'Provider not connected',
          ErrorCodes.CONNECTION_ERROR,
          this.config.chainId
        );
      }

      const [network, blockNumber, gasPrice] = await Promise.all([
        this.provider.getNetwork(),
        this.provider.getBlockNumber(),
        this.provider.getFeeData()
      ]);

      return {
        chainId: Number(network.chainId),
        name: network.name,
        blockNumber,
        gasPrice: gasPrice.gasPrice?.toString(),
        maxFeePerGas: gasPrice.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas?.toString(),
        supportsEIP1559: this.supportsEIP1559,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to get network info: ${error.message}`,
        ErrorCodes.NETWORK_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Get balance implementation
   */
  async _getBalance(address, tokenAddress = null) {
    try {
      this.validateAddress(address);
      
      // Check cache first
      const cacheKey = `${address}:${tokenAddress || 'native'}`;
      const cached = this.balanceCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
        return cached.data;
      }

      let balance, decimals, symbol;

      if (tokenAddress) {
        // ERC-20 token balance
        this.validateAddress(tokenAddress);
        
        const tokenContract = new ethers.Contract(
          tokenAddress,
          [
            'function balanceOf(address) view returns (uint256)',
            'function decimals() view returns (uint8)',
            'function symbol() view returns (string)'
          ],
          this.provider
        );

        [balance, decimals, symbol] = await Promise.all([
          tokenContract.balanceOf(address),
          tokenContract.decimals(),
          tokenContract.symbol()
        ]);

        balance = balance.toString();
      } else {
        // Native token balance
        balance = await this.provider.getBalance(address);
        balance = balance.toString();
        decimals = this.config.nativeCurrency.decimals;
        symbol = this.config.nativeCurrency.symbol;
      }

      const result = {
        address,
        balance,
        decimals,
        symbol,
        tokenAddress,
        chainId: this.config.chainId,
        blockNumber: await this.provider.getBlockNumber(),
        timestamp: new Date().toISOString()
      };

      // Cache the result
      this.balanceCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      throw new BlockchainError(
        `Failed to get balance: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Get transaction implementation
   */
  async _getTransaction(txHash) {
    try {
      this.validateTransactionHash(txHash);

      const [tx, receipt] = await Promise.all([
        this.provider.getTransaction(txHash),
        this.provider.getTransactionReceipt(txHash).catch(() => null)
      ]);

      if (!tx) {
        throw new BlockchainError(
          `Transaction not found: ${txHash}`,
          ErrorCodes.TRANSACTION_ERROR,
          this.config.chainId
        );
      }

      const result = {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value?.toString(),
        gasLimit: tx.gasLimit?.toString(),
        gasPrice: tx.gasPrice?.toString(),
        maxFeePerGas: tx.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas?.toString(),
        nonce: tx.nonce,
        data: tx.data,
        chainId: tx.chainId,
        type: tx.type,
        blockNumber: tx.blockNumber,
        blockHash: tx.blockHash,
        transactionIndex: tx.index,
        confirmations: await tx.confirmations(),
        status: receipt ? (receipt.status === 1 ? 'success' : 'failed') : 'pending',
        gasUsed: receipt?.gasUsed?.toString(),
        effectiveGasPrice: receipt?.effectiveGasPrice?.toString(),
        logs: receipt?.logs || [],
        timestamp: new Date().toISOString()
      };

      return result;
    } catch (error) {
      throw new BlockchainError(
        `Failed to get transaction: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Build transaction implementation
   */
  async _buildTransaction(txParams) {
    try {
      this.validateTransactionParams(txParams);

      const {
        to,
        value = '0',
        data = '0x',
        gasLimit,
        gasPrice,
        maxFeePerGas,
        maxPriorityFeePerGas,
        nonce,
        type
      } = txParams;

      // Get current nonce if not provided
      const fromAddress = txParams.from;
      if (!fromAddress) {
        throw new BlockchainError(
          'From address is required',
          ErrorCodes.INVALID_PARAMS,
          this.config.chainId
        );
      }

      const currentNonce = nonce !== undefined ? nonce : await this.getNonce(fromAddress);

      // Estimate gas if not provided
      const estimatedGasLimit = gasLimit || await this.estimateGas({
        to,
        value,
        data,
        from: fromAddress
      });

      // Get fee data
      const feeData = await this.provider.getFeeData();
      
      // Build transaction object
      const transaction = {
        to,
        value: ethers.parseEther(ethers.formatEther(value || '0')),
        data,
        nonce: currentNonce,
        gasLimit: estimatedGasLimit,
        chainId: this.chainId
      };

      // Handle gas pricing based on EIP-1559 support and provided parameters
      if (this.supportsEIP1559 && (maxFeePerGas || maxPriorityFeePerGas || type === 2)) {
        transaction.type = 2;
        transaction.maxFeePerGas = maxFeePerGas || feeData.maxFeePerGas;
        transaction.maxPriorityFeePerGas = maxPriorityFeePerGas || feeData.maxPriorityFeePerGas;
      } else {
        transaction.type = type || 0;
        transaction.gasPrice = gasPrice || feeData.gasPrice;
      }

      return {
        ...transaction,
        value: transaction.value.toString(),
        gasLimit: transaction.gasLimit.toString(),
        gasPrice: transaction.gasPrice?.toString(),
        maxFeePerGas: transaction.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas?.toString(),
        estimatedFee: this.calculateTransactionFee(transaction),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to build transaction: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Sign transaction implementation
   */
  async _signTransaction(tx, signingParams) {
    try {
      const { privateKey, wallet: walletInstance } = signingParams;

      let signer;
      if (privateKey) {
        signer = new ethers.Wallet(privateKey, this.provider);
      } else if (walletInstance) {
        signer = walletInstance;
      } else if (this.signer) {
        signer = this.signer;
      } else {
        throw new BlockchainError(
          'No signing method available',
          ErrorCodes.WALLET_ERROR,
          this.config.chainId
        );
      }

      // Convert string values back to BigInt for signing
      const transactionRequest = {
        ...tx,
        value: tx.value ? ethers.parseEther(ethers.formatEther(tx.value)) : 0,
        gasLimit: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
        gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : undefined,
        maxFeePerGas: tx.maxFeePerGas ? BigInt(tx.maxFeePerGas) : undefined,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? BigInt(tx.maxPriorityFeePerGas) : undefined
      };

      const signedTx = await signer.signTransaction(transactionRequest);

      return {
        ...tx,
        signature: signedTx,
        signed: true,
        signerAddress: await signer.getAddress(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to sign transaction: ${error.message}`,
        ErrorCodes.WALLET_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Submit transaction implementation
   */
  async _submitTransaction(signedTx) {
    try {
      if (!signedTx.signature) {
        throw new BlockchainError(
          'Transaction is not signed',
          ErrorCodes.INVALID_PARAMS,
          this.config.chainId
        );
      }

      const txResponse = await this.provider.broadcastTransaction(signedTx.signature);

      return {
        hash: txResponse.hash,
        from: txResponse.from,
        to: txResponse.to,
        value: txResponse.value?.toString(),
        gasLimit: txResponse.gasLimit?.toString(),
        gasPrice: txResponse.gasPrice?.toString(),
        maxFeePerGas: txResponse.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: txResponse.maxPriorityFeePerGas?.toString(),
        nonce: txResponse.nonce,
        chainId: txResponse.chainId,
        type: txResponse.type,
        status: 'submitted',
        timestamp: new Date().toISOString(),
        wait: async (confirmations = 1) => {
          const receipt = await txResponse.wait(confirmations);
          return {
            ...receipt,
            status: receipt.status === 1 ? 'success' : 'failed',
            gasUsed: receipt.gasUsed?.toString(),
            effectiveGasPrice: receipt.effectiveGasPrice?.toString()
          };
        }
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to submit transaction: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Estimate fees implementation
   */
  async _estimateFees(txParams) {
    try {
      const feeData = await this.provider.getFeeData();
      
      // Estimate gas limit
      const gasLimit = await this.estimateGas(txParams);
      
      let result = {
        gasLimit: gasLimit.toString(),
        chainId: this.config.chainId,
        timestamp: new Date().toISOString()
      };

      if (this.supportsEIP1559 && feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        // EIP-1559 fee estimation
        result = {
          ...result,
          maxFeePerGas: feeData.maxFeePerGas.toString(),
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.toString(),
          baseFee: feeData.gasPrice?.toString(),
          totalFee: (BigInt(gasLimit) * feeData.maxFeePerGas).toString(),
          type: 'eip1559'
        };
      } else {
        // Legacy fee estimation
        result = {
          ...result,
          gasPrice: feeData.gasPrice?.toString(),
          totalFee: (BigInt(gasLimit) * feeData.gasPrice).toString(),
          type: 'legacy'
        };
      }

      return result;
    } catch (error) {
      throw new BlockchainError(
        `Failed to estimate fees: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Connect wallet implementation
   */
  async _connectWallet(options = {}) {
    try {
      const { walletType = 'metamask', privateKey } = options;

      if (privateKey) {
        // Connect with private key
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        this.signer = this.wallet;
        
        return {
          connected: true,
          address: await this.wallet.getAddress(),
          walletType: 'private_key',
          chainId: this.chainId,
          timestamp: new Date().toISOString()
        };
      }

      if (walletType === 'metamask' && typeof window !== 'undefined' && window.ethereum) {
        // Connect to MetaMask
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        this.signer = await provider.getSigner();
        
        const address = await this.signer.getAddress();
        const chainId = await this.signer.getChainId();
        
        if (Number(chainId) !== this.chainId) {
          // Request network switch
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: `0x${this.chainId.toString(16)}` }]
            });
          } catch (switchError) {
            if (switchError.code === 4902) {
              // Network not added, add it
              await this.addNetworkToWallet();
            } else {
              throw switchError;
            }
          }
        }
        
        return {
          connected: true,
          address,
          walletType: 'metamask',
          chainId: Number(chainId),
          timestamp: new Date().toISOString()
        };
      }

      throw new BlockchainError(
        `Wallet type ${walletType} not supported or not available`,
        ErrorCodes.WALLET_ERROR,
        this.config.chainId
      );
    } catch (error) {
      throw new BlockchainError(
        `Failed to connect wallet: ${error.message}`,
        ErrorCodes.WALLET_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Disconnect wallet implementation
   */
  async _disconnectWallet() {
    try {
      this.wallet = null;
      this.signer = null;
      
      return {
        disconnected: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to disconnect wallet: ${error.message}`,
        ErrorCodes.WALLET_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Get network status implementation
   */
  async _getNetworkStatus() {
    try {
      const [blockNumber, feeData, network] = await Promise.all([
        this.provider.getBlockNumber(),
        this.provider.getFeeData(),
        this.provider.getNetwork()
      ]);

      return {
        connected: true,
        chainId: Number(network.chainId),
        blockNumber,
        gasPrice: feeData.gasPrice?.toString(),
        maxFeePerGas: feeData.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
        networkName: network.name,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * EVM-specific utility methods
   */

  /**
   * Get nonce for address
   */
  async getNonce(address) {
    try {
      // Check cache first
      const cached = this.nonceCache.get(address);
      if (cached && (Date.now() - cached.timestamp) < 5000) { // 5 second cache
        return cached.nonce;
      }

      const nonce = await this.provider.getTransactionCount(address, 'pending');
      
      // Cache the nonce
      this.nonceCache.set(address, {
        nonce,
        timestamp: Date.now()
      });

      return nonce;
    } catch (error) {
      throw new BlockchainError(
        `Failed to get nonce: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        this.config.chainId,
        error
      );
    }
  }

  /**
   * Estimate gas for transaction
   */
  async estimateGas(txParams) {
    try {
      const gasEstimate = await this.provider.estimateGas({
        to: txParams.to,
        value: txParams.value || 0,
        data: txParams.data || '0x',
        from: txParams.from
      });

      // Add 20% buffer for safety
      return BigInt(Math.floor(Number(gasEstimate) * 1.2));
    } catch (error) {
      // Fallback to default gas limit
      console.warn(`Gas estimation failed, using default: ${error.message}`);
      return BigInt(21000);
    }
  }

  /**
   * Calculate transaction fee
   */
  calculateTransactionFee(tx) {
    try {
      const gasLimit = BigInt(tx.gasLimit);
      
      if (tx.maxFeePerGas) {
        return (gasLimit * BigInt(tx.maxFeePerGas)).toString();
      } else if (tx.gasPrice) {
        return (gasLimit * BigInt(tx.gasPrice)).toString();
      }
      
      return '0';
    } catch (error) {
      return '0';
    }
  }

  /**
   * Add network to wallet (MetaMask)
   */
  async addNetworkToWallet() {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new BlockchainError(
        'MetaMask not available',
        ErrorCodes.WALLET_ERROR,
        this.config.chainId
      );
    }

    const networkParams = {
      chainId: `0x${this.chainId.toString(16)}`,
      chainName: this.config.name,
      nativeCurrency: this.config.nativeCurrency,
      rpcUrls: this.config.rpcUrls,
      blockExplorerUrls: this.config.blockExplorerUrls || []
    };

    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [networkParams]
    });
  }

  /**
   * Validation methods
   */

  /**
   * Validate Ethereum address
   */
  validateAddress(address) {
    if (!ethers.isAddress(address)) {
      throw new BlockchainError(
        `Invalid address: ${address}`,
        ErrorCodes.INVALID_ADDRESS,
        this.config.chainId
      );
    }
  }

  /**
   * Validate transaction hash
   */
  validateTransactionHash(txHash) {
    if (!txHash || typeof txHash !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      throw new BlockchainError(
        `Invalid transaction hash: ${txHash}`,
        ErrorCodes.INVALID_PARAMS,
        this.config.chainId
      );
    }
  }

  /**
   * Validate transaction parameters
   */
  validateTransactionParams(txParams) {
    if (!txParams || typeof txParams !== 'object') {
      throw new BlockchainError(
        'Transaction parameters must be an object',
        ErrorCodes.INVALID_PARAMS,
        this.config.chainId
      );
    }

    if (txParams.to) {
      this.validateAddress(txParams.to);
    }

    if (txParams.from) {
      this.validateAddress(txParams.from);
    }

    if (txParams.value && isNaN(Number(txParams.value))) {
      throw new BlockchainError(
        `Invalid value: ${txParams.value}`,
        ErrorCodes.INVALID_AMOUNT,
        this.config.chainId
      );
    }
  }

  /**
   * Cleanup method
   */
  async cleanup() {
    try {
      // Remove event listeners
      if (this.provider) {
        this.provider.removeAllListeners();
      }

      // Clear caches
      this.balanceCache.clear();
      this.nonceCache.clear();

      // Reset connections
      this.provider = null;
      this.signer = null;
      this.wallet = null;

      await super.cleanup();
    } catch (error) {
      console.error(`[${this.config.name}] Error during cleanup:`, error);
    }
  }
}

module.exports = {
  BaseEVMAdapter
};

