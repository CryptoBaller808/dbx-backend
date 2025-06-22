/**
 * Swap Service Implementation
 * 
 * Provides token swap operations across all supported blockchains.
 */

const { SwapOperations } = require('./blockchain-abstraction-layer');

class SwapService extends SwapOperations {
  constructor(adapterRegistry, transactionService) {
    super(adapterRegistry, transactionService);
    this.recentQuotes = new Map();
  }

  /**
   * Get quote for a swap with caching
   * @param {string} sourceChainId - Source chain identifier
   * @param {string} targetChainId - Target chain identifier
   * @param {string} sourceToken - Source token address
   * @param {string} targetToken - Target token address
   * @param {string} amount - Amount to swap
   * @param {boolean} forceRefresh - Force refresh quote
   * @returns {Promise<Object>} Swap quote
   */
  async getQuote(sourceChainId, targetChainId, sourceToken, targetToken, amount, forceRefresh = false) {
    const quoteKey = `${sourceChainId}:${targetChainId}:${sourceToken}:${targetToken}:${amount}`;
    
    // Check cache if not forcing refresh
    if (!forceRefresh) {
      const cachedQuote = this.recentQuotes.get(quoteKey);
      if (cachedQuote && Date.now() - cachedQuote.timestamp < 30000) { // 30 seconds cache
        return cachedQuote.quote;
      }
    }
    
    // Get fresh quote
    const quote = await super.getQuote(sourceChainId, targetChainId, sourceToken, targetToken, amount);
    
    // Cache quote
    this.recentQuotes.set(quoteKey, {
      quote,
      timestamp: Date.now()
    });
    
    // Clean up old quotes
    this._cleanupOldQuotes();
    
    return quote;
  }

  /**
   * Execute a swap with quote validation
   * @param {Object} swapParams - Swap parameters
   * @param {Object} quoteReference - Reference quote to validate against
   * @returns {Promise<Object>} Swap result
   */
  async executeSwapWithQuote(swapParams, quoteReference) {
    // Validate quote if provided
    if (quoteReference) {
      const { sourceChainId, targetChainId, sourceToken, targetToken, amount } = swapParams;
      
      // Get fresh quote
      const currentQuote = await this.getQuote(
        sourceChainId, 
        targetChainId, 
        sourceToken, 
        targetToken, 
        amount,
        true // Force refresh
      );
      
      // Check for price movement
      const slippageTolerance = swapParams.slippageTolerance || 0.01; // 1% default
      const expectedRate = quoteReference.rate;
      const currentRate = currentQuote.rate;
      
      const priceDifference = Math.abs(currentRate - expectedRate) / expectedRate;
      
      if (priceDifference > slippageTolerance) {
        throw new Error(`Price moved beyond slippage tolerance: ${priceDifference * 100}% > ${slippageTolerance * 100}%`);
      }
    }
    
    // Execute swap
    return await super.executeSwap(swapParams);
  }

  /**
   * Clean up old quotes
   * @private
   */
  _cleanupOldQuotes() {
    const now = Date.now();
    for (const [key, entry] of this.recentQuotes.entries()) {
      if (now - entry.timestamp > 60000) { // 1 minute expiry
        this.recentQuotes.delete(key);
      }
    }
  }

  /**
   * Get supported swap pairs for a chain
   * @param {string} chainId - Chain identifier
   * @returns {Promise<Array<Object>>} Supported swap pairs
   */
  async getSupportedSwapPairs(chainId) {
    const adapter = this.adapterRegistry.getAdapter(chainId);
    
    // Check if adapter supports getting swap pairs
    if (typeof adapter.getSupportedSwapPairs !== 'function') {
      throw new Error(`Getting swap pairs not supported for chain: ${chainId}`);
    }
    
    return await adapter.getSupportedSwapPairs();
  }

  /**
   * Get swap history for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array<Object>>} Swap history
   */
  async getSwapHistory(userId, options = {}) {
    // This would typically query the database for swap history
    // Implementation depends on how swaps are recorded
    throw new Error('Not implemented');
  }
}

module.exports = SwapService;
