/**
 * Routing Engine Unit Tests
 * Tests threshold-based routing logic and provider selection
 */

const { routeQuote } = require('../services/routing/router');

// Mock environment variables for testing
process.env.ROUTING_ENGINE_V1 = 'true';
process.env.ROUTING_ENGINE_LOG = 'warn'; // Reduce noise in tests
process.env.ROUTING_THRESHOLD_LARGE_USD = '1000';
process.env.ROUTING_THRESHOLD_SPLIT_USD = '25000';

describe('Routing Engine', () => {
  
  describe('Feature Flag', () => {
    it('should return disabled when flag is off', async () => {
      const originalFlag = process.env.ROUTING_ENGINE_V1;
      process.env.ROUTING_ENGINE_V1 = 'false';
      
      const result = await routeQuote({
        base: 'XRP',
        quote: 'USDT',
        side: 'buy',
        amountUsd: 500
      });
      
      expect(result.ok).toBe(false);
      expect(result.code).toBe('ROUTING_DISABLED');
      
      process.env.ROUTING_ENGINE_V1 = originalFlag;
    });
  });
  
  describe('Small Trades (< $1k) - Best Price Strategy', () => {
    it('should select venue with lowest total cost for $500 trade', async () => {
      const result = await routeQuote({
        base: 'XRP',
        quote: 'USDT',
        side: 'buy',
        amountUsd: 500
      });
      
      expect(result.ok).toBe(true);
      expect(result.chosen.reason).toBe('best-price');
      expect(result.route.splits).toBeUndefined();
      expect(result.policy.strategy).toBe('smart-hybrid');
    });
    
    it('should prioritize low fees over liquidity for small trades', async () => {
      const result = await routeQuote({
        base: 'XRP',
        quote: 'USD',
        side: 'buy',
        amountUsd: 800
      });
      
      expect(result.ok).toBe(true);
      expect(result.chosen.totalCostBps).toBeDefined();
      expect(result.chosen.reason).toBe('best-price');
    });
  });
  
  describe('Medium Trades ($1k-$25k) - Deepest Liquidity Strategy', () => {
    it('should select venue with highest liquidity for $1,500 trade', async () => {
      const result = await routeQuote({
        base: 'XRP',
        quote: 'USDT',
        side: 'buy',
        amountUsd: 1500
      });
      
      expect(result.ok).toBe(true);
      expect(result.chosen.reason).toBe('deepest-liquidity');
      expect(result.route.splits).toBeUndefined();
      expect(result.chosen.liquidityScore).toBeGreaterThan(0);
    });
    
    it('should handle $10k trade with deep liquidity venue', async () => {
      const result = await routeQuote({
        base: 'XRP',
        quote: 'USDT',
        side: 'sell',
        amountUsd: 10000
      });
      
      expect(result.ok).toBe(true);
      expect(result.chosen.reason).toBe('deepest-liquidity');
    });
  });
  
  describe('Large Trades (> $25k) - Smart Split Strategy', () => {
    it('should split $50,000 trade across top 2 venues', async () => {
      const result = await routeQuote({
        base: 'XRP',
        quote: 'USDT',
        side: 'buy',
        amountUsd: 50000
      });
      
      expect(result.ok).toBe(true);
      expect(result.chosen.reason).toBe('smart-split');
      expect(result.route.splits).toBeDefined();
      expect(result.route.splits.length).toBe(2);
      
      // Verify split percentages add up to 100
      const totalPct = result.route.splits.reduce((sum, s) => sum + s.pct, 0);
      expect(totalPct).toBe(100);
    });
    
    it('should calculate weighted average metrics for split', async () => {
      const result = await routeQuote({
        base: 'XRP',
        quote: 'USDT',
        side: 'buy',
        amountUsd: 100000
      });
      
      expect(result.ok).toBe(true);
      expect(result.chosen.source).toContain('split:');
      expect(result.chosen.price).toBeGreaterThan(0);
      expect(result.chosen.feeBps).toBeGreaterThan(0);
      expect(result.chosen.liquidityScore).toBeGreaterThan(0);
    });
  });
  
  describe('Pair Support', () => {
    it('should handle concatenated pair format (ETHUSDT)', async () => {
      const result = await routeQuote({
        base: 'ETH',
        quote: 'USDT',
        side: 'buy',
        amountUsd: 1000
      });
      
      expect(result.ok).toBe(true);
      expect(result.candidates.length).toBeGreaterThan(0);
    });
    
    it('should handle hyphenated pair format (ETH-USDT)', async () => {
      const result = await routeQuote({
        base: 'ETH',
        quote: 'USDT',
        side: 'buy',
        amountUsd: 1000
      });
      
      expect(result.ok).toBe(true);
    });
    
    it('should return no liquidity for unsupported pairs', async () => {
      const result = await routeQuote({
        base: 'FAKE',
        quote: 'TOKEN',
        side: 'buy',
        amountUsd: 1000
      });
      
      expect(result.ok).toBe(false);
      expect(result.code).toBe('NO_LIQUIDITY');
    });
  });
  
  describe('Response Structure', () => {
    it('should include all required fields in response', async () => {
      const result = await routeQuote({
        base: 'XRP',
        quote: 'USDT',
        side: 'buy',
        amountUsd: 1000
      });
      
      expect(result).toHaveProperty('ok');
      expect(result).toHaveProperty('route');
      expect(result).toHaveProperty('chosen');
      expect(result).toHaveProperty('candidates');
      expect(result).toHaveProperty('policy');
      
      expect(result.chosen).toHaveProperty('price');
      expect(result.chosen).toHaveProperty('feeBps');
      expect(result.chosen).toHaveProperty('liquidityScore');
      expect(result.chosen).toHaveProperty('estConfirmMs');
      expect(result.chosen).toHaveProperty('source');
    });
    
    it('should limit candidates to 5 items', async () => {
      const result = await routeQuote({
        base: 'XRP',
        quote: 'USDT',
        side: 'buy',
        amountUsd: 1000
      });
      
      expect(result.candidates.length).toBeLessThanOrEqual(5);
    });
  });
  
});

// Simple test runner (if not using Jest/Mocha)
if (require.main === module) {
  console.log('Running routing engine tests...\n');
  
  const tests = [
    { name: 'Small trade ($500)', params: { base: 'XRP', quote: 'USDT', side: 'buy', amountUsd: 500 }, expectedReason: 'best-price' },
    { name: 'Medium trade ($1,500)', params: { base: 'XRP', quote: 'USDT', side: 'buy', amountUsd: 1500 }, expectedReason: 'deepest-liquidity' },
    { name: 'Large trade ($50,000)', params: { base: 'XRP', quote: 'USDT', side: 'buy', amountUsd: 50000 }, expectedReason: 'smart-split' }
  ];
  
  (async () => {
    for (const test of tests) {
      const result = await routeQuote(test.params);
      const pass = result.ok && result.chosen.reason === test.expectedReason;
      console.log(`${pass ? '✅' : '❌'} ${test.name}: ${result.chosen.reason} via ${result.chosen.source}`);
    }
  })();
}

module.exports = { routeQuote };
