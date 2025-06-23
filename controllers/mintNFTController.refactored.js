/**
 * Mint NFT Controller
 * Refactored to use Sequelize consistently
 */
const multer = require("multer");
const Aws = require("aws-sdk");
const { XummSdk } = require("xumm-sdk");
const axios = require("axios");
const xrpl = require("xrpl");
const request = require("request");
const http = require("https");

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
const sdk1 = require("api")("@xumm/v0.9#4r71r49l0zx90kh");

// Activity type enum
const ActivityEnum = Object.freeze({
  1: "transaction",
  2: "SaleOffer",
  3: "BuyOffer",
  4: "SaleCancel",
  5: "BuyCancel",
  6: "NftMinted",
});

/**
 * Helper function to query XRP Ledger transaction
 */
async function txAPI(txid) {
  var data = JSON.stringify({
    method: "tx",
    params: [
      {
        transaction: txid,
        binary: false,
      },
    ],
  });
  
  var config = {
    method: "post",
    url: process.env.TESTNET_HTTPS,
    headers: {
      "Content-Type": "application/json",
    },
    data: data,
  };

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error("Error in txAPI:", error);
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
    file.mimetype === "image/gif" ||
    file.mimetype === "video/mp4" ||
    file.mimetype === "audio/mpeg" ||
    file.mimetype === "model/gltf-binary" ||
    file.mimetype === "model/gltf+json"
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
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB file size limit
  },
}).single("file");

/**
 * AWS S3 configuration
 */
const s3 = new Aws.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

/**
 * Mint NFT on XRP Ledger
 */
const mintNFT = async (req, res) => {
  try {
    const {
      name,
      description,
      collection_id,
      category_id,
      user_id,
      properties,
      royalty,
      blockchain,
      wallet_address,
      price,
      currency,
      sale_type,
      expiry_date,
    } = req.body;

    // Validate required fields
    if (!name || !user_id || !collection_id || !category_id) {
      return res.status(400).json({
        success: false,
        msg: "Missing required fields",
      });
    }

    // Check if user exists
    const user = await dbUtil.findById("users", user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        msg: "User not found",
      });
    }

    // Check if collection exists
    const collection = await dbUtil.findById("collections", collection_id);
    if (!collection) {
      return res.status(404).json({
        success: false,
        msg: "Collection not found",
      });
    }

    // Check if category exists
    const category = await dbUtil.findById("categories", category_id);
    if (!category) {
      return res.status(404).json({
        success: false,
        msg: "Category not found",
      });
    }

    // Process file upload
    let fileUrl = null;
    if (req.file) {
      const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `nfts/${Date.now()}-${req.file.originalname}`,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      };

      const uploadResult = await s3.upload(params).promise();
      fileUrl = uploadResult.Location;
    }

    // Start transaction
    const transaction = await db.sequelize.transaction();

    try {
      // Create NFT item
      const newItem = await dbUtil.create(
        "items",
        {
          name,
          description,
          file_url: fileUrl,
          collection_id,
          category_id,
          user_id,
          royalty: royalty || 0,
          blockchain: blockchain || "xrp",
          status: true,
          is_minted: false,
          token_id: null,
          token_address: null,
        },
        { transaction }
      );

      // Add properties if provided
      if (properties && Array.isArray(properties)) {
        for (const prop of properties) {
          await dbUtil.create(
            "item_properties",
            {
              item_id: newItem.id,
              trait_type: prop.trait_type,
              value: prop.value,
              display_type: prop.display_type || null,
            },
            { transaction }
          );
        }
      }

      // Add sale info if price is provided
      if (price) {
        await dbUtil.create(
          "item_sale_info",
          {
            item_id: newItem.id,
            price,
            currency: currency || "XRP",
            sale_type: sale_type || "fixed",
            expiry_date: expiry_date || null,
            status: true,
          },
          { transaction }
        );
      }

      // Add activity record
      await dbUtil.create(
        "item_activity",
        {
          item_id: newItem.id,
          user_id,
          activity_type: 6, // NftMinted
          price: price || 0,
          currency: currency || "XRP",
          from_address: wallet_address || null,
          to_address: null,
          transaction_hash: null,
          status: "pending",
        },
        { transaction }
      );

      await transaction.commit();

      // If wallet address is provided, initiate XRPL minting
      if (wallet_address && blockchain === "xrp") {
        // XUMM payload for NFT minting would be created here
        // This is a placeholder for the actual XUMM integration
        const xummPayload = {
          txjson: {
            TransactionType: "NFTokenMint",
            Account: wallet_address,
            URI: Buffer.from(fileUrl || "").toString("hex").toUpperCase(),
            NFTokenTaxon: 0,
            Flags: 8, // Transferable
            TransferFee: Math.round(royalty * 1000) || 0,
          },
        };

        // This would be replaced with actual XUMM SDK call
        console.log("XUMM payload for NFT minting:", xummPayload);
      }

      return res.status(201).json({
        success: true,
        msg: "NFT created successfully",
        data: {
          id: newItem.id,
          name: newItem.name,
          file_url: newItem.file_url,
        },
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error minting NFT:", error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Get all NFTs
 */
const getAllNFTs = async (req, res) => {
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

    // Build query conditions
    const where = { status: true };
    if (collection_id) where.collection_id = collection_id;
    if (category_id) where.category_id = category_id;
    if (user_id) where.user_id = user_id;
    if (search) {
      where[dbUtil.Op.or] = [
        { name: { [dbUtil.Op.like]: `%${search}%` } },
        { description: { [dbUtil.Op.like]: `%${search}%` } },
      ];
    }

    // Get items with pagination
    const items = await dbUtil.query({
      model: "items",
      where,
      include: [
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
        {
          model: db.item_properties,
          as: "properties",
        },
        {
          model: db.item_sale_info,
          as: "item_sale_info",
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sort_by, sort_order]],
    });

    // Get total count
    const totalItems = await dbUtil.count("items", where);

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
    console.error("Error fetching NFTs:", error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Get NFT by ID
 */
const getNFTById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get item with related data
    const item = await dbUtil.findById("items", id, [
      {
        model: db.users,
        as: "creator",
        attributes: ["id", "username", "profile_image"],
      },
      {
        model: db.collections,
        as: "collection",
        attributes: ["id", "name", "logo_image", "royalty"],
      },
      {
        model: db.categories,
        as: "category",
        attributes: ["id", "name"],
      },
      {
        model: db.item_properties,
        as: "properties",
      },
      {
        model: db.item_sale_info,
        as: "item_sale_info",
      },
      {
        model: db.item_activity,
        as: "activities",
        include: [
          {
            model: db.users,
            as: "user",
            attributes: ["id", "username", "profile_image"],
          },
        ],
      },
    ]);

    if (!item) {
      return res.status(404).json({
        success: false,
        msg: "NFT not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error("Error fetching NFT:", error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Update NFT metadata
 */
const updateNFT = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, properties, status } = req.body;

    // Check if item exists
    const item = await dbUtil.findById("items", id);
    if (!item) {
      return res.status(404).json({
        success: false,
        msg: "NFT not found",
      });
    }

    // Start transaction
    const transaction = await db.sequelize.transaction();

    try {
      // Update item
      await dbUtil.update(
        "items",
        {
          name: name || item.name,
          description: description || item.description,
          status: status !== undefined ? status : item.status,
        },
        { id },
        { transaction }
      );

      // Update properties if provided
      if (properties && Array.isArray(properties)) {
        // Delete existing properties
        await dbUtil.destroy(
          "item_properties",
          { item_id: id },
          { transaction }
        );

        // Add new properties
        for (const prop of properties) {
          await dbUtil.create(
            "item_properties",
            {
              item_id: id,
              trait_type: prop.trait_type,
              value: prop.value,
              display_type: prop.display_type || null,
            },
            { transaction }
          );
        }
      }

      await transaction.commit();

      return res.status(200).json({
        success: true,
        msg: "NFT updated successfully",
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error updating NFT:", error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Delete NFT
 */
const deleteNFT = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if item exists
    const item = await dbUtil.findById("items", id);
    if (!item) {
      return res.status(404).json({
        success: false,
        msg: "NFT not found",
      });
    }

    // Check if NFT is minted
    if (item.is_minted) {
      return res.status(400).json({
        success: false,
        msg: "Cannot delete minted NFT",
      });
    }

    // Start transaction
    const transaction = await db.sequelize.transaction();

    try {
      // Delete properties
      await dbUtil.destroy("item_properties", { item_id: id }, { transaction });

      // Delete sale info
      await dbUtil.destroy("item_sale_info", { item_id: id }, { transaction });

      // Delete activities
      await dbUtil.destroy("item_activity", { item_id: id }, { transaction });

      // Delete wishlist entries
      await dbUtil.destroy("wishlist", { item_id: id }, { transaction });

      // Delete item
      await dbUtil.destroy("items", { id }, { transaction });

      await transaction.commit();

      return res.status(200).json({
        success: true,
        msg: "NFT deleted successfully",
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error deleting NFT:", error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Update NFT minting status
 */
const updateMintingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_minted, token_id, token_address, transaction_hash } = req.body;

    // Check if item exists
    const item = await dbUtil.findById("items", id);
    if (!item) {
      return res.status(404).json({
        success: false,
        msg: "NFT not found",
      });
    }

    // Start transaction
    const transaction = await db.sequelize.transaction();

    try {
      // Update item
      await dbUtil.update(
        "items",
        {
          is_minted: is_minted !== undefined ? is_minted : item.is_minted,
          token_id: token_id || item.token_id,
          token_address: token_address || item.token_address,
        },
        { id },
        { transaction }
      );

      // Update activity if transaction hash is provided
      if (transaction_hash) {
        await dbUtil.update(
          "item_activity",
          {
            transaction_hash,
            status: "confirmed",
          },
          {
            item_id: id,
            activity_type: 6, // NftMinted
            status: "pending",
          },
          { transaction }
        );
      }

      await transaction.commit();

      return res.status(200).json({
        success: true,
        msg: "Minting status updated successfully",
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error updating minting status:", error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  upload,
  mintNFT,
  getAllNFTs,
  getNFTById,
  updateNFT,
  deleteNFT,
  updateMintingStatus,
};
