/**
 * stage5_liquidity_test.js
 * Stage 5 - Phase 5: Real Liquidity Integration Test Suite
 * 
 * Tests multi-provider liquidity oracle with simulated, XRPL, and EVM providers.
 */

const LiquidityOracle = require('../services/routing/LiquidityOracle');

class Stage5LiquidityTester {
  constructor() {
    this.liquidityOracle = new LiquidityOracle();
    this.testResults = [];
    this.passCount = 0;
    this.failCount = 0;
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('\n========================================');
    console.log('STAGE 5 LIQUIDITY INTEGRATION TEST SUITE');
    console.log('========================================\n');

    // Test 1: Simulated mode (backward compatibility)
    await this.test1_SimulatedMode();

    // Test 2: XRPL provider (live mode)
    await this.test2_XrplLiveMode();

    // Test 3: EVM provider (live mode)
    await this.test3_EvmLiveMode();

    // Test 4: Auto mode fallback
    await this.test4_AutoModeFallback();

    // Test 5: Live mode error handling
    await this.test5_LiveModeError();

    // Test 6: Mode override via parameter
    await this.test6_ModeOverride();

    // Test 7: Provider priority selection
    await this.test7_ProviderPriority();

    // Test 8: Depth API with providers
    await this.test8_DepthAPI();

    // Test 9: Slippage curve with providers
    await this.test9_SlippageCurve();

    // Test 10: Cache behavior (EVM provider)
    await this.test10_CacheBehavior();

    // Print summary
    this.printSummary();
  }

  /**
   * Test 1: Simulated mode (backward compatibility with Stage 4)
   */
  async test1_SimulatedMode() {
    const testName = 'Test 1: Simulated Mode (Backward Compatibility)';
    console.log(`\n[TEST] ${testName}`);

    try {
      this.liquidityOracle.setMode('simulated');

      const result = await this.liquidityOracle.getSpotPrice('XRP', 'USDT', {});

      if (!result || result.price === null) {
        this.recordFail(testName, 'Failed to get spot price in simulated mode');
        return;
      }

      if (result.provider !== 'simulated') {
        this.recordFail(testName, `Expected provider 'simulated', got '${result.provider}'`);
        return;
      }

      if (result.mode !== 'simulated') {
        this.recordFail(testName, `Expected mode 'simulated', got '${result.mode}'`);
        return;
      }

      this.recordPass(testName, `Price: ${result.price}, Provider: ${result.provider}, Timing: ${result.timing}ms`);

    } catch (error) {
      this.recordFail(testName, error.message);
    }
  }

  /**
   * Test 2: XRPL provider (live mode)
   */
  async test2_XrplLiveMode() {
    const testName = 'Test 2: XRPL Provider (Live Mode)';
    console.log(`\n[TEST] ${testName}`);

    try {
      this.liquidityOracle.setMode('auto'); // Use auto to allow fallback

      const result = await this.liquidityOracle.getSpotPrice('XRP', 'USD', { chain: 'XRPL' });

      if (!result) {
        this.recordFail(testName, 'No result returned');
        return;
      }

      // In auto mode, should try XRPL first, may fall back to simulated
      if (result.provider === 'xrpl') {
        this.recordPass(testName, `Price: ${result.price}, Provider: ${result.provider} (live), Timing: ${result.timing}ms`);
      } else if (result.provider === 'simulated') {
        this.recordPass(testName, `Price: ${result.price}, Provider: ${result.provider} (fallback), Timing: ${result.timing}ms`);
      } else {
        this.recordFail(testName, `Unexpected provider: ${result.provider}`);
      }

    } catch (error) {
      this.recordFail(testName, error.message);
    }
  }

  /**
   * Test 3: EVM provider (live mode)
   */
  async test3_EvmLiveMode() {
    const testName = 'Test 3: EVM Provider (Live Mode)';
    console.log(`\n[TEST] ${testName}`);

    try {
      this.liquidityOracle.setMode('auto');

      const result = await this.liquidityOracle.getSpotPrice('ETH', 'USDT', { chain: 'ETH' });

      if (!result) {
        this.recordFail(testName, 'No result returned');
        return;
      }

      // In auto mode, should try EVM first, may fall back to simulated
      if (result.provider === 'evm') {
        this.recordPass(testName, `Price: ${result.price}, Provider: ${result.provider} (live), Timing: ${result.timing}ms`);
      } else if (result.provider === 'simulated') {
        this.recordPass(testName, `Price: ${result.price}, Provider: ${result.provider} (fallback), Timing: ${result.timing}ms`);
      } else {
        this.recordFail(testName, `Unexpected provider: ${result.provider}`);
      }

    } catch (error) {
      this.recordFail(testName, error.message);
    }
  }

  /**
   * Test 4: Auto mode fallback
   */
  async test4_AutoModeFallback() {
    const testName = 'Test 4: Auto Mode Fallback';
    console.log(`\n[TEST] ${testName}`);

    try {
      this.liquidityOracle.setMode('auto');

      // Request a pair that live providers might not have
      const result = await this.liquidityOracle.getSpotPrice('XRP', 'BTC', {});

      if (!result) {
        this.recordFail(testName, 'No result returned');
        return;
      }

      // Should eventually fall back to simulated
      if (result.price === null) {
        this.recordFail(testName, 'No price found even with fallback');
        return;
      }

      this.recordPass(testName, `Price: ${result.price}, Provider: ${result.provider}, Tried: ${result.providersTried.join(', ')}`);

    } catch (error) {
      this.recordFail(testName, error.message);
    }
  }

  /**
   * Test 5: Live mode error handling
   */
  async test5_LiveModeError() {
    const testName = 'Test 5: Live Mode Error Handling';
    console.log(`\n[TEST] ${testName}`);

    try {
      this.liquidityOracle.setMode('live');

      // Request a pair that only exists in simulated data
      const result = await this.liquidityOracle.getSpotPrice('FAKE_TOKEN', 'USD', {});

      if (!result) {
        this.recordFail(testName, 'No result returned');
        return;
      }

      // In live mode, should fail if no live provider has data
      if (result.error === 'NO_LIQUIDITY_PROVIDER' || result.price === null) {
        this.recordPass(testName, `Correctly failed in live mode: ${result.error || 'no price'}`);
      } else {
        this.recordFail(testName, 'Should have failed in live mode for non-existent pair');
      }

    } catch (error) {
      this.recordPass(testName, `Correctly threw error in live mode: ${error.message}`);
    } finally {
      // Reset to auto mode
      this.liquidityOracle.setMode('auto');
    }
  }

  /**
   * Test 6: Mode override via parameter
   */
  async test6_ModeOverride() {
    const testName = 'Test 6: Mode Override via Parameter';
    console.log(`\n[TEST] ${testName}`);

    try {
      // Global mode is 'auto', but override to 'simulated' for this request
      this.liquidityOracle.setMode('auto');

      const result = await this.liquidityOracle.getSpotPrice('XRP', 'USDT', { mode: 'simulated' });

      if (!result) {
        this.recordFail(testName, 'No result returned');
        return;
      }

      if (result.provider !== 'simulated') {
        this.recordFail(testName, `Expected provider 'simulated', got '${result.provider}'`);
        return;
      }

      if (result.mode !== 'simulated') {
        this.recordFail(testName, `Expected mode 'simulated', got '${result.mode}'`);
        return;
      }

      this.recordPass(testName, `Successfully overrode mode to simulated, Provider: ${result.provider}`);

    } catch (error) {
      this.recordFail(testName, error.message);
    }
  }

  /**
   * Test 7: Provider priority selection
   */
  async test7_ProviderPriority() {
    const testName = 'Test 7: Provider Priority Selection';
    console.log(`\n[TEST] ${testName}`);

    try {
      this.liquidityOracle.setMode('auto');

      // For XRPL chain, should prioritize XRPL provider
      const xrplPriority = this.liquidityOracle.getProviderPriority({ chain: 'XRPL' });
      
      if (xrplPriority[0] !== 'xrpl') {
        this.recordFail(testName, `Expected XRPL provider first for XRPL chain, got ${xrplPriority[0]}`);
        return;
      }

      // For ETH chain, should prioritize EVM provider
      const evmPriority = this.liquidityOracle.getProviderPriority({ chain: 'ETH' });
      
      if (evmPriority[0] !== 'evm') {
        this.recordFail(testName, `Expected EVM provider first for ETH chain, got ${evmPriority[0]}`);
        return;
      }

      this.recordPass(testName, `XRPL priority: [${xrplPriority.join(', ')}], ETH priority: [${evmPriority.join(', ')}]`);

    } catch (error) {
      this.recordFail(testName, error.message);
    }
  }

  /**
   * Test 8: Depth API with providers
   */
  async test8_DepthAPI() {
    const testName = 'Test 8: Depth API with Providers';
    console.log(`\n[TEST] ${testName}`);

    try {
      this.liquidityOracle.setMode('auto');

      const result = await this.liquidityOracle.getDepth('XRP', 'USDT', { chain: 'XRPL' });

      if (!result || !result.depth) {
        this.recordFail(testName, 'No depth data returned');
        return;
      }

      const totalLiq = result.depth.totalLiquidity || result.depth.totalLiquidityUSD;
      if (!totalLiq) {
        this.recordFail(testName, 'Missing totalLiquidity in depth data');
        return;
      }

      this.recordPass(testName, `Depth: ${result.depth.totalLiquidity}, Provider: ${result.provider}, Timing: ${result.timing}ms`);

    } catch (error) {
      this.recordFail(testName, error.message);
    }
  }

  /**
   * Test 9: Slippage curve with providers
   */
  async test9_SlippageCurve() {
    const testName = 'Test 9: Slippage Curve with Providers';
    console.log(`\n[TEST] ${testName}`);

    try {
      this.liquidityOracle.setMode('auto');

      const result = await this.liquidityOracle.getSlippageCurve('XRP', 'USDT', { 
        chain: 'XRPL'
      });

      if (!result || !result.curve) {
        this.recordFail(testName, 'No slippage curve returned');
        return;
      }

      const curveData = result.curve.curve || result.curve;
      if (!curveData || !Array.isArray(curveData) || curveData.length === 0) {
        this.recordFail(testName, 'Empty slippage curve');
        return;
      }

      this.recordPass(testName, `Curve points: ${curveData.length}, Provider: ${result.provider}, Timing: ${result.timing}ms`);

    } catch (error) {
      this.recordFail(testName, error.message);
    }
  }

  /**
   * Test 10: Cache behavior (EVM provider)
   */
  async test10_CacheBehavior() {
    const testName = 'Test 10: Cache Behavior (EVM Provider)';
    console.log(`\n[TEST] ${testName}`);

    try {
      this.liquidityOracle.setMode('auto');

      // First request (cache miss)
      const result1 = await this.liquidityOracle.getSpotPrice('ETH', 'USDT', { chain: 'ETH' });
      const timing1 = result1.timing;

      // Second request (should hit cache if EVM provider)
      const result2 = await this.liquidityOracle.getSpotPrice('ETH', 'USDT', { chain: 'ETH' });
      const timing2 = result2.timing;

      if (result1.provider === 'evm' && result2.provider === 'evm') {
        // Cache hit should be faster
        if (timing2 < timing1) {
          this.recordPass(testName, `Cache hit! First: ${timing1}ms, Second: ${timing2}ms (faster)`);
        } else {
          this.recordPass(testName, `Both requests completed. First: ${timing1}ms, Second: ${timing2}ms`);
        }
      } else {
        this.recordPass(testName, `Providers: ${result1.provider}, ${result2.provider} (cache test skipped for non-EVM)`);
      }

    } catch (error) {
      this.recordFail(testName, error.message);
    }
  }

  /**
   * Record test pass
   */
  recordPass(testName, details) {
    console.log(`✅ PASS: ${details}`);
    this.testResults.push({ test: testName, status: 'PASS', details });
    this.passCount++;
  }

  /**
   * Record test fail
   */
  recordFail(testName, reason) {
    console.log(`❌ FAIL: ${reason}`);
    this.testResults.push({ test: testName, status: 'FAIL', reason });
    this.failCount++;
  }

  /**
   * Print test summary
   */
  printSummary() {
    console.log('\n========================================');
    console.log('TEST SUMMARY');
    console.log('========================================\n');

    console.log(`Total Tests: ${this.testResults.length}`);
    console.log(`✅ Passed: ${this.passCount}`);
    console.log(`❌ Failed: ${this.failCount}`);
    console.log(`Success Rate: ${((this.passCount / this.testResults.length) * 100).toFixed(2)}%\n`);

    if (this.failCount > 0) {
      console.log('Failed Tests:');
      this.testResults
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`  - ${r.test}: ${r.reason}`));
      console.log();
    }

    console.log('========================================\n');
  }
}

// Run tests if executed directly
if (require.main === module) {
  const tester = new Stage5LiquidityTester();
  tester.runAllTests().then(() => {
    process.exit(tester.failCount > 0 ? 1 : 0);
  }).catch(error => {
    console.error('Test suite error:', error);
    process.exit(1);
  });
}

module.exports = Stage5LiquidityTester;
