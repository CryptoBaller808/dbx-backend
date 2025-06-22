/**
 * Enhanced Blockchain Abstraction Layer - Task 3.1 Implementation
 * 
 * This file contains the enhanced implementation of the blockchain abstraction layer
 * with unified adapter interfaces, comprehensive error handling, and standardized
 * functionality across all supported blockchain networks.
 */

// Enhanced Error handling with more specific error types
class BlockchainError extends Error {
  constructor(message, code, chainId, originalError = null, context = {}) {
    super(message);
    this.name = 'BlockchainError';
    this.code = code;
    this.chainId = chainId;
    this.originalError = originalError;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.retryable = this.isRetryable(code);
  }

  isRetryable(code) {
    const retryableCodes = [
      'CONNECTION_ERROR',
      'TIMEOUT',
      'NETWORK_ERROR',
      'RATE_LIMITED',
      'TEMPORARY_UNAVAILABLE'
    ];
    return retryableCodes.includes(code);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      chainId: this.chainId,
      context: this.context,
      timestamp: this.timestamp,
      retryable: this.retryable,
      stack: this.stack
    };
  }
}

// Enhanced Error codes with more granular categorization
const ErrorCodes = {
  // Connection errors
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  CONNECTION_REFUSED: 'CONNECTION_REFUSED',
  RPC_ERROR: 'RPC_ERROR',
  
  // Transaction errors
  TRANSACTION_ERROR: 'TRANSACTION_ERROR',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  TRANSACTION_TIMEOUT: 'TRANSACTION_TIMEOUT',
  TRANSACTION_REVERTED: 'TRANSACTION_REVERTED',
  INSUFFICIENT_GAS: 'INSUFFICIENT_GAS',
  GAS_PRICE_TOO_LOW: 'GAS_PRICE_TOO_LOW',
  NONCE_TOO_LOW: 'NONCE_TOO_LOW',
  NONCE_TOO_HIGH: 'NONCE_TOO_HIGH',
  
  // Wallet errors
  WALLET_ERROR: 'WALLET_ERROR',
  WALLET_NOT_CONNECTED: 'WALLET_NOT_CONNECTED',
  WALLET_CONNECTION_REJECTED: 'WALLET_CONNECTION_REJECTED',
  WALLET_LOCKED: 'WALLET_LOCKED',
  WALLET_NETWORK_MISMATCH: 'WALLET_NETWORK_MISMATCH',
  
  // Validation errors
  INVALID_PARAMS: 'INVALID_PARAMS',
  INVALID_ADDRESS: 'INVALID_ADDRESS',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  INVALID_TOKEN: 'INVALID_TOKEN',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  
  // Authorization errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  INSUFFICIENT_ALLOWANCE: 'INSUFFICIENT_ALLOWANCE',
  
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  NETWORK_CONGESTION: 'NETWORK_CONGESTION',
  RATE_LIMITED: 'RATE_LIMITED',
  
  // Feature support errors
  NOT_SUPPORTED: 'NOT_SUPPORTED',
  FEATURE_DISABLED: 'FEATURE_DISABLED',
  
  // System errors
  TIMEOUT: 'TIMEOUT',
  TEMPORARY_UNAVAILABLE: 'TEMPORARY_UNAVAILABLE',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * Network Configuration Schema
 * Standardized configuration structure for all blockchain networks
 */
class NetworkConfiguration {
  constructor(config) {
    this.chainId = config.chainId;
    this.name = config.name;
    this.type = config.type; // 'evm', 'solana', 'xrp', 'stellar', etc.
    this.isMainnet = config.isMainnet || false;
    this.isTestnet = config.isTestnet || false;
    
    // Network endpoints
    this.rpcUrls = config.rpcUrls || [];
    this.wsUrls = config.wsUrls || [];
    this.explorerUrls = config.explorerUrls || [];
    
    // Native currency
    this.nativeCurrency = {
      name: config.nativeCurrency?.name || '',
      symbol: config.nativeCurrency?.symbol || '',
      decimals: config.nativeCurrency?.decimals || 18
    };
    
    // Network-specific settings
    this.blockTime = config.blockTime || 15000; // milliseconds
    this.confirmations = config.confirmations || 1;
    this.gasSettings = config.gasSettings || {};
    this.feeSettings = config.feeSettings || {};
    
    // Feature flags
    this.features = {
      smartContracts: config.features?.smartContracts || false,
      nativeSwaps: config.features?.nativeSwaps || false,
      nfts: config.features?.nfts || false,
      staking: config.features?.staking || false,
      governance: config.features?.governance || false,
      ...config.features
    };
    
    // Connection settings
    this.connectionSettings = {
      timeout: config.connectionSettings?.timeout || 30000,
      retryAttempts: config.connectionSettings?.retryAttempts || 3,
      retryDelay: config.connectionSettings?.retryDelay || 1000,
      ...config.connectionSettings
    };
  }

  validate() {
    if (!this.chainId) throw new Error('chainId is required');
    if (!this.name) throw new Error('name is required');
    if (!this.type) throw new Error('type is required');
    if (!this.rpcUrls.length) throw new Error('at least one RPC URL is required');
    if (!this.nativeCurrency.symbol) throw new Error('native currency symbol is required');
  }
}

/**
 * Enhanced Base Blockchain Adapter
 * Standardized interface with comprehensive functionality for all blockchain networks
 */
class EnhancedBlockchainAdapter {
  constructor(config) {
    this.config = new NetworkConfiguration(config);
    this.config.validate();
    
    this.isInitialized = false;
    this.isConnected = false;
    this.connectionPool = new Map();
    this.eventListeners = new Map();
    this.retryManager = new RetryManager(this.config.connectionSettings);
    this.performanceMonitor = new PerformanceMonitor(this.config.chainId);
    
    // Connection state
    this.lastConnectionCheck = null;
    this.connectionHealth = 'unknown';
    this.currentRpcIndex = 0;
  }

  /**
   * Initialize the adapter with necessary connections
   */
  async initialize() {
    try {
      this.performanceMonitor.startOperation('initialize');
      
      await this.establishConnection();
      await this.validateNetwork();
      await this.loadNetworkInfo();
      
      this.isInitialized = true;
      this.performanceMonitor.endOperation('initialize');
      
      this.emit('initialized', { chainId: this.config.chainId });
      return true;
    } catch (error) {
      this.performanceMonitor.endOperation('initialize', error);
      throw this.handleError(error, 'initialize');
    }
  }

  /**
   * Establish connection to the blockchain network
   */
  async establishConnection() {
    const errors = [];
    
    for (let i = 0; i < this.config.rpcUrls.length; i++) {
      try {
        this.currentRpcIndex = i;
        await this.connectToRpc(this.config.rpcUrls[i]);
        this.isConnected = true;
        this.connectionHealth = 'healthy';
        this.lastConnectionCheck = Date.now();
        return;
      } catch (error) {
        errors.push(error);
        console.warn(`Failed to connect to RPC ${i}: ${error.message}`);
      }
    }
    
    throw new BlockchainError(
      `Failed to connect to any RPC endpoint`,
      ErrorCodes.CONNECTION_ERROR,
      this.config.chainId,
      errors[0],
      { attemptedUrls: this.config.rpcUrls }
    );
  }

  /**
   * Connect to a specific RPC endpoint
   * @param {string} rpcUrl - RPC endpoint URL
   */
  async connectToRpc(rpcUrl) {
    throw new BlockchainError(
      'connectToRpc must be implemented by subclass',
      ErrorCodes.NOT_SUPPORTED,
      this.config.chainId
    );
  }

  /**
   * Validate network connection and configuration
   */
  async validateNetwork() {
    try {
      const networkInfo = await this.getNetworkInfo();
      
      // Validate chain ID matches
      if (networkInfo.chainId && networkInfo.chainId !== this.config.chainId) {
        throw new BlockchainError(
          `Chain ID mismatch: expected ${this.config.chainId}, got ${networkInfo.chainId}`,
          ErrorCodes.NETWORK_ERROR,
          this.config.chainId
        );
      }
      
      return true;
    } catch (error) {
      throw this.handleError(error, 'validateNetwork');
    }
  }

  /**
   * Load network information
   */
  async loadNetworkInfo() {
    try {
      this.networkInfo = await this.getNetworkInfo();
      return this.networkInfo;
    } catch (error) {
      throw this.handleError(error, 'loadNetworkInfo');
    }
  }

  /**
   * Get network information
   */
  async getNetworkInfo() {
    throw new BlockchainError(
      'getNetworkInfo must be implemented by subclass',
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
    try {
      this.validateAddress(address);
      this.performanceMonitor.startOperation('getBalance');
      
      const balance = await this.retryManager.execute(
        () => this._getBalance(address, tokenAddress),
        'getBalance'
      );
      
      this.performanceMonitor.endOperation('getBalance');
      return this.formatBalance(balance, tokenAddress);
    } catch (error) {
      this.performanceMonitor.endOperation('getBalance', error);
      throw this.handleError(error, 'getBalance', { address, tokenAddress });
    }
  }

  /**
   * Internal balance retrieval method (to be implemented by subclasses)
   */
  async _getBalance(address, tokenAddress = null) {
    throw new BlockchainError(
      '_getBalance must be implemented by subclass',
      ErrorCodes.NOT_SUPPORTED,
      this.config.chainId
    );
  }

  /**
   * Format balance response
   */
  formatBalance(balance, tokenAddress = null) {
    return {
      address: balance.address,
      balance: balance.balance,
      decimals: balance.decimals || this.config.nativeCurrency.decimals,
      symbol: balance.symbol || this.config.nativeCurrency.symbol,
      tokenAddress: tokenAddress,
      formatted: this.formatAmount(balance.balance, balance.decimals),
      chainId: this.config.chainId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get transaction details
   * @param {string} txHash - Transaction hash/ID
   * @returns {Promise<Object>} Transaction details
   */
  async getTransaction(txHash) {
    try {
      this.validateTransactionHash(txHash);
      this.performanceMonitor.startOperation('getTransaction');
      
      const transaction = await this.retryManager.execute(
        () => this._getTransaction(txHash),
        'getTransaction'
      );
      
      this.performanceMonitor.endOperation('getTransaction');
      return this.formatTransaction(transaction);
    } catch (error) {
      this.performanceMonitor.endOperation('getTransaction', error);
      throw this.handleError(error, 'getTransaction', { txHash });
    }
  }

  /**
   * Internal transaction retrieval method (to be implemented by subclasses)
   */
  async _getTransaction(txHash) {
    throw new BlockchainError(
      '_getTransaction must be implemented by subclass',
      ErrorCodes.NOT_SUPPORTED,
      this.config.chainId
    );
  }

  /**
   * Format transaction response
   */
  formatTransaction(transaction) {
    return {
      hash: transaction.hash || transaction.id,
      from: transaction.from || transaction.source,
      to: transaction.to || transaction.destination,
      value: transaction.value || transaction.amount,
      fee: transaction.fee || transaction.gas,
      status: transaction.status || 'unknown',
      blockNumber: transaction.blockNumber || transaction.ledger,
      timestamp: transaction.timestamp,
      confirmations: transaction.confirmations || 0,
      chainId: this.config.chainId,
      raw: transaction
    };
  }

  /**
   * Build a transaction object
   * @param {Object} txParams - Transaction parameters
   * @returns {Promise<Object>} Unsigned transaction
   */
  async buildTransaction(txParams) {
    try {
      this.validateTransactionParams(txParams);
      this.performanceMonitor.startOperation('buildTransaction');
      
      const transaction = await this._buildTransaction(txParams);
      
      this.performanceMonitor.endOperation('buildTransaction');
      return this.formatUnsignedTransaction(transaction);
    } catch (error) {
      this.performanceMonitor.endOperation('buildTransaction', error);
      throw this.handleError(error, 'buildTransaction', { txParams });
    }
  }

  /**
   * Internal transaction building method (to be implemented by subclasses)
   */
  async _buildTransaction(txParams) {
    throw new BlockchainError(
      '_buildTransaction must be implemented by subclass',
      ErrorCodes.NOT_SUPPORTED,
      this.config.chainId
    );
  }

  /**
   * Format unsigned transaction
   */
  formatUnsignedTransaction(transaction) {
    return {
      ...transaction,
      chainId: this.config.chainId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Sign a transaction
   * @param {Object} tx - Unsigned transaction
   * @param {Object} signingParams - Parameters for signing
   * @returns {Promise<Object>} Signed transaction
   */
  async signTransaction(tx, signingParams) {
    try {
      this.validateUnsignedTransaction(tx);
      this.performanceMonitor.startOperation('signTransaction');
      
      const signedTx = await this._signTransaction(tx, signingParams);
      
      this.performanceMonitor.endOperation('signTransaction');
      return this.formatSignedTransaction(signedTx);
    } catch (error) {
      this.performanceMonitor.endOperation('signTransaction', error);
      throw this.handleError(error, 'signTransaction', { tx, signingParams });
    }
  }

  /**
   * Internal transaction signing method (to be implemented by subclasses)
   */
  async _signTransaction(tx, signingParams) {
    throw new BlockchainError(
      '_signTransaction must be implemented by subclass',
      ErrorCodes.NOT_SUPPORTED,
      this.config.chainId
    );
  }

  /**
   * Format signed transaction
   */
  formatSignedTransaction(signedTx) {
    return {
      ...signedTx,
      chainId: this.config.chainId,
      signedAt: new Date().toISOString()
    };
  }

  /**
   * Submit a signed transaction
   * @param {Object} signedTx - Signed transaction
   * @returns {Promise<Object>} Transaction result
   */
  async submitTransaction(signedTx) {
    try {
      this.validateSignedTransaction(signedTx);
      this.performanceMonitor.startOperation('submitTransaction');
      
      const result = await this._submitTransaction(signedTx);
      
      this.performanceMonitor.endOperation('submitTransaction');
      this.emit('transactionSubmitted', result);
      
      return this.formatTransactionResult(result);
    } catch (error) {
      this.performanceMonitor.endOperation('submitTransaction', error);
      throw this.handleError(error, 'submitTransaction', { signedTx });
    }
  }

  /**
   * Internal transaction submission method (to be implemented by subclasses)
   */
  async _submitTransaction(signedTx) {
    throw new BlockchainError(
      '_submitTransaction must be implemented by subclass',
      ErrorCodes.NOT_SUPPORTED,
      this.config.chainId
    );
  }

  /**
   * Format transaction result
   */
  formatTransactionResult(result) {
    return {
      hash: result.hash || result.id,
      status: 'submitted',
      chainId: this.config.chainId,
      submittedAt: new Date().toISOString(),
      ...result
    };
  }

  /**
   * Estimate transaction fees
   * @param {Object} txParams - Transaction parameters
   * @returns {Promise<Object>} Fee estimation
   */
  async estimateFees(txParams) {
    try {
      this.validateTransactionParams(txParams);
      this.performanceMonitor.startOperation('estimateFees');
      
      const fees = await this._estimateFees(txParams);
      
      this.performanceMonitor.endOperation('estimateFees');
      return this.formatFeeEstimation(fees);
    } catch (error) {
      this.performanceMonitor.endOperation('estimateFees', error);
      throw this.handleError(error, 'estimateFees', { txParams });
    }
  }

  /**
   * Internal fee estimation method (to be implemented by subclasses)
   */
  async _estimateFees(txParams) {
    throw new BlockchainError(
      '_estimateFees must be implemented by subclass',
      ErrorCodes.NOT_SUPPORTED,
      this.config.chainId
    );
  }

  /**
   * Format fee estimation
   */
  formatFeeEstimation(fees) {
    return {
      ...fees,
      chainId: this.config.chainId,
      estimatedAt: new Date().toISOString()
    };
  }

  /**
   * Connect to a wallet
   * @param {Object} options - Connection options
   * @returns {Promise<Object>} Connection result
   */
  async connectWallet(options = {}) {
    try {
      this.performanceMonitor.startOperation('connectWallet');
      
      const connection = await this._connectWallet(options);
      
      this.performanceMonitor.endOperation('connectWallet');
      this.emit('walletConnected', connection);
      
      return this.formatWalletConnection(connection);
    } catch (error) {
      this.performanceMonitor.endOperation('connectWallet', error);
      throw this.handleError(error, 'connectWallet', { options });
    }
  }

  /**
   * Internal wallet connection method (to be implemented by subclasses)
   */
  async _connectWallet(options) {
    throw new BlockchainError(
      '_connectWallet must be implemented by subclass',
      ErrorCodes.NOT_SUPPORTED,
      this.config.chainId
    );
  }

  /**
   * Format wallet connection result
   */
  formatWalletConnection(connection) {
    return {
      ...connection,
      chainId: this.config.chainId,
      connectedAt: new Date().toISOString()
    };
  }

  /**
   * Disconnect from wallet
   * @returns {Promise<boolean>} Success indicator
   */
  async disconnectWallet() {
    try {
      this.performanceMonitor.startOperation('disconnectWallet');
      
      const result = await this._disconnectWallet();
      
      this.performanceMonitor.endOperation('disconnectWallet');
      this.emit('walletDisconnected', { chainId: this.config.chainId });
      
      return result;
    } catch (error) {
      this.performanceMonitor.endOperation('disconnectWallet', error);
      throw this.handleError(error, 'disconnectWallet');
    }
  }

  /**
   * Internal wallet disconnection method (to be implemented by subclasses)
   */
  async _disconnectWallet() {
    throw new BlockchainError(
      '_disconnectWallet must be implemented by subclass',
      ErrorCodes.NOT_SUPPORTED,
      this.config.chainId
    );
  }

  /**
   * Get network status
   * @returns {Promise<Object>} Network status
   */
  async getNetworkStatus() {
    try {
      this.performanceMonitor.startOperation('getNetworkStatus');
      
      const status = await this._getNetworkStatus();
      
      this.performanceMonitor.endOperation('getNetworkStatus');
      return this.formatNetworkStatus(status);
    } catch (error) {
      this.performanceMonitor.endOperation('getNetworkStatus', error);
      throw this.handleError(error, 'getNetworkStatus');
    }
  }

  /**
   * Internal network status method (to be implemented by subclasses)
   */
  async _getNetworkStatus() {
    throw new BlockchainError(
      '_getNetworkStatus must be implemented by subclass',
      ErrorCodes.NOT_SUPPORTED,
      this.config.chainId
    );
  }

  /**
   * Format network status
   */
  formatNetworkStatus(status) {
    return {
      chainId: this.config.chainId,
      networkName: this.config.name,
      isConnected: this.isConnected,
      connectionHealth: this.connectionHealth,
      lastConnectionCheck: this.lastConnectionCheck,
      currentRpcUrl: this.config.rpcUrls[this.currentRpcIndex],
      ...status,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Validation methods
   */
  validateAddress(address) {
    if (!address || typeof address !== 'string') {
      throw new BlockchainError(
        'Invalid address: must be a non-empty string',
        ErrorCodes.INVALID_ADDRESS,
        this.config.chainId
      );
    }
    // Subclasses should override with network-specific validation
  }

  validateTransactionHash(txHash) {
    if (!txHash || typeof txHash !== 'string') {
      throw new BlockchainError(
        'Invalid transaction hash: must be a non-empty string',
        ErrorCodes.INVALID_PARAMS,
        this.config.chainId
      );
    }
    // Subclasses should override with network-specific validation
  }

  validateTransactionParams(txParams) {
    if (!txParams || typeof txParams !== 'object') {
      throw new BlockchainError(
        'Invalid transaction parameters: must be an object',
        ErrorCodes.INVALID_PARAMS,
        this.config.chainId
      );
    }
    // Subclasses should override with network-specific validation
  }

  validateUnsignedTransaction(tx) {
    if (!tx || typeof tx !== 'object') {
      throw new BlockchainError(
        'Invalid unsigned transaction: must be an object',
        ErrorCodes.INVALID_PARAMS,
        this.config.chainId
      );
    }
    // Subclasses should override with network-specific validation
  }

  validateSignedTransaction(signedTx) {
    if (!signedTx || typeof signedTx !== 'object') {
      throw new BlockchainError(
        'Invalid signed transaction: must be an object',
        ErrorCodes.INVALID_PARAMS,
        this.config.chainId
      );
    }
    // Subclasses should override with network-specific validation
  }

  /**
   * Utility methods
   */
  formatAmount(amount, decimals = 18) {
    if (!amount) return '0';
    
    const divisor = Math.pow(10, decimals);
    const formatted = (parseFloat(amount) / divisor).toString();
    
    return formatted;
  }

  parseAmount(amount, decimals = 18) {
    if (!amount) return '0';
    
    const multiplier = Math.pow(10, decimals);
    const parsed = (parseFloat(amount) * multiplier).toString();
    
    return parsed;
  }

  /**
   * Error handling
   */
  handleError(error, operation, context = {}) {
    if (error instanceof BlockchainError) {
      error.context = { ...error.context, operation, ...context };
      return error;
    }

    // Categorize unknown errors
    let errorCode = ErrorCodes.UNKNOWN_ERROR;
    
    if (error.message.includes('timeout')) {
      errorCode = ErrorCodes.TIMEOUT;
    } else if (error.message.includes('network') || error.message.includes('connection')) {
      errorCode = ErrorCodes.NETWORK_ERROR;
    } else if (error.message.includes('insufficient funds')) {
      errorCode = ErrorCodes.INSUFFICIENT_FUNDS;
    } else if (error.message.includes('invalid address')) {
      errorCode = ErrorCodes.INVALID_ADDRESS;
    }

    return new BlockchainError(
      `${operation} failed: ${error.message}`,
      errorCode,
      this.config.chainId,
      error,
      { operation, ...context }
    );
  }

  /**
   * Event system
   */
  on(event, listener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(listener);
  }

  off(event, listener) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const status = await this.getNetworkStatus();
      return {
        healthy: this.isConnected && this.connectionHealth === 'healthy',
        status: status,
        performance: this.performanceMonitor.getMetrics()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        status: null,
        performance: this.performanceMonitor.getMetrics()
      };
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      await this.disconnectWallet();
      this.eventListeners.clear();
      this.connectionPool.clear();
      this.isInitialized = false;
      this.isConnected = false;
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

/**
 * Retry Manager
 * Handles retry logic for failed operations
 */
class RetryManager {
  constructor(settings) {
    this.maxAttempts = settings.retryAttempts || 3;
    this.baseDelay = settings.retryDelay || 1000;
    this.maxDelay = settings.maxRetryDelay || 10000;
  }

  async execute(operation, operationName) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry if error is not retryable
        if (error instanceof BlockchainError && !error.retryable) {
          throw error;
        }
        
        // Don't retry on last attempt
        if (attempt === this.maxAttempts) {
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.baseDelay * Math.pow(2, attempt - 1),
          this.maxDelay
        );
        
        console.warn(
          `${operationName} attempt ${attempt} failed, retrying in ${delay}ms:`,
          error.message
        );
        
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Performance Monitor
 * Tracks performance metrics for adapter operations
 */
class PerformanceMonitor {
  constructor(chainId) {
    this.chainId = chainId;
    this.operations = new Map();
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageResponseTime: 0,
      operationCounts: {},
      errorCounts: {}
    };
  }

  startOperation(operationName) {
    const operationId = `${operationName}_${Date.now()}_${Math.random()}`;
    this.operations.set(operationId, {
      name: operationName,
      startTime: Date.now()
    });
    return operationId;
  }

  endOperation(operationName, error = null) {
    const operation = Array.from(this.operations.values())
      .find(op => op.name === operationName);
    
    if (!operation) return;
    
    const duration = Date.now() - operation.startTime;
    
    // Update metrics
    this.metrics.totalOperations++;
    
    if (error) {
      this.metrics.failedOperations++;
      this.metrics.errorCounts[error.code || 'UNKNOWN'] = 
        (this.metrics.errorCounts[error.code || 'UNKNOWN'] || 0) + 1;
    } else {
      this.metrics.successfulOperations++;
    }
    
    this.metrics.operationCounts[operationName] = 
      (this.metrics.operationCounts[operationName] || 0) + 1;
    
    // Update average response time
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalOperations - 1) + duration) / 
      this.metrics.totalOperations;
    
    // Clean up operation tracking
    this.operations.delete(
      Array.from(this.operations.keys())
        .find(key => this.operations.get(key) === operation)
    );
  }

  getMetrics() {
    return {
      chainId: this.chainId,
      ...this.metrics,
      timestamp: new Date().toISOString()
    };
  }

  reset() {
    this.operations.clear();
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageResponseTime: 0,
      operationCounts: {},
      errorCounts: {}
    };
  }
}

module.exports = {
  EnhancedBlockchainAdapter,
  BlockchainError,
  ErrorCodes,
  NetworkConfiguration,
  RetryManager,
  PerformanceMonitor
};

