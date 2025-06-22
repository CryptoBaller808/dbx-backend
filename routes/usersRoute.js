const express = require("express");
const user = require("../models/userModel");
const { 
  validateUserRegistration, 
  validateUserLogin, 
  handleValidationErrors,
  validateRateLimit 
} = require("../middleware/expressValidation");
const { 
  createValidationMiddleware, 
  validateSensitiveOperation 
} = require("../middleware/validationMiddleware");

const router = express.Router();
// const { nanoid } = require("nanoid");
// Load the MySQL pool connection
const pool = require("../data/config");

const idLength = 8;

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - wallet_address
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the User
 *         wallet_address:
 *           type: string
 *           description: Wallet Address of user
 *         full_name:
 *           type: string
 *           description: name of the user
 *         email:
 *           type: string
 *           description: Wallet Address of user
 *         profile_url:
 *           type: string
 *           description: profile picture url of the user
 *         cover_url:
 *           type: string
 *           description: cover picture url of user
 *         is_deleted:
 *           type: boolean
 *           description:

 */

const userController = require("../controllers/userController.js");

//const itemController = require('../controllers/itemController.js')
const authMiddleware = require("../services/authMiddleware.js");

/**
 * @swagger
 * tags:
 *   name: Connect Wallet
 *   description: Connect wallet on our platform
 */

/**
 * @swagger
 * /users/Accounts/connectwallet:
 *  post:
 *   summary:
 *   tags:
 *    - Connect Wallet
 *   requestBody:
 *    description: Request made. Scan the code.
 *   responses:
 *    201:
 *     description: Provides xumm scanner and scanner verification id.
 *    400:
 *     description: Incorrect user details
 *    500:
 *     description: Issue at server side
 */

//add user with validation
router.post("/Accounts/connectwallet", 
  validateRateLimit,
  validateUserRegistration, 
  handleValidationErrors, 
  userController.addUser
);

router.post("/Accounts/xummWalletConnection", 
  validateRateLimit,
  validateUserLogin, 
  handleValidationErrors, 
  userController.xummWalletConnection
);


/**
 * @swagger
 * /users/Accounts/verifyWallet:
 *  post:
 *   summary:
 *   tags:
 *    - Connect Wallet
 *   requestBody:
 *    description: Send scanner verification id.
 *    required: true
 *    content:
 *     application/json:
 *      schema:
 *       type: object
 *       properties:
 *        wallet:
 *         type: string
 *        usertoken:
 *         type: string
 *   responses:
 *    201:
 *     description: Provides ID, Wallet Address and Access Token
 *    400:
 *     description: Incorrect user details
 *    500:
 *     description: Issue at server side
 */

//add user
router.post("/Accounts/verifyWallet", userController.verifyUser);

/**
 * @swagger
 * /users/Accounts/connectWalletMobile:
 *  post:
 *   summary:
 *   tags:
 *    - Connect Wallet
 *   requestBody:
 *    description: Send scanner verification id.
 *    required: true
 *    content:
 *     application/json:
 *      schema:
 *       type: object
 *       properties:
 *   responses:
 *    201:
 *     description: Provides ID, Wallet Address and Access Token
 *    400:
 *     description: Incorrect user details
 *    500:
 *     description: Issue at server side
 */

//add user
router.post(
  "/Accounts/connectWalletMobile",
  userController.connectWalletMobile
);



router.get('/Accounts/getAssetLists', userController.getAssetLists);






module.exports = router;
