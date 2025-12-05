/**
 * Enhanced Error Handling and Monitoring Framework - Task 3.1 Phase 3
 * 
 * This file contains the comprehensive error handling and monitoring framework
 * for the blockchain abstraction layer with advanced error classification,
 * monitoring, alerting, and recovery mechanisms.
 */

const { BlockchainError, ErrorCodes } = require('./enhanced-blockchain-adapter');

/**
 * Error Classification System
 * Provides detailed error categorization and handling strategies
 */
class ErrorClassificationSystem {
  constructor() {
    this.errorPatterns = new Map();
    this.recoveryStrategies = new Map();
    this.setupErrorPatterns();
    this.setupRecoveryStrategies();
  }

  /**
   * Setup error patterns for classification
   */
  setupErrorPatterns() {
    // Connection errors
    this.errorPatterns.set('CONNECTION_ERROR', [
      /connection.*refused/i,
      /network.*unreachable/i,
      /timeout.*connecting/i,
      /failed.*to.*connect/i,
      /connection.*reset/i,
      /socket.*hang.*up/i
    ]);

    // RPC errors
    this.errorPatterns.set('RPC_ERROR', [
      /rpc.*error/i,
      /json.*rpc.*error/i,
      /method.*not.*found/i,
      /invalid.*request/i,
      /parse.*error/i
    ]);

    // Transaction errors
    this.errorPatterns.set('TRANSACTION_FAILED', [
      /transaction.*failed/i,
      /execution.*reverted/i,
      /out.*of.*gas/i,
      /gas.*limit.*exceeded/i,
      /transaction.*underpriced/i
    ]);

    // Insufficient funds
    this.errorPatterns.set('INSUFFICIENT_FUNDS', [
      /insufficient.*funds/i,
      /insufficient.*balance/i,
      /not.*enough.*balance/i,
      /account.*balance.*too.*low/i
    ]);

    // Nonce errors
    this.errorPatterns.set('NONCE_TOO_LOW', [
      /nonce.*too.*low/i,
      /transaction.*nonce.*is.*too.*low/i
    ]);

    this.errorPatterns.set('NONCE_TOO_HIGH', [
      /nonce.*too.*high/i,
      /transaction.*nonce.*is.*too.*high/i
    ]);

    // Gas errors
    this.errorPatterns.set('INSUFFICIENT_GAS', [
      /insufficient.*gas/i,
      /gas.*required.*exceeds.*allowance/i,
      /intrinsic.*gas.*too.*low/i
    ]);

    // Rate limiting
    this.errorPatterns.set('RATE_LIMITED', [
      /rate.*limit.*exceeded/i,
      /too.*many.*requests/i,
      /request.*throttled/i,
      /quota.*exceeded/i
    ]);

    // Wallet errors
    this.errorPatterns.set('WALLET_NOT_CONNECTED', [
      /wallet.*not.*connected/i,
      /no.*wallet.*found/i,
      /wallet.*connection.*required/i
    ]);

    this.errorPatterns.set('WALLET_CONNECTION_REJECTED', [
      /user.*rejected/i,
      /connection.*rejected/i,
      /user.*denied/i,
      /cancelled.*by.*user/i
    ]);

    // Network errors
    this.errorPatterns.set('NETWORK_CONGESTION', [
      /network.*congested/i,
      /high.*network.*traffic/i,
      /mempool.*full/i
    ]);

    // Timeout errors
    this.errorPatterns.set('TIMEOUT', [
      /timeout/i,
      /request.*timed.*out/i,
      /operation.*timeout/i
    ]);
  }

  /**
   * Setup recovery strategies for different error types
   */
  setupRecoveryStrategies() {
    this.recoveryStrategies.set('CONNECTION_ERROR', {
      retryable: true,
      maxRetries: 3,
      backoffMultiplier: 2,
      baseDelay: 1000,
      strategy: 'exponential_backoff',
      actions: ['switch_rpc_endpoint', 'check_network_status']
    });

    this.recoveryStrategies.set('RPC_ERROR', {
      retryable: true,
      maxRetries: 2,
      backoffMultiplier: 1.5,
      baseDelay: 500,
      strategy: 'linear_backoff',
      actions: ['switch_rpc_endpoint', 'validate_request']
    });

    this.recoveryStrategies.set('TRANSACTION_FAILED', {
      retryable: false,
      maxRetries: 0,
      strategy: 'no_retry',
      actions: ['analyze_failure_reason', 'suggest_user_action']
    });

    this.recoveryStrategies.set('INSUFFICIENT_FUNDS', {
      retryable: false,
      maxRetries: 0,
      strategy: 'no_retry',
      actions: ['check_balance', 'suggest_funding']
    });

    this.recoveryStrategies.set('NONCE_TOO_LOW', {
      retryable: true,
      maxRetries: 1,
      baseDelay: 100,
      strategy: 'immediate_retry',
      actions: ['refresh_nonce', 'rebuild_transaction']
    });

    this.recoveryStrategies.set('NONCE_TOO_HIGH', {
      retryable: true,
      maxRetries: 1,
      baseDelay: 1000,
      strategy: 'delayed_retry',
      actions: ['wait_for_nonce_sync', 'refresh_nonce']
    });

    this.recoveryStrategies.set('INSUFFICIENT_GAS', {
      retryable: true,
      maxRetries: 1,
      baseDelay: 0,
      strategy: 'immediate_retry',
      actions: ['increase_gas_limit', 'estimate_gas']
    });

    this.recoveryStrategies.set('RATE_LIMITED', {
      retryable: true,
      maxRetries: 5,
      backoffMultiplier: 2,
      baseDelay: 2000,
      strategy: 'exponential_backoff',
      actions: ['switch_rpc_endpoint', 'implement_backoff']
    });

    this.recoveryStrategies.set('WALLET_NOT_CONNECTED', {
      retryable: false,
      maxRetries: 0,
      strategy: 'no_retry',
      actions: ['prompt_wallet_connection', 'check_wallet_availability']
    });

    this.recoveryStrategies.set('WALLET_CONNECTION_REJECTED', {
      retryable: false,
      maxRetries: 0,
      strategy: 'no_retry',
      actions: ['inform_user', 'provide_alternative_methods']
    });

    this.recoveryStrategies.set('NETWORK_CONGESTION', {
      retryable: true,
      maxRetries: 3,
      backoffMultiplier: 3,
      baseDelay: 5000,
      strategy: 'exponential_backoff',
      actions: ['increase_gas_price', 'wait_for_congestion_relief']
    });

    this.recoveryStrategies.set('TIMEOUT', {
      retryable: true,
      maxRetries: 2,
      backoffMultiplier: 1.5,
      baseDelay: 2000,
      strategy: 'linear_backoff',
      actions: ['increase_timeout', 'switch_rpc_endpoint']
    });
  }

  /**
   * Classify an error based on its message and properties
   */
  classifyError(error) {
    const errorMessage = error.message || error.toString();
    
    // Check if it's already a classified BlockchainError
    if (error instanceof BlockchainError && error.code !== ErrorCodes.UNKNOWN_ERROR) {
      return {
        code: error.code,
        classification: this.getErrorClassification(error.code),
        confidence: 1.0
      };
    }

    // Pattern matching for error classification
    for (const [errorCode, patterns] of this.errorPatterns) {
      for (const pattern of patterns) {
        if (pattern.test(errorMessage)) {
          return {
            code: errorCode,
            classification: this.getErrorClassification(errorCode),
            confidence: 0.9,
            matchedPattern: pattern.source
          };
        }
      }
    }

    // Fallback classification
    return {
      code: ErrorCodes.UNKNOWN_ERROR,
      classification: this.getErrorClassification(ErrorCodes.UNKNOWN_ERROR),
      confidence: 0.1
    };
  }

  /**
   * Get error classification details
   */
  getErrorClassification(errorCode) {
    const recoveryStrategy = this.recoveryStrategies.get(errorCode);
    
    return {
      errorCode,
      category: this.getErrorCategory(errorCode),
      severity: this.getErrorSeverity(errorCode),
      userFacing: this.isUserFacingError(errorCode),
      recoveryStrategy: recoveryStrategy || {
        retryable: false,
        maxRetries: 0,
        strategy: 'no_retry',
        actions: ['log_error', 'notify_support']
      }
    };
  }

  /**
   * Get error category
   */
  getErrorCategory(errorCode) {
    const categories = {
      'CONNECTION_ERROR': 'network',
      'CONNECTION_TIMEOUT': 'network',
      'CONNECTION_REFUSED': 'network',
      'RPC_ERROR': 'network',
      'NETWORK_ERROR': 'network',
      'NETWORK_CONGESTION': 'network',
      'RATE_LIMITED': 'network',
      'TIMEOUT': 'network',
      
      'TRANSACTION_ERROR': 'transaction',
      'TRANSACTION_FAILED': 'transaction',
      'TRANSACTION_TIMEOUT': 'transaction',
      'TRANSACTION_REVERTED': 'transaction',
      'INSUFFICIENT_GAS': 'transaction',
      'GAS_PRICE_TOO_LOW': 'transaction',
      'NONCE_TOO_LOW': 'transaction',
      'NONCE_TOO_HIGH': 'transaction',
      
      'WALLET_ERROR': 'wallet',
      'WALLET_NOT_CONNECTED': 'wallet',
      'WALLET_CONNECTION_REJECTED': 'wallet',
      'WALLET_LOCKED': 'wallet',
      'WALLET_NETWORK_MISMATCH': 'wallet',
      
      'INVALID_PARAMS': 'validation',
      'INVALID_ADDRESS': 'validation',
      'INVALID_AMOUNT': 'validation',
      'INVALID_TOKEN': 'validation',
      'INVALID_SIGNATURE': 'validation',
      
      'UNAUTHORIZED': 'authorization',
      'INSUFFICIENT_FUNDS': 'authorization',
      'INSUFFICIENT_ALLOWANCE': 'authorization',
      
      'NOT_SUPPORTED': 'feature',
      'FEATURE_DISABLED': 'feature',
      
      'TEMPORARY_UNAVAILABLE': 'system',
      'UNKNOWN_ERROR': 'system'
    };
    
    return categories[errorCode] || 'unknown';
  }

  /**
   * Get error severity level
   */
  getErrorSeverity(errorCode) {
    const severityLevels = {
      'UNKNOWN_ERROR': 'high',
      'CONNECTION_ERROR': 'medium',
      'TRANSACTION_FAILED': 'medium',
      'INSUFFICIENT_FUNDS': 'low',
      'INVALID_PARAMS': 'low',
      'WALLET_NOT_CONNECTED': 'low',
      'RATE_LIMITED': 'medium',
      'TIMEOUT': 'medium',
      'NOT_SUPPORTED': 'low'
    };
    
    return severityLevels[errorCode] || 'medium';
  }

  /**
   * Check if error should be shown to user
   */
  isUserFacingError(errorCode) {
    const userFacingErrors = [
      'INSUFFICIENT_FUNDS',
      'INVALID_ADDRESS',
      'INVALID_AMOUNT',
      'WALLET_NOT_CONNECTED',
      'WALLET_CONNECTION_REJECTED',
      'TRANSACTION_FAILED',
      'NOT_SUPPORTED',
      'NETWORK_CONGESTION'
    ];
    
    return userFacingErrors.includes(errorCode);
  }
}

/**
 * Error Recovery Manager
 * Handles automatic error recovery and retry logic
 */
class ErrorRecoveryManager {
  constructor(adapterRegistry) {
    this.adapterRegistry = adapterRegistry;
    this.classificationSystem = new ErrorClassificationSystem();
    this.recoveryAttempts = new Map();
    this.recoveryHistory = [];
  }

  /**
   * Attempt to recover from an error
   */
  async attemptRecovery(error, context = {}) {
    const classification = this.classificationSystem.classifyError(error);
    const { recoveryStrategy } = classification.classification;
    
    // Check if recovery should be attempted
    if (!recoveryStrategy.retryable) {
      return {
        success: false,
        reason: 'Error is not retryable',
        classification,
        suggestedActions: recoveryStrategy.actions
      };
    }

    // Check retry limits
    const attemptKey = this.getAttemptKey(error, context);
    const currentAttempts = this.recoveryAttempts.get(attemptKey) || 0;
    
    if (currentAttempts >= recoveryStrategy.maxRetries) {
      return {
        success: false,
        reason: 'Maximum retry attempts exceeded',
        attempts: currentAttempts,
        classification,
        suggestedActions: recoveryStrategy.actions
      };
    }

    // Increment attempt counter
    this.recoveryAttempts.set(attemptKey, currentAttempts + 1);

    try {
      // Execute recovery actions
      const recoveryResult = await this.executeRecoveryActions(
        recoveryStrategy.actions,
        error,
        context
      );

      // Apply backoff strategy
      if (currentAttempts > 0) {
        await this.applyBackoffStrategy(recoveryStrategy, currentAttempts);
      }

      // Record successful recovery
      this.recordRecoveryAttempt(error, context, classification, true, recoveryResult);

      return {
        success: true,
        attempts: currentAttempts + 1,
        classification,
        recoveryActions: recoveryResult,
        nextRetryDelay: this.calculateNextDelay(recoveryStrategy, currentAttempts + 1)
      };

    } catch (recoveryError) {
      // Record failed recovery
      this.recordRecoveryAttempt(error, context, classification, false, recoveryError);

      return {
        success: false,
        reason: 'Recovery actions failed',
        attempts: currentAttempts + 1,
        classification,
        recoveryError: recoveryError.message,
        nextRetryDelay: this.calculateNextDelay(recoveryStrategy, currentAttempts + 1)
      };
    }
  }

  /**
   * Execute recovery actions
   */
  async executeRecoveryActions(actions, error, context) {
    const results = {};

    for (const action of actions) {
      try {
        results[action] = await this.executeRecoveryAction(action, error, context);
      } catch (actionError) {
        results[action] = {
          success: false,
          error: actionError.message
        };
      }
    }

    return results;
  }

  /**
   * Execute a specific recovery action
   */
  async executeRecoveryAction(action, error, context) {
    switch (action) {
      case 'switch_rpc_endpoint':
        return await this.switchRpcEndpoint(context.chainId);
      
      case 'check_network_status':
        return await this.checkNetworkStatus(context.chainId);
      
      case 'refresh_nonce':
        return await this.refreshNonce(context.chainId, context.address);
      
      case 'increase_gas_limit':
        return await this.increaseGasLimit(context.transaction);
      
      case 'estimate_gas':
        return await this.estimateGas(context.chainId, context.transaction);
      
      case 'increase_gas_price':
        return await this.increaseGasPrice(context.transaction);
      
      case 'check_balance':
        return await this.checkBalance(context.chainId, context.address);
      
      case 'validate_request':
        return this.validateRequest(context.request);
      
      case 'increase_timeout':
        return this.increaseTimeout(context.operation);
      
      default:
        return {
          success: false,
          message: `Unknown recovery action: ${action}`
        };
    }
  }

  /**
   * Switch to next available RPC endpoint
   */
  async switchRpcEndpoint(chainId) {
    try {
      const adapter = this.adapterRegistry.getAdapter(chainId);
      const config = adapter.config;
      
      // Switch to next RPC URL
      const currentIndex = adapter.currentRpcIndex || 0;
      const nextIndex = (currentIndex + 1) % config.rpcUrls.length;
      
      if (nextIndex === currentIndex) {
        return {
          success: false,
          message: 'No alternative RPC endpoints available'
        };
      }

      adapter.currentRpcIndex = nextIndex;
      await adapter.connectToRpc(config.rpcUrls[nextIndex]);

      return {
        success: true,
        message: `Switched to RPC endpoint ${nextIndex}`,
        newEndpoint: config.rpcUrls[nextIndex]
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to switch RPC endpoint: ${error.message}`
      };
    }
  }

  /**
   * Check network status
   */
  async checkNetworkStatus(chainId) {
    try {
      const adapter = this.adapterRegistry.getAdapter(chainId);
      const status = await adapter.getNetworkStatus();
      
      return {
        success: true,
        status: status
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to check network status: ${error.message}`
      };
    }
  }

  /**
   * Refresh nonce for an address
   */
  async refreshNonce(chainId, address) {
    try {
      const adapter = this.adapterRegistry.getAdapter(chainId);
      
      // This would be implemented by the specific adapter
      if (typeof adapter.refreshNonce === 'function') {
        const nonce = await adapter.refreshNonce(address);
        return {
          success: true,
          nonce: nonce
        };
      }

      return {
        success: false,
        message: 'Nonce refresh not supported by adapter'
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to refresh nonce: ${error.message}`
      };
    }
  }

  /**
   * Increase gas limit for a transaction
   */
  async increaseGasLimit(transaction) {
    try {
      if (!transaction || !transaction.gasLimit) {
        return {
          success: false,
          message: 'No gas limit to increase'
        };
      }

      const currentGasLimit = parseInt(transaction.gasLimit);
      const newGasLimit = Math.floor(currentGasLimit * 1.2); // Increase by 20%

      return {
        success: true,
        oldGasLimit: currentGasLimit,
        newGasLimit: newGasLimit,
        increase: newGasLimit - currentGasLimit
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to increase gas limit: ${error.message}`
      };
    }
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(chainId, transaction) {
    try {
      const adapter = this.adapterRegistry.getAdapter(chainId);
      const gasEstimate = await adapter.estimateFees(transaction);
      
      return {
        success: true,
        gasEstimate: gasEstimate
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to estimate gas: ${error.message}`
      };
    }
  }

  /**
   * Increase gas price for a transaction
   */
  async increaseGasPrice(transaction) {
    try {
      if (!transaction) {
        return {
          success: false,
          message: 'No transaction to modify'
        };
      }

      const result = {};

      if (transaction.gasPrice) {
        const currentGasPrice = parseInt(transaction.gasPrice);
        const newGasPrice = Math.floor(currentGasPrice * 1.1); // Increase by 10%
        result.gasPrice = {
          old: currentGasPrice,
          new: newGasPrice
        };
      }

      if (transaction.maxFeePerGas) {
        const currentMaxFee = parseInt(transaction.maxFeePerGas);
        const newMaxFee = Math.floor(currentMaxFee * 1.1);
        result.maxFeePerGas = {
          old: currentMaxFee,
          new: newMaxFee
        };
      }

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to increase gas price: ${error.message}`
      };
    }
  }

  /**
   * Check balance for an address
   */
  async checkBalance(chainId, address) {
    try {
      const adapter = this.adapterRegistry.getAdapter(chainId);
      const balance = await adapter.getBalance(address);
      
      return {
        success: true,
        balance: balance
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to check balance: ${error.message}`
      };
    }
  }

  /**
   * Validate request parameters
   */
  validateRequest(request) {
    try {
      // Basic request validation
      if (!request) {
        return {
          success: false,
          message: 'Request is null or undefined'
        };
      }

      if (typeof request !== 'object') {
        return {
          success: false,
          message: 'Request must be an object'
        };
      }

      return {
        success: true,
        message: 'Request validation passed'
      };
    } catch (error) {
      return {
        success: false,
        message: `Request validation failed: ${error.message}`
      };
    }
  }

  /**
   * Increase timeout for an operation
   */
  increaseTimeout(operation) {
    try {
      if (!operation || !operation.timeout) {
        return {
          success: false,
          message: 'No timeout to increase'
        };
      }

      const currentTimeout = operation.timeout;
      const newTimeout = Math.min(currentTimeout * 1.5, 120000); // Max 2 minutes

      return {
        success: true,
        oldTimeout: currentTimeout,
        newTimeout: newTimeout,
        increase: newTimeout - currentTimeout
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to increase timeout: ${error.message}`
      };
    }
  }

  /**
   * Apply backoff strategy
   */
  async applyBackoffStrategy(recoveryStrategy, attemptNumber) {
    const { strategy, baseDelay, backoffMultiplier } = recoveryStrategy;
    let delay = baseDelay || 1000;

    switch (strategy) {
      case 'exponential_backoff':
        delay = baseDelay * Math.pow(backoffMultiplier || 2, attemptNumber - 1);
        break;
      
      case 'linear_backoff':
        delay = baseDelay * (backoffMultiplier || 1.5) * attemptNumber;
        break;
      
      case 'fixed_delay':
        delay = baseDelay;
        break;
      
      case 'immediate_retry':
        delay = 0;
        break;
      
      default:
        delay = baseDelay;
    }

    // Cap maximum delay
    delay = Math.min(delay, recoveryStrategy.maxDelay || 30000);

    if (delay > 0) {
      await this.sleep(delay);
    }

    return delay;
  }

  /**
   * Calculate next retry delay
   */
  calculateNextDelay(recoveryStrategy, attemptNumber) {
    const { strategy, baseDelay, backoffMultiplier } = recoveryStrategy;
    let delay = baseDelay || 1000;

    switch (strategy) {
      case 'exponential_backoff':
        delay = baseDelay * Math.pow(backoffMultiplier || 2, attemptNumber);
        break;
      
      case 'linear_backoff':
        delay = baseDelay * (backoffMultiplier || 1.5) * (attemptNumber + 1);
        break;
      
      case 'fixed_delay':
        delay = baseDelay;
        break;
      
      case 'immediate_retry':
        delay = 0;
        break;
      
      default:
        delay = baseDelay;
    }

    return Math.min(delay, recoveryStrategy.maxDelay || 30000);
  }

  /**
   * Generate attempt key for tracking
   */
  getAttemptKey(error, context) {
    const errorType = error.code || error.name || 'unknown';
    const chainId = context.chainId || 'unknown';
    const operation = context.operation || 'unknown';
    
    return `${chainId}:${operation}:${errorType}`;
  }

  /**
   * Record recovery attempt
   */
  recordRecoveryAttempt(error, context, classification, success, result) {
    const record = {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        code: error.code,
        type: error.name
      },
      context,
      classification,
      success,
      result,
      attemptKey: this.getAttemptKey(error, context)
    };

    this.recoveryHistory.push(record);

    // Keep only last 1000 records
    if (this.recoveryHistory.length > 1000) {
      this.recoveryHistory = this.recoveryHistory.slice(-1000);
    }
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStatistics() {
    const stats = {
      totalAttempts: this.recoveryHistory.length,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      errorTypeStats: {},
      chainStats: {},
      operationStats: {}
    };

    this.recoveryHistory.forEach(record => {
      if (record.success) {
        stats.successfulRecoveries++;
      } else {
        stats.failedRecoveries++;
      }

      // Error type stats
      const errorCode = record.classification.classification.errorCode;
      stats.errorTypeStats[errorCode] = (stats.errorTypeStats[errorCode] || 0) + 1;

      // Chain stats
      const chainId = record.context.chainId || 'unknown';
      stats.chainStats[chainId] = (stats.chainStats[chainId] || 0) + 1;

      // Operation stats
      const operation = record.context.operation || 'unknown';
      stats.operationStats[operation] = (stats.operationStats[operation] || 0) + 1;
    });

    stats.successRate = stats.totalAttempts > 0 
      ? (stats.successfulRecoveries / stats.totalAttempts * 100).toFixed(2)
      : 0;

    return stats;
  }

  /**
   * Clear recovery history
   */
  clearRecoveryHistory() {
    this.recoveryHistory = [];
    this.recoveryAttempts.clear();
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Monitoring and Alerting System
 * Provides comprehensive monitoring and alerting for the blockchain abstraction layer
 */
class MonitoringAndAlertingSystem {
  constructor(adapterRegistry) {
    this.adapterRegistry = adapterRegistry;
    this.errorClassificationSystem = new ErrorClassificationSystem();
    this.metrics = new Map();
    this.alerts = [];
    this.alertThresholds = new Map();
    this.monitoringInterval = 30000; // 30 seconds
    this.intervalId = null;
    this.setupDefaultThresholds();
  }

  /**
   * Setup default alert thresholds
   */
  setupDefaultThresholds() {
    this.alertThresholds.set('error_rate', {
      warning: 5, // 5% error rate
      critical: 10 // 10% error rate
    });

    this.alertThresholds.set('response_time', {
      warning: 5000, // 5 seconds
      critical: 10000 // 10 seconds
    });

    this.alertThresholds.set('connection_failures', {
      warning: 3, // 3 failures in monitoring period
      critical: 5 // 5 failures in monitoring period
    });

    this.alertThresholds.set('adapter_health', {
      warning: 80, // 80% healthy adapters
      critical: 50 // 50% healthy adapters
    });
  }

  /**
   * Start monitoring
   */
  startMonitoring() {
    if (this.intervalId) return;

    this.intervalId = setInterval(async () => {
      await this.performMonitoringCheck();
    }, this.monitoringInterval);

    console.log('Started blockchain abstraction layer monitoring');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Stopped blockchain abstraction layer monitoring');
    }
  }

  /**
   * Perform monitoring check
   */
  async performMonitoringCheck() {
    try {
      const timestamp = new Date().toISOString();
      
      // Collect metrics from all adapters
      const adapterMetrics = await this.collectAdapterMetrics();
      
      // Calculate aggregate metrics
      const aggregateMetrics = this.calculateAggregateMetrics(adapterMetrics);
      
      // Store metrics
      this.metrics.set(timestamp, {
        adapters: adapterMetrics,
        aggregate: aggregateMetrics
      });

      // Check for alerts
      await this.checkAlertConditions(aggregateMetrics);

      // Cleanup old metrics (keep last 24 hours)
      this.cleanupOldMetrics();

    } catch (error) {
      console.error('Error during monitoring check:', error);
    }
  }

  /**
   * Collect metrics from all adapters
   */
  async collectAdapterMetrics() {
    const metrics = {};
    const supportedChains = this.adapterRegistry.getSupportedChains();
    let activeAdapterCount = 0;

    for (const chainId of supportedChains) {
      try {
        const adapter = this.adapterRegistry.getAdapter(chainId);
        
        // Check if adapter is a stub (doesn't implement connectToRpc)
        const isStub = adapter.connectToRpc.toString().includes('must be implemented by subclass');
        
        if (isStub) {
          // Skip stub adapters - don't mark as failed
          metrics[chainId] = {
            health: { healthy: true, isStub: true },
            performance: null,
            config: {
              name: adapter.config.name,
              type: adapter.config.type,
              isMainnet: adapter.config.isMainnet,
              isStub: true
            }
          };
          continue;
        }
        
        activeAdapterCount++;
        const healthCheck = await adapter.healthCheck();
        const performanceMetrics = adapter.performanceMonitor.getMetrics();

        metrics[chainId] = {
          health: healthCheck,
          performance: performanceMetrics,
          config: {
            name: adapter.config.name,
            type: adapter.config.type,
            isMainnet: adapter.config.isMainnet,
            isStub: false
          }
        };
      } catch (error) {
        activeAdapterCount++;
        metrics[chainId] = {
          health: { healthy: false, error: error.message },
          performance: null,
          config: null
        };
      }
    }
    
    // Store active adapter count for stub mode detection
    this.activeAdapterCount = activeAdapterCount;

    return metrics;
  }

  /**
   * Calculate aggregate metrics
   */
  calculateAggregateMetrics(adapterMetrics) {
    const chains = Object.keys(adapterMetrics);
    
    // Filter out stub adapters from health calculations
    const activeChains = chains.filter(chainId => 
      !adapterMetrics[chainId].config?.isStub
    );
    
    const healthyChains = activeChains.filter(chainId => 
      adapterMetrics[chainId].health.healthy
    );

    let totalOperations = 0;
    let totalErrors = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    activeChains.forEach(chainId => {
      const performance = adapterMetrics[chainId].performance;
      if (performance) {
        totalOperations += performance.totalOperations || 0;
        totalErrors += performance.failedOperations || 0;
        
        if (performance.averageResponseTime) {
          totalResponseTime += performance.averageResponseTime;
          responseTimeCount++;
        }
      }
    });

    const errorRate = totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0;
    const averageResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;
    const healthPercentage = activeChains.length > 0 ? (healthyChains.length / activeChains.length) * 100 : 0;

    return {
      totalChains: chains.length,
      activeChains: activeChains.length,
      healthyChains: healthyChains.length,
      isStubMode: activeChains.length === 0,
      healthPercentage: Math.round(healthPercentage),
      totalOperations,
      totalErrors,
      errorRate: Math.round(errorRate * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Check alert conditions
   */
  async checkAlertConditions(metrics) {
    const alerts = [];
    
    // Skip alerts if in stub mode (no active adapters)
    if (metrics.isStubMode) {
      console.log('[UBAL] No active adapters — skipping health monitor (stub mode).');
      return;
    }

    // Check error rate
    const errorRateThreshold = this.alertThresholds.get('error_rate');
    if (metrics.errorRate >= errorRateThreshold.critical) {
      alerts.push({
        type: 'error_rate',
        severity: 'critical',
        message: `Critical error rate: ${metrics.errorRate}%`,
        value: metrics.errorRate,
        threshold: errorRateThreshold.critical
      });
    } else if (metrics.errorRate >= errorRateThreshold.warning) {
      alerts.push({
        type: 'error_rate',
        severity: 'warning',
        message: `High error rate: ${metrics.errorRate}%`,
        value: metrics.errorRate,
        threshold: errorRateThreshold.warning
      });
    }

    // Check response time
    const responseTimeThreshold = this.alertThresholds.get('response_time');
    if (metrics.averageResponseTime >= responseTimeThreshold.critical) {
      alerts.push({
        type: 'response_time',
        severity: 'critical',
        message: `Critical response time: ${metrics.averageResponseTime}ms`,
        value: metrics.averageResponseTime,
        threshold: responseTimeThreshold.critical
      });
    } else if (metrics.averageResponseTime >= responseTimeThreshold.warning) {
      alerts.push({
        type: 'response_time',
        severity: 'warning',
        message: `High response time: ${metrics.averageResponseTime}ms`,
        value: metrics.averageResponseTime,
        threshold: responseTimeThreshold.warning
      });
    }

    // Check adapter health
    const healthThreshold = this.alertThresholds.get('adapter_health');
    if (metrics.healthPercentage <= healthThreshold.critical) {
      alerts.push({
        type: 'adapter_health',
        severity: 'critical',
        message: `Critical adapter health: ${metrics.healthPercentage}% healthy`,
        value: metrics.healthPercentage,
        threshold: healthThreshold.critical
      });
    } else if (metrics.healthPercentage <= healthThreshold.warning) {
      alerts.push({
        type: 'adapter_health',
        severity: 'warning',
        message: `Low adapter health: ${metrics.healthPercentage}% healthy`,
        value: metrics.healthPercentage,
        threshold: healthThreshold.warning
      });
    }

    // Process alerts
    for (const alert of alerts) {
      await this.processAlert(alert);
    }
  }

  /**
   * Process an alert
   */
  async processAlert(alert) {
    const alertRecord = {
      ...alert,
      id: this.generateAlertId(),
      timestamp: new Date().toISOString(),
      acknowledged: false
    };

    this.alerts.push(alertRecord);

    // Log alert
    console.warn(`BLOCKCHAIN ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);

    // Trigger alert handlers
    await this.triggerAlertHandlers(alertRecord);

    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }
  }

  /**
   * Trigger alert handlers
   */
  async triggerAlertHandlers(alert) {
    // This would integrate with external alerting systems
    // For now, just log the alert
    
    if (alert.severity === 'critical') {
      // Could send to PagerDuty, Slack, email, etc.
      console.error(`CRITICAL ALERT: ${alert.message}`);
    }
  }

  /**
   * Generate alert ID
   */
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup old metrics
   */
  cleanupOldMetrics() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [timestamp] of this.metrics) {
      if (new Date(timestamp).getTime() < cutoffTime) {
        this.metrics.delete(timestamp);
      }
    }
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics() {
    const timestamps = Array.from(this.metrics.keys()).sort();
    const latestTimestamp = timestamps[timestamps.length - 1];
    
    return latestTimestamp ? this.metrics.get(latestTimestamp) : null;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(hours = 1) {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    const history = [];

    for (const [timestamp, metrics] of this.metrics) {
      if (new Date(timestamp).getTime() >= cutoffTime) {
        history.push({ timestamp, ...metrics });
      }
    }

    return history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    return this.alerts.filter(alert => !alert.acknowledged);
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  /**
   * Update alert threshold
   */
  updateAlertThreshold(type, thresholds) {
    this.alertThresholds.set(type, thresholds);
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus() {
    return {
      isMonitoring: this.intervalId !== null,
      monitoringInterval: this.monitoringInterval,
      totalMetricsRecords: this.metrics.size,
      totalAlerts: this.alerts.length,
      activeAlerts: this.getActiveAlerts().length,
      alertThresholds: Object.fromEntries(this.alertThresholds)
    };
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.stopMonitoring();
    this.metrics.clear();
    this.alerts = [];
  }
}

module.exports = {
  ErrorClassificationSystem,
  ErrorRecoveryManager,
  MonitoringAndAlertingSystem
};

