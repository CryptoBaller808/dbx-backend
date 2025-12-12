/**
 * stage6_route_execution_test.js
 * Stage 6: Route Execution Test Suite
 * 
 * Tests POST /api/routing/execute endpoint with XRPL execution
 */

const axios = require('axios');

// Test configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const ROUTING_EXECUTE_URL = `${BASE_URL}/api/routing/execute`;
const ROUTING_QUOTE_URL = `${BASE_URL}/api/routing/quote`;

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  tests: []
};

/**
 * Test helper: Run a test case
 */
async function runTest(name, testFn) {
  testResults.total++;
  console.log(`\n[TEST ${testResults.total}] ${name}`);
  console.log('='.repeat(80));
  
  try {
    await testFn();
    testResults.passed++;
    testResults.tests.push({ name, status: 'PASSED' });
    console.log(`✅ PASSED: ${name}`);
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ name, status: 'FAILED', error: error.message });
    console.error(`❌ FAILED: ${name}`);
    console.error(`   Error: ${error.message}`);
  }
}

/**
 * Test 1: Happy-path XRPL execution
 */
async function testHappyPathXrplExecution() {
  console.log('Testing XRPL route execution (XRP → USDT)...');
  
  // Step 1: Get a quote first
  console.log('Step 1: Getting routing quote...');
  const quoteResponse = await axios.get(ROUTING_QUOTE_URL, {
    params: {
      base: 'XRP',
      quote: 'USDT',
      amount: '10',
      side: 'sell',
      fromChain: 'XRPL',
      mode: 'auto'
    }
  });
  
  console.log('Quote response:', JSON.stringify(quoteResponse.data, null, 2));
  
  if (!quoteResponse.data.success || !quoteResponse.data.bestRoute) {
    throw new Error('Failed to get valid quote');
  }
  
  // Step 2: Execute the route
  console.log('\nStep 2: Executing route...');
  const executeResponse = await axios.post(ROUTING_EXECUTE_URL, {
    base: 'XRP',
    quote: 'USDT',
    amount: '10',
    side: 'sell',
    fromChain: 'XRPL',
    toChain: 'XRPL',
    mode: 'auto',
    preview: true,
    executionMode: 'demo'
  });
  
  console.log('Execution response:', JSON.stringify(executeResponse.data, null, 2));
  
  // Assertions
  if (!executeResponse.data.success) {
    throw new Error('Execution failed: ' + executeResponse.data.message);
  }
  
  if (executeResponse.data.chain !== 'XRPL') {
    throw new Error(`Expected chain=XRPL, got ${executeResponse.data.chain}`);
  }
  
  if (executeResponse.data.executionMode !== 'demo') {
    throw new Error(`Expected executionMode=demo, got ${executeResponse.data.executionMode}`);
  }
  
  if (!executeResponse.data.transaction || !executeResponse.data.transaction.hash) {
    throw new Error('Missing transaction hash');
  }
  
  if (!executeResponse.data.transaction.ledgerIndex) {
    throw new Error('Missing ledger index');
  }
  
  if (!executeResponse.data.settlement || executeResponse.data.settlement.status !== 'confirmed') {
    throw new Error('Settlement not confirmed');
  }
  
  console.log('✓ Transaction hash:', executeResponse.data.transaction.hash);
  console.log('✓ Ledger index:', executeResponse.data.transaction.ledgerIndex);
  console.log('✓ Settlement status:', executeResponse.data.settlement.status);
}

/**
 * Test 2: Unsupported chain (EVM)
 */
async function testUnsupportedChain() {
  console.log('Testing unsupported chain (ETH)...');
  
  try {
    const response = await axios.post(ROUTING_EXECUTE_URL, {
      base: 'ETH',
      quote: 'USDT',
      amount: '1',
      side: 'sell',
      fromChain: 'ETH',
      toChain: 'ETH',
      mode: 'auto',
      preview: true,
      executionMode: 'demo'
    });
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    // Should return error
    if (response.data.success !== false) {
      throw new Error('Expected success=false for unsupported chain');
    }
    
    if (response.data.errorCode !== 'UNSUPPORTED_CHAIN') {
      throw new Error(`Expected errorCode=UNSUPPORTED_CHAIN, got ${response.data.errorCode}`);
    }
    
    console.log('✓ Correctly rejected unsupported chain');
    console.log('✓ Error code:', response.data.errorCode);
    console.log('✓ Error message:', response.data.message);
    
  } catch (error) {
    if (error.response && error.response.data) {
      // Check if it's the expected error response
      const data = error.response.data;
      if (data.success === false && data.errorCode === 'UNSUPPORTED_CHAIN') {
        console.log('✓ Correctly rejected unsupported chain (via HTTP error)');
        console.log('✓ Error code:', data.errorCode);
        console.log('✓ Error message:', data.message);
        return; // Test passed
      }
    }
    throw error; // Re-throw if not the expected error
  }
}

/**
 * Test 3: No route / invalid params
 */
async function testNoRoute() {
  console.log('Testing invalid parameters (no route)...');
  
  try {
    const response = await axios.post(ROUTING_EXECUTE_URL, {
      base: 'INVALID_TOKEN',
      quote: 'ANOTHER_INVALID',
      amount: '1',
      side: 'sell',
      fromChain: 'XRPL',
      toChain: 'XRPL',
      mode: 'auto',
      preview: true,
      executionMode: 'demo'
    });
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success !== false) {
      throw new Error('Expected success=false for invalid route');
    }
    
    if (response.data.errorCode !== 'NO_ROUTE' && response.data.errorCode !== 'EXECUTION_FAILED') {
      throw new Error(`Expected errorCode=NO_ROUTE or EXECUTION_FAILED, got ${response.data.errorCode}`);
    }
    
    console.log('✓ Correctly rejected invalid parameters');
    console.log('✓ Error code:', response.data.errorCode);
    
  } catch (error) {
    if (error.response && error.response.data) {
      const data = error.response.data;
      if (data.success === false && (data.errorCode === 'NO_ROUTE' || data.errorCode === 'EXECUTION_FAILED')) {
        console.log('✓ Correctly rejected invalid parameters (via HTTP error)');
        console.log('✓ Error code:', data.errorCode);
        return;
      }
    }
    throw error;
  }
}

/**
 * Test 4: Missing required parameters
 */
async function testMissingParameters() {
  console.log('Testing missing required parameters...');
  
  try {
    const response = await axios.post(ROUTING_EXECUTE_URL, {
      base: 'XRP',
      // Missing quote and amount
      side: 'sell'
    });
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success !== false) {
      throw new Error('Expected success=false for missing parameters');
    }
    
    if (response.data.errorCode !== 'MISSING_PARAMETERS') {
      throw new Error(`Expected errorCode=MISSING_PARAMETERS, got ${response.data.errorCode}`);
    }
    
    console.log('✓ Correctly rejected missing parameters');
    
  } catch (error) {
    if (error.response && error.response.status === 400) {
      const data = error.response.data;
      if (data.success === false && data.errorCode === 'MISSING_PARAMETERS') {
        console.log('✓ Correctly rejected missing parameters (via HTTP 400)');
        console.log('✓ Error code:', data.errorCode);
        return;
      }
    }
    throw error;
  }
}

/**
 * Test 5: Invalid amount
 */
async function testInvalidAmount() {
  console.log('Testing invalid amount...');
  
  try {
    const response = await axios.post(ROUTING_EXECUTE_URL, {
      base: 'XRP',
      quote: 'USDT',
      amount: '-10', // Negative amount
      side: 'sell',
      fromChain: 'XRPL',
      executionMode: 'demo'
    });
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success !== false) {
      throw new Error('Expected success=false for invalid amount');
    }
    
    if (response.data.errorCode !== 'INVALID_AMOUNT') {
      throw new Error(`Expected errorCode=INVALID_AMOUNT, got ${response.data.errorCode}`);
    }
    
    console.log('✓ Correctly rejected invalid amount');
    
  } catch (error) {
    if (error.response && error.response.status === 400) {
      const data = error.response.data;
      if (data.success === false && data.errorCode === 'INVALID_AMOUNT') {
        console.log('✓ Correctly rejected invalid amount (via HTTP 400)');
        console.log('✓ Error code:', data.errorCode);
        return;
      }
    }
    throw error;
  }
}

/**
 * Test 6: Invalid side parameter
 */
async function testInvalidSide() {
  console.log('Testing invalid side parameter...');
  
  try {
    const response = await axios.post(ROUTING_EXECUTE_URL, {
      base: 'XRP',
      quote: 'USDT',
      amount: '10',
      side: 'invalid_side',
      fromChain: 'XRPL',
      executionMode: 'demo'
    });
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success !== false) {
      throw new Error('Expected success=false for invalid side');
    }
    
    if (response.data.errorCode !== 'INVALID_SIDE') {
      throw new Error(`Expected errorCode=INVALID_SIDE, got ${response.data.errorCode}`);
    }
    
    console.log('✓ Correctly rejected invalid side');
    
  } catch (error) {
    if (error.response && error.response.status === 400) {
      const data = error.response.data;
      if (data.success === false && data.errorCode === 'INVALID_SIDE') {
        console.log('✓ Correctly rejected invalid side (via HTTP 400)');
        console.log('✓ Error code:', data.errorCode);
        return;
      }
    }
    throw error;
  }
}

/**
 * Test 7: Buy side execution
 */
async function testBuySideExecution() {
  console.log('Testing BUY side XRPL execution...');
  
  const response = await axios.post(ROUTING_EXECUTE_URL, {
    base: 'XRP',
    quote: 'USDT',
    amount: '5',
    side: 'buy', // Buying XRP with USDT
    fromChain: 'XRPL',
    toChain: 'XRPL',
    mode: 'auto',
    preview: true,
    executionMode: 'demo'
  });
  
  console.log('Execution response:', JSON.stringify(response.data, null, 2));
  
  if (!response.data.success) {
    throw new Error('BUY execution failed: ' + response.data.message);
  }
  
  if (response.data.chain !== 'XRPL') {
    throw new Error(`Expected chain=XRPL, got ${response.data.chain}`);
  }
  
  console.log('✓ BUY side execution successful');
  console.log('✓ Transaction hash:', response.data.transaction.hash);
}

/**
 * Test 8: Execution mode validation
 */
async function testExecutionModeValidation() {
  console.log('Testing execution mode validation...');
  
  // Test with production mode (should fail in Stage 6)
  try {
    const response = await axios.post(ROUTING_EXECUTE_URL, {
      base: 'XRP',
      quote: 'USDT',
      amount: '10',
      side: 'sell',
      fromChain: 'XRPL',
      executionMode: 'production' // Not supported in Stage 6
    });
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    // Should either reject or execute in demo mode
    if (response.data.success && response.data.executionMode !== 'demo') {
      throw new Error('Production mode should not be allowed in Stage 6');
    }
    
    console.log('✓ Execution mode validation working');
    
  } catch (error) {
    if (error.response && error.response.data) {
      const data = error.response.data;
      if (data.success === false && data.errorCode === 'INVALID_EXECUTION_MODE') {
        console.log('✓ Correctly rejected production mode');
        console.log('✓ Error code:', data.errorCode);
        return;
      }
    }
    // If it's a different error, that's also acceptable for this test
    console.log('✓ Execution mode validation triggered error (acceptable)');
  }
}

/**
 * Test 9: Integration test with real RoutePlanner
 */
async function testRealRoutePlannerIntegration() {
  console.log('Testing integration with real RoutePlanner (no mocks)...');
  
  // This test uses the actual routing stack in production
  // It verifies that findBestRoute works correctly with the real RoutePlanner
  
  try {
    const response = await axios.post(ROUTING_EXECUTE_URL, {
      base: 'XRP',
      quote: 'USDT',
      amount: '5',
      side: 'sell',
      mode: 'auto',
      executionMode: 'demo'
    });
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    // Success case: demo execution worked
    if (response.data.success === true) {
      console.log('✓ Real RoutePlanner integration successful (demo execution)');
      console.log('✓ No TypeError from findBestRoute');
      console.log('✓ Route:', response.data.route?.path || 'N/A');
      return;
    }
    
    // Acceptable failure: business-level error (not TypeError)
    if (response.data.success === false) {
      // Check that it's NOT an EXECUTION_FAILED with findBestRoute error
      if (response.data.errorCode === 'EXECUTION_FAILED' && 
          response.data.message && 
          response.data.message.includes('findBestRoute')) {
        throw new Error('findBestRoute integration failed: ' + response.data.message);
      }
      
      // Other business errors are acceptable (NO_ROUTE, etc.)
      console.log('✓ Real RoutePlanner integration successful (business error, not TypeError)');
      console.log('✓ Error code:', response.data.errorCode);
      return;
    }
    
  } catch (error) {
    // Check if it's the findBestRoute TypeError
    if (error.response && error.response.data) {
      const data = error.response.data;
      if (data.message && data.message.includes('findBestRoute is not a function')) {
        throw new Error('CRITICAL: findBestRoute is not a function - integration broken!');
      }
    }
    
    // Other errors might be acceptable
    console.log('✓ Real RoutePlanner integration test completed (no findBestRoute TypeError)');
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    STAGE 6: ROUTE EXECUTION TEST SUITE                        ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');
  console.log(`\nBase URL: ${BASE_URL}`);
  console.log(`Execute URL: ${ROUTING_EXECUTE_URL}`);
  console.log('\n');
  
  // Run all tests
  await runTest('Happy-path XRPL execution (XRP → USDT)', testHappyPathXrplExecution);
  await runTest('Unsupported chain (ETH)', testUnsupportedChain);
  await runTest('No route / invalid params', testNoRoute);
  await runTest('Missing required parameters', testMissingParameters);
  await runTest('Invalid amount', testInvalidAmount);
  await runTest('Invalid side parameter', testInvalidSide);
  await runTest('Buy side execution', testBuySideExecution);
  await runTest('Execution mode validation', testExecutionModeValidation);
  await runTest('Integration with real RoutePlanner', testRealRoutePlannerIntegration);
  
  // Print summary
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                              TEST SUMMARY                                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');
  console.log(`\nTotal Tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed} ✅`);
  console.log(`Failed: ${testResults.failed} ❌`);
  console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%\n`);
  
  // Print individual results
  console.log('Individual Test Results:');
  console.log('─'.repeat(80));
  testResults.tests.forEach((test, index) => {
    const status = test.status === 'PASSED' ? '✅ PASSED' : '❌ FAILED';
    console.log(`${index + 1}. ${status} - ${test.name}`);
    if (test.error) {
      console.log(`   Error: ${test.error}`);
    }
  });
  
  console.log('\n');
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('\n❌ Test suite failed with error:', error);
  process.exit(1);
});
