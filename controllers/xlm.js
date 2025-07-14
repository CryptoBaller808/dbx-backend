const express = require("express");
const axios = require("axios");
const {
  COIN_IDS,
  NETWORK_TYPE,
  getExchangePath,
} = require("../data/commonData");
const router = express.Router();

const db = require("../util/database.js");
const CurrencyList = db.currency_list;

const { Horizon, Asset } = require("@stellar/stellar-sdk");
const isDev = process.env.ENV_TYPE === "development";
const useGecko = process.env.USE_CRYPTO_COMPARE !== "true";

const NETWORK_URL = isDev
  ? process.env.XLM_TESTNET
  : process.env.XLM_PUBNET_BASE_URL;

const xlmServer = new Horizon.Server(NETWORK_URL);

let chartData = {};
let livePrices = [];

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

// do not remove 

// router.get("/get-live-prices", async (req, res) => { 
//   const { ledger } = req.query;
//   try {
//     if (!ledger) {
//       return res.status(400).json({ success: false, msg: "please provide ledger" })
//     }

//     const DB_TOKENS = await CurrencyList.findAll({
//       where: {
//         // is_live_net: !isDev,
//         is_exchange: true,
//         ledger: ledger,
//       },
//       raw: true,
//     });

//     const vsCurrencies = DB_TOKENS.map((item) =>
//       item.asset_code.toLowerCase()
//     ).join(",");
//     const finalURL = `${process.env.COIN_BASE_URL}/simple/price?include_24hr_change=true&ids=stellar&vs_currencies=${vsCurrencies}`;
//     // const resp = await axios.get(finalURL);
//     console.log('finalurllll', finalURL);
//     const resp = await axios.get(finalURL, {
//       headers: {
//         'Cache-Control': 'no-cache',
//       },
//     });
//     if (resp.data) {
//       const currentPrices = resp.data.stellar; 
// console.log('currentPrices',currentPrices);
//       const finalPairs = [];
//       DB_TOKENS.forEach((token) => {
//         const key = token.asset_code.toLowerCase();
//         if (currentPrices?.[key]) {
//           finalPairs.push({
//             title: `${ledger.toUpperCase()}/${key.toUpperCase()}`,
//             price: currentPrices[key],
//             stat: currentPrices[`${key}_24h_change`],
//             curA: ledger,
//             curB: key.toUpperCase(),
//             id: token.id,
//             issuerB: token.asset_issuer,
//             icon_url:token.icon_url
//           });
//         }
//       });
//       livePrices = finalPairs;
//       console.log('===================================', finalPairs);
//       if (finalPairs) {
//         return res.status(200).json({ success: true, data: finalPairs });
//       }
//     } else {
//       res.send({ success: true, data: [] });
//     }
//   } catch (err) {
//     console.error("get-live-prices error", err?.response?.statusText);
//     res.send({ success: true, data: livePrices ?? [] });
//   }
// });

router.get("/get-live-prices", async (req, res) => { 
  const { ledger } = req.query;
  try {
    if (!ledger) {
      return res.status(400).json({ success: false, msg: "please provide ledger" })
    }

    const DB_TOKENS = await CurrencyList.findAll({
      where: {
        // is_live_net: !isDev,
        is_exchange: true,
        ledger: ledger,
      },
      raw: true,
    });

    const vsCurrencies = DB_TOKENS.map((item) =>
      item.asset_code.toLowerCase()
    ).join(",");
 
    const finalURL = `${process.env.COIN_BASE_URL}/simple/price?include_24hr_change=true&ids=${vsCurrencies}&vs_currencies=${ledger}`;
    // const finalURL = `https://pro-api.coingecko.com/api/v3/simple/price?include_24hr_change=true&ids=${vsCurrencies}&vs_currencies=${ledger}`;

    // const resp = await axios.get(finalURL); 
    const resp = await axios.get(finalURL, {
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'x-cg-pro-api-key': 'CG-WJiGJcB5x8QfQDTY9pjh2vre'
      },
    });  
    if (resp.data) { 
      const currentPrices = resp.data;  
      const finalPairs = [];
      DB_TOKENS.forEach((token) => {
        const key = token.asset_code.toLowerCase(); 
        if (currentPrices?.[key]) {
          finalPairs.push({
            title: `${ledger.toUpperCase()}/${key.toUpperCase()}`,
            price: ledger==="xrp" ? currentPrices[key].xrp : currentPrices[key].xlm,
            stat: ledger==="xrp" ?currentPrices[key].xrp_24h_change: currentPrices[key].xlm_24h_change,
            curA: ledger,
            curB: key.toUpperCase(),
            id: token.id,
            issuerB: token.asset_issuer,
            icon_url:token.icon_url
          });
        }
      });
      livePrices = finalPairs;
      if (finalPairs) {
        return res.status(200).json({ success: true, data: finalPairs });
      }
    } else {
      res.send({ success: true, data: [] });
    }
  } catch (err) {
    console.error("get-live-prices error", err?.response?.statusText);
    res.send({ success: true, data: livePrices ?? [] });
  }
});

 
router.post("/get-chart-data", async (req, res) => {
  const { curB, period, countBack = 100, to } = req.body.acc;
  const oldData = chartData[curB];
  try {
    let url = "";
    if (useGecko) {
      url = `${process.env.XLM_PRICE_API
        }/ohlc?vs_currency=${curB.toLowerCase()}&days=${getDays(period)}`;
      const resp = await axios.get(url);

      if (resp.data) {
        chartData[curB] = resp.data;
        res.send({ success: true, data: resp.data });
      } else {
        res.send({ success: true, data: oldData ?? [], error: resp.data });
      }
    } else {
      url = `${process.env.CRYPTOCOMP_BASE_URL}/histoday?fsym=xlm&tsym=${curB}&toTs=${to}&limit=2000&api_key=${process.env.CRYPTOCOMP_API_KEY}`;

      const resp = await axios.get(url);
      if (resp.data.Response === "Success" && resp.data?.Data?.Data?.length) {
        const parsedData = resp.data?.Data?.Data.map((item) => [
          item.time,
          item.open,
          item.high,
          item.low,
          item.close,
          item.volumefrom,
        ]);

        chartData[curB] = parsedData;

        res.send({
          success: true,
          data: parsedData,
        });
      } else {
        res.send({ success: true, data: oldData ?? [], error: resp.data });
      }
    }
  } catch (err) {
    console.log("xlm//get-chart-data error", err);
    res.send({ success: true, data: oldData ?? [], error: err?.message });
  }
});

//trades data API
router.post("/get-trades-data", async (req, res) => {
  try {
    const { acc } = req.body;
    const issuer = acc?.issuerB;

    const trades = await xlmServer
      .trades()
      .forAssetPair(new Asset(acc.curB, issuer), new Asset.native())
      .limit(200)
      .order("desc")
      .call();

    const records = trades.records ?? [];

    for (let i = 1; i < records.length; i++) {
      const currentTrade = records[i];
      const previousTrade = records[i - 1];

      previousTrade["time"] = previousTrade?.ledger_close_time;
      previousTrade["price"] =
        Number(previousTrade?.price?.n) / Number(previousTrade?.price?.d);
      previousTrade["amount"] = Number(previousTrade?.base_amount);

      // Compare prices
      if (currentTrade?.price > previousTrade?.price) {
        currentTrade["color"] = "green";
      } else if (currentTrade?.price < previousTrade?.price) {
        currentTrade["color"] = "red";
      } else {
        currentTrade["color"] = "neutral"; // No price change
      }

      // Consider trade type
      if (currentTrade?.base_is_seller) {
        currentTrade["color"] = "green"; // You may adjust this based on your specific scenario
      } else {
        currentTrade["color"] = "red";
      }
    }

    res.json({
      success: true,
      data: records.slice(0, records.length - 1), //removing NAN valued record
    });
  } catch (error) {
    console.log("xlm/get-trades-data:Error", error?.message);
    res.status(200).json({
      success: false,
      data: [],
    });
  }
});

//order books API
router.post("/getorderbooks", async (req, res) => {
  try {
    const { baseCurrency, baseIssuer } = req.body;

    const baseAsset = new Asset(baseCurrency, baseIssuer);
    const quoteAsset = Asset.native();

    const orders = await xlmServer
      .orderbook(baseAsset, quoteAsset)
      .order("desc")
      .call();

    res.json({
      status: "success",
      result: {
        offers: orders.asks,
      },
    });
  } catch (error) {
    console.log("xlm/getorderbooks:error:", error);
    res.json({
      status: "error",
      data: [],
    });
  }
});

router.post("/get-account-offers", async (req, res) => {
  try {
    const { accountNo } = req.body;
    const offers = await xlmServer
      .offers()
      .forAccount(accountNo)
      .order("desc")
      .call();

    const parsedOffers = offers.records.map((record) => {
      const { pair, offerType, side } = analyseXlmOffer(record);
      return {
        ...record,
        date: record.last_modified_time,
        pair,
        offerType,
        side,
      };
    });

    res.status(200).json({ success: true, data: parsedOffers });
  } catch (err) {
    console.warn("get-account-offer.error", err);
    res.status(500).json({ success: false, message: "Something went wrong." });
  }
});

router.post("/get-offer-history", async (req, res) => {
  try {
    const { accountNo } = req.body;

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setDate(twentyFourHoursAgo.getDate() - 1);

    const trades = await xlmServer
      .trades()
      .forAccount(accountNo)
      .forType("orderbook")
      .order("desc")
      .call();

    const parsedTrades = [];

    trades.records.forEach((trade) => {
      const tradeTimestamp = new Date(trade.ledger_close_time).getTime();

      if (tradeTimestamp >= twentyFourHoursAgo.getTime()) {
        parsedTrades.push({
          ...trade,
          date: trade.ledger_close_time,
          pair: `XLM/${trade.counter_asset_code}`,
          offerType: "Orderbook",
          side: trade.base_is_seller ? "Sell" : "Buy",
          amount: trade.base_amount,
          price: Number(trade.price.n) / Number(trade.price.d),
        });
      }
    });

    res.json({
      success: true,
      data: parsedTrades.slice(0, 50),
    });
  } catch (error) {
    console.log("xlm/get-offer-history:error:", error.message);
    res.status(200).json({
      success: false,
      message: error.message,
      data: [],
    });
  }
});

//get Tickers Data
router.post("/get-tickers", async (req, res) => {
  try {
    const { acc } = req.body;
    const pair = acc.symbols[0].split("+")[0];
    const vsCur = pair.split("/")[1];
    const id = COIN_IDS[vsCur];

    const URL = `${process.env.COIN_BASE_URL}/coins/markets?vs_currency=xlm&ids=${id}&order=market_cap_desc`;
    const resp = await axios.get(URL);
    if (resp && resp.statusText === "OK") {
      const obj = resp.data[0];

      const volumeXLM = obj.total_volume;
      const currentPriceXLMtoBTC = obj.current_price;
      const volumeBTC = volumeXLM / currentPriceXLMtoBTC;

      const payload = {
        id: {
          ...obj,
          high_price: obj.high_24h,
          volume: obj.total_volume,
          inverted_volume: volumeBTC,
        },
      };

      res.json({
        success: true,
        data: payload,
      });
    }
  } catch (error) {
    console.log("xlm/get-tickers:Error", error?.message);
    res.json({
      success: false,
      data: error,
    });
  }
});

//get Tickers Data
router.get("/getAssetLists", async (req, res) => {
  try {
    const network = isDev ? NETWORK_TYPE.TESTNET : NETWORK_TYPE.LIVENET;

    // const DB_TOKENS = await CurrencyList.findAll({
    //   where: {
    //     is_live_net: !isDev,
    //     ledger: "xlm",
    //   },
    //   raw: true,
    // });

    // const parsedAssets = DB_TOKENS.map((token) => ({
    //   id: token.id,
    //   asset_code: token.asset_code,
    //   asset_issuer: token.asset_issuer,
    // }));

    // parsedAssets.push({
    //   id: 1009387393,
    //   asset_code: "XLM",
    //   asset_issuer: "native",
    // });

    let parsedAssets = [];

    const URL = `${process.env.STELLAR_EXPERT_URL}/explorer/${network}/asset?limit=20&order=desc&sort=rating`;

    const resp = await axios.get(URL);

    if (resp && resp.data) {
      parsedAssets = resp.data._embedded.records.map((rc, index) => {
        const splitted = rc.asset.split("-");

        return {
          id: index + 1,
          asset_code: splitted[0],
          asset_issuer: splitted[1],
        };
      });
    }

    res.status(200).json({ status: true, data: parsedAssets });
  } catch (error) {
    console.log("xlm/get-tickers:Error", error);
    res.json({
      success: false,
      data: [],
      message: error,
    });
  }
});

router.post("/getExchangeRates", async (req, res) => {
  try {
    console.log("req===>", req.body);

    const {
      fromCurrency,
      toCurrency,
      toIssuer,
      amount,
      fromIssuer = "",
    } = req.body;

    const resp = await getExchangePath({
      fromCurrency,
      toCurrency,
      toIssuer,
      amount,
      fromIssuer,
    });

    res.status(200).json({ status: true, data: resp ?? [] });
  } catch (error) {
    console.log("xlm/getExchangeRates:Error", error);
    res.json({
      success: false,
      data: [],
      message: error,
    });
  }
});

module.exports = router;

const analyseXlmOffer = (offer) => {
  const isNativeSelling = offer.selling.asset_type === "native";
  const isNativeBuying = offer.buying.asset_type === "native";

  if (isNativeBuying && !isNativeSelling) {
    const pair = `XLM/${offer.selling.asset_code}`;

    return { pair, offerType: "ManageBuyOffer", side: "Buy" };
  } else if (isNativeSelling && !isNativeBuying) {
    const pair = `XLM/${offer.buying.asset_code}`;
    return { pair, offerType: "ManageSellOffer", side: "Sell" };
  }
};
