const express = require("express");
const router = express.Router();
const authMiddleware = require('../services/authMiddleware.js');
const mintNFTController = require('../controllers/mintNFTController.js');
const { 
  validateNFTOperation, 
  handleValidationErrors,
  validateRateLimit 
} = require("../middleware/expressValidation");
const { 
  createValidationMiddleware 
} = require("../middleware/validationMiddleware");


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
  *   name: Items
  *   description: NFT related APIs
  */


/**
 * @swagger
 * /mint/mintNFT:
 *  post:
 *   summary: Create Single NFT. 
 *   tags: 
 *    - Items 
 *   requestBody: 
 *    description: Request is made with json body
 *    required: true
 *    content:
 *     multipart/form-data:
 *      schema:
 *       type: object
 *       properties:
 *        collection_id:
 *         type: integer
 *        user_id:
 *         type: integer
 *        nft_property:
 *         type: object
 *         example: {"property_one":"value one","property_two":"value two"}
 *        nftimage:
 *         type: string
 *         format: binary
 *        is_unlockable_content:
 *         type: boolean
 *        unlockable_content:
 *         type: string
 *        is_explicit_content:
 *         type: boolean
 *        explicit_content:
 *         type: string
 *        title:
 *         type: string
 *        description:
 *         type: string
 *        external_link:
 *         type: string
 *   responses:
 *    200:
 *     description: Minted
 *    400:
 *     description: Error in minting process.
 */

//mint NFT with validation
router.post('/mintNFT', 
  validateRateLimit,
  validateNFTOperation, 
  handleValidationErrors, 
  mintNFTController.nftImg, 
  mintNFTController.mintNFT
);
/**
 * @swagger
 * /mint/getNftByUserId/{id}:
 *  get:
 *   summary: Get NFTs by User Id.
 *   tags: 
 *    - Items
 *   parameters:
 *    - name: id
 *      in: path
 *      description: Use id 113
 *      required: true
 *      type: integer
 *      format: int64
 *   responses:
 *    201:
 *     description: Get NFT by User Id.
 *    404:
 *     description: NFT with this Id doesn't exists.
 *    500:
 *     description: Server side error please try again or check your IDs.
 */

//get collection by ID
router.get('/getNftByUserId/:id',mintNFTController.getNftByUserId)
/**
 * @swagger
 * /mint/getNftById/{id}:
 *  get:
 *   summary: Get details about a specific NFT.
 *   tags: 
 *    - Items
 *   parameters:
 *    - name: id
 *      in: path
 *      description: Use id 4
 *      required: true
 *      type: integer
 *      format: int64
 *   responses:
 *    201:
 *     description: Get NFT by User Id.
 *    404:
 *     description: NFT with this Id doesn't exists.
 *    500:
 *     description: Server side error please try again or check your IDs.
 */

//get collection by ID
router.get('/getNftById/:id',mintNFTController.getNftById)
/**
 * @swagger
 * /mint/getAllItems:
 *  get:
 *   summary: Get All NFTs even if they are not on sale.
 *   tags: 
 *    - Items
 *   responses:
 *    201:
 *     description: Get all NFTs.
 *    404:
 *     description: error
 *    500:
 *     description: Server error
 */

//get collection by ID
router.get('/getAllItems',mintNFTController.getAllItems)
module.exports = router;