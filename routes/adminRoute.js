const express = require('express');
const router = express.Router();

// Add debugging middleware to track requests
router.use((req, res, next) => {
  console.log(`🔍 [ADMIN DEBUG] ${req.method} ${req.path} - Request received`);
  console.log(`🔍 [ADMIN DEBUG] Headers:`, req.headers);
  console.log(`🔍 [ADMIN DEBUG] Query:`, req.query);
  next();
});

// MINIMAL TEST ROUTE - No dependencies
router.get('/minimal', (req, res) => {
  try {
    console.log('✅ [MINIMAL] Minimal test route called successfully');
    console.log('✅ [MINIMAL] Request path:', req.path);
    console.log('✅ [MINIMAL] Request method:', req.method);
    console.log('✅ [MINIMAL] Process uptime:', process.uptime());
    
    const response = { 
      success: true, 
      message: 'Minimal admin route working!',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      path: req.path,
      method: req.method,
      nodeEnv: process.env.NODE_ENV
    };
    
    console.log('✅ [MINIMAL] Sending response:', response);
    res.json(response);
  } catch (err) {
    console.error('❌ [MINIMAL] Even minimal route failed:', err);
    console.error('❌ [MINIMAL] Error stack:', err.stack);
    res.status(500).json({ 
      success: false, 
      error: 'Minimal route failed',
      message: err.message,
      stack: err.stack
    });
  }
});

// TEST MODELS IMPORT
router.get('/test-models', (req, res) => {
  try {
    console.log('🔄 [TEST MODELS] Testing models import...');
    const db = require('../models');
    console.log('✅ [TEST MODELS] Models imported successfully');
    
    const modelKeys = Object.keys(db).filter(key => 
      key !== 'Sequelize' && key !== 'sequelize' && key !== 'initializeDatabase'
    );
    
    res.json({ 
      success: true, 
      message: 'Models import successful',
      models: modelKeys,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ [TEST MODELS] Models import failed:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Models import failed',
      message: err.message,
      stack: err.stack
    });
  }
});

// TEST ENVIRONMENT VARIABLES
router.get('/test-env', (req, res) => {
  try {
    console.log('🔄 [TEST ENV] Testing environment variables...');
    
    const envStatus = {
      success: true,
      message: 'Environment variables test',
      timestamp: new Date().toISOString(),
      variables: {
        NODE_ENV: process.env.NODE_ENV || 'undefined',
        JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
        DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET'
      }
    };
    
    console.log('✅ [TEST ENV] Environment test completed');
    res.json(envStatus);
  } catch (err) {
    console.error('❌ [TEST ENV] Environment test failed:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Environment test failed',
      message: err.message 
    });
  }
});

// ENV CHECK ENDPOINT - As requested by user
router.get('/env-check', (req, res) => {
  try {
    console.log('🔄 [ENV CHECK] Checking environment configuration...');
    
    const envCheck = {
      success: true,
      message: 'Environment check completed',
      timestamp: new Date().toISOString(),
      jwt: process.env.JWT_SECRET ? '✅' : '❌',
      db: process.env.DATABASE_URL ? '✅' : '❌',
      env: process.env.NODE_ENV || 'undefined'
    };
    
    console.log('✅ [ENV CHECK] Environment check completed:', envCheck);
    res.json(envCheck);
  } catch (err) {
    console.error('❌ [ENV CHECK] Environment check failed:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Environment check failed',
      message: err.message 
    });
  }
});

const authMiddleware = require('../services/authMiddleware.js')
const saleController = require('../controllers/saleController.js')
const collectionController = require('../controllers/collectionController.js')
const userController = require('../controllers/userController.js')
const mintNFTController = require('../controllers/mintNFTController.js')
const multer = require('multer');
const upload = multer(); // Initialize multer for handling file uploads
/**
 * @swagger
 * components:
 *   schemas:
 *     Profile:
 *       type: object
 *       required:
 *         - title
 *         - author
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the USER
 *       example:
 *         id: 12
 */

/**
 * @swagger
 * tags:
 *   name: Admin Dashboard
 *   description: Admin related APIs to handle both WEB and MOBILE
 */


/**
 * @swagger
 * /admindashboard/user/getuserProfile/{id}:
 *  get:
 *   summary: 
 *   tags: 
 *    - Admin Dashboard
 *   parameters:
 *    - name: id
 *      in: path
 *      description: ID of user. Use id 113
 *      required: true
 *      type: integer
 *      format: int64
 *   responses:
 *    201:
 *     description: User details by ID
 *    404:
 *     description: User does't exists.
 */

//get user profile by user id
router.get('/user/getuserProfile/:id', authMiddleware.authenticateToken, userController.getuserProfile)


/**
 * @swagger
 * /admindashboard/user/deleteUser/{id}:
 *  post:
 *   summary: 
 *   tags: 
 *    - Admin Dashboard
 *   parameters:
 *    - name: id
 *      in: path
 *      description: ID of user. Use id 118
 *      required: true
 *      type: integer
 *      format: int64
 *   responses:
 *    201:
 *     description: User details by ID
 *    404:
 *     description: User does't exists.
 */

//get user profile by user id
router.post('/user/deleteUser/:id', /* authMiddleware.authenticateToken, */userController.DeleteProfile)



/**
 * @swagger
 * /admindashboard/user/updateUser:
 *  post:
 *   summary: 
 *   tags: 
 *    - Admin Dashboard
 *   requestBody: 
 *    description: Request is made with json body
 *    required: true
 *    content:
 *     multipart/form-data:
 *      schema:
 *       type: object
 *       properties:
 *        id:
 *         type: integer
 *        email:
 *         type: string
 *        firstname:
 *         type: string
 *        lastname:
 *         type: string
 *        profile_image:
 *         type: string
 *         format: binary
 *        cover_image:
 *         type: string
 *         format: binary
 *        insta_url:
 *         type: string
 *        bio:
 *         type: string
 *        twitter_url:
 *         type: string
 *        discord_url:
 *         type: string
 *        fb_url:
 *         type: string
 *   responses:
 *    201:
 *     description: User data updated
 *    400:
 *     description: Erro in updating user data.
 */

//update users
router.post('/user/updateUser',/* authMiddleware.authenticateToken, */userController.uploadImg, userController.updateUser)

/**
 * @swagger
 * /admindashboard/collection/getCollections:
 *  get:
 *   summary:
 *   tags: 
 *    - Admin Dashboard
 *   responses:
 *    200:
 *     description: List of all collections
 *    500:
 *     description: There was an error in fetching collections.
 */

//get all collections
router.get('/collection/getCollections', collectionController.getCollections)

/**
 * @swagger
 * /admindashboard/collection/updateCollection:
 *  post:
 *   summary:
 *   tags: 
 *    - Admin Dashboard
 *   requestBody: 
 *    content:
 *     multipart/form-data:
 *      schema:
 *       type: object
 *       properties:
 *        collection_id:
 *         type: integer
 *         required: true
 *        name:
 *         type: string
 *         required: true
 *        twitter_url:
 *         type: string
 *        insta_url:
 *         type: string
 *        discord_url:
 *         type: string
 *        fb_url:
 *         type: string
 *        profile_image:
 *         type: string
 *         format: binary
 *         required: true
 *        cover_image:
 *         type: string
 *         format: binary
 *   responses:
 *    201:
 *     description: Your collection has been created
 *    400:
 *     description: something went wrong while creating collection.
 */

//create collection
// shift + alt + a for specific block comment
router.post('/collection/updateCollection', /* authMiddleware.authenticateToken, */collectionController.uploadImg/* ,collectionController.uploadImg2 */, collectionController.updateCollection)

/**
 * @swagger
 * /admindashboard/collection/getCollectionbycId/{id}:
 *  get:
 *   summary:
 *   tags: 
 *    - Admin Dashboard
 *   parameters:
 *    - name: id
 *      in: path
 *      description: ID of collection id. Use id 8
 *      required: true
 *      type: integer
 *      format: int64
 *   responses:
 *    201:
 *     description: Get collection by Collection Id.
 *    404:
 *     description: Collection with this Id doesn't exists.
 *    500:
 *     description: Server side error please try again or check your IDs.
 */

//get collection by ID
router.get('/collection/getCollectionbycId/:id', authMiddleware.authenticateToken, collectionController.getCollectionbyId)
/**
 * @swagger
 * /admindashboard/collection/getCollectionbyUserId/{id}:
 *  get:
 *   summary:
 *   tags: 
 *    - Admin Dashboard
 *   parameters:
 *    - name: id
 *      in: path
 *      description: ID of user id. Use id 113
 *      required: true
 *      type: integer
 *      format: int64
 *   responses:
 *    201:
 *     description: Get collections by user Id
 *    404:
 *     description: Collection with this Id doesn't exists.
 *    500:
 *     description: Server side error please try again or check your IDs.
 */
//get collection by user ID
router.get('/collection/getCollectionbyUserId/:id', authMiddleware.authenticateToken, collectionController.getCollectionbyUserId)
/**
 * @swagger
 * /admindashboard/collection/getAllItems:
 *  get:
 *   summary:
 *   tags: 
 *    - Admin Dashboard
 *   responses:
 *    201:
 *     description: Get all NFTs.
 *    404:
 *     description: error
 *    500:
 *     description: Server error
 */

//get collection by ID
router.get('/collection/getAllItems', mintNFTController.getAllItems)

/**
 * @swagger
 * /admindashboard/collection/getAllitemsOnSale:
 *  get:
 *   summary: 
 *   tags: 
 *    - Admin Dashboard
 *   requestBody: 
 *    description: Request is made with json body
 *    content:
 *     multipart/form-data:
 *      schema:
 *       type: object
 *       properties:
 *        sale_type:
 *         type: integer
 *         description: 1 for fix price, 2 for timed auction and 3 for unlimited auction and empty for all items on sale.
 *   responses:
 *    200:
 *     description: Success
 *    400:
 *     description: Error.
 */

//get all items on sale
router.get('/collection/getAllitemsOnSale', saleController.getAllitemsOnSale)


/**
 * @swagger
 * /admindashboard/user/getAllUser:
 *   get:
 *     summary: Get all users
 *     tags:
 *       - Admin Dashboard
 *     description: Retrieves a list of all users.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         description: Send Page number. Positive numbers only.
 *         required: false
 *         type: integer
 *         format: int64
 *       - name: limit
 *         in: query
 *         description: Number of items that you want in one page. Positive numbers only.
 *         required: false
 *         type: integer
 *         format: int64
 *     responses:
 *       200:
 *         description: Successful response. Returns an array of users.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized error. User is not authenticated.
 *       500:
 *         description: Internal Server Error. An error occurred while processing the request.
 */

// Route Definition
router.get('/user/getAllUser', authMiddleware.authenticateToken, userController.getAllUser);
router.post('/user/addWallet',  userController.addWalletDetails);


// Admin Login

/**
 * @swagger
 * /admindashboard/user/loginAdmin:
 *   post:
 *     summary: Login API
 *     tags:
 *      - Admin Dashboard
 *     requestBody:
 *       description: User credentials
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               wal_password:
 *                 type: string
 *             example:
 *               email: john@example.com
 *               wal_password: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 access_token:
 *                   type: string
 *             example:
 *               message: Login successful
 *               access_token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *             example:
 *               error: Invalid credentials
 */

// Route for handling the login request
// router.post('/login', loginUser);

// CORS FIX: Add explicit CORS handling for admin login
router.options('/user/loginAdmin', (req, res) => {
  console.log('🔧 [CORS] Handling OPTIONS preflight for loginAdmin');
  res.header('Access-Control-Allow-Origin', 'https://dbx-admin.onrender.com');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// BACKUP: Simplified test login endpoint with hardcoded admin check
router.options('/user/testLogin', (req, res) => {
  console.log('🔧 [CORS] Handling OPTIONS preflight for testLogin');
  res.header('Access-Control-Allow-Origin', 'https://dbx-admin.onrender.com');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

router.post('/user/testLogin', (req, res) => {
  console.log('🔧 [TEST LOGIN] Processing test login request');
  
  // Add explicit CORS headers
  res.header('Access-Control-Allow-Origin', 'https://dbx-admin.onrender.com');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  try {
    const { email, password } = req.body;
    console.log('🔧 [TEST LOGIN] Email:', email);
    
    // Hardcoded admin check for testing
    if (email === 'admin@dbx.com' && password === 'dbxsupersecure') {
      console.log('✅ [TEST LOGIN] Admin credentials match - login successful');
      
      // Return success response with mock token
      res.status(200).json({
        success: true,
        message: 'Login successful',
        token: 'test-admin-token-' + Date.now(),
        user: {
          id: 1,
          email: 'admin@dbx.com',
          username: 'admin',
          role: 'admin'
        }
      });
    } else {
      console.log('❌ [TEST LOGIN] Invalid credentials');
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
  } catch (error) {
    console.error('❌ [TEST LOGIN] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during test login',
      error: error.message
    });
  }
});

router.post(
  "/user/loginAdmin",
  (req, res, next) => {
    // Add explicit CORS headers for the login endpoint
    console.log('🔧 [CORS] Adding CORS headers for loginAdmin POST');
    res.header('Access-Control-Allow-Origin', 'https://dbx-admin.onrender.com');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    next();
  },
  userController.loginAdmin
);


// change password

/**
 * @swagger
 * /admindashboard/user/change_password:
 *   put:
 *     summary: Change Password
 *     tags:
 *      - Admin Dashboard
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: Old and new passwords
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               oldPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *             example:
 *               oldPassword: oldPassword123
 *               newPassword: newPassword123
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       401:
 *         description: Invalid old password
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */

// Route for changing the password
router.put('/user/change_password', authMiddleware.authenticateToken, userController.changePassword);

// Block/Activate User

/**
 * @swagger
 * /admindashboard/user/toggleBlockUser/{id}:
 *   post:
 *     summary: Toggle block/unblock user
 *     tags:
 *       - Admin Dashboard
 *     description: Toggles the block status of a user based on their ID.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the user to toggle the block status.
 *     responses:
 *       200:
 *         description: Successful response. Returns a message indicating the user's block status.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ToggleBlockUserResponse'
 *       401:
 *         description: Unauthorized error. User is not authenticated.
 *       404:
 *         description: User not found. The provided user ID does not exist.
 *       500:
 *         description: Internal Server Error. An error occurred while processing the request.
 */

// Route Definition
router.post('/user/toggleBlockUser/:id', authMiddleware.authenticateToken, userController.toggleBlockUser);

/**
 * @swagger
 * /admindashboard/user/dashboardSummary:
 *   get:
 *     summary: Get NFT Dashboard Data 
 *     tags:
 *       - Admin Dashboard
 *     description: Retrieves all Data on the specified criteria.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successful response. Returns an array of Dashboard data.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/dashboardSummaryResponse'
 *       401:
 *         description: Unauthorized error. User is not authenticated.
 *       500:
 *         description: Internal Server Error. An error occurred while processing the request.
 */

// Route Definition
router.get('/user/dashboardSummary', authMiddleware.authenticateToken, userController.getDashboardSummary);


/**
 * @swagger
 * /admindashboard/user/getNFTSalesLists:
 *   get:
 *     summary: Get NFT sales
 *     tags:
 *       - Admin Dashboard
 *     description: Retrieves all Dashboard Stats based for Admin
 *     parameters:
 *       - name: page_number
 *         in: query
 *         description: Send Page number. Positive numbers only.
 *         required: false
 *         type: integer
 *         format: int64
 *       - name: page_size
 *         in: query
 *         description: Number of items that you want in one page. Positive numbers only.
 *         required: false
 *         type: integer
 *         format: int64
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successful response. Returns an array of NFT sales.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/getNFTSalesListsResponse'
 *       401:
 *         description: Unauthorized error. User is not authenticated.
 *       500:
 *         description: Internal Server Error. An error occurred while processing the request.
 *
 * components:
 *   schemas:
 *     getNFTSalesListsResponse:
 *       type: object
 *       properties:
 *         nftSales:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/NFTSale'
 *     NFTSale:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         item_id:
 *           type: integer
 *         buyer:
 *           type: string
 *         seller:
 *           type: string
 *         price:
 *           type: string
 *         type:
 *           type: integer
 *         entry_date:
 *           type: string
 *           format: date-time
 *         tx_id:
 *           type: string
 */

// Route Definition
router.get('/user/getNFTSalesLists', authMiddleware.authenticateToken, userController.getNFTSalesLists);

// TEMPORARY: Test endpoint
router.get('/user/test', async (req, res) => {
  try {
    console.log('🔄 [USER TEST] Starting database test...');
    
    const db = require('../models');
    console.log('🔄 [USER TEST] Models imported successfully');
    console.log('🔄 [USER TEST] DB object type:', typeof db);
    console.log('🔄 [USER TEST] DB sequelize exists:', !!db.sequelize);
    
    if (!db || !db.sequelize) {
      throw new Error('Database connection not available - db.sequelize is undefined');
    }
    
    console.log('🔄 [USER TEST] Testing database connection...');
    // Test database connection
    await db.sequelize.authenticate();
    console.log('✅ [USER TEST] Database authentication successful');
    
    console.log('🔄 [USER TEST] Checking available models...');
    const availableModels = Object.keys(db).filter(key => key !== 'Sequelize' && key !== 'sequelize' && key !== 'initializeDatabase');
    console.log('📋 [USER TEST] Available models:', availableModels);
    
    return res.json({ 
      success: true, 
      message: 'Database connection successful',
      models: availableModels,
      user_model_exists: !!db.User,
      role_model_exists: !!db.Role,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('🔥 [USER TEST] Test error:', err);
    console.error('🔥 [USER TEST] Error message:', err.message);
    console.error('🔥 [USER TEST] Stack trace:', err.stack);
    return res.status(500).json({ 
      success: false, 
      message: 'Test failed',
      error: err.message || 'Unknown error',
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
  }
});

// TEMPORARY: Simple Database Connection Test
router.get('/user/testConnection', async (req, res) => {
  try {
    console.log('🔄 [TEST CONNECTION] Starting database connection test...');
    console.log('🔄 [TEST CONNECTION] Request path:', req.path);
    console.log('🔄 [TEST CONNECTION] Request method:', req.method);
    console.log('🔄 [TEST CONNECTION] DATABASE_URL exists:', !!process.env.DATABASE_URL);
    
    if (!process.env.DATABASE_URL) {
      console.error('❌ [TEST CONNECTION] DATABASE_URL is not set');
      return res.status(500).json({ 
        success: false, 
        message: 'DATABASE_URL environment variable is not set',
        timestamp: new Date().toISOString()
      });
    }
    
    console.log('🔄 [TEST CONNECTION] Importing Sequelize...');
    const { Sequelize } = require('sequelize');
    console.log('✅ [TEST CONNECTION] Sequelize imported successfully');
    
    console.log('🔄 [TEST CONNECTION] Creating Sequelize instance...');
    // Test basic connection without models
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
    
    console.log('🔄 [TEST CONNECTION] Testing authentication...');
    await sequelize.authenticate();
    console.log('✅ [TEST CONNECTION] Direct database connection successful');
    
    return res.json({ 
      success: true, 
      message: 'Direct database connection successful',
      database_url_exists: !!process.env.DATABASE_URL,
      database_url_length: process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('🔥 [TEST CONNECTION] Direct connection test error:', err);
    console.error('🔥 [TEST CONNECTION] Error message:', err.message);
    console.error('🔥 [TEST CONNECTION] Error stack:', err.stack);
    return res.status(500).json({ 
      success: false, 
      message: 'Direct connection test failed',
      error: err.message || 'Unknown error',
      database_url_exists: !!process.env.DATABASE_URL,
      timestamp: new Date().toISOString()
    });
  }
});

// TEMPORARY: Database Sync - Create Tables
router.post('/user/syncDatabase', async (req, res) => {
  try {
    console.log('🔄 [SYNC DATABASE] Starting database synchronization...');
    console.log('🔄 [SYNC DATABASE] Request path:', req.path);
    console.log('🔄 [SYNC DATABASE] Request method:', req.method);
    
    console.log('🔄 [SYNC DATABASE] Importing models...');
    const db = require('../models');
    console.log('🔄 [SYNC DATABASE] Models imported successfully');
    console.log('🔄 [SYNC DATABASE] DB object type:', typeof db);
    console.log('🔄 [SYNC DATABASE] DB sequelize exists:', !!db.sequelize);
    console.log('🔄 [SYNC DATABASE] Available models:', Object.keys(db).filter(key => key !== 'Sequelize' && key !== 'sequelize' && key !== 'initializeDatabase'));
    
    if (!db || !db.sequelize) {
      console.error('❌ [SYNC DATABASE] Database connection not available - db.sequelize is undefined');
      throw new Error('Database connection not available - db.sequelize is undefined');
    }
    
    console.log('🔄 [SYNC DATABASE] Testing database connection...');
    await db.sequelize.authenticate();
    console.log('✅ [SYNC DATABASE] Database authentication successful');
    
    console.log('🔄 [SYNC DATABASE] Starting sync operation...');
    // Sync database - this will create tables if they don't exist
    await db.sequelize.sync({ force: false, alter: true });
    
    console.log('✅ [SYNC DATABASE] Database synchronization completed');
    
    return res.json({ 
      success: true, 
      message: 'Database synchronized successfully',
      tables_created: true,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('🔥 [SYNC DATABASE] Sync error:', err);
    console.error('🔥 [SYNC DATABASE] Error message:', err.message);
    console.error('🔥 [SYNC DATABASE] Error stack:', err.stack);
    return res.status(500).json({ 
      success: false, 
      message: 'Database sync failed',
      error: err.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// TEMPORARY: Create Default Admin
router.post('/user/createDefaultAdmin', async (req, res) => {
  try {
    console.log('🔄 [CREATE ADMIN] Starting admin creation process...');
    console.log('🔄 [CREATE ADMIN] Request path:', req.path);
    console.log('🔄 [CREATE ADMIN] Request method:', req.method);
    
    console.log('🔄 [CREATE ADMIN] Importing bcrypt...');
    const bcrypt = require('bcryptjs');
    console.log('✅ [CREATE ADMIN] bcrypt imported successfully');
    
    console.log('🔄 [CREATE ADMIN] Importing models...');
    const db = require('../models'); // Import db object
    console.log('✅ [CREATE ADMIN] Models imported successfully');
    
    console.log('🔄 [CREATE ADMIN] Models imported successfully');
    console.log('🔄 [CREATE ADMIN] DB object type:', typeof db);
    console.log('🔄 [CREATE ADMIN] DB sequelize exists:', !!db.sequelize);
    console.log('🔄 [CREATE ADMIN] Available models:', Object.keys(db).filter(key => key !== 'Sequelize' && key !== 'sequelize' && key !== 'initializeDatabase'));
    
    if (!db || !db.sequelize) {
      console.error('❌ [CREATE ADMIN] Database connection not available - db.sequelize is undefined');
      throw new Error('Database connection not available - db.sequelize is undefined');
    }
    
    // First, ensure database is synced
    try {
      console.log('🔄 [CREATE ADMIN] Testing database connection...');
      await db.sequelize.authenticate();
      console.log('✅ [CREATE ADMIN] Database authentication successful');
      
      console.log('🔄 [CREATE ADMIN] Starting database sync...');
      await db.sequelize.sync({ force: false, alter: true });
      console.log('✅ [CREATE ADMIN] Database sync completed');
    } catch (syncError) {
      console.error('🔥 [CREATE ADMIN] Database sync failed:', syncError);
      console.error('🔥 [CREATE ADMIN] Sync error message:', syncError.message);
      console.error('🔥 [CREATE ADMIN] Sync error stack:', syncError.stack);
      return res.status(500).json({ 
        success: false, 
        message: 'Database sync failed',
        error: syncError.message || 'Unknown sync error',
        timestamp: new Date().toISOString()
      });
    }

    console.log('🔄 [CREATE ADMIN] Checking for existing admin...');
    // Check if admin already exists
    const existing = await db.User.findOne({ where: { email: 'admin@dbx.com' } });
    if (existing) {
      console.log('⚠️  [CREATE ADMIN] Admin user already exists');
      return res.json({ 
        success: false, 
        message: 'Admin already exists',
        timestamp: new Date().toISOString()
      });
    }

    console.log('🔄 [CREATE ADMIN] Finding or creating admin role...');
    // Find or create admin role
    let adminRole = await db.Role.findOne({ where: { name: 'admin' } });
    if (!adminRole) {
      console.log('🔄 [Admin] Creating admin role...');
      adminRole = await db.Role.create({
        name: 'admin',
        description: 'Administrator role with full access',
        permissions: { all: true }
      });
      console.log('✅ [Admin] Admin role created');
    } else {
      console.log('✅ [Admin] Admin role found');
    }

    // Hash password
    console.log('🔄 [Admin] Hashing password...');
    const hashedPassword = await bcrypt.hash('dbxsupersecure', 10);
    
    // Create admin user
    console.log('🔄 [Admin] Creating admin user...');
    const newAdmin = await db.User.create({
      username: 'admin',
      email: 'admin@dbx.com',
      password: hashedPassword,
      first_name: 'Admin',
      last_name: 'User',
      role_id: adminRole.id,
      status: 'active',
      email_verified: true
    });

    console.log('✅ [Admin] Admin user created successfully');

    return res.json({ 
      success: true, 
      message: 'Default admin created successfully',
      admin: {
        id: newAdmin.id,
        email: newAdmin.email,
        username: newAdmin.username
      }
    });
  } catch (err) {
    console.error('❌ [Admin] Error creating admin:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Error creating admin',
      error: err.message,
      stack: err.stack
    });
  }
});

// COMPREHENSIVE DEBUG ENDPOINTS FOR PRODUCTION TROUBLESHOOTING

// 1. Environment Variables Debug
router.get('/debug/env', (req, res) => {
  try {
    console.log('🔍 [DEBUG ENV] Environment variables check started');
    
    const envCheck = {
      success: true,
      message: 'Environment variables check',
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV || 'undefined',
        JWT_SECRET: process.env.JWT_SECRET ? 'SET (length: ' + process.env.JWT_SECRET.length + ')' : 'NOT SET',
        DATABASE_URL: process.env.DATABASE_URL ? 'SET (length: ' + process.env.DATABASE_URL.length + ')' : 'NOT SET',
        XUMM_API_KEY: process.env.XUMM_API_KEY ? 'SET' : 'NOT SET',
        XUMM_API_SECRET: process.env.XUMM_API_SECRET ? 'SET' : 'NOT SET',
        XRPL_NETWORK: process.env.XRPL_NETWORK || 'undefined'
      },
      critical_missing: []
    };
    
    // Check for critical missing variables
    if (!process.env.JWT_SECRET) envCheck.critical_missing.push('JWT_SECRET');
    if (!process.env.DATABASE_URL) envCheck.critical_missing.push('DATABASE_URL');
    
    if (envCheck.critical_missing.length > 0) {
      envCheck.success = false;
      envCheck.message = 'Critical environment variables missing';
    }
    
    console.log('✅ [DEBUG ENV] Environment check completed:', envCheck);
    return res.json(envCheck);
  } catch (err) {
    console.error('❌ [DEBUG ENV] Environment check failed:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Environment check failed',
      error: err.message,
      stack: err.stack
    });
  }
});

// 2. Database Connection Test (Detailed)
router.get('/debug/database', async (req, res) => {
  try {
    console.log('🔍 [DEBUG DB] Database connection test started');
    
    const { Sequelize } = require('sequelize');
    
    if (!process.env.DATABASE_URL) {
      console.error('❌ [DEBUG DB] DATABASE_URL not found');
      return res.status(500).json({
        success: false,
        message: 'DATABASE_URL environment variable not set',
        timestamp: new Date().toISOString()
      });
    }
    
    console.log('🔄 [DEBUG DB] Creating Sequelize connection...');
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      logging: (msg) => console.log('📋 [DB LOG]', msg)
    });
    
    console.log('🔄 [DEBUG DB] Testing authentication...');
    await sequelize.authenticate();
    
    console.log('🔄 [DEBUG DB] Testing query...');
    const [results] = await sequelize.query('SELECT version() as version, current_database() as database');
    
    await sequelize.close();
    
    const response = {
      success: true,
      message: 'Database connection successful',
      timestamp: new Date().toISOString(),
      database_info: results[0],
      connection_test: 'PASSED'
    };
    
    console.log('✅ [DEBUG DB] Database test completed:', response);
    return res.json(response);
  } catch (err) {
    console.error('❌ [DEBUG DB] Database test failed:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Database connection failed',
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
  }
});

// 3. Models Loading Test
router.get('/debug/models', async (req, res) => {
  try {
    console.log('🔍 [DEBUG MODELS] Models loading test started');
    
    console.log('🔄 [DEBUG MODELS] Requiring models...');
    const db = require('../models');
    
    console.log('🔄 [DEBUG MODELS] Checking sequelize instance...');
    if (!db.sequelize) {
      throw new Error('Sequelize instance not found in models');
    }
    
    console.log('🔄 [DEBUG MODELS] Testing database authentication...');
    await db.sequelize.authenticate();
    
    console.log('🔄 [DEBUG MODELS] Checking available models...');
    const availableModels = Object.keys(db).filter(key => 
      key !== 'Sequelize' && 
      key !== 'sequelize' && 
      key !== 'initializeDatabase' &&
      typeof db[key] === 'object' &&
      db[key].name
    );
    
    console.log('🔄 [DEBUG MODELS] Testing specific models...');
    const modelTests = {};
    
    // Test User model
    if (db.User) {
      try {
        const userCount = await db.User.count();
        modelTests.User = { status: 'OK', count: userCount };
      } catch (err) {
        modelTests.User = { status: 'ERROR', error: err.message };
      }
    } else {
      modelTests.User = { status: 'NOT_FOUND' };
    }
    
    // Test CurrencyList model
    if (db.CurrencyList) {
      try {
        const currencyCount = await db.CurrencyList.count();
        modelTests.CurrencyList = { status: 'OK', count: currencyCount };
      } catch (err) {
        modelTests.CurrencyList = { status: 'ERROR', error: err.message };
      }
    } else {
      modelTests.CurrencyList = { status: 'NOT_FOUND' };
    }
    
    const response = {
      success: true,
      message: 'Models loading test completed',
      timestamp: new Date().toISOString(),
      available_models: availableModels,
      model_tests: modelTests,
      sequelize_connected: true
    };
    
    console.log('✅ [DEBUG MODELS] Models test completed:', response);
    return res.json(response);
  } catch (err) {
    console.error('❌ [DEBUG MODELS] Models test failed:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Models loading failed',
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
  }
});

// 4. Complete System Health Check
router.get('/debug/health', async (req, res) => {
  try {
    console.log('🔍 [DEBUG HEALTH] Complete system health check started');
    
    const healthCheck = {
      success: true,
      message: 'System health check',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {}
    };
    
    // Environment check
    try {
      healthCheck.checks.environment = {
        status: 'OK',
        jwt_secret: !!process.env.JWT_SECRET,
        database_url: !!process.env.DATABASE_URL,
        node_env: process.env.NODE_ENV
      };
    } catch (err) {
      healthCheck.checks.environment = { status: 'ERROR', error: err.message };
      healthCheck.success = false;
    }
    
    // Database check
    try {
      const db = require('../models');
      await db.sequelize.authenticate();
      healthCheck.checks.database = { status: 'OK', connected: true };
    } catch (err) {
      healthCheck.checks.database = { status: 'ERROR', error: err.message };
      healthCheck.success = false;
    }
    
    // Models check
    try {
      const db = require('../models');
      const modelCount = Object.keys(db).filter(key => 
        key !== 'Sequelize' && key !== 'sequelize' && key !== 'initializeDatabase'
      ).length;
      healthCheck.checks.models = { status: 'OK', count: modelCount };
    } catch (err) {
      healthCheck.checks.models = { status: 'ERROR', error: err.message };
      healthCheck.success = false;
    }
    
    if (!healthCheck.success) {
      healthCheck.message = 'System health check failed';
    }
    
    console.log('✅ [DEBUG HEALTH] Health check completed:', healthCheck);
    return res.json(healthCheck);
  } catch (err) {
    console.error('❌ [DEBUG HEALTH] Health check failed:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Health check failed',
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
  }
});

// Add a dummy handler for any undefined routes to prevent the "Route.get() requires a callback function" error
const dummyHandler = (req, res) => {
  res.status(404).json({ error: "Route not implemented" });
};

// Export the router
// SIMPLE: Test if admin routes are working at all
router.get('/user/ping', (req, res) => {
  try {
    console.log('🔄 [Ping] Simple ping test endpoint called');
    return res.json({ 
      success: true, 
      message: 'Admin routes are working!', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (err) {
    console.error('❌ [Ping] Even ping failed:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Ping failed',
      error: err.message 
    });
  }
});

// MANUAL: Create Admin User Directly
router.post('/user/createAdminManual', async (req, res) => {
  try {
    console.log('🔄 [Manual] Starting safe admin creation...');
    
    const createAdminSafe = require('../scripts/createAdminSafe');
    const result = await createAdminSafe();
    
    console.log('✅ [Manual] Safe admin creation completed:', result);
    return res.json(result);
  } catch (err) {
    console.error('❌ [Manual] Safe admin creation failed:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Safe admin creation failed',
      error: err.message
    });
  }
});

// Add error handler at the end (after all routes)
router.use((err, req, res, next) => {
  console.error('❌ [ADMIN ROUTE ERROR]', err);
  console.error('❌ [ADMIN ROUTE ERROR] Request URL:', req.url);
  console.error('❌ [ADMIN ROUTE ERROR] Request Method:', req.method);
  console.error('❌ [ADMIN ROUTE ERROR] Stack:', err.stack);
  
  res.status(500).json({ 
    success: false,
    error: 'Admin route error', 
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
