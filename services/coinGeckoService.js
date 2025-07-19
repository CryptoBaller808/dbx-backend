const axios = require('axios');

class CoinGeckoService {
  constructor() {
    this.apiKey = process.env.COINGECKO_API_KEY || 'CG-Qgjp9CPoPvTfqgbHCk7x8o5Q';
    this.baseURL = 'https://api.coingecko.com/api/v3';
    this.proBaseURL = 'https://pro-api.coingecko.com/api/v3';
    
    // Use pro API if we have an API key
    this.apiURL = this.apiKey ? this.proBaseURL : this.baseURL;
    
    this.axiosInstance = axios.create({
      baseURL: this.apiURL,
      timeout: 10000,
      headers: this.apiKey ? {
        'X-Cg-Pro-Api-Key': this.apiKey
      } : {}
    });

    // Token ID mapping for popular cryptocurrencies
    this.tokenMapping = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum', 
      'XRP': 'ripple',
      'ADA': 'cardano',
      'DOT': 'polkadot',
      'LINK': 'chainlink',
      'LTC': 'litecoin',
      'BCH': 'bitcoin-cash',
      'XLM': 'stellar',
      'USDT': 'tether',
      'USDC': 'usd-coin',
      'BNB': 'binancecoin',
      'SOL': 'solana',
      'MATIC': 'matic-network',
      'AVAX': 'avalanche-2',
      'DOGE': 'dogecoin',
      'SHIB': 'shiba-inu',
      'UNI': 'uniswap',
      'ATOM': 'cosmos',
      'FTT': 'ftx-token',
      'NEAR': 'near',
      'ALGO': 'algorand',
      'VET': 'vechain',
      'ICP': 'internet-computer',
      'FIL': 'filecoin',
      'TRX': 'tron',
      'ETC': 'ethereum-classic',
      'XMR': 'monero',
      'APT': 'aptos',
      'QNT': 'quant-network',
      'STX': 'blockstack',
      'HBAR': 'hedera-hashgraph',
      'LDO': 'lido-dao',
      'CRO': 'crypto-com-chain',
      'TON': 'the-open-network',
      'ARB': 'arbitrum'
    };
  }

  /**
   * Get token ID from symbol
   * @param {string} symbol - Token symbol (e.g., 'BTC', 'ETH')
   * @returns {string} - CoinGecko token ID
   */
  getTokenId(symbol) {
    const upperSymbol = symbol.toUpperCase();
    return this.tokenMapping[upperSymbol] || symbol.toLowerCase();
  }

  /**
   * Get current price for a single token
   * @param {string} tokenSymbol - Token symbol (e.g., 'bitcoin', 'ethereum')
   * @param {string} vsCurrency - Currency to get price in (default: 'usd')
   * @returns {Promise<number>} - Current price
   */
  async getCurrentPrice(tokenSymbol, vsCurrency = 'usd') {
    try {
      const tokenId = this.getTokenId(tokenSymbol);
      
      const response = await this.axiosInstance.get('/simple/price', {
        params: {
          ids: tokenId,
          vs_currencies: vsCurrency,
          include_24hr_change: true,
          include_24hr_vol: true,
          include_last_updated_at: true
        }
      });

      const data = response.data[tokenId];
      if (!data) {
        throw new Error(`Token ${tokenSymbol} not found`);
      }

      return {
        price: data[vsCurrency],
        change_24h: data[`${vsCurrency}_24h_change`],
        volume_24h: data[`${vsCurrency}_24h_vol`],
        last_updated: data.last_updated_at
      };
    } catch (error) {
      console.error(`Error fetching price for ${tokenSymbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Get current prices for multiple tokens
   * @param {string[]} tokenSymbols - Array of token symbols
   * @param {string} vsCurrency - Currency to get prices in (default: 'usd')
   * @returns {Promise<Object>} - Object with token prices
   */
  async getMultiplePrices(tokenSymbols, vsCurrency = 'usd') {
    try {
      const tokenIds = tokenSymbols.map(symbol => this.getTokenId(symbol));
      
      const response = await this.axiosInstance.get('/simple/price', {
        params: {
          ids: tokenIds.join(','),
          vs_currencies: vsCurrency,
          include_24hr_change: true,
          include_24hr_vol: true,
          include_last_updated_at: true
        }
      });

      const result = {};
      tokenSymbols.forEach((symbol, index) => {
        const tokenId = tokenIds[index];
        const data = response.data[tokenId];
        if (data) {
          result[symbol.toUpperCase()] = {
            price: data[vsCurrency],
            change_24h: data[`${vsCurrency}_24h_change`],
            volume_24h: data[`${vsCurrency}_24h_vol`],
            last_updated: data.last_updated_at
          };
        }
      });

      return result;
    } catch (error) {
      console.error('Error fetching multiple prices:', error.message);
      throw error;
    }
  }

  /**
   * Get historical price data for charts
   * @param {string} tokenSymbol - Token symbol
   * @param {string} vsCurrency - Currency (default: 'usd')
   * @param {number} days - Number of days (1, 7, 14, 30, 90, 180, 365, max)
   * @returns {Promise<Array>} - Array of [timestamp, price] pairs
   */
  async getHistoricalPrices(tokenSymbol, vsCurrency = 'usd', days = 7) {
    try {
      const tokenId = this.getTokenId(tokenSymbol);
      
      const response = await this.axiosInstance.get(`/coins/${tokenId}/market_chart`, {
        params: {
          vs_currency: vsCurrency,
          days: days,
          interval: days <= 1 ? 'hourly' : 'daily'
        }
      });

      return response.data.prices;
    } catch (error) {
      console.error(`Error fetching historical prices for ${tokenSymbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Get OHLC data for TradingView charts
   * @param {string} tokenSymbol - Token symbol
   * @param {string} vsCurrency - Currency (default: 'usd')
   * @param {number} days - Number of days
   * @returns {Promise<Array>} - Array of [timestamp, open, high, low, close] data
   */
  async getOHLCData(tokenSymbol, vsCurrency = 'usd', days = 7) {
    try {
      const tokenId = this.getTokenId(tokenSymbol);
      
      const response = await this.axiosInstance.get(`/coins/${tokenId}/ohlc`, {
        params: {
          vs_currency: vsCurrency,
          days: days
        }
      });

      return response.data;
    } catch (error) {
      console.error(`Error fetching OHLC data for ${tokenSymbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Convert amount from one token to another
   * @param {string} fromToken - Source token symbol
   * @param {string} toToken - Target token symbol  
   * @param {number} amount - Amount to convert
   * @returns {Promise<Object>} - Conversion result
   */
  async convertTokens(fromToken, toToken, amount) {
    try {
      const prices = await this.getMultiplePrices([fromToken, toToken]);
      
      if (!prices[fromToken.toUpperCase()] || !prices[toToken.toUpperCase()]) {
        throw new Error('One or both tokens not found');
      }

      const fromPrice = prices[fromToken.toUpperCase()].price;
      const toPrice = prices[toToken.toUpperCase()].price;
      
      const convertedAmount = (amount * fromPrice) / toPrice;
      
      return {
        from_token: fromToken.toUpperCase(),
        to_token: toToken.toUpperCase(),
        from_amount: amount,
        to_amount: convertedAmount,
        from_price: fromPrice,
        to_price: toPrice,
        rate: fromPrice / toPrice,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error converting tokens:', error.message);
      throw error;
    }
  }

  /**
   * Get trending tokens
   * @returns {Promise<Array>} - Array of trending tokens
   */
  async getTrendingTokens() {
    try {
      const response = await this.axiosInstance.get('/search/trending');
      return response.data.coins.map(coin => ({
        id: coin.item.id,
        name: coin.item.name,
        symbol: coin.item.symbol,
        market_cap_rank: coin.item.market_cap_rank,
        thumb: coin.item.thumb
      }));
    } catch (error) {
      console.error('Error fetching trending tokens:', error.message);
      throw error;
    }
  }

  /**
   * Get market data for a token
   * @param {string} tokenSymbol - Token symbol
   * @returns {Promise<Object>} - Detailed market data
   */
  async getMarketData(tokenSymbol) {
    try {
      const tokenId = this.getTokenId(tokenSymbol);
      
      const response = await this.axiosInstance.get(`/coins/${tokenId}`, {
        params: {
          localization: false,
          tickers: false,
          market_data: true,
          community_data: false,
          developer_data: false,
          sparkline: true
        }
      });

      const coin = response.data;
      return {
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        current_price: coin.market_data.current_price.usd,
        market_cap: coin.market_data.market_cap.usd,
        market_cap_rank: coin.market_cap_rank,
        total_volume: coin.market_data.total_volume.usd,
        high_24h: coin.market_data.high_24h.usd,
        low_24h: coin.market_data.low_24h.usd,
        price_change_24h: coin.market_data.price_change_24h,
        price_change_percentage_24h: coin.market_data.price_change_percentage_24h,
        circulating_supply: coin.market_data.circulating_supply,
        total_supply: coin.market_data.total_supply,
        ath: coin.market_data.ath.usd,
        ath_date: coin.market_data.ath_date.usd,
        atl: coin.market_data.atl.usd,
        atl_date: coin.market_data.atl_date.usd,
        last_updated: coin.last_updated
      };
    } catch (error) {
      console.error(`Error fetching market data for ${tokenSymbol}:`, error.message);
      throw error;
    }
  }
}

module.exports = new CoinGeckoService();

