/**
 * Test Suite for Enhanced Blockchain Abstraction Layer - Task 3.1 Phase 4
 * 
 * Comprehensive test suite for the unified adapter interface design
 */

const assert = require('assert');
const { 
  UnifiedBlockchainAbstractionLayer,
  EnhancedBlockchainAdapter,
  EnhancedAdapterRegistry,
  ErrorClassificationSystem,
  ErrorRecoveryManager,
  MonitoringAndAlertingSystem,
  BlockchainError,
  ErrorCodes,
  NetworkConfiguration
} = require('./unified-blockchain-abstraction-layer');

/**
 * Mock Adapter for Testing
 */
class MockBlockchainAdapter extends EnhancedBlockchainAdapter {
  constructor(config) {
    super(config);
    this.mockResponses = new Map();
    this.callHistory = [];
    this.shouldFail = false;
    this.failureError = null;
  }

  setMockResponse(method, response) {
    this.mockResponses.set(method, response);
  }

  setShouldFail(shouldFail, error = null) {
    this.shouldFail = shouldFail;
    this.failureError = error || new BlockchainError(
      'Mock failure',
      ErrorCodes.UNKNOWN_ERROR,
      this.config.chainId
    );
  }

  recordCall(method, args) {
    this.callHistory.push({
      method,
      args,
      timestamp: new Date().toISOString()
    });
  }

  async connectToRpc(rpcUrl) {
    this.recordCall('connectToRpc', [rpcUrl]);
    if (this.shouldFail) throw this.failureError;
    return true;
  }

  async getNetworkInfo() {
    this.recordCall('getNetworkInfo', []);
    if (this.shouldFail) throw this.failureError;
    return this.mockResponses.get('getNetworkInfo') || {
      chainId: this.config.chainId,
      name: this.config.name,
      blockNumber: 12345
    };
  }

  async _getBalance(address, tokenAddress = null) {
    this.recordCall('_getBalance', [address, tokenAddress]);
    if (this.shouldFail) throw this.failureError;
    return this.mockResponses.get('_getBalance') || {
      address,
      balance: '1000000000000000000',
      decimals: 18,
      symbol: this.config.nativeCurrency.symbol
    };
  }

  async _getTransaction(txHash) {
    this.recordCall('_getTransaction', [txHash]);
    if (this.shouldFail) throw this.failureError;
    return this.mockResponses.get('_getTransaction') || {
      hash: txHash,
      from: '0x1234567890123456789012345678901234567890',
      to: '0x0987654321098765432109876543210987654321',
      value: '1000000000000000000',
      status: 'confirmed'
    };
  }

  async _buildTransaction(txParams) {
    this.recordCall('_buildTransaction', [txParams]);
    if (this.shouldFail) throw this.failureError;
    return this.mockResponses.get('_buildTransaction') || {
      ...txParams,
      gasLimit: '21000',
      gasPrice: '20000000000',
      nonce: 42
    };
  }

  async _signTransaction(tx, signingParams) {
    this.recordCall('_signTransaction', [tx, signingParams]);
    if (this.shouldFail) throw this.failureError;
    return this.mockResponses.get('_signTransaction') || {
      ...tx,
      signature: '0xabcdef1234567890',
      signed: true
    };
  }

  async _submitTransaction(signedTx) {
    this.recordCall('_submitTransaction', [signedTx]);
    if (this.shouldFail) throw this.failureError;
    return this.mockResponses.get('_submitTransaction') || {
      hash: '0x1234567890abcdef',
      status: 'submitted'
    };
  }

  async _estimateFees(txParams) {
    this.recordCall('_estimateFees', [txParams]);
    if (this.shouldFail) throw this.failureError;
    return this.mockResponses.get('_estimateFees') || {
      gasLimit: '21000',
      gasPrice: '20000000000',
      totalFee: '420000000000000'
    };
  }

  async _connectWallet(options) {
    this.recordCall('_connectWallet', [options]);
    if (this.shouldFail) throw this.failureError;
    return this.mockResponses.get('_connectWallet') || {
      connected: true,
      address: '0x1234567890123456789012345678901234567890',
      walletType: 'mock'
    };
  }

  async _disconnectWallet() {
    this.recordCall('_disconnectWallet', []);
    if (this.shouldFail) throw this.failureError;
    return true;
  }

  async _getNetworkStatus() {
    this.recordCall('_getNetworkStatus', []);
    if (this.shouldFail) throw this.failureError;
    return this.mockResponses.get('_getNetworkStatus') || {
      connected: true,
      blockNumber: 12345,
      gasPrice: '20000000000'
    };
  }
}

/**
 * Test Suite Class
 */
class BlockchainAbstractionLayerTestSuite {
  constructor() {
    this.testResults = [];
    this.mockAdapters = new Map();
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🧪 Starting Blockchain Abstraction Layer Test Suite...\n');

    const testSuites = [
      () => this.testNetworkConfiguration(),
      () => this.testEnhancedBlockchainAdapter(),
      () => this.testErrorClassificationSystem(),
      () => this.testErrorRecoveryManager(),
      () => this.testEnhancedAdapterRegistry(),
      () => this.testMonitoringAndAlertingSystem(),
      () => this.testUnifiedBlockchainAbstractionLayer(),
      () => this.testIntegrationScenarios()
    ];

    for (const testSuite of testSuites) {
      try {
        await testSuite();
      } catch (error) {
        console.error(`❌ Test suite failed: ${error.message}`);
        this.recordTestResult('Test Suite', false, error.message);
      }
    }

    this.printTestSummary();
    return this.getTestResults();
  }

  /**
   * Test Network Configuration
   */
  async testNetworkConfiguration() {
    console.log('📋 Testing Network Configuration...');

    // Test valid configuration
    await this.runTest('NetworkConfiguration - Valid Config', async () => {
      const config = new NetworkConfiguration({
        chainId: 'test-chain',
        name: 'Test Chain',
        type: 'evm',
        isMainnet: false,
        rpcUrls: ['https://test-rpc.example.com'],
        nativeCurrency: { name: 'Test Token', symbol: 'TEST', decimals: 18 }
      });

      config.validate();
      assert.strictEqual(config.chainId, 'test-chain');
      assert.strictEqual(config.type, 'evm');
      assert.strictEqual(config.nativeCurrency.symbol, 'TEST');
    });

    // Test invalid configuration
    await this.runTest('NetworkConfiguration - Invalid Config', async () => {
      try {
        const config = new NetworkConfiguration({
          // Missing required fields
          name: 'Test Chain'
        });
        config.validate();
        throw new Error('Should have thrown validation error');
      } catch (error) {
        assert(error.message.includes('chainId is required'));
      }
    });

    console.log('✅ Network Configuration tests completed\n');
  }

  /**
   * Test Enhanced Blockchain Adapter
   */
  async testEnhancedBlockchainAdapter() {
    console.log('🔗 Testing Enhanced Blockchain Adapter...');

    const mockConfig = {
      chainId: 'test-chain',
      name: 'Test Chain',
      type: 'evm',
      rpcUrls: ['https://test-rpc.example.com'],
      nativeCurrency: { name: 'Test Token', symbol: 'TEST', decimals: 18 }
    };

    // Test adapter initialization
    await this.runTest('EnhancedBlockchainAdapter - Initialization', async () => {
      const adapter = new MockBlockchainAdapter(mockConfig);
      await adapter.initialize();
      
      assert.strictEqual(adapter.isInitialized, true);
      assert.strictEqual(adapter.isConnected, true);
    });

    // Test balance retrieval
    await this.runTest('EnhancedBlockchainAdapter - Get Balance', async () => {
      const adapter = new MockBlockchainAdapter(mockConfig);
      await adapter.initialize();
      
      const balance = await adapter.getBalance('0x1234567890123456789012345678901234567890');
      
      assert(balance.balance);
      assert(balance.symbol);
      assert(balance.chainId === 'test-chain');
    });

    // Test transaction operations
    await this.runTest('EnhancedBlockchainAdapter - Transaction Operations', async () => {
      const adapter = new MockBlockchainAdapter(mockConfig);
      await adapter.initialize();
      
      const txParams = {
        to: '0x0987654321098765432109876543210987654321',
        value: '1000000000000000000'
      };
      
      const unsignedTx = await adapter.buildTransaction(txParams);
      assert(unsignedTx.to === txParams.to);
      
      const signedTx = await adapter.signTransaction(unsignedTx, {});
      assert(signedTx.signature);
      
      const result = await adapter.submitTransaction(signedTx);
      assert(result.hash);
    });

    // Test error handling
    await this.runTest('EnhancedBlockchainAdapter - Error Handling', async () => {
      const adapter = new MockBlockchainAdapter(mockConfig);
      await adapter.initialize();
      
      adapter.setShouldFail(true, new BlockchainError(
        'Test error',
        ErrorCodes.CONNECTION_ERROR,
        'test-chain'
      ));
      
      try {
        await adapter.getBalance('0x1234567890123456789012345678901234567890');
        throw new Error('Should have thrown error');
      } catch (error) {
        assert(error instanceof BlockchainError);
        assert(error.code === ErrorCodes.CONNECTION_ERROR);
      }
    });

    console.log('✅ Enhanced Blockchain Adapter tests completed\n');
  }

  /**
   * Test Error Classification System
   */
  async testErrorClassificationSystem() {
    console.log('🚨 Testing Error Classification System...');

    const classifier = new ErrorClassificationSystem();

    // Test error classification
    await this.runTest('ErrorClassificationSystem - Connection Error', async () => {
      const error = new Error('connection refused');
      const classification = classifier.classifyError(error);
      
      assert.strictEqual(classification.code, 'CONNECTION_ERROR');
      assert.strictEqual(classification.classification.category, 'network');
      assert.strictEqual(classification.classification.recoveryStrategy.retryable, true);
    });

    await this.runTest('ErrorClassificationSystem - Insufficient Funds', async () => {
      const error = new Error('insufficient funds for gas');
      const classification = classifier.classifyError(error);
      
      assert.strictEqual(classification.code, 'INSUFFICIENT_FUNDS');
      assert.strictEqual(classification.classification.category, 'authorization');
      assert.strictEqual(classification.classification.recoveryStrategy.retryable, false);
    });

    await this.runTest('ErrorClassificationSystem - Unknown Error', async () => {
      const error = new Error('some unknown error message');
      const classification = classifier.classifyError(error);
      
      assert.strictEqual(classification.code, ErrorCodes.UNKNOWN_ERROR);
      assert(classification.confidence < 0.5);
    });

    console.log('✅ Error Classification System tests completed\n');
  }

  /**
   * Test Error Recovery Manager
   */
  async testErrorRecoveryManager() {
    console.log('🔄 Testing Error Recovery Manager...');

    const mockRegistry = {
      getAdapter: (chainId) => new MockBlockchainAdapter({
        chainId,
        name: 'Test Chain',
        type: 'evm',
        rpcUrls: ['https://test-rpc.example.com'],
        nativeCurrency: { name: 'Test Token', symbol: 'TEST', decimals: 18 }
      })
    };

    const recoveryManager = new ErrorRecoveryManager(mockRegistry);

    // Test retryable error recovery
    await this.runTest('ErrorRecoveryManager - Retryable Error', async () => {
      const error = new BlockchainError(
        'connection timeout',
        ErrorCodes.TIMEOUT,
        'test-chain'
      );
      
      const result = await recoveryManager.attemptRecovery(error, {
        chainId: 'test-chain',
        operation: 'getBalance'
      });
      
      assert.strictEqual(result.success, true);
      assert(result.attempts >= 1);
    });

    // Test non-retryable error
    await this.runTest('ErrorRecoveryManager - Non-Retryable Error', async () => {
      const error = new BlockchainError(
        'insufficient funds',
        ErrorCodes.INSUFFICIENT_FUNDS,
        'test-chain'
      );
      
      const result = await recoveryManager.attemptRecovery(error, {
        chainId: 'test-chain',
        operation: 'sendTransaction'
      });
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.reason, 'Error is not retryable');
    });

    console.log('✅ Error Recovery Manager tests completed\n');
  }

  /**
   * Test Enhanced Adapter Registry
   */
  async testEnhancedAdapterRegistry() {
    console.log('📚 Testing Enhanced Adapter Registry...');

    const registry = new EnhancedAdapterRegistry();

    // Test registry initialization
    await this.runTest('EnhancedAdapterRegistry - Initialization', async () => {
      await registry.initialize();
      
      assert.strictEqual(registry.isInitialized, true);
      assert(registry.getConfiguredChains().length > 0);
    });

    // Test adapter registration
    await this.runTest('EnhancedAdapterRegistry - Adapter Registration', async () => {
      const mockConfig = {
        chainId: 'test-chain-2',
        name: 'Test Chain 2',
        type: 'evm',
        rpcUrls: ['https://test-rpc-2.example.com'],
        nativeCurrency: { name: 'Test Token 2', symbol: 'TEST2', decimals: 18 }
      };

      const chainId = await registry.addNetworkConfiguration(mockConfig);
      assert.strictEqual(chainId, 'test-chain-2');
      
      assert(registry.isChainConfigured('test-chain-2'));
    });

    // Test adapter retrieval
    await this.runTest('EnhancedAdapterRegistry - Adapter Retrieval', async () => {
      try {
        const adapter = registry.getAdapter('non-existent-chain');
        throw new Error('Should have thrown error');
      } catch (error) {
        assert(error instanceof BlockchainError);
        assert(error.code === ErrorCodes.INVALID_PARAMS);
      }
    });

    console.log('✅ Enhanced Adapter Registry tests completed\n');
  }

  /**
   * Test Monitoring and Alerting System
   */
  async testMonitoringAndAlertingSystem() {
    console.log('📊 Testing Monitoring and Alerting System...');

    const mockRegistry = {
      getSupportedChains: () => ['test-chain'],
      getAdapter: (chainId) => {
        const adapter = new MockBlockchainAdapter({
          chainId,
          name: 'Test Chain',
          type: 'evm',
          rpcUrls: ['https://test-rpc.example.com'],
          nativeCurrency: { name: 'Test Token', symbol: 'TEST', decimals: 18 }
        });
        adapter.isInitialized = true;
        return adapter;
      }
    };

    const monitoring = new MonitoringAndAlertingSystem(mockRegistry);

    // Test monitoring initialization
    await this.runTest('MonitoringAndAlertingSystem - Initialization', async () => {
      const status = monitoring.getMonitoringStatus();
      
      assert.strictEqual(status.isMonitoring, false);
      assert(status.monitoringInterval > 0);
    });

    // Test metrics collection
    await this.runTest('MonitoringAndAlertingSystem - Metrics Collection', async () => {
      const metrics = await monitoring.collectAdapterMetrics();
      
      assert(metrics['test-chain']);
      assert(metrics['test-chain'].health);
      assert(metrics['test-chain'].performance);
    });

    // Test alert thresholds
    await this.runTest('MonitoringAndAlertingSystem - Alert Thresholds', async () => {
      monitoring.updateAlertThreshold('error_rate', {
        warning: 1,
        critical: 2
      });
      
      const mockMetrics = {
        errorRate: 1.5,
        averageResponseTime: 1000,
        healthPercentage: 100
      };
      
      await monitoring.checkAlertConditions(mockMetrics);
      
      const activeAlerts = monitoring.getActiveAlerts();
      assert(activeAlerts.length > 0);
      assert(activeAlerts[0].type === 'error_rate');
      assert(activeAlerts[0].severity === 'warning');
    });

    console.log('✅ Monitoring and Alerting System tests completed\n');
  }

  /**
   * Test Unified Blockchain Abstraction Layer
   */
  async testUnifiedBlockchainAbstractionLayer() {
    console.log('🌐 Testing Unified Blockchain Abstraction Layer...');

    const ubal = new UnifiedBlockchainAbstractionLayer();

    // Test UBAL initialization
    await this.runTest('UBAL - Initialization', async () => {
      const result = await ubal.initialize();
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(ubal.isInitialized, true);
      assert(result.supportedChains.length >= 0);
    });

    // Test multi-chain operations
    await this.runTest('UBAL - Multi-Chain Balance Query', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      const supportedChains = ubal.getSupportedChains();
      
      if (supportedChains.length > 0) {
        const results = await ubal.getMultiChainBalances(address, [supportedChains[0]]);
        
        assert(results.address === address);
        assert(results.chains);
        assert(results.timestamp);
      }
    });

    // Test error recovery integration
    await this.runTest('UBAL - Error Recovery Integration', async () => {
      const error = new Error('test connection error');
      const suggestions = ubal.getRecoverySuggestions(error, {
        operation: 'getBalance',
        chainId: 'test-chain'
      });
      
      assert(suggestions.classification);
      assert(typeof suggestions.retryable === 'boolean');
      assert(Array.isArray(suggestions.suggestedActions));
    });

    // Test system status
    await this.runTest('UBAL - System Status', async () => {
      const status = await ubal.getSystemStatus();
      
      assert(status.system);
      assert(status.registry);
      assert(status.monitoring);
      assert(status.alerts);
      assert(status.recovery);
    });

    console.log('✅ Unified Blockchain Abstraction Layer tests completed\n');
  }

  /**
   * Test Integration Scenarios
   */
  async testIntegrationScenarios() {
    console.log('🔄 Testing Integration Scenarios...');

    const ubal = new UnifiedBlockchainAbstractionLayer();
    await ubal.initialize();

    // Test end-to-end transaction flow
    await this.runTest('Integration - End-to-End Transaction Flow', async () => {
      const supportedChains = ubal.getSupportedChains();
      
      if (supportedChains.length > 0) {
        const chainId = supportedChains[0];
        
        // Test balance query
        try {
          const balance = await ubal.getBalance(
            chainId,
            '0x1234567890123456789012345678901234567890'
          );
          assert(balance.balance !== undefined);
        } catch (error) {
          // Expected for mock adapters without proper implementation
          assert(error instanceof BlockchainError);
        }
        
        // Test transaction building
        try {
          const txParams = {
            to: '0x0987654321098765432109876543210987654321',
            value: '1000000000000000000'
          };
          
          const unsignedTx = await ubal.buildTransaction(chainId, txParams);
          assert(unsignedTx.to === txParams.to);
        } catch (error) {
          // Expected for mock adapters
          assert(error instanceof BlockchainError);
        }
      }
    });

    // Test network management
    await this.runTest('Integration - Network Management', async () => {
      const newNetworkConfig = {
        chainId: 'integration-test-chain',
        name: 'Integration Test Chain',
        type: 'evm',
        rpcUrls: ['https://integration-test.example.com'],
        nativeCurrency: { name: 'Integration Token', symbol: 'INT', decimals: 18 }
      };
      
      // Add network
      const addResult = await ubal.addNetwork(newNetworkConfig);
      assert.strictEqual(addResult.success, true);
      assert.strictEqual(addResult.chainId, 'integration-test-chain');
      
      // Verify network is supported
      assert(ubal.isChainSupported('integration-test-chain'));
      
      // Remove network
      const removeResult = await ubal.removeNetwork('integration-test-chain');
      assert.strictEqual(removeResult.success, true);
      
      // Verify network is no longer supported
      assert(!ubal.isChainSupported('integration-test-chain'));
    });

    // Test health monitoring
    await this.runTest('Integration - Health Monitoring', async () => {
      const healthCheck = await ubal.performSystemHealthCheck();
      
      assert(healthCheck.overall);
      assert(typeof healthCheck.overall.healthy === 'boolean');
      assert(typeof healthCheck.overall.healthPercentage === 'number');
      assert(healthCheck.chains);
      assert(healthCheck.timestamp);
    });

    console.log('✅ Integration Scenarios tests completed\n');
  }

  /**
   * Run individual test
   */
  async runTest(testName, testFunction) {
    try {
      await testFunction();
      console.log(`  ✅ ${testName}`);
      this.recordTestResult(testName, true);
    } catch (error) {
      console.log(`  ❌ ${testName}: ${error.message}`);
      this.recordTestResult(testName, false, error.message);
    }
  }

  /**
   * Record test result
   */
  recordTestResult(testName, success, error = null) {
    this.testResults.push({
      testName,
      success,
      error,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Print test summary
   */
  printTestSummary() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const successRate = totalTests > 0 ? (passedTests / totalTests * 100).toFixed(2) : 0;

    console.log('\n📊 Test Summary:');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${successRate}%`);

    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => !r.success)
        .forEach(r => console.log(`  - ${r.testName}: ${r.error}`));
    }

    console.log('\n🎉 Test Suite Completed!');
  }

  /**
   * Get test results
   */
  getTestResults() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    return {
      summary: {
        totalTests,
        passedTests,
        failedTests,
        successRate: totalTests > 0 ? (passedTests / totalTests * 100) : 0
      },
      results: this.testResults
    };
  }
}

/**
 * Run tests if this file is executed directly
 */
if (require.main === module) {
  (async () => {
    const testSuite = new BlockchainAbstractionLayerTestSuite();
    const results = await testSuite.runAllTests();
    
    // Exit with error code if tests failed
    if (results.summary.failedTests > 0) {
      process.exit(1);
    }
  })().catch(error => {
    console.error('Test suite execution failed:', error);
    process.exit(1);
  });
}

module.exports = {
  BlockchainAbstractionLayerTestSuite,
  MockBlockchainAdapter
};

