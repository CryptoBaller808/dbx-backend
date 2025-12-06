/**
 * FeeModel.js
 * Stage 4 - Phase 1: Cross-Chain Fee Abstraction
 * 
 * Models gas fees, bridge fees, AMM fees, and XRPL network fees.
 * Provides unified fee calculation across all supported chains.
 */

class FeeModel {
  constructor() {
    // Fee configurations for different chains and protocols
    this.feeConfig = {
      // XRPL fees
      XRPL: {
        networkFee: 0.00001, // 10 drops
        ammFee: 0.003, // 0.3% for AMM swaps
        trustlineFee: 2.0, // Reserve for trustlines
        currency: 'XRP'
      },
      // EVM chains
      ETH: {
        gasPrice: 30, // gwei
        gasLimit: {
          swap: 150000,
          bridge: 300000,
          approve: 50000
        },
        ammFee: 0.003, // Uniswap V2 default
        currency: 'ETH'
      },
      BSC: {
        gasPrice: 5,
        gasLimit: {
          swap: 150000,
          bridge: 300000,
          approve: 50000
        },
        ammFee: 0.0025,
        currency: 'BNB'
      },
      MATIC: {
        gasPrice: 50,
        gasLimit: {
          swap: 150000,
          bridge: 300000,
          approve: 50000
        },
        ammFee: 0.003,
        currency: 'MATIC'
      },
      // XDC
      XDC: {
        gasPrice: 0.25,
        gasLimit: {
          swap: 150000,
          bridge: 300000,
          approve: 50000
        },
        ammFee: 0.003,
        currency: 'XDC'
      },
      // Bridge fees
      BRIDGE: {
        fixed: 0.1, // $0.10 USD
        percentage: 0.001 // 0.1%
      }
    };

    // USD prices for native currencies (simulated)
    this.nativePrices = {
      XRP: 2.07,
      ETH: 3800,
      BNB: 600,
      MATIC: 0.85,
      XDC: 0.05,
      BTC: 95000
    };
  }

  /**
   * Calculate total fees for a route
   * @param {Array} hops - Array of hop objects
   * @returns {Object} Fee breakdown
   */
  calculateRouteFees(hops) {
    const breakdown = [];
    let totalFeeUSD = 0;
    let totalFeeNative = 0;
    let primaryChain = hops[0]?.chain;

    for (const hop of hops) {
      const hopFee = this.calculateHopFee(hop);
      breakdown.push(hopFee);
      totalFeeUSD += parseFloat(hopFee.feeUSD);
      
      if (hop.chain === primaryChain) {
        totalFeeNative += parseFloat(hopFee.feeNative);
      }
    }

    return {
      totalFeeUSD: totalFeeUSD.toFixed(4),
      totalFeeNative: totalFeeNative.toFixed(6),
      nativeCurrency: this.feeConfig[primaryChain]?.currency || 'UNKNOWN',
      breakdown
    };
  }

  /**
   * Calculate fee for a single hop
   * @param {Object} hop - Hop object
   * @returns {Object} Hop fee details
   */
  calculateHopFee(hop) {
    const { chain, protocol, amountIn } = hop;

    let feeNative = 0;
    let feeUSD = 0;
    let feeType = 'unknown';

    if (protocol === 'XRPL_AMM') {
      // XRPL AMM fee
      const ammFee = parseFloat(amountIn) * this.feeConfig.XRPL.ammFee;
      const networkFee = this.feeConfig.XRPL.networkFee;
      feeNative = ammFee + networkFee;
      feeUSD = feeNative * this.nativePrices.XRP;
      feeType = 'AMM + Network';
    } else if (protocol === 'XRPL_DEX') {
      // XRPL DEX (orderbook) fee
      feeNative = this.feeConfig.XRPL.networkFee;
      feeUSD = feeNative * this.nativePrices.XRP;
      feeType = 'Network';
    } else if (protocol.includes('UNISWAP') || protocol.includes('PANCAKE') || protocol.includes('QUICKSWAP')) {
      // EVM AMM fee
      const config = this.feeConfig[chain];
      if (config) {
        const gasLimit = config.gasLimit.swap;
        const gasPrice = config.gasPrice;
        feeNative = (gasLimit * gasPrice) / 1e9; // Convert gwei to native
        feeUSD = feeNative * this.nativePrices[config.currency];
        
        // Add AMM fee
        const ammFee = parseFloat(amountIn) * config.ammFee;
        feeUSD += ammFee; // Assume AMM fee in USD
        feeType = 'Gas + AMM';
      }
    } else if (protocol === 'BRIDGE') {
      // Bridge fee
      const fixedFee = this.feeConfig.BRIDGE.fixed;
      const percentageFee = parseFloat(amountIn) * this.feeConfig.BRIDGE.percentage;
      feeUSD = fixedFee + percentageFee;
      feeNative = 0; // Bridge fees typically in USD
      feeType = 'Bridge';
    }

    return {
      hopIndex: hop.hopIndex,
      chain,
      protocol,
      feeType,
      feeNative: feeNative.toFixed(6),
      feeUSD: feeUSD.toFixed(4),
      currency: this.feeConfig[chain]?.currency || 'USD'
    };
  }

  /**
   * Estimate gas cost for EVM transaction
   * @param {string} chain - Chain name (e.g., 'ETH', 'BSC')
   * @param {string} txType - Transaction type ('swap', 'bridge', 'approve')
   * @returns {Object} Gas cost estimate
   */
  estimateGasCost(chain, txType) {
    const config = this.feeConfig[chain];
    if (!config || !config.gasLimit) {
      return { gasNative: 0, gasUSD: 0 };
    }

    const gasLimit = config.gasLimit[txType] || config.gasLimit.swap;
    const gasPrice = config.gasPrice;
    const gasNative = (gasLimit * gasPrice) / 1e9;
    const gasUSD = gasNative * this.nativePrices[config.currency];

    return {
      gasLimit,
      gasPrice,
      gasNative: gasNative.toFixed(6),
      gasUSD: gasUSD.toFixed(4),
      currency: config.currency
    };
  }

  /**
   * Calculate bridge fee
   * @param {string} fromChain - Source chain
   * @param {string} toChain - Destination chain
   * @param {string} amount - Amount to bridge
   * @returns {Object} Bridge fee details
   */
  calculateBridgeFee(fromChain, toChain, amount) {
    const fixedFee = this.feeConfig.BRIDGE.fixed;
    const percentageFee = parseFloat(amount) * this.feeConfig.BRIDGE.percentage;
    const totalFeeUSD = fixedFee + percentageFee;

    return {
      fromChain,
      toChain,
      fixedFeeUSD: fixedFee.toFixed(4),
      percentageFee: (this.feeConfig.BRIDGE.percentage * 100).toFixed(2) + '%',
      totalFeeUSD: totalFeeUSD.toFixed(4)
    };
  }

  /**
   * Update native currency prices
   * @param {Object} prices - Price updates
   */
  updatePrices(prices) {
    this.nativePrices = { ...this.nativePrices, ...prices };
  }

  /**
   * Get fee configuration for a chain
   * @param {string} chain - Chain name
   * @returns {Object} Fee configuration
   */
  getChainFeeConfig(chain) {
    return this.feeConfig[chain] || null;
  }
}

module.exports = FeeModel;
