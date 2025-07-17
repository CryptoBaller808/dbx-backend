const { DATE } = require("sequelize");
const db = require("../models");  // Use models instead of util/database
const jwt = require("jsonwebtoken");
const multer = require("multer"); // multer will be used to handle the form data.
const Aws = require("aws-sdk"); // aws-sdk library will used to upload image to s3 bucket.
const { XummSdk } = require("xumm-sdk");
const xrpl = require("xrpl");
const Sdk = new XummSdk(
  process.env.XUMM_API_KEY,
  process.env.XUMM_API_SECRET,
  {
    network: process.env.XRPL_NETWORK || 'mainnet' // defaults to mainnet
  }
);
const sdk = require("api")("@xumm/v0.9#4r71r49l0zx90kh");
const http = require("https");
// create main Model
const User = db.User; // Fixed: Use capitalized User model
const UserRole = db.userRole;
const Categories = db.categories;
const Review = db.reviews;
const Wishlist = db.wishlist;
const Items = db.items;
const CurrencyList = db.CurrencyList; // Fixed: Use correct model name
const BlockchainList = db.blockchain_list;
const settingBanner = db.settings;
const transactions = db.transactions;
const account_offers = db.AccountOffer; // Fixed: Use correct model name
const ItemActivity = db.ItemActivity; // Fixed: Use correct model name
const WAValidator = require("wallet-address-validator");
const { json } = require("body-parser");
const { create } = require("domain");
const { items } = require("../util/database.js");
var Sequelize = require("sequelize");
const crypto = require("crypto");
const { Op } = require("sequelize");
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
require('dotenv').config();
const axios = require('axios');

const loginAdmin = async (req, res) => {
  try {
    console.log('🔐 [ADMIN LOGIN] Login request received');
    console.log('🔍 [ADMIN LOGIN] Request details:', {
      method: req.method,
      url: req.url,
      body: req.body,
      headers: {
        'content-type': req.headers['content-type'],
        'origin': req.headers.origin
      }
    });

    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      console.log('❌ [ADMIN LOGIN] Missing credentials:', { email: !!email, password: !!password });
      return res.status(400).json({ 
        success: false, 
        message: "Email and password are required" 
      });
    }

    console.log('🔍 [ADMIN LOGIN] Attempting login for email:', email);

    // Use direct SQL approach (same as working health endpoint logic)
    const bcrypt = require('bcrypt');
    const jwt = require('jsonwebtoken');
    const { Sequelize } = require('sequelize');
    
    // Create direct database connection
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      logging: false
    });
    
    await sequelize.authenticate();
    console.log('✅ [ADMIN LOGIN] Database connected');
    
    // Find admin user using direct SQL
    const [adminUsers] = await sequelize.query(`
      SELECT id, email, password, role_id
      FROM users 
      WHERE email = $1
    `, {
      bind: [email]
    });
    
    if (adminUsers.length === 0) {
      console.log('❌ [ADMIN LOGIN] User not found for email:', email);
      await sequelize.close();
      return res.status(401).json({ 
        success: false, 
        message: "Invalid credentials" 
      });
    }
    
    const admin = adminUsers[0];
    console.log('✅ [ADMIN LOGIN] User found:', {
      id: admin.id,
      email: admin.email,
      role_id: admin.role_id
    });
    
    // Verify password using bcrypt
    const isValidPassword = await bcrypt.compare(password, admin.password);
    console.log('🔍 [ADMIN LOGIN] Password verification:', isValidPassword ? 'VALID' : 'INVALID');
    
    if (!isValidPassword) {
      console.log('❌ [ADMIN LOGIN] Invalid password for email:', email);
      await sequelize.close();
      return res.status(401).json({ 
        success: false, 
        message: "Invalid credentials" 
      });
    }
    
    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'dbx-temp-secret-2025';
    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        role_id: admin.role_id,
        type: 'admin'
      },
      jwtSecret,
      { expiresIn: '24h' }
    );
    
    console.log('✅ [ADMIN LOGIN] Login successful - JWT token generated');
    await sequelize.close();
    
    // Return successful login response
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token: token,
      user: {
        id: admin.id,
        email: admin.email,
        role_id: admin.role_id,
        type: 'admin'
      }
    });
    
  } catch (error) {
    console.error('❌ [ADMIN LOGIN] Login error:', error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: "Internal server error"
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id; // Assuming user ID is available from authentication middleware
    
    // Find user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Verify current password
    const bcrypt = require('bcrypt');
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    
    if (!isValidPassword) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }
    
    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password in database
    user.password = hashedNewPassword;
    await user.save();
    
    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Utility function to hash the password using SHA-256
function hashPassword(password) {
  const hash = crypto.createHash("sha256");
  hash.update(password);
  return hash.digest("hex");
}

// Utility function to compare hashed passwords
function compareHashedPasswords(password, hashedPassword) {
  const hashedInputPassword = hashPassword(password);
  return hashedInputPassword === hashedPassword;
}

// GET all users
const getAllUser = async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Get the requested page or default to 1
  const limit = parseInt(req.query.limit) || 10; // Number of users to retrieve per page

  const offset = (page - 1) * limit; // Calculate the offset based on the page and limit

  User.findAndCountAll({
    attributes: ["id", "wallet_address", "email", "is_blocked"],
    where: { is_deleted: 0 }, // Add the where condition to filter users with is_deleted = 0
    limit: limit,
    offset: offset,
  })
    .then((result) => {
      const { count, rows } = result;
      console.log("Total active users:", count);
      console.log("Active Users:", rows);
      res.status(200).json({ count, users: rows });
    })
    .catch((err) => {
      console.log("Error:", err);
      res.status(500).json({ error: "An error occurred while fetching users" });
    });
};

// Get user profile by ID
const getuserProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    return res.status(200).json(user);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "An error occurred while fetching user profile" });
  }
};

// Delete user profile
const DeleteProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Soft delete by setting is_deleted flag
    user.is_deleted = 1;
    await user.save();
    
    return res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "An error occurred while deleting user" });
  }
};

// Update user profile
const updateUser = async (req, res) => {
  try {
    const { id, email, firstname, lastname, bio, insta_url, twitter_url, discord_url, fb_url } = req.body;
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Update user fields
    if (email) user.email = email;
    if (firstname) user.firstname = firstname;
    if (lastname) user.lastname = lastname;
    if (bio) user.bio = bio;
    if (insta_url) user.insta_url = insta_url;
    if (twitter_url) user.twitter_url = twitter_url;
    if (discord_url) user.discord_url = discord_url;
    if (fb_url) user.fb_url = fb_url;
    
    // Handle profile image upload if provided
    if (req.files && req.files.profile_image) {
      // Image upload logic would go here
      user.profile_image = "path/to/uploaded/image";
    }
    
    // Handle cover image upload if provided
    if (req.files && req.files.cover_image) {
      // Image upload logic would go here
      user.cover_image = "path/to/uploaded/image";
    }
    
    await user.save();
    return res.status(200).json({ message: "User updated successfully", user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "An error occurred while updating user" });
  }
};

// Image upload middleware
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Not an image! Please upload only images.'), false);
  }
};

const uploadImg = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
}).fields([
  { name: 'profile_image', maxCount: 1 },
  { name: 'cover_image', maxCount: 1 }
]);

const addWalletDetails = async (req, res) => {
  const { wallet_address, access_token, provider } = req.body
  // const { id } = req.query

  try {
    const isExist = await User.findOne({ where: { wallet_address } });
    if (isExist) {
      const deleted = await User.destroy({ where: { wallet_address } });

      // If no rows are deleted, something went wrong
      if (deleted === 0) {
        return res.status(400).json({ error: "Failed to delete existing wallet" });
      }
      return res.status(200).json({ status: true, msg: "wallet disconnect successfully" });

    }

    const response = await User.create({ wallet_address, access_token, provider })
    if (!response) return res.status(400).json({ error: "Something went wrong" });

    return res.status(201).json({ status: true, msg: "Wallet added successfully" });

  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Block or Activate User
const toggleBlockUser = async (req, res) => {
  const userId = req.params.id;

  try {
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.is_blocked = !user.is_blocked;
    await user.save();

    const message = user.is_blocked
      ? "User blocked successfully"
      : "User unblocked successfully";
    res.status(200).json({ message });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "An error occurred while updating the user" });
  }
};

// Stats/Dahsboard Data APIs
const getDashboardSummary = async (req, res) => {
  try {
    const totalUsers = await User.count();
    const TotalTrades = await account_offers.count();
    const currencies = await CurrencyList.count();
    const TotalNFTSales = await ItemActivity.count({ where: { type: 1 } });
    const TotalAskOffferNFT = await ItemActivity.count({ where: { type: 2 } });
    const TotalBidOffferNFT = await ItemActivity.count({ where: { type: 3 } });
    const buyOffers = await account_offers.count({ where: { side: "Buy" } });
    const SellOffers = await account_offers.count({ where: { side: "Sell" } });

    res.status(200).json({
      totalUsers,
      TotalTrades,
      currencies,
      TotalNFTSales,
      TotalAskOffferNFT,
      TotalBidOffferNFT,
      buyOffers,
      SellOffers,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "An error occurred while retrieving the dashboard summary",
    });
  }
};

// get NFT Tx details
const getNFTSalesLists = async (req, res) => {
  try {
    const { page_number = 1, page_size = 10 } = req.query;
    const offset = (page_number - 1) * page_size;
    const limit = parseInt(page_size, 10); // Ensure the pageSize is parsed as an integer

    const { count, rows: nftSales } = await ItemActivity.findAndCountAll({
      where: { type: 1 },
      include: [
        { model: User, as: "buyer_details", attributes: ["wallet_address"] },
        { model: User, as: "seller_details", attributes: ["wallet_address"] },
      ],
      offset,
      limit,
    });

    const modifiedNFTSales = nftSales.map((nftSale) => ({
      id: nftSale.id,
      item_id: nftSale.item_id,
      buyer: nftSale.buyer_details
        ? nftSale.buyer_details.wallet_address
        : null,
      seller: nftSale.seller_details
        ? nftSale.seller_details.wallet_address
        : null,
      price: nftSale.price,
      type: nftSale.type,
      entry_date: nftSale.entry_date,
      tx_id: nftSale.tx_id,
    }));

    const totalPages = Math.ceil(count / page_size);

    res.status(200).json({
      nftSales: modifiedNFTSales,
      totalItems: count,
      currentPage: page_number,
      pageSize: page_size,
      totalPages: totalPages,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "An error occurred while retrieving the NFT sales" });
  }
};

// 1. create User
const addUser = async (req, res) => {
  var createdat = new DATE();
  console.log("this is req date", createdat);
  var payloaduid = "";
  var wallet = "";
  var usertoken = "";
  const request = {
    TransactionType: "SignIn",
  };
  const subscription = await Sdk.payload.createAndSubscribe(
    request,
    (event) => {
      console.log("New payload event:", event.data);
      if (event.data.signed === true) {
        console.log("Woohoo! The sign request was signed :)");
        return event;
      }
      if (event.data.signed === false) {
        console.log("The sign request was rejected :(", event);
        return false;
      }
    }
  );
  console.log("New payload created, URL:", subscription.created.next.always);
  console.log("  > Pushed:", subscription.created.pushed ? "yes" : "no");

  const obj = {};
  const addnew = {
    xumm_url: subscription.created.next.always,
    xumm_png: subscription.created.refs.qr_png,
    verification_id: subscription.payload.meta.uuid,
  };
  Object.entries(addnew).forEach(([key, value]) => {
    obj[key] = value;
  });
  res.status(200).send(obj);
  ///?????///// do we need to save payload uid in server as temporarily?
  ///?????///// we should not send payload id to the front end. contains xumm wallet in response.
  ///?????////  Jwt token should be generated
  payloaduid = subscription.payload.meta.uuid;
  console.log(
    "this is pay load uid :::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::",
    payloaduid
  );

  const resolveData = await subscription.resolved;
  console.log("this is resolve data:::::::::::::::::::", resolveData);

  if (resolveData.signed === false) {
    console.log("The sign request was rejected :(");
    console.log("On ledger TX hash:", result.response);
  } else {
    console.log("! The sign request was signed :)");

    console.log("AFTWR SIGNING");

    console.log("this is resolve data:::::::::::::::::::", resolveData);
    /**
     * Let's fetch the full payload end result and check for
     * a transaction hash, to verify the transaction on ledger later.
     */
    // const result = await Sdk.payload.get(resolveData.data.payload_uuidv4)
    // console.log('On ledger TX hash:', result.response)
    // console.log('On ledger Account', result.response.account)
    // console.log('On ledger Signer', result.response.signer)
  }
};

// 1.1 verify user and create wallet
async function callAwait(wallet, usertoken, firstname = null, lastname = null, email = null, provider = null) {
  var finalobj = {};
  console.log("this is callAwait wallet ::" + wallet + " UserToken :: " + usertoken);
  let retwallet = false;

  await User.findOne({ where: { wallet_address: wallet } })
    .then(async (users) => {
      console.log("user already exists1", users);
      if (wallet.toLowerCase() == users.wallet_address.toLowerCase()) {
        if (users.is_deleted || users.is_blocked) {
          res1.status(201).send("Please contact admin.");
          console.log("Please contact admin because user is deleted");
          retwallet = true;
          var objdel = {
            is_deleted: users.is_deleted,
            is_blocked: users.is_blocked,
          };
          return objdel;
        } else {
          retwallet = true;
          const username = wallet;
          const user = { wallet_address: username };
          const accessToken = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "24h" });
          const xumm_token = usertoken;

          var obj = users.get();
          const add = {
            access_token: accessToken,
            fcmToken: null,
            xumm_token: xumm_token,
          };

          // Only add the optional fields if they are provided
          if (firstname) add.firstname = firstname;
          if (lastname) add.lastname = lastname;
          if (email) add.email = email;
          if (provider) add.provider = provider;

          Object.entries(add).forEach(([key, value]) => {
            obj[key] = value;
          });

          const obj2 = {};
          const addnew = {
            id: obj.id,
            wallet_address: obj.wallet_address,
            access_token: accessToken,
            request_token: xumm_token,
          };
          Object.entries(addnew).forEach(([key, value]) => {
            obj2[key] = value;
          });

          // Get current time through JavaScript
          var today = new Date();
          var date = today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
          var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
          var dateTime = date + " " + time;
          var update1 = dateTime;

          const objid = { wallet_address: username };
          const info = {
            updated_at: update1,
            access_token: accessToken,
            xumm_token: xumm_token,
          };

          // Update user info
          await User.update(info, { where: objid, options: { multi: true } });

          console.log("this is obj", obj2);
          finalobj = obj2;
        }
      } else {
        console.log("user doesn't exist");
      }
    })
    .catch((err) => {
      console.log("Error:", err);
    });

  return finalobj;
}

// FIXED: Added missing controller methods referenced in routes
const xummWalletConnection = async (req, res) => {
  try {
    // Placeholder implementation for XUMM wallet connection
    res.status(200).json({
      success: true,
      message: "XUMM wallet connection endpoint",
      data: {}
    });
  } catch (error) {
    console.error("XUMM wallet connection error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const verifyUser = async (req, res) => {
  try {
    // Placeholder implementation for user verification
    res.status(200).json({
      success: true,
      message: "User verification endpoint",
      data: {}
    });
  } catch (error) {
    console.error("User verification error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const connectWalletMobile = async (req, res) => {
  try {
    // Placeholder implementation for mobile wallet connection
    res.status(200).json({
      success: true,
      message: "Mobile wallet connection endpoint",
      data: {}
    });
  } catch (error) {
    console.error("Mobile wallet connection error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const getAssetLists = async (req, res) => {
  try {
    // Placeholder implementation for asset lists
    res.status(200).json({
      success: true,
      message: "Asset lists endpoint",
      data: {
        assets: []
      }
    });
  } catch (error) {
    console.error("Get asset lists error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = {
  loginAdmin,
  changePassword,
  getAllUser,
  getuserProfile,
  DeleteProfile,
  updateUser,
  uploadImg,
  addWalletDetails,
  toggleBlockUser,
  getDashboardSummary,
  getNFTSalesLists,
  addUser,
  callAwait,
  xummWalletConnection,
  verifyUser,
  connectWalletMobile,
  getAssetLists
};

