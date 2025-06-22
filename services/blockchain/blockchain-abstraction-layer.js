/**
 * Blockchain Abstraction Layer - Core Implementation
 * 
 * This file contains the core implementation of the blockchain abstraction layer,
 * including interfaces, registry, and base adapter classes.
 */

// Error handling
class BlockchainError extends Error {
  constructor(message, code, chainId, originalError = null) {
    super(message);
    this.name = 'BlockchainError';
    this.code = code;
    this.chainId = chainId;
    this.originalError = originalError;
  }
}

// Error codes
const ErrorCodes = {
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  TRANSACTION_ERROR: 'TRANSACTION_ERROR',
  WALLET_ERROR: 'WALLET_ERROR',
  INVALID_PARAMS: 'INVALID_PARAMS',
  NOT_SUPPORTED: 'NOT_SUPPORTED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  UNAUTHORIZED: 'UNAUTHORIZED',
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * Base Blockchain Adapter Interface
 * All blockchain-specific adapters must implement this interface
 */
class BlockchainAdapter {
  constructor(config) {
    this.config = config;
    this.isInitialized = false;
  }

  /**
   * Initialize the adapter with necessary connections
   */
  async initialize() {
    throw new BlockchainError(
      'Method not implemented',
      ErrorCodes.NOT_SUPPORTED,
      this.config.chainId
    );
  }

  /**
   * Get balance for an address
   * @param {string} address - The wallet address
   * @param {string} tokenAddress - Optional token address for non-native assets
   * @returns {Promise<Object>} Balance information
   */
  async getBalance(address, tokenAddress = null) {
    throw new BlockchainError(
      'Method not implemented',
      ErrorCodes.NOT_SUPPORTED,
      this.config.chainId
    );
  }

  /**
   * Get transaction details
   * @param {string} txHash - Transaction hash/ID
   * @returns {Promise<Object>} Transaction details
   */
  async getTransaction(txHash) {
    throw new BlockchainError(
      'Method not implemented',
      ErrorCodes.NOT_SUPPORTED,
      this.config.chainId
    );
  }

  /**
   * Build a transaction object
   * @param {Object} txParams - Transaction parameters
   * @returns {Promise<Object>} Unsigned transaction
   */
  async buildTransaction(txParams) {
    throw new BlockchainError(
      'Method not implemented',
      ErrorCodes.NOT_SUPPORTED,
      this.config.chainId
    );
  }

  /**
   * Sign a transaction
   * @param {Object} tx - Unsigned transaction
   * @param {Object} signingParams - Parameters for signing
   * @returns {Promise<Object>} Signed transaction
   */
  async signTransaction(tx, signingParams) {
    throw new BlockchainError(
      'Method not implemented',
      ErrorCodes.NOT_SUPPORTED,
      this.config.chainId
    );
  }

  /**
   * Submit a signed transaction
   * @param {Object} signedTx - Signed transaction
   * @returns {Promise<Object>} Transaction result
   */
  async submitTransaction(signedTx) {
    throw new BlockchainError(
      'Method not implemented',
      ErrorCodes.NOT_SUPPORTED,
      this.config.chainId
    );
  }

  /**
   * Connect to a wallet
   * @param {Object} options - Connection options
   * @returns {Promise<Object>} Connection result
   */
  async connectWallet(options = {}) {
    throw new BlockchainError(
      'Method not implemented',
      ErrorCodes.NOT_SUPPORTED,
      this.config.chainId
    );
  }

  /**
   * Disconnect from wallet
   * @returns {Promise<boolean>} Success indicator
   */
  async disconnectWallet() {
    throw new BlockchainError(
      'Method not implemented',
      ErrorCodes.NOT_SUPPORTED,
      this.config.chainId
    );
  }

  /**
   * Get network status
   * @returns {Promise<Object>} Network status
   */
  async getNetworkStatus() {
    throw new BlockchainError(
      'Method not implemented',
      ErrorCodes.NOT_SUPPORTED,
      this.config.chainId
    );
  }
}

/**
 * Adapter Registry
 * Manages blockchain adapters and provides access to them
 */
class AdapterRegistry {
  constructor() {
    this.adapters = new Map();
  }

  /**
   * Register a blockchain adapter
   * @param {string} chainId - Chain identifier
   * @param {BlockchainAdapter} adapter - Blockchain adapter instance
   */
  registerAdapter(chainId, adapter) {
    this.adapters.set(chainId, adapter);
  }

  /**
   * Get a blockchain adapter by chain ID
   * @param {string} chainId - Chain identifier
   * @returns {BlockchainAdapter} Blockchain adapter
   */
  getAdapter(chainId) {
    const adapter = this.adapters.get(chainId);
    if (!adapter) {
      throw new BlockchainError(
        `No adapter registered for chain ID: ${chainId}`,
        ErrorCodes.INVALID_PARAMS,
        chainId
      );
    }
    return adapter;
  }

  /**
   * Get list of supported chain IDs
   * @returns {Array<string>} List of chain IDs
   */
  getSupportedChains() {
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if a chain is supported
   * @param {string} chainId - Chain identifier
   * @returns {boolean} Whether the chain is supported
   */
  isChainSupported(chainId) {
    return this.adapters.has(chainId);
  }
}

/**
 * Configuration Manager
 * Manages blockchain configurations
 */
class ConfigurationManager {
  constructor(blockchainConfigRepository) {
    this.blockchainConfigRepository = blockchainConfigRepository;
    this.configs = new Map();
  }

  /**
   * Load configurations from database
   * @returns {Promise<Map>} Map of configurations
   */
  async loadConfigurations() {
  const configs = this.blockchainConfigRepository?.findAll
    ? await this.blockchainConfigRepository.findAll({ where: { isActive: true } })
    : [];

  configs.forEach(config => {
    this.configs.set(config.chainId, config);
  });

  return this.configs;
}

  /**
   * Get configuration for a chain
   * @param {string} chainId - Chain identifier
   * @returns {Object} Chain configuration
   */
  getConfiguration(chainId) {
    const config = this.configs.get(chainId);
    if (!config) {
      throw new BlockchainError(
        `Configuration not found for chain ID: ${chainId}`,
        ErrorCodes.INVALID_PARAMS,
        chainId
      );
    }
    return config;
  }

  /**
   * Update a chain configuration
   * @param {string} chainId - Chain identifier
   * @param {Object} updates - Configuration updates
   * @returns {Promise<Object>} Updated configuration
   */
  async updateConfiguration(chainId, updates) {
    const config = await this.blockchainConfigRepository.findOne({
      where: { chainId }
    });
    
    if (!config) {
      throw new BlockchainError(
        `Configuration not found for chain ID: ${chainId}`,
        ErrorCodes.INVALID_PARAMS,
        chainId
      );
    }
    
    Object.assign(config, updates);
    await config.save();
    
    // Update in-memory cache
    this.configs.set(chainId, config);
    
    return config;
  }
}

/**
 * Blockchain Service
 * Provides high-level blockchain operations
 */
class BlockchainService {
  constructor(adapterRegistry) {
    this.adapterRegistry = adapterRegistry;
  }

  /**
   * Get adapter for a chain
   * @param {string} chainId - Chain identifier
   * @returns {BlockchainAdapter} Blockchain adapter
   */
  getAdapter(chainId) {
    return this.adapterRegistry.getAdapter(chainId);
  }

  /**
   * Get balance for an address
   * @param {string} chainId - Chain identifier
   * @param {string} address - Wallet address
   * @param {string} tokenAddress - Optional token address
   * @returns {Promise<Object>} Balance information
   */
  async getBalance(chainId, address, tokenAddress = null) {
    try {
      const adapter = this.getAdapter(chainId);
      return await adapter.getBalance(address, tokenAddress);
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to get balance: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        chainId,
        error
      );
    }
  }

  /**
   * Get transaction details
   * @param {string} chainId - Chain identifier
   * @param {string} txHash - Transaction hash/ID
   * @returns {Promise<Object>} Transaction details
   */
  async getTransaction(chainId, txHash) {
    try {
      const adapter = this.getAdapter(chainId);
      return await adapter.getTransaction(txHash);
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to get transaction: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        chainId,
        error
      );
    }
  }

  /**
   * Get network status
   * @param {string} chainId - Chain identifier
   * @returns {Promise<Object>} Network status
   */
  async getNetworkStatus(chainId) {
    try {
      const adapter = this.getAdapter(chainId);
      return await adapter.getNetworkStatus();
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to get network status: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        chainId,
        error
      );
    }
  }

  /**
   * Get supported chains
   * @returns {Array<string>} List of supported chain IDs
   */
  getSupportedChains() {
    return this.adapterRegistry.getSupportedChains();
  }
}

/**
 * Wallet Operations
 * Handles wallet-related operations
 */
class WalletOperations {
  constructor(adapterRegistry) {
    this.adapterRegistry = adapterRegistry;
  }

  /**
   * Connect to a wallet
   * @param {string} chainId - Chain identifier
   * @param {Object} options - Connection options
   * @returns {Promise<Object>} Connection result
   */
  async connect(chainId, options = {}) {
    try {
      const adapter = this.adapterRegistry.getAdapter(chainId);
      return await adapter.connectWallet(options);
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to connect wallet: ${error.message}`,
        ErrorCodes.WALLET_ERROR,
        chainId,
        error
      );
    }
  }

  /**
   * Disconnect from wallet
   * @param {string} chainId - Chain identifier
   * @returns {Promise<boolean>} Success indicator
   */
  async disconnect(chainId) {
    try {
      const adapter = this.adapterRegistry.getAdapter(chainId);
      return await adapter.disconnectWallet();
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to disconnect wallet: ${error.message}`,
        ErrorCodes.WALLET_ERROR,
        chainId,
        error
      );
    }
  }
}

/**
 * Transaction Service
 * Handles transaction operations
 */
class TransactionService {
  constructor(adapterRegistry, transactionRepository) {
    this.adapterRegistry = adapterRegistry;
    this.transactionRepository = transactionRepository;
  }

  /**
   * Build a transaction
   * @param {string} chainId - Chain identifier
   * @param {Object} txParams - Transaction parameters
   * @returns {Promise<Object>} Unsigned transaction
   */
  async buildTransaction(chainId, txParams) {
    try {
      const adapter = this.adapterRegistry.getAdapter(chainId);
      return await adapter.buildTransaction(txParams);
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to build transaction: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        chainId,
        error
      );
    }
  }

  /**
   * Sign a transaction
   * @param {string} chainId - Chain identifier
   * @param {Object} tx - Unsigned transaction
   * @param {Object} signingParams - Parameters for signing
   * @returns {Promise<Object>} Signed transaction
   */
  async signTransaction(chainId, tx, signingParams) {
    try {
      const adapter = this.adapterRegistry.getAdapter(chainId);
      return await adapter.signTransaction(tx, signingParams);
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to sign transaction: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        chainId,
        error
      );
    }
  }

  /**
   * Submit a transaction
   * @param {string} chainId - Chain identifier
   * @param {Object} signedTx - Signed transaction
   * @returns {Promise<Object>} Transaction result
   */
  async submitTransaction(chainId, signedTx) {
    try {
      const adapter = this.adapterRegistry.getAdapter(chainId);
      const result = await adapter.submitTransaction(signedTx);
      
      // Record transaction in database
      await this.recordTransaction(chainId, result);
      
      return result;
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to submit transaction: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        chainId,
        error
      );
    }
  }

  /**
   * Record transaction in database
   * @param {string} chainId - Chain identifier
   * @param {Object} txResult - Transaction result
   * @returns {Promise<Object>} Recorded transaction
   * @private
   */
  async recordTransaction(chainId, txResult) {
    try {
      const txRecord = {
        chainId,
        txHash: txResult.hash || txResult.id,
        fromAddress: txResult.from || txResult.source,
        toAddress: txResult.to || txResult.destination,
        value: txResult.value || txResult.amount,
        currency: txResult.currency || 'native',
        status: 'pending',
        type: txResult.type || 'transfer',
        data: txResult
      };
      
      return await this.transactionRepository.create(txRecord);
    } catch (error) {
      console.error('Failed to record transaction:', error);
      // Don't throw here to avoid affecting the main transaction flow
    }
  }
}

/**
 * Swap Operations
 * Handles swap/exchange operations
 */
class SwapOperations {
  constructor(adapterRegistry, transactionService) {
    this.adapterRegistry = adapterRegistry;
    this.transactionService = transactionService;
  }

  /**
   * Get quote for a swap
   * @param {string} sourceChainId - Source chain identifier
   * @param {string} targetChainId - Target chain identifier
   * @param {string} sourceToken - Source token address
   * @param {string} targetToken - Target token address
   * @param {string} amount - Amount to swap
   * @returns {Promise<Object>} Swap quote
   */
  async getQuote(sourceChainId, targetChainId, sourceToken, targetToken, amount) {
    // Same-chain swap
    if (sourceChainId === targetChainId) {
      try {
        const adapter = this.adapterRegistry.getAdapter(sourceChainId);
        
        // Check if adapter supports swaps
        if (typeof adapter.getSwapQuote !== 'function') {
          throw new BlockchainError(
            `Swaps not supported for chain: ${sourceChainId}`,
            ErrorCodes.NOT_SUPPORTED,
            sourceChainId
          );
        }
        
        return await adapter.getSwapQuote(sourceToken, targetToken, amount);
      } catch (error) {
        if (error instanceof BlockchainError) {
          throw error;
        }
        throw new BlockchainError(
          `Failed to get swap quote: ${error.message}`,
          ErrorCodes.UNKNOWN_ERROR,
          sourceChainId,
          error
        );
      }
    }
    
    // Cross-chain swap
    // This would typically involve a bridge or cross-chain protocol
    // Implementation would depend on the specific protocols supported
    throw new BlockchainError(
      'Cross-chain swaps not implemented yet',
      ErrorCodes.NOT_SUPPORTED,
      sourceChainId
    );
  }

  /**
   * Execute a swap
   * @param {Object} swapParams - Swap parameters
   * @returns {Promise<Object>} Swap result
   */
  async executeSwap(swapParams) {
    const { sourceChainId, targetChainId } = swapParams;
    
    // Same-chain swap
    if (sourceChainId === targetChainId) {
      try {
        const adapter = this.adapterRegistry.getAdapter(sourceChainId);
        
        // Check if adapter supports swaps
        if (typeof adapter.executeSwap !== 'function') {
          throw new BlockchainError(
            `Swaps not supported for chain: ${sourceChainId}`,
            ErrorCodes.NOT_SUPPORTED,
            sourceChainId
          );
        }
        
        return await adapter.executeSwap(swapParams);
      } catch (error) {
        if (error instanceof BlockchainError) {
          throw error;
        }
        throw new BlockchainError(
          `Failed to execute swap: ${error.message}`,
          ErrorCodes.UNKNOWN_ERROR,
          sourceChainId,
          error
        );
      }
    }
    
    // Cross-chain swap
    throw new BlockchainError(
      'Cross-chain swaps not implemented yet',
      ErrorCodes.NOT_SUPPORTED,
      sourceChainId
    );
  }
}

// Export all classes
module.exports = {
  BlockchainError,
  ErrorCodes,
  BlockchainAdapter,
  AdapterRegistry,
  ConfigurationManager,
  BlockchainService,
  WalletOperations,
  TransactionService,
  SwapOperations
};
