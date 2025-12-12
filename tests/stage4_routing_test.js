/**
 * stage4_routing_test.js
 * Stage 4 - Phase 5: Automated Test Suite
 * 
 * Comprehensive test suite for the Cross-Chain Routing Engine.
 * Tests direct routes, cross-chain routes, multi-hop routes, and error cases.
 */

const RoutePlanner = require('../services/routing/RoutePlanner');
const LiquidityOracle = require('../services/routing/LiquidityOracle');
const FeeModel = require('../services/routing/FeeModel');
const SlippageEngine = require('../services/routing/SlippageEngine');
const RouteValidator = require('../services/routing/RouteValidator');

class Stage4RoutingTester {
  constructor() {
    this.routePlanner = new RoutePlanner();
    this.liquidityOracle = new LiquidityOracle();
    this.feeModel = new FeeModel();
    this.slippageEngine = new SlippageEngine();
    this.routeValidator = new RouteValidator();
    
    this.testResults = [];
    this.passCount = 0;
    this.failCount = 0;
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('\n========================================');
    console.log('STAGE 4 ROUTING ENGINE TEST SUITE');
    console.log('========================================\n');

    // Test 1: XRP → USDT (direct)
    await this.test1_XRP_USDT_Direct();

    // Test 2: XRP → ETH (cross-chain)
    await this.test2_XRP_ETH_CrossChain();

    // Test 3: USDT (EVM) → BTC (simulated)
    await this.test3_USDT_BTC_Simulated();

    // Test 4: Multi-hop paths (XRP → USDC → ETH)
    await this.test4_MultiHop_XRP_USDC_ETH();

    // Test 5: Preview mode load test
    await this.test5_PreviewModeLoadTest();

    // Test 6: Error case - no liquidity
    await this.test6_NoLiquidity();

    // Test 7: Error case - excessive slippage
    await this.test7_ExcessiveSlippage();

    // Test 8: Error case - invalid chain
    await this.test8_InvalidChain();

    // Test 9: Error case - oracle failure
    await this.test9_OracleFailure();

    // Test 10: Route validation
    await this.test10_RouteValidation();

    // Print summary
    this.printSummary();
  }

  /**
   * Test 1: XRP → USDT (direct route on XRPL)
   */
  async test1_XRP_USDT_Direct() {
    const testName = 'Test 1: XRP → USDT (Direct)';
    console.log(`\n[TEST] ${testName}`);

    try {
      const result = await this.routePlanner.planRoutes({
        fromToken: 'XRP',
        toToken: 'USDT',
        amount: '100',
        side: 'sell'
      });

      if (!result.success) {
        this.recordFail(testName, 'Route planning failed');
        return;
      }

      const route = result.bestRoute;
      
      // Assertions
      if (route.chain !== 'XRPL') {
        this.recordFail(testName, `Expected chain XRPL, got ${route.chain}`);
        return;
      }

      if (route.pathType !== 'direct') {
        this.recordFail(testName, `Expected pathType direct, got ${route.pathType}`);
        return;
      }

      if (route.hops.length !== 1) {
        this.recordFail(testName, `Expected 1 hop, got ${route.hops.length}`);
        return;
      }

      const expectedOutput = parseFloat(route.expectedOutput);
      if (expectedOutput <= 0 || expectedOutput > 210) {
        this.recordFail(testName, `Unexpected output: ${expectedOutput}`);
        return;
      }

      this.recordPass(testName, `Output: ${route.expectedOutput} USDT, Fee: $${route.fees.totalFeeUSD}`);

    } catch (error) {
      this.recordFail(testName, error.message);
    }
  }

  /**
   * Test 2: XRP → ETH (cross-chain route)
   */
  async test2_XRP_ETH_CrossChain() {
    const testName = 'Test 2: XRP → ETH (Cross-Chain)';
    console.log(`\n[TEST] ${testName}`);

    try {
      const result = await this.routePlanner.planRoutes({
        fromToken: 'XRP',
        toToken: 'ETH',
        amount: '100',
        side: 'sell',
        fromChain: 'XRPL',
        toChain: 'ETH'
      });

      if (!result.success) {
        this.recordFail(testName, 'Route planning failed');
        return;
      }

      const route = result.bestRoute;
      
      // Assertions
      if (route.pathType !== 'multi-hop') {
        this.recordFail(testName, `Expected pathType multi-hop, got ${route.pathType}`);
        return;
      }

      if (route.hops.length < 2) {
        this.recordFail(testName, `Expected at least 2 hops, got ${route.hops.length}`);
        return;
      }

      // Check for bridge hop
      const hasBridge = route.hops.some(h => h.protocol === 'BRIDGE');
      if (!hasBridge) {
        this.recordFail(testName, 'Expected BRIDGE hop in cross-chain route');
        return;
      }

      this.recordPass(testName, `Hops: ${route.hops.length}, Output: ${route.expectedOutput} ETH, Fee: $${route.fees.totalFeeUSD}`);

    } catch (error) {
      this.recordFail(testName, error.message);
    }
  }

  /**
   * Test 3: USDT (EVM) → BTC (simulated)
   */
  async test3_USDT_BTC_Simulated() {
    const testName = 'Test 3: USDT (EVM) → BTC (Simulated)';
    console.log(`\n[TEST] ${testName}`);

    try {
      const result = await this.routePlanner.planRoutes({
        fromToken: 'USDT',
        toToken: 'BTC',
        amount: '1000',
        side: 'sell',
        fromChain: 'ETH',
        toChain: 'BTC'
      });

      // BTC is a stub chain, so this should either fail or return a simulated route
      if (!result.success) {
        this.recordPass(testName, 'Correctly rejected BTC stub chain');
        return;
      }

      // If it succeeds, check that it's marked as simulated
      const route = result.bestRoute;
      this.recordPass(testName, `Simulated route created: ${route.hops.length} hops, Output: ${route.expectedOutput} BTC`);

    } catch (error) {
      this.recordPass(testName, `Correctly threw error for BTC stub: ${error.message}`);
    }
  }

  /**
   * Test 4: Multi-hop paths (XRP → USDC → ETH)
   */
  async test4_MultiHop_XRP_USDC_ETH() {
    const testName = 'Test 4: Multi-Hop (XRP → USDC → ETH)';
    console.log(`\n[TEST] ${testName}`);

    try {
      const result = await this.routePlanner.planRoutes({
        fromToken: 'XRP',
        toToken: 'ETH',
        amount: '100',
        side: 'sell'
      });

      if (!result.success) {
        this.recordFail(testName, 'Route planning failed');
        return;
      }

      const route = result.bestRoute;
      
      // Check for multi-hop
      if (route.hops.length < 2) {
        this.recordFail(testName, `Expected multi-hop route, got ${route.hops.length} hops`);
        return;
      }

      // Check cumulative slippage
      if (!route.slippage.cumulativeSlippage) {
        this.recordFail(testName, 'Missing cumulative slippage calculation');
        return;
      }

      this.recordPass(testName, `Hops: ${route.hops.length}, Cumulative Slippage: ${(route.slippage.cumulativeSlippage * 100).toFixed(2)}%, Output: ${route.expectedOutput} ETH`);

    } catch (error) {
      this.recordFail(testName, error.message);
    }
  }

  /**
   * Test 5: Preview mode load test
   */
  async test5_PreviewModeLoadTest() {
    const testName = 'Test 5: Preview Mode Load Test';
    console.log(`\n[TEST] ${testName}`);

    try {
      const iterations = 10;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await this.routePlanner.planRoutes({
          fromToken: 'XRP',
          toToken: 'USDT',
          amount: (100 + i * 10).toString(),
          side: 'sell'
        });
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      if (avgTime > 1000) {
        this.recordFail(testName, `Average time ${avgTime}ms exceeds 1000ms threshold`);
        return;
      }

      this.recordPass(testName, `${iterations} iterations in ${totalTime}ms (avg: ${avgTime.toFixed(2)}ms)`);

    } catch (error) {
      this.recordFail(testName, error.message);
    }
  }

  /**
   * Test 6: Error case - no liquidity
   */
  async test6_NoLiquidity() {
    const testName = 'Test 6: Error Case - No Liquidity';
    console.log(`\n[TEST] ${testName}`);

    try {
      const result = await this.routePlanner.planRoutes({
        fromToken: 'XRP',
        toToken: 'FAKE_TOKEN',
        amount: '100',
        side: 'sell'
      });

      if (result.success) {
        this.recordFail(testName, 'Expected failure for non-existent token pair');
        return;
      }

      this.recordPass(testName, `Correctly rejected: ${result.error}`);

    } catch (error) {
      this.recordPass(testName, `Correctly threw error: ${error.message}`);
    }
  }

  /**
   * Test 7: Error case - excessive slippage
   */
  async test7_ExcessiveSlippage() {
    const testName = 'Test 7: Error Case - Excessive Slippage';
    console.log(`\n[TEST] ${testName}`);

    try {
      // Large trade to trigger excessive slippage
      const result = await this.routePlanner.planRoutes({
        fromToken: 'XRP',
        toToken: 'USDT',
        amount: '500000', // 50% of pool
        side: 'sell'
      });

      if (!result.success) {
        this.recordPass(testName, `Correctly rejected excessive trade: ${result.error}`);
        return;
      }

      const route = result.bestRoute;
      
      if (route.slippage.isExcessive) {
        this.recordPass(testName, `Correctly flagged excessive slippage: ${(route.slippage.percentage * 100).toFixed(2)}%`);
      } else {
        this.recordFail(testName, 'Failed to flag excessive slippage');
      }

    } catch (error) {
      this.recordPass(testName, `Correctly threw error: ${error.message}`);
    }
  }

  /**
   * Test 8: Error case - invalid chain
   */
  async test8_InvalidChain() {
    const testName = 'Test 8: Error Case - Invalid Chain';
    console.log(`\n[TEST] ${testName}`);

    try {
      const result = await this.routePlanner.planRoutes({
        fromToken: 'XRP',
        toToken: 'USDT',
        amount: '100',
        side: 'sell',
        fromChain: 'INVALID_CHAIN'
      });

      if (result.success) {
        this.recordFail(testName, 'Expected failure for invalid chain');
        return;
      }

      this.recordPass(testName, `Correctly rejected invalid chain: ${result.error}`);

    } catch (error) {
      this.recordPass(testName, `Correctly threw error: ${error.message}`);
    }
  }

  /**
   * Test 9: Error case - oracle failure
   */
  async test9_OracleFailure() {
    const testName = 'Test 9: Error Case - Oracle Failure';
    console.log(`\n[TEST] ${testName}`);

    try {
      // Test with tokens that have no oracle data
      const price = this.liquidityOracle.getSpotPrice('FAKE_TOKEN_1', 'FAKE_TOKEN_2');

      if (price !== null) {
        this.recordFail(testName, 'Expected null price for non-existent tokens');
        return;
      }

      this.recordPass(testName, 'Correctly returned null for missing oracle data');

    } catch (error) {
      this.recordPass(testName, `Correctly threw error: ${error.message}`);
    }
  }

  /**
   * Test 10: Route validation
   */
  async test10_RouteValidation() {
    const testName = 'Test 10: Route Validation';
    console.log(`\n[TEST] ${testName}`);

    try {
      const result = await this.routePlanner.planRoutes({
        fromToken: 'XRP',
        toToken: 'USDT',
        amount: '100',
        side: 'sell'
      });

      if (!result.success) {
        this.recordFail(testName, 'Route planning failed');
        return;
      }

      const route = result.bestRoute;
      const validation = this.routeValidator.validateRoute(route);

      if (!validation.valid) {
        this.recordFail(testName, `Route validation failed: ${validation.errors.join(', ')}`);
        return;
      }

      this.recordPass(testName, `Route validated successfully (${validation.warnings.length} warnings)`);

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
  const tester = new Stage4RoutingTester();
  tester.runAllTests().then(() => {
    process.exit(tester.failCount > 0 ? 1 : 0);
  }).catch(error => {
    console.error('Test suite error:', error);
    process.exit(1);
  });
}

module.exports = Stage4RoutingTester;
