/**
 * User Controller
 * Refactored to use Sequelize consistently
 */
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { BlobServiceClient } = require('@azure/storage-blob');
const { v4: uuidv4 } = require('uuid');
const { GoogleAuth } = require('google-auth-library');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

// Import standardized database utilities
const db = require('../models');
const dbUtil = require('../util/database');
const config = require('../config');

// Google Analytics configuration
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const analyticsDataClient = new BetaAnalyticsDataClient({
  auth: new GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: GOOGLE_PRIVATE_KEY,
    },
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  }),
});

/**
 * Add user to wishlist
 */
const addWishlist = async (req, res) => {
  try {
    const { user_id, item_id } = req.body;

    // Check if item exists
    const item = await dbUtil.findById('items', item_id);
    if (!item) {
      return res.status(404).json({
        success: false,
        msg: "Item not found"
      });
    }

    // Check if user exists
    const user = await dbUtil.findById('users', user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        msg: "User not found"
      });
    }

    // Check if wishlist entry already exists
    const existingWishlist = await dbUtil.findOne('wishlist', {
      user_id,
      item_id
    });

    if (existingWishlist) {
      return res.status(400).json({
        success: false,
        msg: "Item already in wishlist"
      });
    }

    // Create wishlist entry
    await dbUtil.create('wishlist', {
      user_id,
      item_id
    });

    return res.status(201).json({
      success: true,
      msg: "Item added to wishlist"
    });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Remove item from wishlist
 */
const removeWishlist = async (req, res) => {
  try {
    const { user_id, item_id } = req.body;

    // Check if wishlist entry exists
    const existingWishlist = await dbUtil.findOne('wishlist', {
      user_id,
      item_id
    });

    if (!existingWishlist) {
      return res.status(404).json({
        success: false,
        msg: "Item not found in wishlist"
      });
    }

    // Delete wishlist entry
    await dbUtil.destroy('wishlist', {
      user_id,
      item_id
    });

    return res.status(200).json({
      success: true,
      msg: "Item removed from wishlist"
    });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get user's wishlist
 */
const wishlist = async (req, res) => {
  try {
    const { user_id } = req.params;

    // Get wishlist items with item details
    const wishlistItems = await dbUtil.query({
      model: 'wishlist',
      where: { user_id },
      include: [
        {
          model: db.items,
          as: 'wishlistM',
          include: [
            {
              model: db.users,
              as: 'creator'
            },
            {
              model: db.item_sale_info,
              as: 'item_sale_info'
            }
          ]
        }
      ]
    });

    return res.status(200).json({
      success: true,
      data: wishlistItems
    });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Add new user
 */
const addUser = async (req, res) => {
  try {
    const { username, email, password, first_name, last_name } = req.body;

    // Check if user with email already exists
    const existingUser = await dbUtil.findOne('users', {
      [db.Sequelize.Op.or]: [
        { email },
        { username }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        msg: existingUser.email === email ? "Email already in use" : "Username already taken"
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user with transaction
    const transaction = await db.sequelize.transaction();

    try {
      // Create user
      const newUser = await dbUtil.create('users', {
        username,
        email,
        password: hashedPassword,
        first_name,
        last_name,
        role_id: 2, // Default to regular user role
        verification_token: uuidv4()
      }, { transaction });

      // Send verification email (implementation omitted)
      // sendVerificationEmail(newUser.email, newUser.verification_token);

      await transaction.commit();

      return res.status(201).json({
        success: true,
        msg: "User registered successfully",
        data: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email
        }
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error registering user:', error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get all users (admin)
 */
const getAllUser = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Get users with pagination
    const users = await dbUtil.query({
      model: 'users',
      include: [
        {
          model: db.roles,
          as: 'role'
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    // Get total count
    const totalUsers = await dbUtil.count('users', {});

    return res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total: totalUsers,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalUsers / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get all users (admin alternative)
 */
const aAllUser = async (req, res) => {
  try {
    // Get all users
    const users = await dbUtil.query({
      model: 'users',
      include: [
        {
          model: db.roles,
          as: 'role'
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching all users:', error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Add wallet details to user
 */
const addWalletDetails = async (req, res) => {
  try {
    const { user_id, wallet_address, blockchain } = req.body;

    // Check if user exists
    const user = await dbUtil.findById('users', user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        msg: "User not found"
      });
    }

    // Update user with wallet address based on blockchain
    const updateData = {};
    
    switch (blockchain.toLowerCase()) {
      case 'xrp':
        updateData.xrp_wallet_address = wallet_address;
        break;
      case 'xlm':
        updateData.xlm_wallet_address = wallet_address;
        break;
      case 'xdc':
        updateData.xdc_wallet_address = wallet_address;
        break;
      case 'solana':
        updateData.solana_wallet_address = wallet_address;
        break;
      default:
        return res.status(400).json({
          success: false,
          msg: "Unsupported blockchain"
        });
    }

    // Update user
    await dbUtil.update('users', updateData, { id: user_id });

    // Create transaction record
    await dbUtil.create('transactions', {
      chainId: blockchain.toLowerCase(),
      fromAddress: wallet_address,
      toAddress: null,
      value: '0',
      currency: blockchain.toUpperCase(),
      status: 'confirmed',
      type: 'wallet_connection',
      userId: user_id,
      data: JSON.stringify({
        action: 'connect_wallet',
        timestamp: new Date().toISOString()
      })
    });

    return res.status(200).json({
      success: true,
      msg: "Wallet details added successfully"
    });
  } catch (error) {
    console.error('Error adding wallet details:', error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Update user profile
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove sensitive fields that shouldn't be updated directly
    delete updateData.password;
    delete updateData.email_verified;
    delete updateData.verification_token;
    delete updateData.reset_password_token;
    delete updateData.reset_password_expires;

    // Check if user exists
    const user = await dbUtil.findById('users', id);
    if (!user) {
      return res.status(404).json({
        success: false,
        msg: "User not found"
      });
    }

    // Update user
    await dbUtil.update('users', updateData, { id });

    return res.status(200).json({
      success: true,
      msg: "User updated successfully"
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Delete user profile
 */
const DeleteProfile = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await dbUtil.findById('users', id);
    if (!user) {
      return res.status(404).json({
        success: false,
        msg: "User not found"
      });
    }

    // Start transaction
    const transaction = await db.sequelize.transaction();

    try {
      // Delete related records
      await dbUtil.destroy('wishlist', { user_id: id }, { transaction });
      
      // Delete user
      await dbUtil.destroy('users', { id }, { transaction });

      await transaction.commit();

      return res.status(200).json({
        success: true,
        msg: "User deleted successfully"
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get categories
 */
const getCategories = async (req, res) => {
  try {
    // Get all active categories
    const categories = await dbUtil.query({
      model: 'categories',
      where: { status: true },
      order: [['name', 'ASC']]
    });

    return res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message
    });
  }
};

// Additional controller methods would be refactored similarly...

// Export all controller methods
module.exports = {
  wishlist,
  addWishlist,
  removeWishlist,
  addUser,
  aAllUser,
  getAllUser,
  addWalletDetails,
  updateUser,
  DeleteProfile,
  getCategories,
  // Additional methods would be included here
};
