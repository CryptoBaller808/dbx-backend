/**
 * Enhanced Blockchain Abstraction Layer Integration - Task 3.1 Phase 4
 * 
 * This file integrates all components of the enhanced blockchain abstraction layer
 * and provides the main interface for the unified adapter system.
 */

const { EnhancedBlockchainAdapter, BlockchainError, ErrorCodes, NetworkConfiguration } = require('./enhanced-blockchain-adapter');
const { EnhancedAdapterRegistry, AdapterFactory } = require('./enhanced-adapter-registry');
const { ErrorClassificationSystem, ErrorRecoveryManager, MonitoringAndAlertingSystem } = require('./enhanced-error-handling');

/**
 * Unified Blockchain Abstraction Layer
 * Main interface for the enhanced blockchain abstraction system
 */
class UnifiedBlockchainAbstractionLayer {
  constructor(configurationManager = null) {
    this.adapterRegistry = new EnhancedAdapterRegistry(configurationManager);
    this.errorRecoveryManager = new ErrorRecoveryManager(this.adapterRegistry);
    this.monitoringSystem = new MonitoringAndAlertingSystem(this.adapterRegistry);
    this.errorClassificationSystem = new ErrorClassificationSystem();
    
    this.isInitialized = false;
    this.eventListeners = new Map();
    
    // Setup event forwarding
    this.setupEventForwarding();
  }

  /**
   * Initialize the unified blockchain abstraction layer
   */
  async initialize() {
    try {
      console.log('[UBAL] Initializing Unified Blockchain Abstraction Layer...');
      
      // Initialize adapter registry
      await this.adapterRegistry.initialize();
      
      // Register all configured adapters
      const registrationResults = await this.adapterRegistry.registerAllConfiguredAdapters();
      
      // Start monitoring
      this.monitoringSystem.startMonitoring();
      
      this.isInitialized = true;
      
      console.log('[UBAL] Initialization complete');
      console.log(`[UBAL] Registered ${registrationResults.filter(r => r.success).length} adapters`);
      
      this.emit('initialized', {
        timestamp: new Date().toISOString(),
        registrationResults
      });
      
      return {
        success: true,
        registrationResults,
        supportedChains: this.adapterRegistry.getSupportedChains()
      };
    } catch (error) {
      console.error('[UBAL] Initialization failed:', error);
      throw new BlockchainError(
        `Failed to initialize Unified Blockchain Abstraction Layer: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        'SYSTEM',
        error
      );
    }
  }

  /**
   * Setup event forwarding from components
   */
  setupEventForwarding() {
    // Forward adapter registry events
    this.adapterRegistry.on('adapterRegistered', (data) => {
      this.emit('adapterRegistered', data);
    });
    
    this.adapterRegistry.on('adapterUnregistered', (data) => {
      this.emit('adapterUnregistered', data);
    });
    
    this.adapterRegistry.on('configurationUpdated', (data) => {
      this.emit('configurationUpdated', data);
    });
  }

  /**
   * Get adapter for a specific chain with automatic error recovery
   */
  async getAdapter(chainId) {
    try {
      return await this.adapterRegistry.getOrCreateAdapter(chainId);
    } catch (error) {
      // Attempt error recovery
      const recoveryResult = await this.errorRecoveryManager.attemptRecovery(error, {
        operation: 'getAdapter',
        chainId
      });
      
      if (recoveryResult.success) {
        // Retry after recovery
        return await this.adapterRegistry.getOrCreateAdapter(chainId);
      }
      
      throw error;
    }
  }

  /**
   * Execute operation with automatic error recovery
   */
  async executeWithRecovery(operation, chainId, operationName, ...args) {
    let lastError;
    const maxAttempts = 3;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const adapter = await this.getAdapter(chainId);
        return await operation(adapter, ...args);
      } catch (error) {
        lastError = error;
        
        // Attempt recovery on non-final attempts
        if (attempt < maxAttempts) {
          const recoveryResult = await this.errorRecoveryManager.attemptRecovery(error, {
            operation: operationName,
            chainId,
            attempt
          });
          
          if (!recoveryResult.success) {
            // If recovery failed, don't retry
            break;
          }
          
          // Wait for recovery delay if specified
          if (recoveryResult.nextRetryDelay > 0) {
            await this.sleep(recoveryResult.nextRetryDelay);
          }
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Get balance with error recovery
   */
  async getBalance(chainId, address, tokenAddress = null) {
    return await this.executeWithRecovery(
      (adapter, addr, tokenAddr) => adapter.getBalance(addr, tokenAddr),
      chainId,
      'getBalance',
      address,
      tokenAddress
    );
  }

  /**
   * Get transaction with error recovery
   */
  async getTransaction(chainId, txHash) {
    return await this.executeWithRecovery(
      (adapter, hash) => adapter.getTransaction(hash),
      chainId,
      'getTransaction',
      txHash
    );
  }

  /**
   * Build transaction with error recovery
   */
  async buildTransaction(chainId, txParams) {
    return await this.executeWithRecovery(
      (adapter, params) => adapter.buildTransaction(params),
      chainId,
      'buildTransaction',
      txParams
    );
  }

  /**
   * Sign transaction with error recovery
   */
  async signTransaction(chainId, tx, signingParams) {
    return await this.executeWithRecovery(
      (adapter, transaction, params) => adapter.signTransaction(transaction, params),
      chainId,
      'signTransaction',
      tx,
      signingParams
    );
  }

  /**
   * Submit transaction with error recovery
   */
  async submitTransaction(chainId, signedTx) {
    return await this.executeWithRecovery(
      (adapter, transaction) => adapter.submitTransaction(transaction),
      chainId,
      'submitTransaction',
      signedTx
    );
  }

  /**
   * Estimate fees with error recovery
   */
  async estimateFees(chainId, txParams) {
    return await this.executeWithRecovery(
      (adapter, params) => adapter.estimateFees(params),
      chainId,
      'estimateFees',
      txParams
    );
  }

  /**
   * Connect wallet with error recovery
   */
  async connectWallet(chainId, options = {}) {
    return await this.executeWithRecovery(
      (adapter, opts) => adapter.connectWallet(opts),
      chainId,
      'connectWallet',
      options
    );
  }

  /**
   * Disconnect wallet with error recovery
   */
  async disconnectWallet(chainId) {
    return await this.executeWithRecovery(
      (adapter) => adapter.disconnectWallet(),
      chainId,
      'disconnectWallet'
    );
  }

  /**
   * Get network status with error recovery
   */
  async getNetworkStatus(chainId) {
    return await this.executeWithRecovery(
      (adapter) => adapter.getNetworkStatus(),
      chainId,
      'getNetworkStatus'
    );
  }

  /**
   * Multi-chain operations
   */
  
  /**
   * Get balances across multiple chains
   */
  async getMultiChainBalances(address, chainIds = null, tokenAddresses = {}) {
    const chains = chainIds || this.adapterRegistry.getSupportedChains();
    const results = {};
    
    const promises = chains.map(async (chainId) => {
      try {
        const tokenAddress = tokenAddresses[chainId] || null;
        const balance = await this.getBalance(chainId, address, tokenAddress);
        results[chainId] = { success: true, balance };
      } catch (error) {
        results[chainId] = { 
          success: false, 
          error: error.message,
          code: error.code 
        };
      }
    });
    
    await Promise.all(promises);
    
    return {
      address,
      chains: results,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get network status across multiple chains
   */
  async getMultiChainNetworkStatus(chainIds = null) {
    const chains = chainIds || this.adapterRegistry.getSupportedChains();
    const results = {};
    
    const promises = chains.map(async (chainId) => {
      try {
        const status = await this.getNetworkStatus(chainId);
        results[chainId] = { success: true, status };
      } catch (error) {
        results[chainId] = { 
          success: false, 
          error: error.message,
          code: error.code 
        };
      }
    });
    
    await Promise.all(promises);
    
    return {
      chains: results,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Validate addresses across multiple chains
   */
  async validateMultiChainAddresses(addresses) {
    const results = {};
    
    const promises = Object.entries(addresses).map(async ([chainId, address]) => {
      try {
        const adapter = await this.getAdapter(chainId);
        adapter.validateAddress(address);
        results[chainId] = { 
          success: true, 
          address,
          valid: true 
        };
      } catch (error) {
        results[chainId] = { 
          success: false, 
          address,
          valid: false,
          error: error.message 
        };
      }
    });
    
    await Promise.all(promises);
    
    return {
      addresses: results,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Configuration management
   */
  
  /**
   * Add new network
   */
  async addNetwork(networkConfig) {
    try {
      const chainId = await this.adapterRegistry.addNetworkConfiguration(networkConfig);
      
      // Automatically register the adapter
      await this.adapterRegistry.registerAdapter(chainId, networkConfig);
      
      this.emit('networkAdded', { chainId, config: networkConfig });
      
      return {
        success: true,
        chainId,
        message: `Network ${chainId} added and adapter registered successfully`
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to add network: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        networkConfig?.chainId || 'UNKNOWN',
        error
      );
    }
  }

  /**
   * Remove network
   */
  async removeNetwork(chainId) {
    try {
      const removed = await this.adapterRegistry.removeNetworkConfiguration(chainId);
      
      if (removed) {
        this.emit('networkRemoved', { chainId });
        return {
          success: true,
          chainId,
          message: `Network ${chainId} removed successfully`
        };
      } else {
        return {
          success: false,
          chainId,
          message: `Network ${chainId} not found`
        };
      }
    } catch (error) {
      throw new BlockchainError(
        `Failed to remove network ${chainId}: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        chainId,
        error
      );
    }
  }

  /**
   * Update network configuration
   */
  async updateNetworkConfiguration(chainId, updates) {
    try {
      const updatedConfig = await this.adapterRegistry.updateConfiguration(chainId, updates);
      
      this.emit('networkUpdated', { chainId, updates, config: updatedConfig });
      
      return {
        success: true,
        chainId,
        config: updatedConfig,
        message: `Network ${chainId} configuration updated successfully`
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to update network configuration for ${chainId}: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        chainId,
        error
      );
    }
  }

  /**
   * System status and monitoring
   */
  
  /**
   * Get comprehensive system status
   */
  async getSystemStatus() {
    try {
      const registryStatus = await this.adapterRegistry.getDetailedStatus();
      const monitoringStatus = this.monitoringSystem.getMonitoringStatus();
      const currentMetrics = this.monitoringSystem.getCurrentMetrics();
      const activeAlerts = this.monitoringSystem.getActiveAlerts();
      const recoveryStats = this.errorRecoveryManager.getRecoveryStatistics();
      
      return {
        system: {
          initialized: this.isInitialized,
          timestamp: new Date().toISOString()
        },
        registry: registryStatus,
        monitoring: monitoringStatus,
        metrics: currentMetrics,
        alerts: {
          active: activeAlerts.length,
          details: activeAlerts
        },
        recovery: recoveryStats
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to get system status: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        'SYSTEM',
        error
      );
    }
  }

  /**
   * Get supported chains
   */
  getSupportedChains() {
    return this.adapterRegistry.getSupportedChains();
  }

  /**
   * Get configured chains
   */
  getConfiguredChains() {
    return this.adapterRegistry.getConfiguredChains();
  }

  /**
   * Check if chain is supported
   */
  isChainSupported(chainId) {
    return this.adapterRegistry.isChainSupported(chainId);
  }

  /**
   * Health check for specific chain
   */
  async performHealthCheck(chainId) {
    try {
      const adapter = await this.getAdapter(chainId);
      return await adapter.healthCheck();
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        chainId
      };
    }
  }

  /**
   * Health check for all chains
   */
  async performSystemHealthCheck() {
    const chains = this.getSupportedChains();
    const results = {};
    
    const promises = chains.map(async (chainId) => {
      results[chainId] = await this.performHealthCheck(chainId);
    });
    
    await Promise.all(promises);
    
    const healthyChains = Object.values(results).filter(r => r.healthy).length;
    const totalChains = chains.length;
    const healthPercentage = totalChains > 0 ? (healthyChains / totalChains) * 100 : 0;
    
    return {
      overall: {
        healthy: healthPercentage >= 80,
        healthPercentage: Math.round(healthPercentage),
        healthyChains,
        totalChains
      },
      chains: results,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Error handling utilities
   */
  
  /**
   * Classify error
   */
  classifyError(error) {
    return this.errorClassificationSystem.classifyError(error);
  }

  /**
   * Get recovery suggestions for an error
   */
  getRecoverySuggestions(error, context = {}) {
    const classification = this.classifyError(error);
    const { recoveryStrategy } = classification.classification;
    
    return {
      classification,
      retryable: recoveryStrategy.retryable,
      maxRetries: recoveryStrategy.maxRetries,
      suggestedActions: recoveryStrategy.actions,
      userFacing: classification.classification.userFacing,
      severity: classification.classification.severity
    };
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
          console.error(`Error in UBAL event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Utility methods
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup and shutdown
   */
  async cleanup() {
    try {
      console.log('[UBAL] Cleaning up Unified Blockchain Abstraction Layer...');
      
      // Stop monitoring
      this.monitoringSystem.cleanup();
      
      // Clear recovery history
      this.errorRecoveryManager.clearRecoveryHistory();
      
      // Cleanup adapter registry
      await this.adapterRegistry.cleanup();
      
      // Clear event listeners
      this.eventListeners.clear();
      
      this.isInitialized = false;
      
      console.log('[UBAL] Cleanup complete');
    } catch (error) {
      console.error('[UBAL] Error during cleanup:', error);
    }
  }
}

/**
 * Factory function to create and initialize the Unified Blockchain Abstraction Layer
 */
async function createUnifiedBlockchainAbstractionLayer(configurationManager = null) {
  const ubal = new UnifiedBlockchainAbstractionLayer(configurationManager);
  await ubal.initialize();
  return ubal;
}

module.exports = {
  UnifiedBlockchainAbstractionLayer,
  createUnifiedBlockchainAbstractionLayer,
  EnhancedBlockchainAdapter,
  EnhancedAdapterRegistry,
  ErrorClassificationSystem,
  ErrorRecoveryManager,
  MonitoringAndAlertingSystem,
  BlockchainError,
  ErrorCodes,
  NetworkConfiguration
};

