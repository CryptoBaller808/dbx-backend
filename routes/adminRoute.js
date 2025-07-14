const express = require("express");
const router = express.Router();
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
    console.log('🔄 [Test] Starting database test...');
    const db = require('../models');
    
    console.log('🔄 [Test] Testing database connection...');
    // Test database connection
    await db.sequelize.authenticate();
    console.log('✅ [Test] Database authentication successful');
    
    console.log('🔄 [Test] Checking available models...');
    const availableModels = Object.keys(db).filter(key => key !== 'Sequelize' && key !== 'sequelize' && key !== 'initializeDatabase');
    console.log('📋 [Test] Available models:', availableModels);
    
    return res.json({ 
      success: true, 
      message: 'Database connection successful',
      models: availableModels,
      user_model_exists: !!db.User,
      role_model_exists: !!db.Role
    });
  } catch (err) {
    console.error('❌ [Test] Test error:', err);
    console.error('🔧 [Test] Error message:', err.message);
    console.error('📋 [Test] Stack trace:', err.stack);
    return res.status(500).json({ 
      success: false, 
      message: 'Test failed',
      error: err.message,
      stack: err.stack
    });
  }
});

// TEMPORARY: Simple Database Connection Test
router.get('/user/testConnection', async (req, res) => {
  try {
    const { Sequelize } = require('sequelize');
    
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
    
    await sequelize.authenticate();
    
    return res.json({ 
      success: true, 
      message: 'Direct database connection successful',
      database_url_exists: !!process.env.DATABASE_URL,
      database_url_length: process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0
    });
  } catch (err) {
    console.error('Direct connection test error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Direct connection test failed',
      error: err.message,
      database_url_exists: !!process.env.DATABASE_URL
    });
  }
});

// TEMPORARY: Database Sync - Create Tables
router.post('/user/syncDatabase', async (req, res) => {
  try {
    const db = require('../models');
    
    console.log('🔄 [Database] Starting database synchronization...');
    
    // Sync database - this will create tables if they don't exist
    await db.sequelize.sync({ force: false, alter: true });
    
    console.log('✅ [Database] Database synchronization completed');
    
    return res.json({ 
      success: true, 
      message: 'Database synchronized successfully',
      tables_created: true
    });
  } catch (err) {
    console.error('❌ [Database] Sync error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Database sync failed',
      error: err.message 
    });
  }
});

// TEMPORARY: Create Default Admin
router.post('/user/createDefaultAdmin', async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const db = require('../models'); // Import db object

    console.log('🔄 [Admin] Starting admin creation process...');
    
    // First, ensure database is synced
    try {
      await db.sequelize.sync({ force: false, alter: true });
      console.log('✅ [Admin] Database sync completed');
    } catch (syncError) {
      console.error('❌ [Admin] Database sync failed:', syncError);
      return res.status(500).json({ 
        success: false, 
        message: 'Database sync failed',
        error: syncError.message 
      });
    }

    // Check if admin already exists
    const existing = await db.User.findOne({ where: { email: 'admin@dbx.com' } });
    if (existing) {
      console.log('⚠️  [Admin] Admin user already exists');
      return res.json({ success: false, message: 'Admin already exists' });
    }

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

module.exports = router;
