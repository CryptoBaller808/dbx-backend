/**
 * EvmLiquidityProvider.js
 * Stage 5 - Phase 3: EVM Real Liquidity Provider
 * 
 * Provides real-time liquidity data for EVM chains (ETH, BSC, MATIC, XDC).
 * Uses CoinGecko API for spot prices and simulated depth model.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const BaseLiquidityProvider = require('./BaseLiquidityProvider');

class EvmLiquidityProvider extends BaseLiquidityProvider {
  constructor(config = {}) {
    super('evm', config);
    
    this.timeout = config.timeout || 5000;
    this.networkConfig = null;
    this.priceCache = new Map();
    this.cacheExpiry = 10000; // 10 seconds
    
    this.loadNetworkConfig();
    console.log('[EvmLiquidityProvider] Initialized with CoinGecko price API');
  }

  /**
   * Load EVM network configuration
   */
  loadNetworkConfig() {
    try {
      const configPath = path.join(__dirname, '../../../config/evm_networks.json');
      const rawData = fs.readFileSync(configPath, 'utf8');
      this.networkConfig = JSON.parse(rawData);
      console.log('[EvmLiquidityProvider] Loaded EVM network configuration');
    } catch (error) {
      console.error('[EvmLiquidityProvider] Failed to load network config:', error.message);
      this.networkConfig = { networks: {}, tokenMappings: {}, priceApiConfig: {} };
    }
  }

  /**
   * Get spot price for a token pair
   */
  async getSpotPrice(base, quote, opts = {}) {
    try {
      // Check cache first
      const cacheKey = `${base}/${quote}`;
      const cached = this.priceCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        console.log(`[EvmLiquidityProvider] Cache hit for ${cacheKey}: ${cached.price}`);
        return cached.price;
      }

      // For USD/USDT/USDC quotes, fetch from CoinGecko
      if (['USD', 'USDT', 'USDC'].includes(quote)) {
        const price = await this.fetchPriceFromCoinGecko(base, 'usd');
        
        if (price !== null) {
          this.priceCache.set(cacheKey, { price, timestamp: Date.now() });
          console.log(`[EvmLiquidityProvider] Spot price for ${base}/${quote}: ${price}`);
          return price;
        }
      }

      // For other pairs, calculate from USD prices
      const basePrice = await this.fetchPriceFromCoinGecko(base, 'usd');
      const quotePrice = await this.fetchPriceFromCoinGecko(quote, 'usd');

      if (basePrice !== null && quotePrice !== null) {
        const price = basePrice / quotePrice;
        this.priceCache.set(cacheKey, { price, timestamp: Date.now() });
        console.log(`[EvmLiquidityProvider] Spot price for ${base}/${quote}: ${price}`);
        return price;
      }

      return null;

    } catch (error) {
      console.error(`[EvmLiquidityProvider] Error getting spot price for ${base}/${quote}:`, error.message);
      throw error;
    }
  }

  /**
   * Get market depth for a token pair
   */
  async getDepth(base, quote, opts = {}) {
    try {
      const { chain, notionalHint = 1000 } = opts;

      // Get spot price
      const spotPrice = await this.getSpotPrice(base, quote, opts);
      if (spotPrice === null) {
        return null;
      }

      // Simulate depth based on token popularity and chain
      const depthModel = this.getDepthModel(base, quote, chain);

      return {
        buyLiquidity: depthModel.buyLiquidity.toFixed(2),
        sellLiquidity: depthModel.sellLiquidity.toFixed(2),
        totalLiquidity: depthModel.totalLiquidity.toFixed(2),
        totalLiquidityUSD: (depthModel.totalLiquidity * spotPrice).toFixed(2),
        depth: depthModel.depth,
        spotPrice: spotPrice,
        source: 'simulated_depth'
      };

    } catch (error) {
      console.error(`[EvmLiquidityProvider] Error getting depth for ${base}/${quote}:`, error.message);
      throw error;
    }
  }

  /**
   * Get slippage curve for a token pair
   */
  async getSlippageCurve(base, quote, opts = {}) {
    try {
      const { amounts = [] } = opts;

      // Get spot price and depth
      const spotPrice = await this.getSpotPrice(base, quote, opts);
      if (spotPrice === null) {
        return null;
      }

      const depth = await this.getDepth(base, quote, opts);
      if (!depth) {
        return null;
      }

      // Generate slippage curve based on depth model
      const curve = [];
      const testAmounts = amounts.length > 0 ? amounts : [100, 500, 1000, 5000, 10000];
      const totalLiquidity = parseFloat(depth.totalLiquidity);

      for (const amount of testAmounts) {
        const utilizationRatio = amount / totalLiquidity;
        let slippage = 0;

        // Slippage model based on utilization
        if (utilizationRatio < 0.01) slippage = 0.001;       // 0.1%
        else if (utilizationRatio < 0.05) slippage = 0.005;  // 0.5%
        else if (utilizationRatio < 0.1) slippage = 0.015;   // 1.5%
        else if (utilizationRatio < 0.2) slippage = 0.035;   // 3.5%
        else slippage = 0.08;                                 // 8%

        const executionPrice = spotPrice * (1 + slippage);
        const amountOut = amount / executionPrice;

        curve.push({
          amountIn: amount.toString(),
          amountOut: amountOut.toFixed(6),
          slippage: slippage,
          priceImpact: slippage
        });
      }

      return { curve, spotPrice };

    } catch (error) {
      console.error(`[EvmLiquidityProvider] Error getting slippage curve for ${base}/${quote}:`, error.message);
      throw error;
    }
  }

  /**
   * Check if this provider supports a given token pair
   */
  supports(base, quote, opts = {}) {
    // EVM provider supports common EVM tokens
    const supportedTokens = ['ETH', 'BNB', 'MATIC', 'XDC', 'USDT', 'USDC', 'USD', 'BTC'];
    return supportedTokens.includes(base) && supportedTokens.includes(quote);
  }

  /**
   * Fetch price from CoinGecko API
   */
  async fetchPriceFromCoinGecko(token, vsCurrency = 'usd') {
    return new Promise((resolve, reject) => {
      try {
        const tokenId = this.networkConfig.priceApiConfig?.tokenIds?.[token];
        if (!tokenId) {
          console.log(`[EvmLiquidityProvider] No CoinGecko ID for ${token}`);
          resolve(null);
          return;
        }

        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=${vsCurrency}`;
        
        const req = https.get(url, { timeout: this.timeout }, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              const price = parsed[tokenId]?.[vsCurrency];
              
              if (price !== undefined) {
                resolve(price);
              } else {
                console.log(`[EvmLiquidityProvider] No price data for ${token} from CoinGecko`);
                resolve(null);
              }
            } catch (error) {
              console.error(`[EvmLiquidityProvider] Error parsing CoinGecko response:`, error.message);
              resolve(null);
            }
          });
        });

        req.on('error', (error) => {
          console.error(`[EvmLiquidityProvider] CoinGecko API error:`, error.message);
          resolve(null);
        });

        req.on('timeout', () => {
          req.destroy();
          console.error(`[EvmLiquidityProvider] CoinGecko API timeout`);
          resolve(null);
        });

      } catch (error) {
        console.error(`[EvmLiquidityProvider] Error fetching from CoinGecko:`, error.message);
        resolve(null);
      }
    });
  }

  /**
   * Get depth model for a token pair
   * This is a simplified model that can be replaced with on-chain queries later
   */
  getDepthModel(base, quote, chain) {
    // Depth tiers based on token popularity
    const popularTokens = ['ETH', 'BNB', 'MATIC', 'USDT', 'USDC'];
    const isPopularPair = popularTokens.includes(base) && popularTokens.includes(quote);

    let totalLiquidity = 0;
    let depth = 'low';

    if (isPopularPair) {
      // High liquidity for popular pairs
      if (chain === 'ETH') {
        totalLiquidity = 50000000; // $50M
        depth = 'high';
      } else if (chain === 'BSC') {
        totalLiquidity = 30000000; // $30M
        depth = 'high';
      } else if (chain === 'MATIC') {
        totalLiquidity = 10000000; // $10M
        depth = 'medium';
      } else if (chain === 'XDC') {
        totalLiquidity = 1000000; // $1M
        depth = 'medium';
      } else {
        totalLiquidity = 5000000; // $5M default
        depth = 'medium';
      }
    } else {
      // Lower liquidity for less popular pairs
      totalLiquidity = 500000; // $500K
      depth = 'low';
    }

    return {
      buyLiquidity: totalLiquidity * 0.5,
      sellLiquidity: totalLiquidity * 0.5,
      totalLiquidity,
      depth
    };
  }

  /**
   * Clear price cache
   */
  clearCache() {
    this.priceCache.clear();
    console.log('[EvmLiquidityProvider] Price cache cleared');
  }
}

module.exports = EvmLiquidityProvider;
