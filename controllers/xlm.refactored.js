/**
 * Stellar (XLM) Controller
 * Refactored to use Sequelize consistently
 */
const express = require("express");
const axios = require("axios");
const { Horizon, Asset } = require("@stellar/stellar-sdk");

// Import standardized database utilities
const db = require("../models");
const dbUtil = require("../util/database");
const { COIN_IDS, NETWORK_TYPE, getExchangePath } = require("../data/commonData");

const router = express.Router();

// Environment configuration
const isDev = process.env.ENV_TYPE === "development";
const useGecko = process.env.USE_CRYPTO_COMPARE !== "true";
const NETWORK_URL = isDev
  ? process.env.XLM_TESTNET
  : process.env.XLM_PUBNET_BASE_URL;
const xlmServer = new Horizon.Server(NETWORK_URL);

// Cache variables
let chartData = {};
let livePrices = [];

/**
 * Helper function to get days from period
 */
const getDays = (period) => {
  switch (period) {
    case "1d":
      return 1;
    case "3d":
      return 3;
    case "1w":
      return 7;
    default:
      return 1;
  }
};

/**
 * Get live prices for Stellar tokens
 */
router.get("/get-live-prices", async (req, res) => {
  const { ledger } = req.query;
  
  try {
    if (!ledger) {
      return res.status(400).json({ 
        success: false, 
        msg: "Please provide ledger" 
      });
    }
    
    // Get tokens from database using Sequelize
    const dbTokens = await dbUtil.query({
      model: 'currency_list',
      where: {
        chainId: 'xlm',
        isActive: true
      }
    });
    
    if (!dbTokens || dbTokens.length === 0) {
      return res.status(404).json({
        success: false,
        msg: "No tokens found"
      });
    }
    
    // Process tokens and get prices
    const tokens = dbTokens.map(token => ({
      id: token.id,
      symbol: token.symbol,
      name: token.name,
      tokenAddress: token.tokenAddress,
      isNative: token.isNative
    }));
    
    const prices = await Promise.all(
      tokens.map(async (token) => {
        try {
          if (token.isNative) {
            // Get XLM price from CoinGecko or CryptoCompare
            const priceData = useGecko
              ? await axios.get(
                  `https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd`
                )
              : await axios.get(
                  `https://min-api.cryptocompare.com/data/price?fsym=XLM&tsyms=USD&api_key=${process.env.CRYPTO_COMPARE_API_KEY}`
                );
            
            const price = useGecko
              ? priceData.data.stellar.usd
              : priceData.data.USD;
            
            return {
              ...token,
              price
            };
          } else {
            // Get token price from Stellar DEX
            const asset = new Asset(token.symbol, token.tokenAddress);
            const xlmAsset = Asset.native();
            
            const orderbook = await xlmServer.orderbook(asset, xlmAsset).call();
            
            // Calculate price from orderbook
            let price = 0;
            if (orderbook.bids.length > 0) {
              price = parseFloat(orderbook.bids[0].price);
            }
            
            return {
              ...token,
              price
            };
          }
        } catch (error) {
          console.error(`Error fetching price for ${token.symbol}:`, error);
          return {
            ...token,
            price: 0,
            error: error.message
          };
        }
      })
    );
    
    // Update cache
    livePrices = prices;
    
    return res.json({
      success: true,
      data: prices
    });
  } catch (error) {
    console.error("Error fetching live prices:", error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message
    });
  }
});

/**
 * Get price chart data for Stellar tokens
 */
router.get("/get-chart-data", async (req, res) => {
  const { symbol, period = "1d" } = req.query;
  
  try {
    if (!symbol) {
      return res.status(400).json({
        success: false,
        msg: "Please provide symbol"
      });
    }
    
    const days = getDays(period);
    const cacheKey = `${symbol}_${period}`;
    
    // Check cache
    if (chartData[cacheKey] && chartData[cacheKey].timestamp > Date.now() - 5 * 60 * 1000) {
      return res.json({
        success: true,
        data: chartData[cacheKey].data
      });
    }
    
    // Get token from database
    const token = await dbUtil.findOne('currency_list', {
      symbol: symbol.toUpperCase(),
      chainId: 'xlm'
    });
    
    if (!token) {
      return res.status(404).json({
        success: false,
        msg: "Token not found"
      });
    }
    
    let data = [];
    
    if (token.isNative) {
      // Get XLM chart data from CoinGecko or CryptoCompare
      const chartResponse = useGecko
        ? await axios.get(
            `https://api.coingecko.com/api/v3/coins/stellar/market_chart?vs_currency=usd&days=${days}`
          )
        : await axios.get(
            `https://min-api.cryptocompare.com/data/v2/histoday?fsym=XLM&tsym=USD&limit=${days}&api_key=${process.env.CRYPTO_COMPARE_API_KEY}`
          );
      
      data = useGecko
        ? chartResponse.data.prices.map(([timestamp, price]) => ({
            timestamp,
            price
          }))
        : chartResponse.data.Data.Data.map((item) => ({
            timestamp: item.time * 1000,
            price: item.close
          }));
    } else {
      // Get token trades from Stellar DEX
      const asset = new Asset(token.symbol, token.tokenAddress);
      const xlmAsset = Asset.native();
      
      const endTime = new Date();
      const startTime = new Date();
      startTime.setDate(startTime.getDate() - days);
      
      const trades = await xlmServer
        .trades()
        .forAssetPair(asset, xlmAsset)
        .order("desc")
        .limit(100)
        .call();
      
      // Process trades into chart data
      data = trades.records.map((trade) => ({
        timestamp: new Date(trade.ledger_close_time).getTime(),
        price: parseFloat(trade.price.n) / parseFloat(trade.price.d)
      }));
      
      // Sort by timestamp
      data.sort((a, b) => a.timestamp - b.timestamp);
    }
    
    // Update cache
    chartData[cacheKey] = {
      timestamp: Date.now(),
      data
    };
    
    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error("Error fetching chart data:", error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message
    });
  }
});

/**
 * Get account balance
 */
router.get("/get-balance/:account", async (req, res) => {
  const { account } = req.params;
  
  try {
    if (!account) {
      return res.status(400).json({
        success: false,
        msg: "Please provide account"
      });
    }
    
    // Get account from Stellar network
    const accountData = await xlmServer.loadAccount(account);
    
    // Process balances
    const balances = accountData.balances.map((balance) => {
      if (balance.asset_type === "native") {
        return {
          asset_type: "native",
          asset_code: "XLM",
          balance: balance.balance
        };
      } else {
        return {
          asset_type: balance.asset_type,
          asset_code: balance.asset_code,
          asset_issuer: balance.asset_issuer,
          balance: balance.balance
        };
      }
    });
    
    // Store balance data in transactions table
    await dbUtil.create('transactions', {
      chainId: 'xlm',
      fromAddress: account,
      toAddress: null,
      value: '0',
      currency: 'XLM',
      status: 'confirmed',
      type: 'balance_check',
      data: JSON.stringify({
        balances,
        timestamp: new Date().toISOString()
      })
    });
    
    return res.json({
      success: true,
      data: balances
    });
  } catch (error) {
    console.error("Error fetching account balance:", error);
    
    // Check if account not found
    if (error.response && error.response.status === 404) {
      return res.status(404).json({
        success: false,
        msg: "Account not found"
      });
    }
    
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message
    });
  }
});

/**
 * Get account transactions
 */
router.get("/get-transactions/:account", async (req, res) => {
  const { account } = req.params;
  
  try {
    if (!account) {
      return res.status(400).json({
        success: false,
        msg: "Please provide account"
      });
    }
    
    // Get transactions from Stellar network
    const transactions = await xlmServer
      .transactions()
      .forAccount(account)
      .order("desc")
      .limit(100)
      .call();
    
    // Process transactions
    const processedTxs = await Promise.all(
      transactions.records.map(async (tx) => {
        // Get transaction operations
        const operations = await tx.operations();
        
        // Store transaction in database
        await dbUtil.create('transactions', {
          chainId: 'xlm',
          txHash: tx.hash,
          fromAddress: account,
          toAddress: null, // Will be updated based on operations
          value: '0', // Will be updated based on operations
          currency: 'XLM',
          status: 'confirmed',
          type: tx.memo_type ? tx.memo_type : 'transaction',
          data: JSON.stringify({
            memo: tx.memo,
            memo_type: tx.memo_type,
            operations: operations.records,
            timestamp: tx.created_at
          })
        });
        
        return {
          id: tx.id,
          hash: tx.hash,
          ledger: tx.ledger,
          created_at: tx.created_at,
          memo: tx.memo,
          memo_type: tx.memo_type,
          operations: operations.records
        };
      })
    );
    
    return res.json({
      success: true,
      data: processedTxs
    });
  } catch (error) {
    console.error("Error fetching account transactions:", error);
    
    // Check if account not found
    if (error.response && error.response.status === 404) {
      return res.status(404).json({
        success: false,
        msg: "Account not found"
      });
    }
    
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message
    });
  }
});

module.exports = router;
