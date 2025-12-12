/**
 * XrplLiquidityProvider.js
 * Stage 5 - Phase 2: XRPL Real Liquidity Provider
 * 
 * Fetches real-time liquidity data from XRPL orderbooks.
 * Supports both testnet and mainnet.
 */

const xrpl = require('xrpl');
const BaseLiquidityProvider = require('./BaseLiquidityProvider');

class XrplLiquidityProvider extends BaseLiquidityProvider {
  constructor(config = {}) {
    super('xrpl', config);
    
    this.network = config.network || process.env.XRPL_NETWORK || 'testnet';
    this.endpoint = config.endpoint || process.env.XRPL_ENDPOINT_URL || this.getDefaultEndpoint();
    this.timeout = config.timeout || 5000;
    this.client = null;
    this.isConnected = false;
    
    console.log(`[XrplLiquidityProvider] Initialized for ${this.network} (${this.endpoint})`);
  }

  /**
   * Get default XRPL endpoint based on network
   */
  getDefaultEndpoint() {
    return this.network === 'mainnet' 
      ? 'wss://xrplcluster.com'
      : 'wss://s.altnet.rippletest.net:51233';
  }

  /**
   * Connect to XRPL
   */
  async connect() {
    if (this.isConnected && this.client) {
      return;
    }

    try {
      this.client = new xrpl.Client(this.endpoint);
      await Promise.race([
        this.client.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), this.timeout)
        )
      ]);
      this.isConnected = true;
      console.log(`[XrplLiquidityProvider] Connected to XRPL ${this.network}`);
    } catch (error) {
      this.isConnected = false;
      throw new Error(`Failed to connect to XRPL: ${error.message}`);
    }
  }

  /**
   * Disconnect from XRPL
   */
  async disconnect() {
    if (this.client && this.isConnected) {
      try {
        await this.client.disconnect();
        this.isConnected = false;
        console.log('[XrplLiquidityProvider] Disconnected from XRPL');
      } catch (error) {
        console.warn('[XrplLiquidityProvider] Error disconnecting:', error.message);
      }
    }
  }

  /**
   * Get spot price for a token pair from XRPL orderbook
   */
  async getSpotPrice(base, quote, opts = {}) {
    try {
      await this.connect();

      // Convert token symbols to XRPL currency format
      const takerPays = this.toCurrency(base);
      const takerGets = this.toCurrency(quote);

      // Fetch orderbook
      const orderbook = await Promise.race([
        this.client.request({
          command: 'book_offers',
          taker_pays: takerPays,
          taker_gets: takerGets,
          limit: 10
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), this.timeout)
        )
      ]);

      if (!orderbook.result || !orderbook.result.offers || orderbook.result.offers.length === 0) {
        console.log(`[XrplLiquidityProvider] No offers found for ${base}/${quote}`);
        return null;
      }

      // Calculate spot price from best offer
      const bestOffer = orderbook.result.offers[0];
      const spotPrice = this.calculateOfferPrice(bestOffer);

      console.log(`[XrplLiquidityProvider] Spot price for ${base}/${quote}: ${spotPrice}`);
      return spotPrice;

    } catch (error) {
      console.error(`[XrplLiquidityProvider] Error getting spot price for ${base}/${quote}:`, error.message);
      throw error;
    }
  }

  /**
   * Get market depth for a token pair from XRPL orderbook
   */
  async getDepth(base, quote, opts = {}) {
    try {
      await this.connect();

      const { notionalHint = 1000 } = opts;

      // Convert token symbols to XRPL currency format
      const takerPays = this.toCurrency(base);
      const takerGets = this.toCurrency(quote);

      // Fetch orderbook (both sides)
      const [buyOrders, sellOrders] = await Promise.all([
        Promise.race([
          this.client.request({
            command: 'book_offers',
            taker_pays: takerPays,
            taker_gets: takerGets,
            limit: 50
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), this.timeout)
          )
        ]),
        Promise.race([
          this.client.request({
            command: 'book_offers',
            taker_pays: takerGets,
            taker_gets: takerPays,
            limit: 50
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), this.timeout)
          )
        ])
      ]);

      // Calculate depth metrics
      const buyOffers = buyOrders.result?.offers || [];
      const sellOffers = sellOrders.result?.offers || [];

      let buyLiquidity = 0;
      let sellLiquidity = 0;

      for (const offer of buyOffers) {
        const amount = this.getOfferAmount(offer.TakerGets);
        buyLiquidity += amount;
      }

      for (const offer of sellOffers) {
        const amount = this.getOfferAmount(offer.TakerGets);
        sellLiquidity += amount;
      }

      const totalLiquidity = buyLiquidity + sellLiquidity;
      const spotPrice = await this.getSpotPrice(base, quote, opts);

      // Categorize depth
      let depthCategory = 'low';
      if (totalLiquidity > 1000000) depthCategory = 'high';
      else if (totalLiquidity > 100000) depthCategory = 'medium';

      return {
        buyLiquidity: buyLiquidity.toFixed(2),
        sellLiquidity: sellLiquidity.toFixed(2),
        totalLiquidity: totalLiquidity.toFixed(2),
        totalLiquidityUSD: (totalLiquidity * (spotPrice || 1)).toFixed(2),
        depth: depthCategory,
        spotPrice: spotPrice || 0,
        buyOfferCount: buyOffers.length,
        sellOfferCount: sellOffers.length
      };

    } catch (error) {
      console.error(`[XrplLiquidityProvider] Error getting depth for ${base}/${quote}:`, error.message);
      throw error;
    }
  }

  /**
   * Get slippage curve for a token pair
   */
  async getSlippageCurve(base, quote, opts = {}) {
    try {
      await this.connect();

      const { amounts = [] } = opts;
      const takerPays = this.toCurrency(base);
      const takerGets = this.toCurrency(quote);

      // Fetch orderbook
      const orderbook = await Promise.race([
        this.client.request({
          command: 'book_offers',
          taker_pays: takerPays,
          taker_gets: takerGets,
          limit: 100
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), this.timeout)
        )
      ]);

      const offers = orderbook.result?.offers || [];
      if (offers.length === 0) {
        return null;
      }

      // Calculate spot price
      const spotPrice = this.calculateOfferPrice(offers[0]);

      // Generate slippage curve
      const curve = [];
      const testAmounts = amounts.length > 0 ? amounts : [100, 500, 1000, 5000, 10000];

      for (const amount of testAmounts) {
        const result = this.simulateSwap(offers, amount, spotPrice);
        curve.push({
          amountIn: amount.toString(),
          amountOut: result.amountOut.toFixed(6),
          slippage: result.slippage,
          priceImpact: result.priceImpact
        });
      }

      return { curve, spotPrice };

    } catch (error) {
      console.error(`[XrplLiquidityProvider] Error getting slippage curve for ${base}/${quote}:`, error.message);
      throw error;
    }
  }

  /**
   * Check if this provider supports a given token pair
   */
  supports(base, quote, opts = {}) {
    // XRPL provider supports XRP and common IOUs
    const supportedTokens = ['XRP', 'USD', 'USDT', 'USDC', 'EUR', 'BTC', 'ETH'];
    return supportedTokens.includes(base) && supportedTokens.includes(quote);
  }

  /**
   * Convert token symbol to XRPL currency format
   */
  toCurrency(token) {
    if (token === 'XRP') {
      return { currency: 'XRP' };
    }

    // For IOUs, we need issuer address
    // Using common issuers for testnet/mainnet
    const issuers = {
      mainnet: {
        USD: 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B', // Bitstamp
        USDT: 'rcvxE9PS9YBwxtGg1qNeewV6ZB3wGubZq', // Tether
        USDC: 'rcEGREd8NmkKRE8GE424sksyt1tJVFZwu', // Circle
        EUR: 'rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq', // GateHub
        BTC: 'rchGBxcD1A1C2tdxF6papQYZ8kjRKMYcL', // GateHub
        ETH: 'rcA8X3TVMST1n3CJeAdGk1RdRCHii7N2h' // GateHub
      },
      testnet: {
        USD: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH', // Test issuer
        USDT: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
        USDC: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
        EUR: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
        BTC: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
        ETH: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH'
      }
    };

    const issuer = issuers[this.network]?.[token];
    if (!issuer) {
      throw new Error(`No issuer found for ${token} on ${this.network}`);
    }

    return {
      currency: token,
      issuer: issuer
    };
  }

  /**
   * Calculate price from XRPL offer
   */
  calculateOfferPrice(offer) {
    const takerPays = this.getOfferAmount(offer.TakerPays);
    const takerGets = this.getOfferAmount(offer.TakerGets);
    return takerPays / takerGets;
  }

  /**
   * Get amount from XRPL amount object
   */
  getOfferAmount(amount) {
    if (typeof amount === 'string') {
      // XRP in drops
      return parseFloat(amount) / 1000000;
    } else if (typeof amount === 'object' && amount.value) {
      // IOU
      return parseFloat(amount.value);
    }
    return 0;
  }

  /**
   * Simulate swap through orderbook
   */
  simulateSwap(offers, amountIn, spotPrice) {
    let remaining = amountIn;
    let totalOut = 0;

    for (const offer of offers) {
      if (remaining <= 0) break;

      const offerIn = this.getOfferAmount(offer.TakerPays);
      const offerOut = this.getOfferAmount(offer.TakerGets);

      if (remaining >= offerIn) {
        // Consume entire offer
        totalOut += offerOut;
        remaining -= offerIn;
      } else {
        // Partial fill
        const fillRatio = remaining / offerIn;
        totalOut += offerOut * fillRatio;
        remaining = 0;
      }
    }

    const executionPrice = amountIn / totalOut;
    const priceImpact = (executionPrice - spotPrice) / spotPrice;
    const slippage = Math.abs(priceImpact);

    return {
      amountOut: totalOut,
      executionPrice,
      priceImpact,
      slippage
    };
  }
}

module.exports = XrplLiquidityProvider;
