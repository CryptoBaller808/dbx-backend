/**
 * Bitcoin Trading Service
 * Handles Bitcoin trading pairs, swaps, and market operations
 */

const BitcoinWalletService = require('./BitcoinWalletService');
const axios = require('axios');

class BitcoinTradingService {
  constructor(config = {}) {
    this.walletService = new BitcoinWalletService(config);
    this.supportedPairs = [
      'BTC/USDT', 'BTC/USDC', 'BTC/ETH', 'BTC/BNB', 
      'BTC/XRP', 'BTC/XLM', 'BTC/AVAX', 'BTC/MATIC',
      'BTC/SOL', 'BTC/XDC'
    ];
    this.priceFeeds = new Map();
    this.orderBook = new Map();
  }

  /**
   * Get Bitcoin trading pairs
   */
  getSupportedTradingPairs() {
    return this.supportedPairs.map(pair => {
      const [base, quote] = pair.split('/');
      return {
        symbol: pair,
        baseAsset: base,
        quoteAsset: quote,
        status: 'TRADING',
        baseAssetPrecision: 8,
        quoteAssetPrecision: base === 'BTC' ? 2 : 8,
        minQty: base === 'BTC' ? '0.00001' : '0.001',
        maxQty: '1000000',
        minNotional: '10'
      };
    });
  }

  /**
   * Get Bitcoin price for specific pair
   */
  async getBitcoinPrice(quoteCurrency = 'USDT') {
    try {
      const pair = `BTC/${quoteCurrency}`;
      
      // Check cache first
      const cached = this.priceFeeds.get(pair);
      if (cached && Date.now() - cached.timestamp < 5000) {
        return cached.data;
      }

      // Fetch from multiple sources for reliability
      const prices = await Promise.allSettled([
        this.fetchPriceFromBinance(pair),
        this.fetchPriceFromCoinGecko(quoteCurrency),
        this.fetchPriceFromCoinbase(pair)
      ]);

      // Use the first successful price
      const validPrice = prices.find(p => p.status === 'fulfilled')?.value;
      if (!validPrice) {
        throw new Error('Failed to fetch Bitcoin price from all sources');
      }

      // Cache the result
      this.priceFeeds.set(pair, {
        data: validPrice,
        timestamp: Date.now()
      });

      return validPrice;
    } catch (error) {
      throw new Error(`Failed to get Bitcoin price: ${error.message}`);
    }
  }

  /**
   * Fetch price from Binance
   */
  async fetchPriceFromBinance(pair) {
    const symbol = pair.replace('/', '');
    const response = await axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    const data = response.data;

    return {
      symbol: pair,
      price: parseFloat(data.lastPrice),
      change24h: parseFloat(data.priceChangePercent),
      volume24h: parseFloat(data.volume),
      high24h: parseFloat(data.highPrice),
      low24h: parseFloat(data.lowPrice),
      source: 'binance',
      timestamp: Date.now()
    };
  }

  /**
   * Fetch price from CoinGecko
   */
  async fetchPriceFromCoinGecko(quoteCurrency) {
    const currency = quoteCurrency.toLowerCase();
    const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${currency}&include_24hr_change=true&include_24hr_vol=true`);
    const data = response.data.bitcoin;

    return {
      symbol: `BTC/${quoteCurrency}`,
      price: data[currency],
      change24h: data[`${currency}_24h_change`] || 0,
      volume24h: data[`${currency}_24h_vol`] || 0,
      source: 'coingecko',
      timestamp: Date.now()
    };
  }

  /**
   * Fetch price from Coinbase
   */
  async fetchPriceFromCoinbase(pair) {
    const symbol = pair.replace('/', '-');
    const response = await axios.get(`https://api.coinbase.com/v2/exchange-rates?currency=BTC`);
    const rates = response.data.data.rates;
    const quoteCurrency = pair.split('/')[1];

    return {
      symbol: pair,
      price: parseFloat(rates[quoteCurrency] || rates.USD),
      source: 'coinbase',
      timestamp: Date.now()
    };
  }

  /**
   * Get order book for Bitcoin pair
   */
  async getOrderBook(pair, depth = 20) {
    try {
      const symbol = pair.replace('/', '');
      const response = await axios.get(`https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=${depth}`);
      const data = response.data;

      const orderBook = {
        symbol: pair,
        bids: data.bids.map(([price, quantity]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity),
          total: parseFloat(price) * parseFloat(quantity)
        })),
        asks: data.asks.map(([price, quantity]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity),
          total: parseFloat(price) * parseFloat(quantity)
        })),
        timestamp: Date.now()
      };

      // Cache order book
      this.orderBook.set(pair, orderBook);
      return orderBook;
    } catch (error) {
      throw new Error(`Failed to get order book: ${error.message}`);
    }
  }

  /**
   * Execute Bitcoin swap
   */
  async executeBitcoinSwap(fromWalletId, toWalletId, fromAmount, toPair, options = {}) {
    try {
      const [fromAsset, toAsset] = toPair.split('/');
      
      if (fromAsset !== 'BTC' && toAsset !== 'BTC') {
        throw new Error('At least one asset must be Bitcoin');
      }

      // Get current price
      const priceData = await this.getBitcoinPrice(fromAsset === 'BTC' ? toAsset : fromAsset);
      const price = priceData.price;

      // Calculate swap amounts
      let toAmount;
      if (fromAsset === 'BTC') {
        toAmount = fromAmount * price;
      } else {
        toAmount = fromAmount / price;
      }

      // Apply slippage
      const slippage = options.slippage || 0.5; // 0.5% default
      const slippageMultiplier = fromAsset === 'BTC' ? (1 - slippage / 100) : (1 + slippage / 100);
      toAmount *= slippageMultiplier;

      // Calculate fees
      const swapFee = toAmount * (options.feeRate || 0.003); // 0.3% default
      const finalAmount = toAmount - swapFee;

      // Create swap transaction
      const swapTransaction = {
        id: this.generateSwapId(),
        fromWalletId,
        toWalletId,
        fromAsset,
        toAsset,
        fromAmount,
        toAmount: finalAmount,
        price,
        slippage,
        fee: swapFee,
        status: 'pending',
        createdAt: new Date()
      };

      // In a real implementation, this would interact with DEX protocols
      // For now, we simulate the swap
      await this.simulateSwapExecution(swapTransaction);

      return {
        swapId: swapTransaction.id,
        fromAsset,
        toAsset,
        fromAmount,
        toAmount: finalAmount,
        price,
        fee: swapFee,
        status: 'completed',
        estimatedTime: '1-3 minutes'
      };
    } catch (error) {
      throw new Error(`Failed to execute Bitcoin swap: ${error.message}`);
    }
  }

  /**
   * Simulate swap execution (replace with real DEX integration)
   */
  async simulateSwapExecution(swapTransaction) {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update transaction status
    swapTransaction.status = 'completed';
    swapTransaction.completedAt = new Date();
    
    return swapTransaction;
  }

  /**
   * Get Bitcoin market data
   */
  async getBitcoinMarketData() {
    try {
      const [priceData, mempoolStatus] = await Promise.all([
        this.getBitcoinPrice('USDT'),
        this.walletService.getMempoolStatus()
      ]);

      return {
        price: priceData.price,
        change24h: priceData.change24h,
        volume24h: priceData.volume24h,
        high24h: priceData.high24h,
        low24h: priceData.low24h,
        marketCap: priceData.price * 19700000, // Approximate circulating supply
        dominance: await this.getBitcoinDominance(),
        mempool: {
          transactions: mempoolStatus.count,
          size: mempoolStatus.vsize,
          fees: mempoolStatus.totalFees
        },
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Failed to get Bitcoin market data: ${error.message}`);
    }
  }

  /**
   * Get Bitcoin dominance
   */
  async getBitcoinDominance() {
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/global');
      return response.data.data.market_cap_percentage.btc;
    } catch (error) {
      return 45; // Fallback value
    }
  }

  /**
   * Get trading history for Bitcoin pairs
   */
  async getBitcoinTradingHistory(walletId, limit = 50) {
    try {
      // In a real implementation, this would fetch from database
      // For now, we return mock data
      return [
        {
          id: 'trade_1',
          pair: 'BTC/USDT',
          type: 'buy',
          amount: 0.1,
          price: 45000,
          total: 4500,
          fee: 13.5,
          status: 'completed',
          timestamp: Date.now() - 3600000
        },
        {
          id: 'trade_2',
          pair: 'BTC/ETH',
          type: 'sell',
          amount: 0.05,
          price: 18.5,
          total: 0.925,
          fee: 0.002775,
          status: 'completed',
          timestamp: Date.now() - 7200000
        }
      ];
    } catch (error) {
      throw new Error(`Failed to get trading history: ${error.message}`);
    }
  }

  /**
   * Calculate optimal swap route
   */
  async calculateOptimalSwapRoute(fromAsset, toAsset, amount) {
    try {
      if (fromAsset === 'BTC' || toAsset === 'BTC') {
        // Direct swap
        const pair = fromAsset === 'BTC' ? `BTC/${toAsset}` : `${fromAsset}/BTC`;
        const priceData = await this.getBitcoinPrice(fromAsset === 'BTC' ? toAsset : fromAsset);
        
        return {
          route: [fromAsset, toAsset],
          hops: 1,
          estimatedOutput: fromAsset === 'BTC' ? amount * priceData.price : amount / priceData.price,
          priceImpact: 0.1, // Estimated
          fee: 0.3 // 0.3%
        };
      } else {
        // Route through Bitcoin
        const fromBtcPrice = await this.getBitcoinPrice(fromAsset);
        const toBtcPrice = await this.getBitcoinPrice(toAsset);
        
        const btcAmount = amount / fromBtcPrice.price;
        const estimatedOutput = btcAmount * toBtcPrice.price;
        
        return {
          route: [fromAsset, 'BTC', toAsset],
          hops: 2,
          estimatedOutput,
          priceImpact: 0.2, // Higher impact for multi-hop
          fee: 0.6 // 0.3% per hop
        };
      }
    } catch (error) {
      throw new Error(`Failed to calculate swap route: ${error.message}`);
    }
  }

  /**
   * Get Bitcoin network statistics
   */
  async getBitcoinNetworkStats() {
    try {
      const [networkInfo, mempoolStatus, fees] = await Promise.all([
        this.walletService.bitcoinAdapter.getNetworkInfo(),
        this.walletService.getMempoolStatus(),
        this.walletService.bitcoinAdapter.estimateFees()
      ]);

      return {
        blockHeight: networkInfo.blockHeight,
        mempoolSize: mempoolStatus.count,
        mempoolBytes: mempoolStatus.vsize,
        recommendedFees: {
          slow: fees.slow,
          standard: fees.standard,
          fast: fees.fast
        },
        averageBlockTime: 600, // 10 minutes
        difficulty: networkInfo.difficulty,
        hashRate: networkInfo.hashRate,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Failed to get network stats: ${error.message}`);
    }
  }

  /**
   * Generate unique swap ID
   */
  generateSwapId() {
    return 'swap_btc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get service info
   */
  getServiceInfo() {
    return {
      name: 'Bitcoin Trading Service',
      version: '1.0.0',
      supportedPairs: this.supportedPairs,
      features: [
        'spot_trading',
        'price_feeds',
        'order_books',
        'token_swaps',
        'market_data',
        'trading_history',
        'network_stats'
      ],
      priceFeeds: [
        'binance',
        'coingecko',
        'coinbase'
      ]
    };
  }
}

module.exports = BitcoinTradingService;

