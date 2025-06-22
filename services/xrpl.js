const config = require("../config");
const xrpl = require("xrpl");
const https = require("https");
const moment = require("moment");

const axios = require("axios");
const WebSocket = require("ws");
const websocketUrl = process.env.TESTNET;
const db = require("../util/database.js");
const account_offers = db.account_offers; // SQL Database
const CurrencyList = db.currency_list;

let mainNetURL;
if ("development" !== "development") {
  mainNetURL = "https://api.sologenic.org/api/v1";
} else {
  mainNetURL = "https://api.sologenic.org/api/v1";
}

const getBalance = async (accountInfo) => {
  return new Promise(async (resolve, reject) => {
    try {
      const client = new xrpl.Client(process.env.TESTNET);
      await client.connect();

      const accData = await client.request({
        command: "account_info",
        account: accountInfo,
      });

      const balance = parseInt(accData.result.account_data.Balance) / 1000000;

      const response = {
        balance,
        account: accData.result.account_data.Account,
      };

      client.disconnect();
      resolve(response);
    } catch (err) {
      console.log("error in getBalance :", err);
      reject(err);
    }
  });
};

/* -------------------- TO Swap the asset 1. find path 2. send payments -----------------  */
/* 1. Find paths */
const getAvailableSwapPath = async (data) => {
  let { source_account, destination_account, destination_amount, sendmax } =
    data;
  console.log(sendmax);
  var xsendmax;
  return new Promise(async (resolve, reject) => {
    try {
      const TESTNET_URL = process.env.TESTNET;
      const client = new xrpl.Client(TESTNET_URL);
      await client.connect();

      if (destination_amount.currency === "XRP") {
        if (destination_amount.value == "-1") {
          destination_amount = destination_amount.value;
        } else {
          destination_amount = xrpl.xrpToDrops(destination_amount.value);
        }
      }

      if (sendmax?.currency === "XRP") {
        sendmax = xrpl.xrpToDrops(sendmax.value);
      }

      const accData = await client.request({
        id: 8,
        command: "path_find",
        subcommand: "create",
        source_account: source_account,
        destination_account: destination_account,
        destination_amount: destination_amount,
        sendmax: xsendmax,
      });

      //get all transactions
      const paths = accData.result;

      client.disconnect();
      resolve(paths);
    } catch (err) {
      console.log("error in paths :", err);
      reject(err);
    }
  });
};

/* To get Available Lines for payment */
// const getAvailableLines = (data) => {
//   return new Promise(async (resolve, reject) => {
//     try {
//       // const { source_secret } = data;

//       // /* 1. Get Credentials */
//       // const wallet = xrpl.Wallet.fromSeed(source_secret);
//       // wallet.address = data.account;

//       /* 2. Connect to a Testnet Server */

//       const client = new xrpl.Client(process.env.TESTNET);
//       await client.connect();
//       // Get account Lines for checking balance and trustline
//       const accData = await client.request({
//         command: "account_lines",
//         account: data.source_account,
//       });

//       const availableLines = accData.result.lines;

//       var availableCurrencies = availableLines.map((item) => item.currency);

//       console.log(availableCurrencies);

//       if (data.receivingAmount && data.receivingAmount.currency != "XRP") {
//         if (!availableCurrencies.includes(data.receivingAmount.currency)) {
//           throw new Error(
//             `Please create trustline with ${data.receivingAmount.currency}`
//           );
//         }
//       }

//       if (data.sendMax && data.sendMax.currency != "XRP") {
//         if (!availableCurrencies.includes(data.sendMax.currency)) {
//           throw new Error(
//             `Please create trustline with ${data.sendMax.currency}`
//           );
//         } else {
//           // Check balance
//           const isBalanceAvailable =
//             Number(
//               availableLines.find(
//                 (item) => item.currency === data.sendMax.currency
//               )?.balance
//             ) >= Number(data.sendMax.value);
//           if (!isBalanceAvailable)
//             throw new Error("Don't have enough balance to send");
//         }
//       }

//       client.disconnect();

//       resolve(result);
//     } catch (err) {
//       console.log("error in create TrustLine:", err);
//       reject(err);
//     }
//   });
// };

// const getAvailableLines = (data) => {
//   return new Promise(async (resolve, reject) => {
//     try {
//       /* 1. Get Credentials */
//       // const { source_secret } = data;
//       // const wallet = xrpl.Wallet.fromSeed(source_secret);
//       // wallet.address = data.account;

//       /* 2. Connect to a Testnet Server */
//       const client = new xrpl.Client(process.env.TESTNET);
//       await client.connect();

//       // Get account Lines for checking balance and trustline
//       const accData = await client.request({
//         command: "account_lines",
//         account: data.source_account,
//       });

//       const availableLines = accData.result.lines;

//       var availableCurrencies = availableLines.map((item) => item.currency);

//       console.log(availableCurrencies);
//       console.log("dest curency");
//       console.log(data.destination_amount.currency);

//       if (data.destination_amount && data.destination_amount.currency != "XRP") {
//         if (!availableCurrencies.includes(data.destination_amount.currency)) {
//           throw new Error(
//             `Please create trustline with ${data.destination_amount.currency}`
//           );
//         }
//       }

//       if (data.sendmax && data.sendmax.currency != "XRP") {
//         if (!availableCurrencies.includes(data.sendmax.currency)) {
//           throw new Error(
//             `Please create trustline with ${data.sendmax.currency}`
//           );
//         } else {
//           // Check balance
//           const isBalanceAvailable =
//             Number(
//               availableLines.find(
//                 (item) => item.currency === data.sendmax.currency
//               )?.balance
//             ) >= Number(data.sendmax.value);
//           if (!isBalanceAvailable)
//             throw new Error("Don't have enough balance to send");
//         }
//       }

//       client.disconnect();

//       resolve(availableLines);
//     } catch (err) {
//       console.log("error in create TrustLine:", err);
//       reject(err);
//     }
//   });
// };

const getAvailableLines = (data) => {
  return new Promise(async (resolve, reject) => {
    try {
      /* 1. Get Credentials */
      // const { source_secret } = data;
      // const wallet = xrpl.Wallet.fromSeed(source_secret);
      // wallet.address = data.account;

      /* 2. Connect to a Testnet Server */
      const client = new xrpl.Client(process.env.TESTNET);
      await client.connect();

      let wallet_address = data.source_account
        ? data.source_account
        : data.account; // as param value is different in swapPath & swapPayment

      // Get account Lines for checking balance and trustline
      const accData = await client.request({
        command: "account_lines",
        //   account: data.source_account,
        account: wallet_address,
      });

      const availableLines = accData.result.lines;

      var availableCurrencies = availableLines.map((item) => item.currency);

      if (
        data.destination_amount &&
        data.destination_amount.currency != "XRP"
      ) {
        // if (!availableCurrencies.includes(data.destination_amount.currency)) {
        //   throw new Error(
        //     `Please create trustline with ${data.destination_amount.currency}`
        //   );
        // }

        const trustlineExists = availableLines.some(
          (line) =>
            line.currency === data.destination_amount.currency &&
            line.account === data.destination_amount.issuer
        );
        if (!trustlineExists) {
          throw new Error(
            `Please create trustline with ${data.destination_amount.currency}:${data.destination_amount.issuer}`
          );
        }
      }

      if (data.sendmax && data.sendmax.currency != "XRP") {
        // if (!availableCurrencies.includes(data.sendmax.currency)) {
        //   throw new Error(
        //     `Please create trustline with ${data.sendmax.currency}`
        //   );
        // }

        const trustlineExists = availableLines.some(
          (line) =>
            line.currency === data.sendmax.currency &&
            line.account === data.sendmax.issuer
        );
        if (!trustlineExists) {
          throw new Error(
            `Please create trustline with ${data.sendmax.currency}:${data.sendmax.issuer}`
          );
        } else {
          // Check balance
          const isBalanceAvailable =
            Number(
              availableLines.find(
                (item) => item.currency === data.sendmax.currency
              )?.balance
            ) >= Number(data.sendmax.value);
          if (!isBalanceAvailable)
            throw new Error(
              `You do not have enough ${data.sendmax.currency} balance`
            );
        }
      }

      client.disconnect();

      resolve(availableLines);
    } catch (err) {
      console.log("error in create TrustLine:", err);
      reject(err.message); // emit the error message to the socket
    }
  });
};

/* -------------------- TO GET OFFER HISTORY of a specific Wallet ----------------- */
const getOrderHistory = async (account) => {
  return new Promise(async (resolve, reject) => {
    try {
      const client = new xrpl.Client(process.env.TESTNET);
      await client.connect();

      const accData = await client.request({
        id: 2,
        command: "account_tx",
        account: account,
        ledger_index_min: -1,
        ledger_index_max: -1,
        binary: false,
        limit: 50,
        forward: false,
      });

      //get all transactions

      const transactions = accData.result.transactions.filter(
        (tx) => tx.tx.TransactionType === "OfferCreate"
      );

      // const transactions = accData.result.transactions;

      console.log(transactions);
      //get all transactions id
      const foundData = transactions.map((tx) => {
        return tx.tx.hash;
      });
      client.disconnect();
      resolve(foundData);
    } catch (err) {
      reject(err);
    }
  });
};

const getChartData = (data) => {
  const { curA, curB, issuerB } = data;

  return new Promise(async (resolve, reject) => {
    try {
      var currentTime = new Date();
      var currentMomentDate = moment(currentTime).unix();
      var numberOfMlSeconds = currentTime.getTime();
      var addMlSeconds = 60 * 1000;
      var newDateObj = new Date(numberOfMlSeconds + addMlSeconds);

      //get previous month date
      const today = new Date();
      const yesterday = new Date(today);

      yesterday.setDate(yesterday.getDate() - 30);
      var momentFutureDate = moment(yesterday).unix();

      console.log("currentMomentDate :: ", currentMomentDate);
      console.log("momentFutureDate :: ", yesterday, momentFutureDate);
      //AXIOS CALL
      const url = `https://api.sologenic.org/api/v1/ohlc?symbol=${curA}%2F${curB}%2B${issuerB}&from=${momentFutureDate}&to=${currentMomentDate}&period=1h`;

      console.log("url :: ", url);
      const response = axios({
        method: "get",
        url: url,
      })
        .then((res) => {
          // console.log("res ::: ", res);
          resolve(res.data);
        })
        .catch((err) => reject(err));
    } catch (err) {
      console.log("error in getBalance :", err);
      resolve(err);
    }
  });
};

const getTradesData = (data) => {
  console.log("getTradesData data ::", data);
  const { curA, curB, issuerB } = data;

  return new Promise(async (resolve, reject) => {
    try {
      //URI : api/v1/trades?symbol=XRP%2FUSD%2Brhub8VRN55s94qWKDv6jmDy1pUykJzF3wq&limit=100
      // const curA = "XRP";
      // const curB = "USD";
      // const issuerB = "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq";

      //AXIOS CALL
      const url = `https://api.sologenic.org/api/v1/trades?symbol=${curA}%2F${curB}%2B${issuerB}&limit=100`;

      console.log("url :: ", url);
      axios({
        method: "get",
        url: url,
      })
        .then((res) => {
          // console.log("res ::: ", res);
          resolve(res.data);
        })
        .catch((err) => reject(err));
    } catch (err) {
      console.log("error in getBalance :", err);
      reject(err);
    }
  });
};
const getTickersData = (data) => {
  return new Promise(async (resolve, reject) => {
    try {
      //AXIOS CALL
      const url = `${mainNetURL}/tickers/24h`;

      axios({
        method: "post",
        url: url,
        data,
      })
        .then((res) => {
          // console.log("res ::: ", res.data);
          resolve(res.data);
        })
        .catch((err) => reject(err));
    } catch (err) {
      // console.log("error in getBalance :", err);
      reject(err);
    }
  });
};

// get chart data with custom timestamps
const getChartDataWithTime = (data) => {
  const { curA, curB, issuerB, from, to, period } = data;

  return new Promise(async (resolve, reject) => {
    try {
      const url = `https://api.sologenic.org/api/v1/ohlc?symbol=${curA}%2F${curB}%2B${issuerB}&from=${from}&to=${to}&period=${period}`;

      axios({
        method: "get",
        url: url,
      })
        .then((res) => {
          resolve(res.data);
        })
        .catch((err) => reject(err));
    } catch (err) {
      resolve(err);
    }
  });
};

// get ExchangePair Rates

const getExchangeRates = (data) => {
  const { curA, issuerA, curB, issuerB } = data;

  return new Promise(async (resolve, reject) => {
    try {
      let url;

      if (!issuerA || issuerA.trim() === "") {
        url = `https://data.ripple.com/v2/exchange_rates/${curA}/${curB}+${issuerB}`;
      } else if (!issuerB || issuerB.trim() === "") {
        url = `https://data.ripple.com/v2/exchange_rates/${curA}+${issuerA}/${curB}`;
      } else {
        url = `https://data.ripple.com/v2/exchange_rates/${curA}+${issuerA}/${curB}+${issuerB}`;
      }

      // const url = `https://data.ripple.com/v2/exchange_rates/${currencyPair}`;
      axios({
        method: "get",
        url: url,
      })
        .then((res) => {
          resolve(res.data);
        })
        .catch((err) => reject(err));
    } catch (err) {
      resolve(err);
    }
  });
};

// create Trustline

const createTrustLine = (data) => {
  return new Promise(async (resolve, reject) => {
    try {
      const wallet = xrpl.Wallet.fromSeed(data.secret);

      const client = new xrpl.Client(process.env.TESTNET);
      await client.connect();

      const trustSet_tx = {
        TransactionType: "TrustSet",
        Account: wallet.address,
        LimitAmount: {
          currency: data.currency,
          value: data.value,
          issuer: data.issuer,
        },
      };

      const prepared = await client.autofill(trustSet_tx);
      console.log("Prepared transaction:", JSON.stringify(prepared, null, 2));
      const signed = wallet.sign(prepared);
      console.log("Sending OfferCreate transaction...");
      const result = await client.submitAndWait(signed.tx_blob);
      if (result.result.meta.TransactionResult == "tesSUCCESS") {
        console.log(`Transaction succeeded:
          			https://testnet.xrpl.org/transactions/${signed.hash}`);
      } else {
        throw `Error sending transaction: ${result}`;
      }

      client.disconnect();

      resolve(result);
    } catch (err) {
      console.log("error in create TrustLine:", err);
    }
  });
};

// GetorderBook between two currencies

const getOrderBooks = async (data) => {
  let { taker, taker_gets, taker_pays, limit } = data;

  limit = parseInt(limit);
  console.log(data);
  return new Promise(async (resolve, reject) => {
    try {
      const TESTNET_URL = process.env.TESTNET;
      const client = new xrpl.Client(TESTNET_URL);
      await client.connect();

      const accData = await client.request({
        id: 8,
        command: "book_offers",
        taker: taker,
        taker_gets: taker_gets,
        taker_pays: taker_pays,
        limit: limit,
      });

      //get all transactions
      const paths = accData.result;

      client.disconnect();
      resolve(paths);
    } catch (err) {
      console.log("error in paths :", err);
      reject(err);
    }
  });
};

// const getUserTradeLists = async (account) => {
//   try {
//     console.log(account)
//     const client = new xrpl.Client(process.env.TESTNET);
//     await client.connect();

//     const accData = await client.request({
//       id: 2,
//       command: "account_tx",
//       account: account,
//       // ledger_index_min: -1,
//       ledger_index_max: -1,
//       binary: false,
//       limit: 2,
//       forward: false,
//     });

//     //get all transactions with TransactionType "OfferCreate"
//     const transactions = accData.result.transactions.filter(tx => tx.tx.TransactionType === "OfferCreate");

// const foundData = transactions.map((tx) => {
//   const date = new Date((tx.tx.date + 946684800) * 1000).toISOString().slice(2, 10).replace(/-/g, "/");
//   const hash = tx.tx.hash;
//   const takerPays = `${tx.tx.TakerPays.value} ${tx.tx.TakerPays.currency}`;
//   const takerGets = `${tx.tx.TakerGets.value} ${tx.tx.TakerGets.currency}`;
//   const account = tx.tx.Account;

//       return { takerPays, takerGets, date, hash, account };
//     });

//     client.disconnect();
//     return foundData;
//   } catch (err) {
//     console.log("error in Getting Orders :", err);
//     throw err;
//   }
// };

// const getUserTradeLists = async (account) => {
//   return new Promise(async (resolve, reject) => {
//     try {
//       const client = new xrpl.Client(process.env.TESTNET);
//       await client.connect();

//       const accData = await client.request({
//         id: 2,
//         command: "account_tx",
//         account: account,
//         // ledger_index_min: -1,
//         ledger_index_max: -1,
//         binary: false,
//         limit: 2,
//         forward: false,
//       });

//       //get all transactions

//       const transactions = accData.result.transactions.filter(tx => tx.tx.TransactionType === "OfferCreate");

//       // const transactions = accData.result.transactions;

//       console.log(transactions);
//       //get all transactions id
//       // const foundData = transactions.map((tx) => {
//       //   return tx.tx.hash;
//       // });

//       const foundData = transactions.map((tx) => {
//         const date = new Date((tx.tx.date + 946684800) * 1000).toISOString().slice(2, 10).replace(/-/g, "/");
//         const hash = tx.tx.hash;
//         const takerPays = `${tx.tx.TakerPays.value} ${tx.tx.TakerPays.currency}`;
//         const takerGets = `${tx.tx.TakerGets.value} ${tx.tx.TakerGets.currency}`;
//         const account = tx.tx.Account;

//         return { takerPays, takerGets, date, hash, account };
//       });

//       client.disconnect();
//       resolve(foundData);
//     } catch (err) {
//       console.log("error in Getting Orders :", err);
//       reject(err);
//     }
//   });
// };

// to get Trade list of a piblic address along with calculations
// for mobiles only
const getUserTradeLists = async (account) => {
  return new Promise(async (resolve, reject) => {
    try {
      const client = new xrpl.Client(process.env.TESTNET);
      await client.connect();

      const accData = await client.request({
        id: 2,
        command: "account_tx",
        account: account,
        ledger_index_max: -1,
        binary: false,
        limit: 2,
        forward: false,
      });

      const transactions = accData.result.transactions.filter(
        (tx) => tx.tx.TransactionType === "OfferCreate"
      );

      const foundData = transactions.map((tx) => {
        const takerPays =
          tx.tx.TakerPays.value + " " + tx.tx.TakerPays.currency;
        const takerGets =
          tx.tx.TakerGets.value + " " + tx.tx.TakerGets.currency;
        const date = new Date(0);
        date.setUTCSeconds(tx.tx.date);
        const hmsmdDate = date
          .toISOString()
          .replace(/-/g, "")
          .replace(/:/g, "")
          .replace(/\..+/, "");
        const hash = tx.tx.hash;
        const account = tx.tx.Account;

        let side = "";
        let price = "";
        let amount = "";
        let pair = "";

        if (account === account) {
          side = "BUY ORDER";
          price = tx.tx.TakerGets.value / tx.tx.TakerPays.value;
          amount = tx.tx.TakerPays.value + " " + tx.tx.TakerPays.currency;
          pair = tx.tx.TakerGets.currency + "/" + tx.tx.TakerPays.currency;
        }

        // else{

        //     side = 'SELL ORDER';
        //     price = tx.tx.TakerGets.value / tx.tx.TakerPays.value;
        //     amount = tx.tx.TakerPays.value + ' ' + tx.tx.TakerPays.currency;
        //     pair = tx.tx.TakerGets.currency + '/' + tx.tx.TakerPays.currency;

        // }

        return {
          takerPays,
          takerGets,
          hmsmdDate,
          hash,
          account,
          side,
          price,
          amount,
          pair,
        };
      });

      client.disconnect();
      resolve(foundData);
    } catch (err) {
      reject(err);
    }
  });
};

// DELETE UNFUNDED OFFER

const deleteoffers = async (tx_id) => {
  try {
    const client = new xrpl.Client(process.env.TESTNET);
    await client.connect();
    const accData = await client.request({
      command: "tx",
      transaction: tx_id,
    });

    const sequence_number = accData.result.Sequence;
    const affected_account = accData.result.Account;

    console.log("sequence_number", sequence_number);
    console.log("affected_account", affected_account);

    // Find the balance for USD currency
    client.disconnect();

    return {
      sequence_number: sequence_number,
      affected_account: affected_account,
    }; // Return the availableLines data and the balance for USD currency in an object
  } catch (err) {
    console.log("error in fetching Offer Tx:", err);
    throw err; // rethrow the error to be caught in the calling function
  }
};

// Subscriptions for OrderBooks

const subscribeToOrderBook = async () => {
  const ws = new WebSocket(websocketUrl);

  ws.on("open", async () => {
    // Fetch currency data from the database
    const currencies = await CurrencyList.findAll();

    // Prepare the books array dynamically based on the fetched data
    const books = currencies.map((currency) => ({
      taker_gets: {
        currency: "XRP",
      },
      taker_pays: {
        currency: currency.asset_code,
        issuer: currency.asset_issuer,
      },
      snapshot: true,
      both: true, // Include both bids and asks
    }));

    // Construct the subscription request
    const subscriptionRequest = {
      id: 1,
      command: "subscribe",
      books,
    };

    // Send the subscription request
    ws.send(JSON.stringify(subscriptionRequest));
    console.log("Subscribing to order book...");
  });

  ws.on("message", async (data) => {
    const message = JSON.parse(data);

    if (
      message.type === "transaction" &&
      message.meta.TransactionResult === "tesSUCCESS"
    ) {
      const affectedOffers = message.meta.AffectedNodes.filter((node) => {
        return (
          node.DeletedNode &&
          node.DeletedNode.FinalFields &&
          node.DeletedNode.LedgerEntryType === "Offer"
        );
      });

      if (affectedOffers.length > 0) {
        for (const offer of affectedOffers) {
          const deletedFields = offer.DeletedNode.FinalFields;
          const account = deletedFields.Account;
          const txId = deletedFields.PreviousTxnID;

          console.log(txId);

          // Match account and txId with accountoffer table entries
          const matchedOffer = await matchOfferInDatabase(account, txId);

          if (matchedOffer) {
            console.log(
              "Matched Offer:",
              JSON.stringify(matchedOffer, null, 2)
            );

            const priceDifference =
              matchedOffer.side === "BUY"
                ? matchedOffer.price - parseFloat(offer.TakerPays.value)
                : matchedOffer.price - parseFloat(offer.TakerGets);

            if (Math.abs(priceDifference) < 0.7) {
              // Delete the record if the difference is less than 0.7
              await updateOrderbooktoTrade(matchedOffer.id);
            } else {
              // Update the price with the new value
              await updateOfferPriceInDatabase(
                matchedOffer.id,
                matchedOffer.price - priceDifference
              );
            }
          }
        }
      }
    }
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed");
  });
};

//Match txid with our DB

async function matchOfferInDatabase(account, txId) {
  try {
    // Assuming 'account_offers' is your Sequelize model for the account_offers table
    const matchedOffer = await account_offers.findOne({
      where: {
        txId: txId,
      },
    });

    return matchedOffer;
  } catch (error) {
    console.error("Error in matchOfferInDatabase:", error);
    return null;
  }
}

async function updateOrderbooktoTrade(id) {
  try {
    await account_offers.update(
      { isCompleted: true }, // Update the isCompleted field to true
      {
        where: {
          id: id,
        },
      }
    );

    console.log("Offer marked as completed in the database:", id);
  } catch (error) {
    console.error("Error updating offer as completed in the database:", error);
  }
}

async function updateOfferPriceInDatabase(id, newPrice) {
  try {
    await account_offers.update(
      { price: newPrice, isCompleted: false }, // Update the price and set isCompleted to false
      {
        where: {
          id: id,
        },
      }
    );

    console.log("Offer price updated in database:", id);
  } catch (error) {
    console.error("Error updating offer price in database:", error);
  }
}

subscribeToOrderBook().catch(console.error);

// GET ALL USER CURRENCIES

const getAllCurrencies = async (accountInfo) => {
  return new Promise(async (resolve, reject) => {
    try {
      const client = new xrpl.Client(process.env.TESTNET);
      await client.connect();

      const accData = await client.request({
        command: "account_lines",
        account: accountInfo,
      });

      const currencies = accData.result.lines.map((line) => {
        return {
          issuer_address: line.account,
          balance: line.balance,
          currency: line.currency,
        };
      });

      client.disconnect();
      resolve(currencies);
    } catch (err) {
      console.log("error in getAllCurrencies:", err);
      reject(err);
    }
  });
};

module.exports = {
  getBalance,
  getOrderHistory,
  getChartData,
  getTradesData,
  getTickersData,
  getChartDataWithTime,
  getAvailableSwapPath,
  getAvailableLines,
  getExchangeRates,
  createTrustLine,
  getOrderBooks,
  getUserTradeLists,
  deleteoffers,
  getAllCurrencies,
};
