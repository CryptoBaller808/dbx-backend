/**
 * Sale Controller
 * Refactored to use Sequelize consistently
 */
const moment = require("moment");
require("moment-timezone");
const axios = require("axios");
const xrpl = require("xrpl");
const { XummSdk } = require("xumm-sdk");
const Aws = require("aws-sdk");
const multer = require("multer");

// Import standardized database utilities
const db = require("../models");
const dbUtil = require("../util/database");

// XUMM SDK initialization
const Sdk = new XummSdk(
  process.env.XUMM_API_KEY,
  process.env.XUMM_API_SECRET,
  {
    network: process.env.XRPL_NETWORK || 'mainnet' // defaults to mainnet
  }
);

// Activity type enum
const ActivityEnum = Object.freeze({
  1: "transaction",
  2: "SaleOffer",
  3: "BuyOffer",
  4: "SaleCancel",
  5: "BuyCancel",
  6: "NftMinted",
});

// Platform NFT broker address
const destination = process.env.PLATFORM_NFT_BROKER_ADDRESS;

/**
 * Sign broker request for NFT sale
 */
async function signBrokerReq(nftselloffer, nftbuyoffer, getFee) {
  try {
    // Connect to XRPL
    const client = new xrpl.Client(process.env.TESTNET_WSS);
    await client.connect();

    // Prepare transaction
    const transaction = {
      TransactionType: "NFTokenAcceptOffer",
      Account: destination,
      NFTokenSellOffer: nftselloffer,
      NFTokenBuyOffer: nftbuyoffer,
    };

    // Get fee if requested
    if (getFee) {
      const prepared = await client.autofill(transaction);
      await client.disconnect();
      return prepared.Fee;
    }

    // Submit transaction
    const wallet = xrpl.Wallet.fromSeed(process.env.PLATFORM_NFT_BROKER_SECRET);
    const prepared = await client.autofill(transaction);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    await client.disconnect();
    return result;
  } catch (error) {
    console.error("Error in signBrokerReq:", error);
    throw error;
  }
}

/**
 * Storage configuration for multer
 */
const storage = multer.memoryStorage({
  destination: function (req, file, cb) {
    cb(null, "");
  },
});

/**
 * File filter for multer
 */
const filefilter = (req, file, cb) => {
  if (
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/png" ||
    file.mimetype === "image/gif"
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

/**
 * Configure multer for file uploads
 */
const upload = multer({
  storage: storage,
  fileFilter: filefilter,
}).single("file");

/**
 * AWS S3 configuration
 */
const s3 = new Aws.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

/**
 * Create sale listing for NFT
 */
const createSale = async (req, res) => {
  try {
    const {
      item_id,
      price,
      currency,
      sale_type,
      expiry_date,
      user_id,
      wallet_address,
    } = req.body;

    // Validate required fields
    if (!item_id || !price || !user_id) {
      return res.status(400).json({
        success: false,
        msg: "Missing required fields",
      });
    }

    // Check if item exists
    const item = await dbUtil.findById("items", item_id, [
      {
        model: db.collections,
        as: "collection",
      },
    ]);

    if (!item) {
      return res.status(404).json({
        success: false,
        msg: "Item not found",
      });
    }

    // Check if user is the owner
    if (item.user_id !== parseInt(user_id)) {
      return res.status(403).json({
        success: false,
        msg: "You are not the owner of this item",
      });
    }

    // Check if item is already on sale
    const existingSale = await dbUtil.findOne("item_sale_info", {
      item_id,
      status: true,
    });

    if (existingSale) {
      return res.status(400).json({
        success: false,
        msg: "Item is already on sale",
      });
    }

    // Start transaction
    const transaction = await db.sequelize.transaction();

    try {
      // Create sale info
      const saleInfo = await dbUtil.create(
        "item_sale_info",
        {
          item_id,
          price,
          currency: currency || "XRP",
          sale_type: sale_type || "fixed",
          expiry_date: expiry_date
            ? moment(expiry_date).format("YYYY-MM-DD HH:mm:ss")
            : null,
          status: true,
        },
        { transaction }
      );

      // Add activity record
      await dbUtil.create(
        "item_activity",
        {
          item_id,
          user_id,
          activity_type: 2, // SaleOffer
          price,
          currency: currency || "XRP",
          from_address: wallet_address || null,
          to_address: null,
          transaction_hash: null,
          status: "confirmed",
        },
        { transaction }
      );

      await transaction.commit();

      return res.status(201).json({
        success: true,
        msg: "Sale created successfully",
        data: saleInfo,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error creating sale:", error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Cancel sale listing
 */
const cancelSale = async (req, res) => {
  try {
    const { item_id, user_id, wallet_address } = req.body;

    // Validate required fields
    if (!item_id || !user_id) {
      return res.status(400).json({
        success: false,
        msg: "Missing required fields",
      });
    }

    // Check if item exists
    const item = await dbUtil.findById("items", item_id);
    if (!item) {
      return res.status(404).json({
        success: false,
        msg: "Item not found",
      });
    }

    // Check if user is the owner
    if (item.user_id !== parseInt(user_id)) {
      return res.status(403).json({
        success: false,
        msg: "You are not the owner of this item",
      });
    }

    // Check if item is on sale
    const saleInfo = await dbUtil.findOne("item_sale_info", {
      item_id,
      status: true,
    });

    if (!saleInfo) {
      return res.status(400).json({
        success: false,
        msg: "Item is not on sale",
      });
    }

    // Start transaction
    const transaction = await db.sequelize.transaction();

    try {
      // Update sale info
      await dbUtil.update(
        "item_sale_info",
        {
          status: false,
        },
        { id: saleInfo.id },
        { transaction }
      );

      // Add activity record
      await dbUtil.create(
        "item_activity",
        {
          item_id,
          user_id,
          activity_type: 4, // SaleCancel
          price: saleInfo.price,
          currency: saleInfo.currency,
          from_address: wallet_address || null,
          to_address: null,
          transaction_hash: null,
          status: "confirmed",
        },
        { transaction }
      );

      await transaction.commit();

      return res.status(200).json({
        success: true,
        msg: "Sale cancelled successfully",
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error cancelling sale:", error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Create bid for NFT
 */
const createBid = async (req, res) => {
  try {
    const { item_id, price, currency, expiry_date, user_id, wallet_address } =
      req.body;

    // Validate required fields
    if (!item_id || !price || !user_id) {
      return res.status(400).json({
        success: false,
        msg: "Missing required fields",
      });
    }

    // Check if item exists
    const item = await dbUtil.findById("items", item_id, [
      {
        model: db.item_sale_info,
        as: "item_sale_info",
        where: { status: true },
        required: false,
      },
    ]);

    if (!item) {
      return res.status(404).json({
        success: false,
        msg: "Item not found",
      });
    }

    // Check if user is not the owner
    if (item.user_id === parseInt(user_id)) {
      return res.status(403).json({
        success: false,
        msg: "You cannot bid on your own item",
      });
    }

    // Check if item is on sale for fixed price
    if (
      item.item_sale_info &&
      item.item_sale_info.length > 0 &&
      item.item_sale_info[0].sale_type === "fixed"
    ) {
      return res.status(400).json({
        success: false,
        msg: "Item is on fixed price sale, not auction",
      });
    }

    // Start transaction
    const transaction = await db.sequelize.transaction();

    try {
      // Create bid
      const bid = await dbUtil.create(
        "item_bids",
        {
          item_id,
          user_id,
          price,
          currency: currency || "XRP",
          expiry_date: expiry_date
            ? moment(expiry_date).format("YYYY-MM-DD HH:mm:ss")
            : null,
          status: "active",
        },
        { transaction }
      );

      // Add activity record
      await dbUtil.create(
        "item_activity",
        {
          item_id,
          user_id,
          activity_type: 3, // BuyOffer
          price,
          currency: currency || "XRP",
          from_address: wallet_address || null,
          to_address: null,
          transaction_hash: null,
          status: "confirmed",
        },
        { transaction }
      );

      await transaction.commit();

      return res.status(201).json({
        success: true,
        msg: "Bid created successfully",
        data: bid,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error creating bid:", error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Cancel bid
 */
const cancelBid = async (req, res) => {
  try {
    const { bid_id, user_id, wallet_address } = req.body;

    // Validate required fields
    if (!bid_id || !user_id) {
      return res.status(400).json({
        success: false,
        msg: "Missing required fields",
      });
    }

    // Check if bid exists
    const bid = await dbUtil.findById("item_bids", bid_id);
    if (!bid) {
      return res.status(404).json({
        success: false,
        msg: "Bid not found",
      });
    }

    // Check if user is the bidder
    if (bid.user_id !== parseInt(user_id)) {
      return res.status(403).json({
        success: false,
        msg: "You are not the bidder",
      });
    }

    // Start transaction
    const transaction = await db.sequelize.transaction();

    try {
      // Update bid status
      await dbUtil.update(
        "item_bids",
        {
          status: "cancelled",
        },
        { id: bid_id },
        { transaction }
      );

      // Add activity record
      await dbUtil.create(
        "item_activity",
        {
          item_id: bid.item_id,
          user_id,
          activity_type: 5, // BuyCancel
          price: bid.price,
          currency: bid.currency,
          from_address: wallet_address || null,
          to_address: null,
          transaction_hash: null,
          status: "confirmed",
        },
        { transaction }
      );

      await transaction.commit();

      return res.status(200).json({
        success: true,
        msg: "Bid cancelled successfully",
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error cancelling bid:", error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Accept bid
 */
const acceptBid = async (req, res) => {
  try {
    const { bid_id, user_id, wallet_address } = req.body;

    // Validate required fields
    if (!bid_id || !user_id) {
      return res.status(400).json({
        success: false,
        msg: "Missing required fields",
      });
    }

    // Check if bid exists
    const bid = await dbUtil.findById("item_bids", bid_id, [
      {
        model: db.items,
        as: "item",
        include: [
          {
            model: db.collections,
            as: "collection",
          },
        ],
      },
      {
        model: db.users,
        as: "bidder",
      },
    ]);

    if (!bid) {
      return res.status(404).json({
        success: false,
        msg: "Bid not found",
      });
    }

    // Check if bid is active
    if (bid.status !== "active") {
      return res.status(400).json({
        success: false,
        msg: "Bid is not active",
      });
    }

    // Check if user is the item owner
    if (bid.item.user_id !== parseInt(user_id)) {
      return res.status(403).json({
        success: false,
        msg: "You are not the owner of this item",
      });
    }

    // Start transaction
    const transaction = await db.sequelize.transaction();

    try {
      // Update bid status
      await dbUtil.update(
        "item_bids",
        {
          status: "accepted",
        },
        { id: bid_id },
        { transaction }
      );

      // Update item owner
      await dbUtil.update(
        "items",
        {
          user_id: bid.user_id,
          previous_owner: bid.item.user_id,
        },
        { id: bid.item_id },
        { transaction }
      );

      // Cancel any active sale
      await dbUtil.update(
        "item_sale_info",
        {
          status: false,
        },
        {
          item_id: bid.item_id,
          status: true,
        },
        { transaction }
      );

      // Cancel other active bids
      await dbUtil.update(
        "item_bids",
        {
          status: "cancelled",
        },
        {
          item_id: bid.item_id,
          status: "active",
          id: { [dbUtil.Op.ne]: bid_id },
        },
        { transaction }
      );

      // Add activity record for transaction
      await dbUtil.create(
        "item_activity",
        {
          item_id: bid.item_id,
          user_id,
          activity_type: 1, // transaction
          price: bid.price,
          currency: bid.currency,
          from_address: wallet_address || null,
          to_address: bid.bidder.wallet_address || null,
          transaction_hash: null,
          status: "confirmed",
        },
        { transaction }
      );

      await transaction.commit();

      return res.status(200).json({
        success: true,
        msg: "Bid accepted successfully",
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error accepting bid:", error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Buy NFT at fixed price
 */
const buyNFT = async (req, res) => {
  try {
    const { item_id, user_id, wallet_address } = req.body;

    // Validate required fields
    if (!item_id || !user_id) {
      return res.status(400).json({
        success: false,
        msg: "Missing required fields",
      });
    }

    // Check if item exists with sale info
    const item = await dbUtil.findById("items", item_id, [
      {
        model: db.item_sale_info,
        as: "item_sale_info",
        where: { status: true },
        required: true,
      },
      {
        model: db.collections,
        as: "collection",
      },
      {
        model: db.users,
        as: "creator",
      },
    ]);

    if (!item) {
      return res.status(404).json({
        success: false,
        msg: "Item not found or not on sale",
      });
    }

    // Check if user is not the owner
    if (item.user_id === parseInt(user_id)) {
      return res.status(403).json({
        success: false,
        msg: "You cannot buy your own item",
      });
    }

    // Check if sale type is fixed
    if (item.item_sale_info[0].sale_type !== "fixed") {
      return res.status(400).json({
        success: false,
        msg: "Item is not on fixed price sale",
      });
    }

    // Start transaction
    const transaction = await db.sequelize.transaction();

    try {
      // Update item owner
      await dbUtil.update(
        "items",
        {
          user_id: parseInt(user_id),
          previous_owner: item.user_id,
        },
        { id: item_id },
        { transaction }
      );

      // End the sale
      await dbUtil.update(
        "item_sale_info",
        {
          status: false,
        },
        { id: item.item_sale_info[0].id },
        { transaction }
      );

      // Cancel any active bids
      await dbUtil.update(
        "item_bids",
        {
          status: "cancelled",
        },
        {
          item_id,
          status: "active",
        },
        { transaction }
      );

      // Add activity record for transaction
      await dbUtil.create(
        "item_activity",
        {
          item_id,
          user_id,
          activity_type: 1, // transaction
          price: item.item_sale_info[0].price,
          currency: item.item_sale_info[0].currency,
          from_address: wallet_address || null,
          to_address: item.creator.wallet_address || null,
          transaction_hash: null,
          status: "confirmed",
        },
        { transaction }
      );

      await transaction.commit();

      return res.status(200).json({
        success: true,
        msg: "Item purchased successfully",
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error buying NFT:", error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Get all sales
 */
const getAllSales = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      collection_id,
      category_id,
      user_id,
      search,
      sort_by = "createdAt",
      sort_order = "DESC",
    } = req.query;

    const offset = (page - 1) * limit;

    // Build query conditions for items with active sales
    const where = {};
    if (collection_id) where.collection_id = collection_id;
    if (category_id) where.category_id = category_id;
    if (user_id) where.user_id = user_id;
    if (search) {
      where[dbUtil.Op.or] = [
        { name: { [dbUtil.Op.like]: `%${search}%` } },
        { description: { [dbUtil.Op.like]: `%${search}%` } },
      ];
    }

    // Get items with active sales
    const items = await dbUtil.query({
      model: "items",
      where,
      include: [
        {
          model: db.item_sale_info,
          as: "item_sale_info",
          where: { status: true },
          required: true,
        },
        {
          model: db.users,
          as: "creator",
          attributes: ["id", "username", "profile_image"],
        },
        {
          model: db.collections,
          as: "collection",
          attributes: ["id", "name", "logo_image"],
        },
        {
          model: db.categories,
          as: "category",
          attributes: ["id", "name"],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sort_by, sort_order]],
    });

    // Get total count
    const totalItems = await dbUtil.count("items", {
      include: [
        {
          model: db.item_sale_info,
          as: "item_sale_info",
          where: { status: true },
          required: true,
        },
      ],
      where,
    });

    return res.status(200).json({
      success: true,
      data: items,
      pagination: {
        total: totalItems,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalItems / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching sales:", error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Get all bids for an item
 */
const getItemBids = async (req, res) => {
  try {
    const { item_id } = req.params;

    // Check if item exists
    const item = await dbUtil.findById("items", item_id);
    if (!item) {
      return res.status(404).json({
        success: false,
        msg: "Item not found",
      });
    }

    // Get active bids
    const bids = await dbUtil.query({
      model: "item_bids",
      where: {
        item_id,
        status: "active",
      },
      include: [
        {
          model: db.users,
          as: "bidder",
          attributes: ["id", "username", "profile_image"],
        },
      ],
      order: [["price", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: bids,
    });
  } catch (error) {
    console.error("Error fetching item bids:", error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  upload,
  createSale,
  cancelSale,
  createBid,
  cancelBid,
  acceptBid,
  buyNFT,
  getAllSales,
  getItemBids,
};
