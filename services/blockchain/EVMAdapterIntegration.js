/**
 * EVM Adapter Integration Layer - Task 3.2 Phase 3
 * 
 * Integration layer that brings together all EVM adapters with unified management,
 * testing, and validation capabilities.
 */

const { BaseEVMAdapter } = require('./BaseEVMAdapter');
const { EthereumAdapter } = require('./adapters/EthereumAdapter');
const { EnhancedXDCAdapter } = require('./adapters/EnhancedXDCAdapter');
const { AvalancheAdapter } = require('./adapters/AvalancheAdapter');
const { PolygonAdapter } = require('./adapters/PolygonAdapter');
const { BinanceSmartChainAdapter } = require('./adapters/BinanceSmartChainAdapter');
const { BlockchainError, ErrorCodes } = require('./enhanced-blockchain-adapter');

/**
 * EVM Adapter Registry and Integration Manager
 * Manages all EVM adapters with unified interface and testing capabilities
 */
class EVMAdapterIntegration {
  constructor(config = {}) {
    this.config = config;
    this.adapters = new Map();
    this.adapterConfigs = new Map();
    this.healthStatus = new Map();
    this.performanceMetrics = new Map();
    
    // Initialize adapter configurations
    this.initializeAdapterConfigs();
    
    // Performance monitoring
    this.monitoringInterval = null;
    this.monitoringEnabled = config.monitoring !== false;
    
    console.log('🔧 EVM Adapter Integration initialized with 5 networks');
  }

  /**
   * Initialize configurations for all EVM adapters
   */
  initializeAdapterConfigs() {
    // Ethereum Mainnet Configuration
    this.adapterConfigs.set('ethereum', {
      chainId: '1',
      name: 'Ethereum Mainnet',
      adapter: EthereumAdapter,
      features: ['eip1559', 'mev-protection', 'smart-contracts', 'defi', 'nfts'],
      priority: 1,
      testnet: false
    });

    // XDC Network Configuration
    this.adapterConfigs.set('xdc', {
      chainId: '50',
      name: 'XDC Network',
      adapter: EnhancedXDCAdapter,
      features: ['address-conversion', 'enterprise', 'smart-contracts', 'low-fees'],
      priority: 2,
      testnet: false
    });

    // Avalanche C-Chain Configuration
    this.adapterConfigs.set('avalanche', {
      chainId: '43114',
      name: 'Avalanche C-Chain',
      adapter: AvalancheAdapter,
      features: ['high-throughput', 'instant-finality', 'eco-friendly', 'subnets'],
      priority: 3,
      testnet: false
    });

    // Polygon Mainnet Configuration
    this.adapterConfigs.set('polygon', {
      chainId: '137',
      name: 'Polygon Mainnet',
      adapter: PolygonAdapter,
      features: ['layer2', 'low-fees', 'ethereum-compatible', 'fast-transactions'],
      priority: 4,
      testnet: false
    });

    // Binance Smart Chain Configuration
    this.adapterConfigs.set('bsc', {
      chainId: '56',
      name: 'Binance Smart Chain',
      adapter: BinanceSmartChainAdapter,
      features: ['high-throughput', 'binance-ecosystem', 'low-fees', 'posa-consensus'],
      priority: 5,
      testnet: false
    });
  }

  /**
   * Initialize a specific adapter
   */
  async initializeAdapter(networkId, config = {}) {
    try {
      const adapterConfig = this.adapterConfigs.get(networkId);
      if (!adapterConfig) {
        throw new BlockchainError(
          `Unknown network: ${networkId}`,
          ErrorCodes.NETWORK_NOT_SUPPORTED,
          networkId
        );
      }

      // Merge configurations
      const finalConfig = {
        ...this.config,
        ...config,
        chainId: adapterConfig.chainId,
        name: adapterConfig.name
      };

      // Create adapter instance
      const AdapterClass = adapterConfig.adapter;
      const adapter = new AdapterClass(finalConfig);

      // Store adapter
      this.adapters.set(networkId, adapter);
      
      console.log(`✅ Initialized ${adapterConfig.name} adapter`);
      return adapter;
    } catch (error) {
      console.error(`❌ Failed to initialize ${networkId} adapter:`, error.message);
      throw error;
    }
  }

  /**
   * Initialize all adapters
   */
  async initializeAllAdapters(configs = {}) {
    const results = [];
    
    for (const [networkId, adapterConfig] of this.adapterConfigs) {
      try {
        const networkConfig = configs[networkId] || {};
        const adapter = await this.initializeAdapter(networkId, networkConfig);
        results.push({
          networkId,
          name: adapterConfig.name,
          status: 'success',
          adapter
        });
      } catch (error) {
        results.push({
          networkId,
          name: adapterConfig.name,
          status: 'failed',
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    console.log(`🚀 Initialized ${successCount}/${results.length} EVM adapters`);
    
    return results;
  }

  /**
   * Get adapter by network ID
   */
  getAdapter(networkId) {
    const adapter = this.adapters.get(networkId);
    if (!adapter) {
      throw new BlockchainError(
        `Adapter not initialized for network: ${networkId}`,
        ErrorCodes.ADAPTER_NOT_FOUND,
        networkId
      );
    }
    return adapter;
  }

  /**
   * Get all initialized adapters
   */
  getAllAdapters() {
    return Array.from(this.adapters.entries()).map(([networkId, adapter]) => ({
      networkId,
      adapter,
      config: this.adapterConfigs.get(networkId)
    }));
  }

  /**
   * Get adapter by chain ID
   */
  getAdapterByChainId(chainId) {
    for (const [networkId, adapter] of this.adapters) {
      if (adapter.config.chainId === chainId.toString()) {
        return { networkId, adapter };
      }
    }
    throw new BlockchainError(
      `No adapter found for chain ID: ${chainId}`,
      ErrorCodes.ADAPTER_NOT_FOUND,
      chainId
    );
  }

  /**
   * Comprehensive health check for all adapters
   */
  async performHealthCheck() {
    const results = [];
    const startTime = Date.now();

    for (const [networkId, adapter] of this.adapters) {
      const checkStart = Date.now();
      try {
        const health = await adapter.healthCheck();
        const duration = Date.now() - checkStart;
        
        results.push({
          networkId,
          name: adapter.config.name,
          status: health.healthy ? 'healthy' : 'unhealthy',
          health,
          responseTime: duration,
          timestamp: new Date().toISOString()
        });

        // Update health status cache
        this.healthStatus.set(networkId, {
          ...health,
          lastCheck: new Date().toISOString(),
          responseTime: duration
        });
      } catch (error) {
        const duration = Date.now() - checkStart;
        results.push({
          networkId,
          name: adapter.config.name,
          status: 'error',
          error: error.message,
          responseTime: duration,
          timestamp: new Date().toISOString()
        });

        this.healthStatus.set(networkId, {
          healthy: false,
          error: error.message,
          lastCheck: new Date().toISOString(),
          responseTime: duration
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    const healthyCount = results.filter(r => r.status === 'healthy').length;
    
    return {
      summary: {
        total: results.length,
        healthy: healthyCount,
        unhealthy: results.length - healthyCount,
        healthPercentage: ((healthyCount / results.length) * 100).toFixed(1),
        totalDuration,
        timestamp: new Date().toISOString()
      },
      results
    };
  }

  /**
   * Performance benchmark for all adapters
   */
  async performBenchmark() {
    const results = [];
    const testAddress = '0x742d35Cc6634C0532925a3b8D0C9e3e8d4C4c8c8'; // Test address

    for (const [networkId, adapter] of this.adapters) {
      try {
        const benchmarks = {
          networkId,
          name: adapter.config.name,
          tests: {}
        };

        // Test 1: Balance Query Performance
        const balanceStart = Date.now();
        try {
          await adapter.getBalance(testAddress);
          benchmarks.tests.balanceQuery = {
            status: 'success',
            duration: Date.now() - balanceStart
          };
        } catch (error) {
          benchmarks.tests.balanceQuery = {
            status: 'failed',
            duration: Date.now() - balanceStart,
            error: error.message
          };
        }

        // Test 2: Fee Estimation Performance
        const feeStart = Date.now();
        try {
          await adapter.estimateFees({
            to: testAddress,
            value: '1000000000000000000' // 1 ETH/native token
          });
          benchmarks.tests.feeEstimation = {
            status: 'success',
            duration: Date.now() - feeStart
          };
        } catch (error) {
          benchmarks.tests.feeEstimation = {
            status: 'failed',
            duration: Date.now() - feeStart,
            error: error.message
          };
        }

        // Test 3: Network Status Performance
        const statusStart = Date.now();
        try {
          await adapter.getNetworkStatus();
          benchmarks.tests.networkStatus = {
            status: 'success',
            duration: Date.now() - statusStart
          };
        } catch (error) {
          benchmarks.tests.networkStatus = {
            status: 'failed',
            duration: Date.now() - statusStart,
            error: error.message
          };
        }

        // Calculate overall performance score
        const successfulTests = Object.values(benchmarks.tests).filter(t => t.status === 'success');
        const avgDuration = successfulTests.length > 0 
          ? successfulTests.reduce((sum, t) => sum + t.duration, 0) / successfulTests.length 
          : 0;

        benchmarks.performance = {
          successRate: (successfulTests.length / Object.keys(benchmarks.tests).length * 100).toFixed(1),
          avgResponseTime: Math.round(avgDuration),
          score: this.calculatePerformanceScore(avgDuration, successfulTests.length)
        };

        results.push(benchmarks);

        // Update performance metrics cache
        this.performanceMetrics.set(networkId, {
          ...benchmarks.performance,
          lastBenchmark: new Date().toISOString()
        });

      } catch (error) {
        results.push({
          networkId,
          name: adapter.config.name,
          status: 'error',
          error: error.message
        });
      }
    }

    return {
      summary: {
        totalNetworks: results.length,
        avgPerformanceScore: this.calculateOverallScore(results),
        timestamp: new Date().toISOString()
      },
      results
    };
  }

  /**
   * Calculate performance score based on response time and success rate
   */
  calculatePerformanceScore(avgDuration, successfulTests) {
    // Base score starts at 100
    let score = 100;
    
    // Deduct points for slow response times
    if (avgDuration > 5000) score -= 50; // Very slow
    else if (avgDuration > 2000) score -= 30; // Slow
    else if (avgDuration > 1000) score -= 15; // Moderate
    else if (avgDuration > 500) score -= 5; // Fast
    
    // Deduct points for failed tests
    if (successfulTests < 3) score -= (3 - successfulTests) * 20;
    
    return Math.max(0, score);
  }

  /**
   * Calculate overall performance score
   */
  calculateOverallScore(results) {
    const scores = results
      .filter(r => r.performance && r.performance.score)
      .map(r => parseFloat(r.performance.score));
    
    return scores.length > 0 
      ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1)
      : 0;
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(intervalMs = 300000) { // 5 minutes default
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
        console.log('🔍 EVM adapters health check completed');
      } catch (error) {
        console.error('❌ Monitoring health check failed:', error.message);
      }
    }, intervalMs);

    console.log(`📊 Started EVM adapter monitoring (${intervalMs/1000}s interval)`);
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('⏹️ Stopped EVM adapter monitoring');
    }
  }

  /**
   * Get cached health status
   */
  getHealthStatus(networkId = null) {
    if (networkId) {
      return this.healthStatus.get(networkId);
    }
    return Object.fromEntries(this.healthStatus);
  }

  /**
   * Get cached performance metrics
   */
  getPerformanceMetrics(networkId = null) {
    if (networkId) {
      return this.performanceMetrics.get(networkId);
    }
    return Object.fromEntries(this.performanceMetrics);
  }

  /**
   * Comprehensive integration test suite
   */
  async runIntegrationTests() {
    console.log('🧪 Starting EVM Adapter Integration Tests...');
    
    const testResults = {
      timestamp: new Date().toISOString(),
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      },
      tests: []
    };

    // Test 1: Adapter Initialization
    testResults.tests.push(await this.testAdapterInitialization());
    
    // Test 2: Health Checks
    testResults.tests.push(await this.testHealthChecks());
    
    // Test 3: Performance Benchmarks
    testResults.tests.push(await this.testPerformanceBenchmarks());
    
    // Test 4: Network-Specific Features
    testResults.tests.push(await this.testNetworkSpecificFeatures());
    
    // Test 5: Error Handling
    testResults.tests.push(await this.testErrorHandling());

    // Calculate summary
    testResults.summary.total = testResults.tests.length;
    testResults.summary.passed = testResults.tests.filter(t => t.status === 'passed').length;
    testResults.summary.failed = testResults.tests.filter(t => t.status === 'failed').length;
    testResults.summary.skipped = testResults.tests.filter(t => t.status === 'skipped').length;
    testResults.summary.successRate = ((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1);

    console.log(`✅ Integration tests completed: ${testResults.summary.passed}/${testResults.summary.total} passed`);
    
    return testResults;
  }

  /**
   * Test adapter initialization
   */
  async testAdapterInitialization() {
    try {
      const results = await this.initializeAllAdapters();
      const successCount = results.filter(r => r.status === 'success').length;
      
      return {
        name: 'Adapter Initialization',
        status: successCount === results.length ? 'passed' : 'failed',
        details: {
          total: results.length,
          successful: successCount,
          results
        }
      };
    } catch (error) {
      return {
        name: 'Adapter Initialization',
        status: 'failed',
        error: error.message
      };
    }
  }

  /**
   * Test health checks
   */
  async testHealthChecks() {
    try {
      const healthResults = await this.performHealthCheck();
      const healthyCount = healthResults.results.filter(r => r.status === 'healthy').length;
      
      return {
        name: 'Health Checks',
        status: healthyCount > 0 ? 'passed' : 'failed',
        details: {
          healthy: healthyCount,
          total: healthResults.results.length,
          healthPercentage: healthResults.summary.healthPercentage,
          results: healthResults.results
        }
      };
    } catch (error) {
      return {
        name: 'Health Checks',
        status: 'failed',
        error: error.message
      };
    }
  }

  /**
   * Test performance benchmarks
   */
  async testPerformanceBenchmarks() {
    try {
      const benchmarkResults = await this.performBenchmark();
      const avgScore = parseFloat(benchmarkResults.summary.avgPerformanceScore);
      
      return {
        name: 'Performance Benchmarks',
        status: avgScore >= 70 ? 'passed' : 'failed',
        details: {
          avgPerformanceScore: avgScore,
          results: benchmarkResults.results
        }
      };
    } catch (error) {
      return {
        name: 'Performance Benchmarks',
        status: 'failed',
        error: error.message
      };
    }
  }

  /**
   * Test network-specific features
   */
  async testNetworkSpecificFeatures() {
    try {
      const featureTests = [];
      
      // Test XDC address conversion
      if (this.adapters.has('xdc')) {
        const xdcAdapter = this.adapters.get('xdc');
        try {
          const ethAddress = xdcAdapter.xdcToEthAddress('xdc742d35Cc6634C0532925a3b8D0C9e3e8d4C4c8c8');
          const xdcAddress = xdcAdapter.ethToXdcAddress('0x742d35Cc6634C0532925a3b8D0C9e3e8d4C4c8c8');
          featureTests.push({
            network: 'xdc',
            feature: 'address_conversion',
            status: 'passed'
          });
        } catch (error) {
          featureTests.push({
            network: 'xdc',
            feature: 'address_conversion',
            status: 'failed',
            error: error.message
          });
        }
      }

      // Test Ethereum EIP-1559
      if (this.adapters.has('ethereum')) {
        const ethAdapter = this.adapters.get('ethereum');
        try {
          const fees = await ethAdapter.estimateFees({
            to: '0x742d35Cc6634C0532925a3b8D0C9e3e8d4C4c8c8',
            value: '1000000000000000000'
          });
          featureTests.push({
            network: 'ethereum',
            feature: 'eip1559_fees',
            status: fees.maxFeePerGas ? 'passed' : 'failed'
          });
        } catch (error) {
          featureTests.push({
            network: 'ethereum',
            feature: 'eip1559_fees',
            status: 'failed',
            error: error.message
          });
        }
      }

      const passedTests = featureTests.filter(t => t.status === 'passed').length;
      
      return {
        name: 'Network-Specific Features',
        status: passedTests === featureTests.length ? 'passed' : 'failed',
        details: {
          total: featureTests.length,
          passed: passedTests,
          tests: featureTests
        }
      };
    } catch (error) {
      return {
        name: 'Network-Specific Features',
        status: 'failed',
        error: error.message
      };
    }
  }

  /**
   * Test error handling
   */
  async testErrorHandling() {
    try {
      const errorTests = [];
      
      // Test invalid network
      try {
        this.getAdapter('invalid_network');
        errorTests.push({
          test: 'invalid_network',
          status: 'failed',
          reason: 'Should have thrown error'
        });
      } catch (error) {
        errorTests.push({
          test: 'invalid_network',
          status: 'passed',
          error: error.message
        });
      }

      // Test invalid chain ID
      try {
        this.getAdapterByChainId(999999);
        errorTests.push({
          test: 'invalid_chain_id',
          status: 'failed',
          reason: 'Should have thrown error'
        });
      } catch (error) {
        errorTests.push({
          test: 'invalid_chain_id',
          status: 'passed',
          error: error.message
        });
      }

      const passedTests = errorTests.filter(t => t.status === 'passed').length;
      
      return {
        name: 'Error Handling',
        status: passedTests === errorTests.length ? 'passed' : 'failed',
        details: {
          total: errorTests.length,
          passed: passedTests,
          tests: errorTests
        }
      };
    } catch (error) {
      return {
        name: 'Error Handling',
        status: 'failed',
        error: error.message
      };
    }
  }

  /**
   * Get integration summary
   */
  getIntegrationSummary() {
    return {
      adapters: {
        total: this.adapterConfigs.size,
        initialized: this.adapters.size,
        networks: Array.from(this.adapterConfigs.keys())
      },
      features: {
        healthMonitoring: this.monitoringEnabled,
        performanceBenchmarking: true,
        networkSpecificOptimizations: true,
        errorHandling: true
      },
      status: {
        healthy: this.healthStatus.size,
        monitoring: !!this.monitoringInterval,
        lastUpdate: new Date().toISOString()
      }
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopMonitoring();
    this.adapters.clear();
    this.healthStatus.clear();
    this.performanceMetrics.clear();
    console.log('🧹 EVM Adapter Integration cleaned up');
  }
}

module.exports = {
  EVMAdapterIntegration
};

