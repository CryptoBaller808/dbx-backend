const express = require("express");
xumm = require("../services/xumm.js");
// import xumm from "../services/xumm.js";
xrplHelper = require("../services/xrpl.js");
// import xrplHelper from "../services/xrpl.js";
io = require("../services/socket.js");
// import io from "../services/socket.js";
// AccountOffers = require('../models/AccountOffers.js');

const db = require("../util/database.js");
const AccountOffers = db.account_offers;

//const AccountOffers = require('../model/AccountOffers.js');  /// MonngoDb

// import AccountOffers from "../model/AccountOffers.js";
const xrpl = require("xrpl");

const router = express.Router();

router.get("/", (req, res, next) => {
  res.json({
    success: true,
    working: true,
  });
});

router.get("/app-info", async (req, res, next) => {
  const appInfo = await xumm.ping();

  res.json({
    success: true,
    data: appInfo,
  });
});

router.post("/request", async (req, res, next) => {
  const { userToken } = req.body;

  const request = {
    txjson: {
      TransactionType: "Payment",
      Destination: "r3WiM5cZ1BjdC7K6m1RmgRYxgTyfFWPygB",
      Amount: "1000000",
    },
    user_token: userToken || "",
  };

  const subscription = await xumm.payload.createAndSubscribe(request, (e) => {
    console.log("New Payload", e.data);

    if (Object.keys(e.data).indexOf("signed") > -1) {
      return e.data;
    }
  });

  console.log("QR url", subscription.created.next.always);

  const resolvedData = await subscription.resolved;

  if (resolvedData.signed == false) {
    res.json({
      success: false,
      data: null,
      message: "Sign request rejected",
    });
  } else {
    const response = await xumm.payload.get(resolvedData.payload_uuidv4);

    res.json({
      success: true,
      data: response,
    });
  }
});

router.get("/get-balance", async (req, res) => {
  const { accountNo } = req.query;

  const response = await xrplHelper.getBalance(accountNo);

  res.json({
    success: true,
    data: response,
  });
});

router.get("/get-allbalance", async (req, res) => {
  const { accountNo } = req.query;

  const response = await xrplHelper.getAllCurrencies(accountNo);

  res.json({
    success: true,
    data: response,
  });
});

router.post("/get-swap-path", async (req, res) => {
  try {
    const data = req.body;

    const response = await xrplHelper.getAvailableSwapPath(data);

    if (response) {
      res.json({
        success: true,
        data: response,
      });
    } else {
      res.json({
        success: false,
        data: response,
      });
    }
  } catch (error) {
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// router.post("/xumm-payment", async (req, res) => {
//   try {
//     const data = req.body;
//     console.log(data)

//     const response = await xrplHelper.XummPayment(data);

//     console.log("response Payment", "=======================", response)
//     if (response) {
//       res.json({
//         success: true,
//         data: response,
//       });
//     } else {
//       res.json({
//         success: false,
//         data: response,
//       });
//     }
//   } catch (error) {
//     console.log(error.message)
//     res.status(500).json({
//       success: false,
//       message: error.message
//     })
//   }
// })

// get account offer from MongDB
// router.post("/get-account-offer", async (req, res) => {
//   const { accountNo } = req.body;
//   // console.log("req.body", accountNo);
//   const accOffers = await AccountOffers.find({ account: accountNo }).sort({
//     _id: -1,
//   });
//    console.log("accOffers", accOffers);
//   res.json({
//     success: true,
//     data: accOffers.length ? accOffers : [],
//   });
// });

// getOpenOrders from MySQL Database

router.post("/get-account-offer", async (req, res) => {
  try {
    const { accountNo } = req.body;
    const accOffers = await AccountOffers.findAll({
      where: { account: accountNo },
      attributes: { exclude: ["id"] },
      order: [["date", "DESC"]],
    });
    if (accOffers.length) {
      res.json({ success: true, data: accOffers });
    } else {
      res.status(200).json({ success: false, message: "No data found." });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Something went wrong." });
  }
});

//get Offer History from MOngoDB
// router.post("/get-offer-history", async (req, res) => {
//   try{
//   const { accountNo } = req.body;
//   // const responseIds = await xrplHelper.getOrderHistory(accountNo);
//   const accOffers = await xrplHelper.getOrderHistory(accountNo);
//   //find corresponding transactions from our database
//   // const accOffers = await AccountOffers.find({
//   //   txId: { $in: responseIds },
//   // }).sort({
//   //   _id: 1,
//   // });
//    console.log("accOffers/history", accOffers);
//   res.json({
//     success: true,
//     data: accOffers.length ? accOffers : [],
//   });
// }
//  catch (error) {
//   console.log(error.message)
//   res.status(500).json({
//     success: false,
//     message: error.message
//   })
// }});

//get all trades of a specific wallet with MySQL

router.post("/get-offer-history", async (req, res) => {
  try {
    const { accountNo } = req.body;
    const responseIds = await xrplHelper.getOrderHistory(accountNo);

    // Check if any of the responseIds match with the txId column in the MySQL database
    const matchingOffers = await AccountOffers.findAll({
      where: { txId: responseIds },
      attributes: { exclude: ["id"] },
      order: [["date", "DESC"]],
    });

    if (matchingOffers.length) {
      res.json({
        success: true,
        data: matchingOffers,
      });
    } else {
      res.json({
        success: true,
        message: "No data found",
        data: [],
      });
    }
  } catch (error) {
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

//get OHLC data
router.post("/get-chart", async (req, res) => {
  const { acc } = req.body;
  const response = await xrplHelper.getChartData(acc);
  // console.log("response", response);
  if (response) {
    res.json({
      success: true,
      data: response,
    });
  } else {
    res.json({
      success: false,
      data: response,
    });
  }
});

router.post("/get-chart-data", async (req, res) => {
  const { acc } = req.body;
  const response = await xrplHelper.getChartDataWithTime(acc);
  // console.log("response", response);
  if (response) {
    res.json({
      success: true,
      data: response,
    });
  } else {
    res.json({
      success: false,
      data: response,
    });
  }
});

//get CHART data
router.post("/get-trades-data", async (req, res) => {
  const { acc } = req.body;
  const response = await xrplHelper.getTradesData(acc);

  if (response) {
    res.json({
      success: true,
      data: response,
    });
  } else {
    res.json({
      success: false,
      data: response,
    });
  }
});
//get Tickers Data
router.post("/get-tickers", async (req, res) => {
  const { acc } = req.body;
  const response = await xrplHelper.getTickersData(acc);
  if (response) {
    res.json({
      success: true,
      data: response,
    });
  } else {
    res.json({
      success: false,
      data: response,
    });
  }
});

router.post("/getExchangeRates", async (req, res) => {
  const { exchangepair } = req.body;
  const response = await xrplHelper.getExchangeRates(exchangepair);
  // console.log("response", response);
  if (response) {
    res.json({
      success: true,
      data: response,
    });
  } else {
    res.json({
      success: false,
      data: response,
    });
  }
});

router.post("/create-trustline", async (req, res) => {
  const data = req.body;
  const trustLineData = await xrplHelper.createTrustLine(data);
  res.json({
    success: true,
    data: trustLineData,
  });
});

router.post("/getorderbooks", async (req, res) => {
  try {
    const data = req.body;
    const response = await xrplHelper.getOrderBooks(data);

    if (response) {
      res.json({
        success: true,
        data: response,
      });
    } else {
      res.json({
        success: false,
        data: response,
      });
    }
  } catch (error) {
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.post("/getusertradelists", async (req, res) => {
  try {
    const { accountNo } = req.body;
    const response = await xrplHelper.getUserTradeLists(accountNo);

    if (response) {
      res.json({
        success: true,
        data: response,
      });
    } else {
      res.json({
        success: false,
        data: response,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

//getVailable Lines

router.post("/getAvailableLines", async (req, res) => {
  try {
    const data = req.body;
    const response = await xrplHelper.getAvailableLines(data);
    if (response) {
      res.json({
        success: true,
        data: response,
      });
    } else {
      res.json({
        success: false,
        data: response,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
