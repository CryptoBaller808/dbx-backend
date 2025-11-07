/**
 * XDC USDT Wrapped Provider
 * XRC20 USDT liquidity on XDC Network via wrapped gateway
 */

const XDC_USDT_CONTRACT = 'xdc0000000000000000000000000000000000000'; // XRC20 USDT contract

/**
 * Get quote from XDC USDT wrapped
 * @param {Object} params - Quote parameters
 * @param {string} params.base - Base currency
 * @param {string} params.quote - Quote currency
 * @param {number} params.amountUsd - Trade amount in USD
 * @returns {Promise<Object>} Quote result
 */
async function getQuote({ base, quote, amountUsd }) {
  try {
    // XDC supports wrapped assets and native XDC
    const supportedBases = ['XDC', 'BTC', 'ETH', 'XRP'];
    const supportedQuotes = ['USDT', 'USD'];
    
    if (!supportedBases.includes(base) || !supportedQuotes.includes(quote)) {
      return {
        ok: false,
        reason: `XDC USDT does not support ${base}/${quote} pair`
      };
    }

    const basePrice = await getMarketPrice(base, quote);
    
    if (!basePrice) {
      return {
        ok: false,
        reason: 'Unable to fetch market price'
      };
    }

    // XDC has moderate depth, best for mid-size trades
    const liquidityScore = calculateLiquidityScore(amountUsd, base);
    
    // XDC fees: 0.30% (30 bps) for wrapped gateway
    const feeBps = 30;
    
    // XDC settlement: 2-3 seconds (very fast)
    const estConfirmMs = 2500;

    return {
      ok: true,
      price: basePrice,
      feeBps,
      liquidityScore,
      estConfirmMs,
      source: 'xdc-usdt',
      meta: {
        contract: XDC_USDT_CONTRACT,
        network: 'xdc',
        type: 'wrapped-gateway'
      }
    };
  } catch (error) {
    console.error('[XDC USDT Provider] Error:', error.message);
    return {
      ok: false,
      reason: error.message
    };
  }
}

/**
 * Get market price for a pair
 * @param {string} base - Base currency
 * @param {string} quote - Quote currency
 * @returns {Promise<number|null>} Price or null
 */
async function getMarketPrice(base, quote) {
  const prices = {
    'XDC/USDT': 0.045,
    'XDC/USD': 0.045,
    'BTC/USDT': 100000,
    'ETH/USDT': 3240,
    'XRP/USDT': 0.52
  };
  
  return prices[`${base}/${quote}`] || null;
}

/**
 * Calculate liquidity score
 * @param {number} amountUsd - Trade amount in USD
 * @param {string} base - Base currency
 * @returns {number} Liquidity score (0-1)
 */
function calculateLiquidityScore(amountUsd, base) {
  // XDC has best depth for native XDC token
  if (base === 'XDC') {
    if (amountUsd < 5000) return 0.85;
    if (amountUsd < 20000) return 0.75;
    if (amountUsd < 50000) return 0.60;
    return 0.40;
  }
  
  // Limited depth for wrapped assets
  if (amountUsd < 2000) return 0.70;
  if (amountUsd < 10000) return 0.55;
  return 0.35;
}

module.exports = {
  getQuote
};
