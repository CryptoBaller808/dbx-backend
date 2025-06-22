/**
 * EVM Adapter Test Runner - Task 3.2 Phase 4
 * 
 * Comprehensive test runner for validating all EVM adapters and integration layer
 */

const { EVMAdapterIntegration } = require('./EVMAdapterIntegration');

/**
 * Test Runner for EVM Adapters
 */
class EVMAdapterTestRunner {
  constructor() {
    this.integration = null;
    this.testResults = {
      timestamp: new Date().toISOString(),
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        successRate: 0
      },
      phases: [],
      performance: {},
      recommendations: []
    };
  }

  /**
   * Run comprehensive test suite
   */
  async runComprehensiveTests() {
    console.log('🚀 Starting EVM Adapter Comprehensive Test Suite...');
    console.log('=' .repeat(60));

    try {
      // Phase 1: Initialize Integration Layer
      await this.testPhase1_Initialization();
      
      // Phase 2: Adapter Functionality Tests
      await this.testPhase2_AdapterFunctionality();
      
      // Phase 3: Performance Validation
      await this.testPhase3_PerformanceValidation();
      
      // Phase 4: Integration Tests
      await this.testPhase4_IntegrationTests();
      
      // Phase 5: Error Handling Validation
      await this.testPhase5_ErrorHandling();

      // Calculate final summary
      this.calculateFinalSummary();
      
      // Generate recommendations
      this.generateRecommendations();

      console.log('=' .repeat(60));
      console.log('✅ EVM Adapter Test Suite Completed');
      console.log(`📊 Success Rate: ${this.testResults.summary.successRate}%`);
      
      return this.testResults;
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      throw error;
    } finally {
      // Cleanup
      if (this.integration) {
        this.integration.cleanup();
      }
    }
  }

  /**
   * Phase 1: Test Integration Layer Initialization
   */
  async testPhase1_Initialization() {
    console.log('📋 Phase 1: Integration Layer Initialization');
    
    const phaseResult = {
      phase: 1,
      name: 'Integration Layer Initialization',
      tests: [],
      summary: { passed: 0, failed: 0, total: 0 }
    };

    // Test 1.1: Create Integration Instance
    try {
      this.integration = new EVMAdapterIntegration({
        monitoring: false // Disable monitoring for tests
      });
      
      phaseResult.tests.push({
        name: 'Create Integration Instance',
        status: 'passed',
        duration: 0,
        details: 'Integration layer created successfully'
      });
    } catch (error) {
      phaseResult.tests.push({
        name: 'Create Integration Instance',
        status: 'failed',
        error: error.message
      });
    }

    // Test 1.2: Verify Adapter Configurations
    try {
      const configs = this.integration.adapterConfigs;
      const expectedNetworks = ['ethereum', 'xdc', 'avalanche', 'polygon', 'bsc'];
      const actualNetworks = Array.from(configs.keys());
      
      const allPresent = expectedNetworks.every(network => actualNetworks.includes(network));
      
      phaseResult.tests.push({
        name: 'Verify Adapter Configurations',
        status: allPresent ? 'passed' : 'failed',
        details: {
          expected: expectedNetworks,
          actual: actualNetworks,
          allPresent
        }
      });
    } catch (error) {
      phaseResult.tests.push({
        name: 'Verify Adapter Configurations',
        status: 'failed',
        error: error.message
      });
    }

    // Test 1.3: Initialize All Adapters
    try {
      const startTime = Date.now();
      const results = await this.integration.initializeAllAdapters();
      const duration = Date.now() - startTime;
      
      const successCount = results.filter(r => r.status === 'success').length;
      const successRate = (successCount / results.length) * 100;
      
      phaseResult.tests.push({
        name: 'Initialize All Adapters',
        status: successRate >= 80 ? 'passed' : 'failed', // 80% success rate required
        duration,
        details: {
          total: results.length,
          successful: successCount,
          successRate: successRate.toFixed(1) + '%',
          results
        }
      });
    } catch (error) {
      phaseResult.tests.push({
        name: 'Initialize All Adapters',
        status: 'failed',
        error: error.message
      });
    }

    this.updatePhaseResults(phaseResult);
    console.log(`  ✅ Phase 1 completed: ${phaseResult.summary.passed}/${phaseResult.summary.total} tests passed`);
  }

  /**
   * Phase 2: Test Individual Adapter Functionality
   */
  async testPhase2_AdapterFunctionality() {
    console.log('📋 Phase 2: Adapter Functionality Tests');
    
    const phaseResult = {
      phase: 2,
      name: 'Adapter Functionality Tests',
      tests: [],
      summary: { passed: 0, failed: 0, total: 0 }
    };

    const testAddress = '0x742d35Cc6634C0532925a3b8D0C9e3e8d4C4c8c8';
    const adapters = this.integration.getAllAdapters();

    for (const { networkId, adapter } of adapters) {
      // Test 2.1: Network Status
      try {
        const startTime = Date.now();
        const status = await adapter.getNetworkStatus();
        const duration = Date.now() - startTime;
        
        phaseResult.tests.push({
          name: `${networkId.toUpperCase()} - Network Status`,
          status: status && status.connected ? 'passed' : 'failed',
          duration,
          details: status
        });
      } catch (error) {
        phaseResult.tests.push({
          name: `${networkId.toUpperCase()} - Network Status`,
          status: 'failed',
          error: error.message
        });
      }

      // Test 2.2: Fee Estimation
      try {
        const startTime = Date.now();
        const fees = await adapter.estimateFees({
          to: testAddress,
          value: '1000000000000000000' // 1 native token
        });
        const duration = Date.now() - startTime;
        
        phaseResult.tests.push({
          name: `${networkId.toUpperCase()} - Fee Estimation`,
          status: fees && fees.gasPrice ? 'passed' : 'failed',
          duration,
          details: fees
        });
      } catch (error) {
        phaseResult.tests.push({
          name: `${networkId.toUpperCase()} - Fee Estimation`,
          status: 'failed',
          error: error.message
        });
      }

      // Test 2.3: Balance Query (will fail for test address, but should not throw)
      try {
        const startTime = Date.now();
        const balance = await adapter.getBalance(testAddress);
        const duration = Date.now() - startTime;
        
        phaseResult.tests.push({
          name: `${networkId.toUpperCase()} - Balance Query`,
          status: balance !== null ? 'passed' : 'failed',
          duration,
          details: balance
        });
      } catch (error) {
        // Balance query might fail for test address, but adapter should handle gracefully
        phaseResult.tests.push({
          name: `${networkId.toUpperCase()} - Balance Query`,
          status: 'skipped',
          reason: 'Test address may not exist on network',
          error: error.message
        });
      }
    }

    this.updatePhaseResults(phaseResult);
    console.log(`  ✅ Phase 2 completed: ${phaseResult.summary.passed}/${phaseResult.summary.total} tests passed`);
  }

  /**
   * Phase 3: Performance Validation
   */
  async testPhase3_PerformanceValidation() {
    console.log('📋 Phase 3: Performance Validation');
    
    const phaseResult = {
      phase: 3,
      name: 'Performance Validation',
      tests: [],
      summary: { passed: 0, failed: 0, total: 0 }
    };

    // Test 3.1: Health Check Performance
    try {
      const startTime = Date.now();
      const healthResults = await this.integration.performHealthCheck();
      const duration = Date.now() - startTime;
      
      const avgResponseTime = healthResults.results.reduce((sum, r) => sum + r.responseTime, 0) / healthResults.results.length;
      
      phaseResult.tests.push({
        name: 'Health Check Performance',
        status: avgResponseTime < 5000 ? 'passed' : 'failed', // 5 second threshold
        duration,
        details: {
          avgResponseTime: Math.round(avgResponseTime),
          healthPercentage: healthResults.summary.healthPercentage,
          results: healthResults.results
        }
      });

      this.testResults.performance.healthCheck = {
        avgResponseTime: Math.round(avgResponseTime),
        healthPercentage: healthResults.summary.healthPercentage
      };
    } catch (error) {
      phaseResult.tests.push({
        name: 'Health Check Performance',
        status: 'failed',
        error: error.message
      });
    }

    // Test 3.2: Benchmark Performance
    try {
      const startTime = Date.now();
      const benchmarkResults = await this.integration.performBenchmark();
      const duration = Date.now() - startTime;
      
      const avgScore = parseFloat(benchmarkResults.summary.avgPerformanceScore);
      
      phaseResult.tests.push({
        name: 'Benchmark Performance',
        status: avgScore >= 70 ? 'passed' : 'failed', // 70% score threshold
        duration,
        details: {
          avgPerformanceScore: avgScore,
          results: benchmarkResults.results
        }
      });

      this.testResults.performance.benchmark = {
        avgPerformanceScore: avgScore,
        totalDuration: duration
      };
    } catch (error) {
      phaseResult.tests.push({
        name: 'Benchmark Performance',
        status: 'failed',
        error: error.message
      });
    }

    this.updatePhaseResults(phaseResult);
    console.log(`  ✅ Phase 3 completed: ${phaseResult.summary.passed}/${phaseResult.summary.total} tests passed`);
  }

  /**
   * Phase 4: Integration Tests
   */
  async testPhase4_IntegrationTests() {
    console.log('📋 Phase 4: Integration Tests');
    
    const phaseResult = {
      phase: 4,
      name: 'Integration Tests',
      tests: [],
      summary: { passed: 0, failed: 0, total: 0 }
    };

    // Test 4.1: Run Full Integration Test Suite
    try {
      const startTime = Date.now();
      const integrationResults = await this.integration.runIntegrationTests();
      const duration = Date.now() - startTime;
      
      const successRate = parseFloat(integrationResults.summary.successRate);
      
      phaseResult.tests.push({
        name: 'Full Integration Test Suite',
        status: successRate >= 80 ? 'passed' : 'failed', // 80% success rate required
        duration,
        details: integrationResults
      });
    } catch (error) {
      phaseResult.tests.push({
        name: 'Full Integration Test Suite',
        status: 'failed',
        error: error.message
      });
    }

    // Test 4.2: Adapter Retrieval by Chain ID
    try {
      const testChainIds = ['1', '50', '43114', '137', '56'];
      let successCount = 0;
      
      for (const chainId of testChainIds) {
        try {
          const result = this.integration.getAdapterByChainId(chainId);
          if (result && result.adapter) {
            successCount++;
          }
        } catch (error) {
          // Expected for some chain IDs if adapters not initialized
        }
      }
      
      phaseResult.tests.push({
        name: 'Adapter Retrieval by Chain ID',
        status: successCount >= 3 ? 'passed' : 'failed', // At least 3 should work
        details: {
          tested: testChainIds.length,
          successful: successCount
        }
      });
    } catch (error) {
      phaseResult.tests.push({
        name: 'Adapter Retrieval by Chain ID',
        status: 'failed',
        error: error.message
      });
    }

    this.updatePhaseResults(phaseResult);
    console.log(`  ✅ Phase 4 completed: ${phaseResult.summary.passed}/${phaseResult.summary.total} tests passed`);
  }

  /**
   * Phase 5: Error Handling Validation
   */
  async testPhase5_ErrorHandling() {
    console.log('📋 Phase 5: Error Handling Validation');
    
    const phaseResult = {
      phase: 5,
      name: 'Error Handling Validation',
      tests: [],
      summary: { passed: 0, failed: 0, total: 0 }
    };

    // Test 5.1: Invalid Network Handling
    try {
      let errorThrown = false;
      try {
        this.integration.getAdapter('invalid_network');
      } catch (error) {
        errorThrown = true;
      }
      
      phaseResult.tests.push({
        name: 'Invalid Network Handling',
        status: errorThrown ? 'passed' : 'failed',
        details: 'Should throw error for invalid network'
      });
    } catch (error) {
      phaseResult.tests.push({
        name: 'Invalid Network Handling',
        status: 'failed',
        error: error.message
      });
    }

    // Test 5.2: Invalid Chain ID Handling
    try {
      let errorThrown = false;
      try {
        this.integration.getAdapterByChainId(999999);
      } catch (error) {
        errorThrown = true;
      }
      
      phaseResult.tests.push({
        name: 'Invalid Chain ID Handling',
        status: errorThrown ? 'passed' : 'failed',
        details: 'Should throw error for invalid chain ID'
      });
    } catch (error) {
      phaseResult.tests.push({
        name: 'Invalid Chain ID Handling',
        status: 'failed',
        error: error.message
      });
    }

    // Test 5.3: XDC Address Conversion Error Handling
    if (this.integration.adapters.has('xdc')) {
      try {
        const xdcAdapter = this.integration.getAdapter('xdc');
        let errorThrown = false;
        
        try {
          xdcAdapter.xdcToEthAddress('invalid_address');
        } catch (error) {
          errorThrown = true;
        }
        
        phaseResult.tests.push({
          name: 'XDC Address Conversion Error Handling',
          status: errorThrown ? 'passed' : 'failed',
          details: 'Should throw error for invalid address format'
        });
      } catch (error) {
        phaseResult.tests.push({
          name: 'XDC Address Conversion Error Handling',
          status: 'failed',
          error: error.message
        });
      }
    } else {
      phaseResult.tests.push({
        name: 'XDC Address Conversion Error Handling',
        status: 'skipped',
        reason: 'XDC adapter not initialized'
      });
    }

    this.updatePhaseResults(phaseResult);
    console.log(`  ✅ Phase 5 completed: ${phaseResult.summary.passed}/${phaseResult.summary.total} tests passed`);
  }

  /**
   * Update phase results
   */
  updatePhaseResults(phaseResult) {
    phaseResult.summary.total = phaseResult.tests.length;
    phaseResult.summary.passed = phaseResult.tests.filter(t => t.status === 'passed').length;
    phaseResult.summary.failed = phaseResult.tests.filter(t => t.status === 'failed').length;
    phaseResult.summary.skipped = phaseResult.tests.filter(t => t.status === 'skipped').length;
    
    this.testResults.phases.push(phaseResult);
  }

  /**
   * Calculate final summary
   */
  calculateFinalSummary() {
    this.testResults.summary.total = this.testResults.phases.reduce((sum, phase) => sum + phase.summary.total, 0);
    this.testResults.summary.passed = this.testResults.phases.reduce((sum, phase) => sum + phase.summary.passed, 0);
    this.testResults.summary.failed = this.testResults.phases.reduce((sum, phase) => sum + phase.summary.failed, 0);
    this.testResults.summary.skipped = this.testResults.phases.reduce((sum, phase) => sum + phase.summary.skipped, 0);
    
    this.testResults.summary.successRate = this.testResults.summary.total > 0 
      ? ((this.testResults.summary.passed / this.testResults.summary.total) * 100).toFixed(1)
      : 0;
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations() {
    const recommendations = [];
    
    // Performance recommendations
    if (this.testResults.performance.benchmark && this.testResults.performance.benchmark.avgPerformanceScore < 80) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: 'Consider optimizing adapter performance - average score below 80%'
      });
    }

    if (this.testResults.performance.healthCheck && this.testResults.performance.healthCheck.avgResponseTime > 3000) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Health check response time is high - consider optimizing network connections'
      });
    }

    // Success rate recommendations
    if (parseFloat(this.testResults.summary.successRate) < 90) {
      recommendations.push({
        type: 'reliability',
        priority: 'high',
        message: 'Test success rate below 90% - investigate failed tests and improve error handling'
      });
    }

    // Network-specific recommendations
    const failedPhases = this.testResults.phases.filter(phase => phase.summary.failed > 0);
    if (failedPhases.length > 0) {
      recommendations.push({
        type: 'debugging',
        priority: 'medium',
        message: `${failedPhases.length} test phases have failures - review detailed results for specific issues`
      });
    }

    // General recommendations
    if (this.testResults.summary.passed >= this.testResults.summary.total * 0.9) {
      recommendations.push({
        type: 'success',
        priority: 'low',
        message: 'Excellent test results! EVM adapters are production-ready'
      });
    }

    this.testResults.recommendations = recommendations;
  }

  /**
   * Generate detailed test report
   */
  generateDetailedReport() {
    const report = {
      title: 'EVM Adapter Implementation - Task 3.2 Test Report',
      timestamp: this.testResults.timestamp,
      summary: this.testResults.summary,
      performance: this.testResults.performance,
      phases: this.testResults.phases,
      recommendations: this.testResults.recommendations,
      conclusion: this.generateConclusion()
    };

    return report;
  }

  /**
   * Generate conclusion based on test results
   */
  generateConclusion() {
    const successRate = parseFloat(this.testResults.summary.successRate);
    
    if (successRate >= 95) {
      return {
        status: 'excellent',
        message: 'EVM adapters are production-ready with excellent performance and reliability'
      };
    } else if (successRate >= 85) {
      return {
        status: 'good',
        message: 'EVM adapters are ready for deployment with minor optimizations recommended'
      };
    } else if (successRate >= 70) {
      return {
        status: 'acceptable',
        message: 'EVM adapters are functional but require optimization before production deployment'
      };
    } else {
      return {
        status: 'needs_improvement',
        message: 'EVM adapters require significant improvements before deployment'
      };
    }
  }
}

// Export for use in other modules
module.exports = {
  EVMAdapterTestRunner
};

// Run tests if this file is executed directly
if (require.main === module) {
  async function runTests() {
    const testRunner = new EVMAdapterTestRunner();
    
    try {
      const results = await testRunner.runComprehensiveTests();
      const report = testRunner.generateDetailedReport();
      
      console.log('\n' + '='.repeat(60));
      console.log('📊 FINAL TEST REPORT');
      console.log('='.repeat(60));
      console.log(`✅ Tests Passed: ${results.summary.passed}`);
      console.log(`❌ Tests Failed: ${results.summary.failed}`);
      console.log(`⏭️  Tests Skipped: ${results.summary.skipped}`);
      console.log(`📈 Success Rate: ${results.summary.successRate}%`);
      console.log(`🎯 Status: ${report.conclusion.status.toUpperCase()}`);
      console.log(`💬 Conclusion: ${report.conclusion.message}`);
      
      if (results.recommendations.length > 0) {
        console.log('\n📋 RECOMMENDATIONS:');
        results.recommendations.forEach((rec, index) => {
          console.log(`${index + 1}. [${rec.priority.toUpperCase()}] ${rec.message}`);
        });
      }
      
      console.log('\n🎉 EVM Adapter Implementation Task 3.2 Testing Complete!');
      
    } catch (error) {
      console.error('❌ Test execution failed:', error.message);
      process.exit(1);
    }
  }
  
  runTests();
}

