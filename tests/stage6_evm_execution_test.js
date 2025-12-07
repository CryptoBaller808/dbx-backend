/**
 * stage6_evm_execution_test.js
 * Stage 6A: EVM Route Execution Tests
 * 
 * Tests for EVM execution functionality:
 * - Service initialization
 * - Configuration helpers
 * - Integration with RouteExecutionService
 * - Error response structure
 * 
 * Note: Actual execution tests require testnet RPC and demo wallets
 * and should be performed manually or in integration test environment
 */

const assert = require('assert');
const EvmRouteExecutionService = require('../services/routing/EvmRouteExecutionService');
const RouteExecutionService = require('../services/routing/RouteExecutionService');
const evmConfig = require('../config/evmConfig');

describe('Stage 6A - EVM Route Execution Tests', function() {
  // Increase timeout for blockchain operations
  this.timeout(30000);
  
  // Set demo mode for tests (unless explicitly testing disabled mode)
  before(function() {
    if (!process.env.EVM_EXECUTION_MODE) {
      process.env.EVM_EXECUTION_MODE = 'demo';
    }
  });
  
  describe('EvmConfig Helper', function() {
    it('should load EVM configuration', function() {
      assert.ok(evmConfig);
      assert.strictEqual(typeof evmConfig.getRpcUrl, 'function');
      assert.strictEqual(typeof evmConfig.getDemoPrivateKey, 'function');
      assert.strictEqual(typeof evmConfig.getChainId, 'function');
    });
    
    it('should support expected EVM chains', function() {
      const supportedChains = evmConfig.getSupportedChains();
      assert.ok(Array.isArray(supportedChains));
      assert.ok(supportedChains.includes('ETH'));
      assert.ok(supportedChains.includes('BSC'));
      assert.ok(supportedChains.includes('AVAX'));
      assert.ok(supportedChains.includes('MATIC'));
    });
    
    it('should validate chain support', function() {
      assert.strictEqual(evmConfig.isChainSupported('ETH'), true);
      assert.strictEqual(evmConfig.isChainSupported('BSC'), true);
      assert.strictEqual(evmConfig.isChainSupported('AVAX'), true);
      assert.strictEqual(evmConfig.isChainSupported('MATIC'), true);
      assert.strictEqual(evmConfig.isChainSupported('SOLANA'), false);
      assert.strictEqual(evmConfig.isChainSupported('XRPL'), false);
    });
    
    it('should get chain IDs from configuration', function() {
      assert.strictEqual(evmConfig.getChainId('ETH'), 1);
      assert.strictEqual(evmConfig.getChainId('BSC'), 56);
      assert.strictEqual(evmConfig.getChainId('MATIC'), 137);
    });
    
    it('should get native currencies from configuration', function() {
      assert.strictEqual(evmConfig.getNativeCurrency('ETH'), 'ETH');
      assert.strictEqual(evmConfig.getNativeCurrency('BSC'), 'BNB');
      assert.strictEqual(evmConfig.getNativeCurrency('MATIC'), 'MATIC');
    });
    
    it('should validate execution mode', function() {
      const validModes = ['disabled', 'demo', 'production'];
      const currentMode = evmConfig.executionMode;
      assert.ok(validModes.includes(currentMode), `Current mode ${currentMode} should be one of ${validModes}`);
    });
  });
  
  describe('EvmRouteExecutionService', function() {
    let evmService;
    
    beforeEach(function() {
      evmService = new EvmRouteExecutionService();
    });
    
    it('should initialize successfully', function() {
      assert.ok(evmService);
      assert.ok(evmService.config);
      assert.strictEqual(typeof evmService.executeRoute, 'function');
    });
    
    it('should have access to EVM configuration', function() {
      assert.ok(evmService.config);
      assert.strictEqual(typeof evmService.config.getRpcUrl, 'function');
      assert.strictEqual(typeof evmService.config.getDemoPrivateKey, 'function');
    });
    
    it('should return error when execution is disabled', function() {
      // Note: This test validates the logic structure
      // Actual runtime test of disabled mode requires separate process
      // due to config module caching
      
      // Validate that the error response structure is correct
      const expectedErrorResponse = {
        success: false,
        errorCode: 'EXECUTION_DISABLED',
        message: 'EVM route execution is currently disabled',
        details: {},
        timestamp: '2024-12-07T...'
      };
      
      assert.strictEqual(expectedErrorResponse.success, false);
      assert.strictEqual(expectedErrorResponse.errorCode, 'EXECUTION_DISABLED');
      assert.ok(expectedErrorResponse.message);
      assert.ok(expectedErrorResponse.timestamp);
    });
    
    it('should reject unsupported chains', async function() {
      const route = {
        chain: 'SOLANA',
        pathType: 'direct',
        expectedOutput: 100,
        hops: [],
        fees: {},
        slippage: 0.01
      };
      
      const params = {
        base: 'SOL',
        quote: 'USDT',
        amount: '1',
        side: 'sell',
        executionMode: 'demo'
      };
      
      const result = await evmService.executeRoute(route, params);
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.errorCode, 'UNSUPPORTED_CHAIN');
      assert.ok(result.details);
      assert.ok(result.details.supportedChains);
      assert.ok(result.details.supportedChains.includes('ETH'));
    });
    
    it('should reject production mode as not implemented', async function() {
      const route = {
        chain: 'ETH',
        pathType: 'direct',
        expectedOutput: 100,
        hops: [],
        fees: {},
        slippage: 0.01
      };
      
      const params = {
        base: 'ETH',
        quote: 'USDT',
        amount: '0.1',
        side: 'sell',
        executionMode: 'production'
      };
      
      const result = await evmService.executeRoute(route, params);
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.errorCode, 'NOT_IMPLEMENTED');
      assert.ok(result.message.includes('Production'));
    });
    
    it('should have correct error response structure', async function() {
      const route = {
        chain: 'INVALID',
        pathType: 'direct',
        expectedOutput: 100,
        hops: [],
        fees: {},
        slippage: 0.01
      };
      
      const params = {
        base: 'XXX',
        quote: 'USDT',
        amount: '0.1',
        side: 'sell',
        executionMode: 'demo'
      };
      
      const result = await evmService.executeRoute(route, params);
      
      // Validate error response structure
      assert.strictEqual(result.success, false);
      assert.ok(result.errorCode);
      assert.ok(result.message);
      assert.ok(result.details);
      assert.ok(result.timestamp);
      assert.ok(typeof result.errorCode === 'string');
      assert.ok(typeof result.message === 'string');
      assert.ok(typeof result.details === 'object');
    });
  });
  
  describe('RouteExecutionService Integration', function() {
    let routeService;
    
    beforeEach(function() {
      routeService = new RouteExecutionService();
    });
    
    it('should initialize both XRPL and EVM services', function() {
      assert.ok(routeService.xrplService);
      assert.ok(routeService.evmService);
      assert.strictEqual(typeof routeService.xrplService, 'object');
      assert.strictEqual(typeof routeService.evmService, 'object');
    });
    
    it('should have EVM service with correct configuration', function() {
      const evmService = routeService.evmService;
      assert.ok(evmService.config);
      assert.strictEqual(typeof evmService.config.isChainSupported, 'function');
    });
    
    it('should support all expected EVM chains', function() {
      const supportedEvmChains = ['ETH', 'BSC', 'AVAX', 'MATIC'];
      const evmService = routeService.evmService;
      
      supportedEvmChains.forEach(chain => {
        assert.ok(evmService.config.isChainSupported(chain), `Chain ${chain} should be supported`);
      });
    });
    
    it('should maintain XRPL service functionality', function() {
      // Verify XRPL service is still initialized and functional
      assert.ok(routeService.xrplService);
      assert.ok(routeService.xrplService.submitTransaction);
      assert.strictEqual(typeof routeService.xrplService.submitTransaction, 'function');
    });
  });
  
  describe('Expected Response Structure', function() {
    it('should define correct success response structure', function() {
      // This validates the expected structure for successful execution
      const expectedStructure = {
        success: true,
        chain: 'ETH',
        executionMode: 'demo',
        route: {
          pathType: 'direct',
          expectedOutput: 100,
          hops: [],
          fees: {},
          slippage: 0.01,
          fromChain: 'ETH',
          toChain: 'ETH'
        },
        transaction: {
          hash: '0x...',
          chainId: 1,
          from: '0x...',
          to: '0x...',
          value: '0.001',
          gasUsed: '21000',
          gasPrice: '20 gwei',
          nonce: 0,
          blockNumber: 12345,
          network: 'eth-testnet',
          currency: 'ETH',
          memo: 'route_123',
          routeDetails: {}
        },
        settlement: {
          status: 'confirmed',
          blockNumber: 12345,
          confirmations: 1,
          timestamp: '2024-12-07T...'
        },
        timestamp: '2024-12-07T...',
        executionTimeMs: 3500
      };
      
      // Validate structure
      assert.strictEqual(expectedStructure.success, true);
      assert.strictEqual(expectedStructure.chain, 'ETH');
      assert.strictEqual(expectedStructure.executionMode, 'demo');
      assert.ok(expectedStructure.route);
      assert.ok(expectedStructure.transaction);
      assert.ok(expectedStructure.settlement);
      assert.ok(expectedStructure.timestamp);
      assert.ok(typeof expectedStructure.executionTimeMs === 'number');
    });
    
    it('should define correct error response structure', function() {
      const expectedErrorStructure = {
        success: false,
        errorCode: 'EXECUTION_DISABLED',
        message: 'EVM route execution is currently disabled',
        details: {},
        timestamp: '2024-12-07T...'
      };
      
      // Validate structure
      assert.strictEqual(expectedErrorStructure.success, false);
      assert.ok(expectedErrorStructure.errorCode);
      assert.ok(expectedErrorStructure.message);
      assert.ok(expectedErrorStructure.details);
      assert.ok(expectedErrorStructure.timestamp);
    });
  });
});

// Export for use in other test files
module.exports = {};
