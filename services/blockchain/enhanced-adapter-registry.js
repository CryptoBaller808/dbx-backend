/**
 * Enhanced Adapter Registry and Configuration System - Task 3.1 Phase 2
 * 
 * This file contains the enhanced adapter registry system that manages all blockchain
 * adapters with dynamic loading, configuration management, and health monitoring.
 */

const { EnhancedBlockchainAdapter, BlockchainError, ErrorCodes, NetworkConfiguration } = require('./enhanced-blockchain-adapter');

/**
 * Adapter Factory
 * Creates and configures blockchain adapters based on network type
 */
class AdapterFactory {
  constructor() {
    this.adapterClasses = new Map();
    this.defaultConfigurations = new Map();
    this.registerBuiltInAdapters();
  }

  /**
   * Register built-in adapter classes
   */
  registerBuiltInAdapters() {
    // Register adapter classes for different blockchain types
    // These would be imported from their respective files
    
    // EVM-compatible adapters
    this.registerAdapterClass('evm', 'EVMAdapter');
    
    // Native protocol adapters
    this.registerAdapterClass('solana', 'SolanaAdapter');
    this.registerAdapterClass('xrp', 'XRPAdapter');
    this.registerAdapterClass('stellar', 'StellarAdapter');
    
    // Set up default configurations
    this.setupDefaultConfigurations();
  }

  /**
   * Register an adapter class for a specific network type
   */
  registerAdapterClass(networkType, adapterClassName) {
    this.adapterClasses.set(networkType, adapterClassName);
  }

  /**
   * Setup default configurations for different network types
   */
  setupDefaultConfigurations() {
    // EVM networks default configuration
    this.defaultConfigurations.set('evm', {
      type: 'evm',
      features: {
        smartContracts: true,
        nativeSwaps: false,
        nfts: true,
        staking: false,
        governance: false
      },
      connectionSettings: {
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        maxRetryDelay: 10000
      },
      gasSettings: {
        gasLimit: 21000,
        maxFeePerGas: '20000000000', // 20 gwei
        maxPriorityFeePerGas: '2000000000' // 2 gwei
      }
    });

    // Solana default configuration
    this.defaultConfigurations.set('solana', {
      type: 'solana',
      features: {
        smartContracts: true,
        nativeSwaps: true,
        nfts: true,
        staking: true,
        governance: true
      },
      connectionSettings: {
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        commitment: 'confirmed'
      },
      feeSettings: {
        priorityFee: 0,
        computeUnitLimit: 200000
      }
    });

    // XRP default configuration
    this.defaultConfigurations.set('xrp', {
      type: 'xrp',
      features: {
        smartContracts: false,
        nativeSwaps: true,
        nfts: true,
        staking: false,
        governance: false
      },
      connectionSettings: {
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000
      },
      feeSettings: {
        baseFee: '12', // drops
        reserveBase: '10000000', // 10 XRP in drops
        reserveIncrement: '2000000' // 2 XRP in drops
      }
    });

    // Stellar default configuration
    this.defaultConfigurations.set('stellar', {
      type: 'stellar',
      features: {
        smartContracts: true,
        nativeSwaps: true,
        nfts: false,
        staking: false,
        governance: false
      },
      connectionSettings: {
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000
      },
      feeSettings: {
        baseFee: '100', // stroops
        baseReserve: '5000000' // 0.5 XLM in stroops
      }
    });
  }

  /**
   * Create an adapter instance
   */
  async createAdapter(networkConfig) {
    try {
      const config = new NetworkConfiguration(networkConfig);
      const defaultConfig = this.defaultConfigurations.get(config.type);
      
      if (!defaultConfig) {
        throw new BlockchainError(
          `No default configuration found for network type: ${config.type}`,
          ErrorCodes.NOT_SUPPORTED,
          config.chainId
        );
      }

      // Merge default configuration with provided configuration
      const mergedConfig = this.mergeConfigurations(defaultConfig, networkConfig);
      
      // Get adapter class
      const adapterClassName = this.adapterClasses.get(config.type);
      if (!adapterClassName) {
        throw new BlockchainError(
          `No adapter class registered for network type: ${config.type}`,
          ErrorCodes.NOT_SUPPORTED,
          config.chainId
        );
      }

      // Create adapter instance
      const AdapterClass = await this.loadAdapterClass(adapterClassName);
      const adapter = new AdapterClass(mergedConfig);
      
      return adapter;
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to create adapter: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        networkConfig.chainId,
        error
      );
    }
  }

  /**
   * Load adapter class dynamically
   */
  async loadAdapterClass(adapterClassName) {
    try {
      // In a real implementation, this would dynamically import the adapter class
      // For now, we'll return the base enhanced adapter class
      return EnhancedBlockchainAdapter;
    } catch (error) {
      throw new BlockchainError(
        `Failed to load adapter class ${adapterClassName}: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        'SYSTEM',
        error
      );
    }
  }

  /**
   * Merge configurations with proper precedence
   */
  mergeConfigurations(defaultConfig, userConfig) {
    const merged = JSON.parse(JSON.stringify(defaultConfig)); // Deep clone
    
    // Merge user configuration
    Object.keys(userConfig).forEach(key => {
      if (typeof userConfig[key] === 'object' && userConfig[key] !== null && !Array.isArray(userConfig[key])) {
        merged[key] = { ...merged[key], ...userConfig[key] };
      } else {
        merged[key] = userConfig[key];
      }
    });
    
    return merged;
  }
}

/**
 * Enhanced Adapter Registry
 * Manages blockchain adapters with advanced features
 */
class EnhancedAdapterRegistry {
  constructor(configurationManager = null) {
    this.adapters = new Map();
    this.configurations = new Map();
    this.adapterFactory = new AdapterFactory();
    this.configurationManager = configurationManager;
    this.healthMonitor = new RegistryHealthMonitor();
    this.eventListeners = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize the registry
   */
  async initialize() {
    try {
      if (this.configurationManager) {
        await this.loadConfigurationsFromDatabase();
      } else {
        await this.loadDefaultConfigurations();
      }
      
      this.isInitialized = true;
      this.emit('initialized', { timestamp: new Date().toISOString() });
      
      return true;
    } catch (error) {
      throw new BlockchainError(
        `Failed to initialize adapter registry: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        'SYSTEM',
        error
      );
    }
  }

  /**
   * Load configurations from database
   */
  async loadConfigurationsFromDatabase() {
    try {
      const configs = await this.configurationManager.loadConfigurations();
      
      for (const [chainId, config] of configs) {
        this.configurations.set(chainId, config);
      }
      
      console.log(`Loaded ${configs.size} network configurations from database`);
    } catch (error) {
      console.warn('Failed to load configurations from database, using defaults:', error.message);
      await this.loadDefaultConfigurations();
    }
  }

  /**
   * Load default configurations
   */
  async loadDefaultConfigurations() {
    const defaultNetworks = [
      // Ethereum mainnet
      {
        chainId: 'ethereum',
        name: 'Ethereum Mainnet',
        type: 'evm',
        isMainnet: true,
        rpcUrls: ['https://mainnet.infura.io/v3/YOUR_PROJECT_ID'],
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
      },
      
      // XDC Network
      {
        chainId: 'xdc',
        name: 'XDC Network',
        type: 'evm',
        isMainnet: true,
        rpcUrls: ['https://rpc.xdc.network'],
        nativeCurrency: { name: 'XDC', symbol: 'XDC', decimals: 18 }
      },
      
      // Avalanche
      {
        chainId: 'avalanche',
        name: 'Avalanche C-Chain',
        type: 'evm',
        isMainnet: true,
        rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
        nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 }
      },
      
      // Polygon
      {
        chainId: 'polygon',
        name: 'Polygon Mainnet',
        type: 'evm',
        isMainnet: true,
        rpcUrls: ['https://polygon-rpc.com'],
        nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }
      },
      
      // Binance Smart Chain
      {
        chainId: 'bsc',
        name: 'Binance Smart Chain',
        type: 'evm',
        isMainnet: true,
        rpcUrls: ['https://bsc-dataseed1.binance.org'],
        nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }
      },
      
      // Solana
      {
        chainId: 'solana',
        name: 'Solana Mainnet',
        type: 'solana',
        isMainnet: true,
        rpcUrls: ['https://api.mainnet-beta.solana.com'],
        nativeCurrency: { name: 'Solana', symbol: 'SOL', decimals: 9 }
      },
      
      // XRP Ledger
      {
        chainId: 'xrp',
        name: 'XRP Ledger',
        type: 'xrp',
        isMainnet: true,
        rpcUrls: ['wss://xrplcluster.com'],
        nativeCurrency: { name: 'XRP', symbol: 'XRP', decimals: 6 }
      },
      
      // Stellar
      {
        chainId: 'stellar',
        name: 'Stellar Network',
        type: 'stellar',
        isMainnet: true,
        rpcUrls: ['https://horizon.stellar.org'],
        nativeCurrency: { name: 'Stellar Lumens', symbol: 'XLM', decimals: 7 }
      }
    ];

    for (const networkConfig of defaultNetworks) {
      this.configurations.set(networkConfig.chainId, networkConfig);
    }
    
    console.log(`Loaded ${defaultNetworks.length} default network configurations`);
  }

  /**
   * Register a blockchain adapter
   */
  async registerAdapter(chainId, adapterOrConfig) {
    try {
      let adapter;
      
      if (adapterOrConfig instanceof EnhancedBlockchainAdapter) {
        adapter = adapterOrConfig;
      } else {
        // Create adapter from configuration
        const config = this.configurations.get(chainId) || adapterOrConfig;
        adapter = await this.adapterFactory.createAdapter(config);
      }
      
      // Initialize the adapter
      await adapter.initialize();
      
      // Register the adapter
      this.adapters.set(chainId, adapter);
      
      // Start health monitoring
      this.healthMonitor.startMonitoring(chainId, adapter);
      
      this.emit('adapterRegistered', { chainId, adapter });
      
      console.log(`Registered adapter for chain: ${chainId}`);
      return adapter;
    } catch (error) {
      throw new BlockchainError(
        `Failed to register adapter for ${chainId}: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        chainId,
        error
      );
    }
  }

  /**
   * Get a blockchain adapter by chain ID
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
   * Get adapter with automatic registration if not exists
   */
  async getOrCreateAdapter(chainId) {
    try {
      return this.getAdapter(chainId);
    } catch (error) {
      if (error.code === ErrorCodes.INVALID_PARAMS) {
        // Try to create adapter from configuration
        const config = this.configurations.get(chainId);
        if (config) {
          return await this.registerAdapter(chainId, config);
        }
      }
      throw error;
    }
  }

  /**
   * Unregister an adapter
   */
  async unregisterAdapter(chainId) {
    try {
      const adapter = this.adapters.get(chainId);
      if (adapter) {
        // Stop health monitoring
        this.healthMonitor.stopMonitoring(chainId);
        
        // Cleanup adapter
        await adapter.cleanup();
        
        // Remove from registry
        this.adapters.delete(chainId);
        
        this.emit('adapterUnregistered', { chainId });
        
        console.log(`Unregistered adapter for chain: ${chainId}`);
        return true;
      }
      return false;
    } catch (error) {
      throw new BlockchainError(
        `Failed to unregister adapter for ${chainId}: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        chainId,
        error
      );
    }
  }

  /**
   * Get list of supported chain IDs
   */
  getSupportedChains() {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get list of configured chain IDs
   */
  getConfiguredChains() {
    return Array.from(this.configurations.keys());
  }

  /**
   * Check if a chain is supported
   */
  isChainSupported(chainId) {
    return this.adapters.has(chainId);
  }

  /**
   * Check if a chain is configured
   */
  isChainConfigured(chainId) {
    return this.configurations.has(chainId);
  }

  /**
   * Get configuration for a chain
   */
  getConfiguration(chainId) {
    const config = this.configurations.get(chainId);
    if (!config) {
      throw new BlockchainError(
        `No configuration found for chain ID: ${chainId}`,
        ErrorCodes.INVALID_PARAMS,
        chainId
      );
    }
    return config;
  }

  /**
   * Update configuration for a chain
   */
  async updateConfiguration(chainId, updates) {
    try {
      const currentConfig = this.getConfiguration(chainId);
      const updatedConfig = { ...currentConfig, ...updates };
      
      // Validate the updated configuration
      new NetworkConfiguration(updatedConfig);
      
      // Update in memory
      this.configurations.set(chainId, updatedConfig);
      
      // Update in database if available
      if (this.configurationManager) {
        await this.configurationManager.updateConfiguration(chainId, updates);
      }
      
      // If adapter is registered, recreate it with new configuration
      if (this.isChainSupported(chainId)) {
        await this.unregisterAdapter(chainId);
        await this.registerAdapter(chainId, updatedConfig);
      }
      
      this.emit('configurationUpdated', { chainId, updates });
      
      return updatedConfig;
    } catch (error) {
      throw new BlockchainError(
        `Failed to update configuration for ${chainId}: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        chainId,
        error
      );
    }
  }

  /**
   * Add new network configuration
   */
  async addNetworkConfiguration(networkConfig) {
    try {
      const config = new NetworkConfiguration(networkConfig);
      config.validate();
      
      // Check if chain already exists
      if (this.isChainConfigured(config.chainId)) {
        throw new BlockchainError(
          `Chain ${config.chainId} is already configured`,
          ErrorCodes.INVALID_PARAMS,
          config.chainId
        );
      }
      
      // Add to configurations
      this.configurations.set(config.chainId, networkConfig);
      
      // Save to database if available
      if (this.configurationManager) {
        await this.configurationManager.addConfiguration(networkConfig);
      }
      
      this.emit('networkAdded', { chainId: config.chainId, config: networkConfig });
      
      return config.chainId;
    } catch (error) {
      throw new BlockchainError(
        `Failed to add network configuration: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        networkConfig?.chainId || 'UNKNOWN',
        error
      );
    }
  }

  /**
   * Remove network configuration
   */
  async removeNetworkConfiguration(chainId) {
    try {
      // Unregister adapter if exists
      if (this.isChainSupported(chainId)) {
        await this.unregisterAdapter(chainId);
      }
      
      // Remove configuration
      const removed = this.configurations.delete(chainId);
      
      // Remove from database if available
      if (this.configurationManager && removed) {
        await this.configurationManager.removeConfiguration(chainId);
      }
      
      if (removed) {
        this.emit('networkRemoved', { chainId });
      }
      
      return removed;
    } catch (error) {
      throw new BlockchainError(
        `Failed to remove network configuration for ${chainId}: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        chainId,
        error
      );
    }
  }

  /**
   * Get registry status
   */
  getRegistryStatus() {
    const supportedChains = this.getSupportedChains();
    const configuredChains = this.getConfiguredChains();
    const healthStatus = this.healthMonitor.getOverallHealth();
    
    return {
      isInitialized: this.isInitialized,
      supportedChains: supportedChains.length,
      configuredChains: configuredChains.length,
      healthStatus,
      chains: {
        supported: supportedChains,
        configured: configuredChains
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get detailed status for all adapters
   */
  async getDetailedStatus() {
    const status = this.getRegistryStatus();
    const adapterStatuses = {};
    
    for (const chainId of this.getSupportedChains()) {
      try {
        const adapter = this.getAdapter(chainId);
        const healthCheck = await adapter.healthCheck();
        adapterStatuses[chainId] = healthCheck;
      } catch (error) {
        adapterStatuses[chainId] = {
          healthy: false,
          error: error.message
        };
      }
    }
    
    return {
      ...status,
      adapters: adapterStatuses
    };
  }

  /**
   * Bulk operations
   */
  async registerAllConfiguredAdapters() {
    const results = [];
    
    for (const chainId of this.getConfiguredChains()) {
      try {
        if (!this.isChainSupported(chainId)) {
          await this.registerAdapter(chainId);
          results.push({ chainId, success: true });
        }
      } catch (error) {
        results.push({ 
          chainId, 
          success: false, 
          error: error.message 
        });
      }
    }
    
    return results;
  }

  async unregisterAllAdapters() {
    const results = [];
    
    for (const chainId of this.getSupportedChains()) {
      try {
        await this.unregisterAdapter(chainId);
        results.push({ chainId, success: true });
      } catch (error) {
        results.push({ 
          chainId, 
          success: false, 
          error: error.message 
        });
      }
    }
    
    return results;
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
          console.error(`Error in registry event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Cleanup
   */
  async cleanup() {
    try {
      await this.unregisterAllAdapters();
      this.healthMonitor.cleanup();
      this.eventListeners.clear();
      this.isInitialized = false;
    } catch (error) {
      console.error('Error during registry cleanup:', error);
    }
  }
}

/**
 * Registry Health Monitor
 * Monitors the health of all registered adapters
 */
class RegistryHealthMonitor {
  constructor() {
    this.monitoredAdapters = new Map();
    this.healthChecks = new Map();
    this.monitoringInterval = 60000; // 1 minute
    this.intervalId = null;
  }

  startMonitoring(chainId, adapter) {
    this.monitoredAdapters.set(chainId, adapter);
    
    // Start monitoring if this is the first adapter
    if (this.monitoredAdapters.size === 1) {
      this.startPeriodicHealthChecks();
    }
  }

  stopMonitoring(chainId) {
    this.monitoredAdapters.delete(chainId);
    this.healthChecks.delete(chainId);
    
    // Stop monitoring if no adapters left
    if (this.monitoredAdapters.size === 0) {
      this.stopPeriodicHealthChecks();
    }
  }

  startPeriodicHealthChecks() {
    if (this.intervalId) return;
    
    this.intervalId = setInterval(async () => {
      await this.performHealthChecks();
    }, this.monitoringInterval);
    
    console.log('Started periodic health checks for adapter registry');
  }

  stopPeriodicHealthChecks() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Stopped periodic health checks for adapter registry');
    }
  }

  async performHealthChecks() {
    for (const [chainId, adapter] of this.monitoredAdapters) {
      try {
        const healthCheck = await adapter.healthCheck();
        this.healthChecks.set(chainId, {
          ...healthCheck,
          lastCheck: new Date().toISOString()
        });
      } catch (error) {
        this.healthChecks.set(chainId, {
          healthy: false,
          error: error.message,
          lastCheck: new Date().toISOString()
        });
      }
    }
  }

  getAdapterHealth(chainId) {
    return this.healthChecks.get(chainId) || {
      healthy: false,
      error: 'No health check data available'
    };
  }

  getOverallHealth() {
    const healthChecks = Array.from(this.healthChecks.values());
    
    if (healthChecks.length === 0) {
      return {
        status: 'unknown',
        healthyAdapters: 0,
        totalAdapters: 0,
        healthPercentage: 0
      };
    }
    
    const healthyCount = healthChecks.filter(check => check.healthy).length;
    const healthPercentage = (healthyCount / healthChecks.length) * 100;
    
    let status = 'healthy';
    if (healthPercentage < 50) {
      status = 'unhealthy';
    } else if (healthPercentage < 80) {
      status = 'degraded';
    }
    
    return {
      status,
      healthyAdapters: healthyCount,
      totalAdapters: healthChecks.length,
      healthPercentage: Math.round(healthPercentage)
    };
  }

  cleanup() {
    this.stopPeriodicHealthChecks();
    this.monitoredAdapters.clear();
    this.healthChecks.clear();
  }
}

module.exports = {
  EnhancedAdapterRegistry,
  AdapterFactory,
  RegistryHealthMonitor
};

