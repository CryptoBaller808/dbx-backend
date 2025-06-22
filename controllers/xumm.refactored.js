/**
 * XUMM Controller
 * Refactored to use Sequelize consistently
 */
const express = require("express");
const xumm = require("../services/xumm.js");
const xrplHelper = require("../services/xrpl.js");
const io = require("../services/socket.js");
const xrpl = require("xrpl");

// Import standardized database utilities
const db = require("../models");
const dbUtil = require("../util/database");

const router = express.Router();

/**
 * Health check endpoint
 */
router.get("/", (req, res, next) => {
  res.json({
    success: true,
    working: true,
  });
});

/**
 * Get XUMM app info
 */
router.get("/app-info", async (req, res, next) => {
  try {
    const appInfo = await xumm.ping();
    res.json({
      success: true,
      data: appInfo,
    });
  } catch (error) {
    console.error("Error fetching XUMM app info:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Create XUMM payment request
 */
router.post("/request", async (req, res, next) => {
  try {
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
      
      // Handle payload events
      if (e.data.signed === true) {
        console.log("Signed", e.data);
        io.emit("xumm-signed", {
          payloadId: subscription.created.uuid,
          signed: true,
        });
        return;
      }
      
      if (e.data.expired === true) {
        console.log("Expired", e.data);
        io.emit("xumm-expired", {
          payloadId: subscription.created.uuid,
          expired: true,
        });
        return;
      }
    });
    
    console.log("Subscription created", subscription.created);
    
    res.json({
      success: true,
      data: {
        uuid: subscription.created.uuid,
        next: subscription.created.next,
        qr: subscription.created.refs.qr_png,
      },
    });
  } catch (error) {
    console.error("Error creating XUMM request:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get account offers
 */
router.get("/account-offers/:account", async (req, res, next) => {
  try {
    const { account } = req.params;
    
    // Get offers from database
    const offers = await dbUtil.query({
      model: 'account_offers',
      where: { account },
      order: [['createdAt', 'DESC']]
    });
    
    res.json({
      success: true,
      data: offers,
    });
  } catch (error) {
    console.error("Error fetching account offers:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Create account offer
 */
router.post("/account-offers", async (req, res, next) => {
  try {
    const { account, txId, pair, offerType, side, price, amount, date } = req.body;
    
    // Create offer in database
    const offer = await dbUtil.create('account_offers', {
      account,
      txId,
      pair,
      offerType,
      side,
      price,
      amount,
      date
    });
    
    res.json({
      success: true,
      data: offer,
    });
  } catch (error) {
    console.error("Error creating account offer:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get account transactions
 */
router.get("/account-tx/:account", async (req, res, next) => {
  try {
    const { account } = req.params;
    
    // Get transactions from XRPL
    const client = new xrpl.Client("wss://xrplcluster.com");
    await client.connect();
    
    const transactions = await client.request({
      command: "account_tx",
      account,
      ledger_index_min: -1,
      ledger_index_max: -1,
      binary: false,
      limit: 100,
      forward: false,
    });
    
    await client.disconnect();
    
    // Store transactions in database
    const txs = transactions.result.transactions;
    for (const tx of txs) {
      // Only store if it doesn't exist
      const existingTx = await dbUtil.findOne('transactions', {
        txHash: tx.tx.hash,
        chainId: 'xrp'
      });
      
      if (!existingTx) {
        await dbUtil.create('transactions', {
          chainId: 'xrp',
          txHash: tx.tx.hash,
          fromAddress: tx.tx.Account,
          toAddress: tx.tx.Destination || null,
          value: tx.tx.Amount || '0',
          currency: 'XRP',
          status: 'confirmed',
          type: tx.tx.TransactionType,
          data: JSON.stringify(tx.tx)
        });
      }
    }
    
    res.json({
      success: true,
      data: transactions.result,
    });
  } catch (error) {
    console.error("Error fetching account transactions:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Connect XUMM wallet
 */
router.post("/connect", async (req, res, next) => {
  try {
    const { userToken } = req.body;
    
    // Create sign request
    const request = {
      txjson: {
        TransactionType: "SignIn",
      },
      user_token: userToken || "",
    };
    
    const subscription = await xumm.payload.createAndSubscribe(request, (e) => {
      console.log("Connect Payload", e.data);
      
      // Handle payload events
      if (e.data.signed === true) {
        console.log("Connect Signed", e.data);
        io.emit("xumm-connect-signed", {
          payloadId: subscription.created.uuid,
          signed: true,
          account: e.data.account,
        });
        return;
      }
      
      if (e.data.expired === true) {
        console.log("Connect Expired", e.data);
        io.emit("xumm-connect-expired", {
          payloadId: subscription.created.uuid,
          expired: true,
        });
        return;
      }
    });
    
    console.log("Connect Subscription created", subscription.created);
    
    res.json({
      success: true,
      data: {
        uuid: subscription.created.uuid,
        next: subscription.created.next,
        qr: subscription.created.refs.qr_png,
      },
    });
  } catch (error) {
    console.error("Error connecting XUMM wallet:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
