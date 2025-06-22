
const express = require("express");
const router = express.Router();
const authMiddleware = require('../services/authMiddleware.js')
const collectionController = require('../controllers/collectionController.js')



 /**
  * @swagger
  * tags:
  *   name: Create Collections
  *   description: Collection related apis on our platform
  */
 /**
  * @swagger
  * tags:
  *   name: User Dashboard
  *   description: Collection related apis on our platform
  */

/**
 * @swagger
 * /collection/createCollection:
 *  post:
 *   summary: Create a New Collection.
 *   tags: 
 *    - Create Collections
 *   requestBody: 
 *    content:
 *     multipart/form-data:
 *      schema:
 *       type: object
 *       properties:
 *        category_id:
 *         type: integer
 *         required: true
 *        name:
 *         type: string
 *         required: true
 *        user_id:
 *         type: integer
 *         required: true
 *        twitter_url:
 *         type: string
 *        insta_url:
 *         type: string
 *        discord_url:
 *         type: string
 *        fb_url:
 *         type: string
 *        collection_custom_url:
 *         type: string
 *        royalty:
 *         type: integer
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
router.post('/createCollection', /* authMiddleware.authenticateToken, */collectionController.uploadImg/* ,collectionController.uploadImg2 */,collectionController.createCollection)
// router.post('/createCollection', collectionController.uploadImg,collectionController.createCollection)

/**
 * @swagger
 * /collection/updateCollection:
 *  post:
 *   summary: Update an existing Collection.
 *   tags: 
 *    - Create Collections
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
 *        collection_custom_url:
 *         type: string
 *        royalty:
 *         type: integer
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
router.post('/updateCollection', /* authMiddleware.authenticateToken, */collectionController.uploadImg/* ,collectionController.uploadImg2 */,collectionController.updateCollection)


/**
 * @swagger
 * /collection/getCollections:
 *  get:
 *   summary: Get List of all Collections.
 *   tags: 
 *    - Create Collections
 *   responses:
 *    200:
 *     description: List of all collections
 *    500:
 *     description: There was an error in fetching collections.
 */

//get all collections
router.get('/getCollections',collectionController.getCollections)

/**
 * @swagger
 * /collection/getAllitemsByCollectionId:
 *  get:
 *   summary: Get All items of a specific Collection.
 *   tags: 
 *    - Create Collections
 *   parameters:
 *    - name: id
 *      in: query
 *      description: ID of collection id. Use id 8
 *      required: true
 *      type: integer
 *      format: int64
 *    - name: page_number
 *      in: query
 *      description: Page Number
 *      required: false
 *      type: integer
 *      format: int64
 *    - name: page_size
 *      in: query
 *      description: Page size.
 *      required: false
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
router.get('/getAllitemsByCollectionId',/* authMiddleware.authenticateToken, */collectionController.getAllItemsByCollectionId)


/** 
 * @swagger
* /collection/getCollectionbycId:
*  get:
*    summary: Get details about a specific Collection.
*    tags: 
*      - Create Collections
*    parameters:
*      - name: id
*        in: query
*        description: ID of the collection. Use ID 8.
*        schema:
*          type: integer
*          format: int64
*      - name: custom_url
*        in: query
*        description: Name of the collection. Use "xyz".
*        schema:
*          type: string
*      - name: page_number
*        in: query
*        description: Page Number.
*        required: false
*        schema:
*          type: integer
*          format: int64
*      - name: page_size
*        in: query
*        description: Page size.
*        required: false
*        schema:
*          type: integer
*          format: int64
*    responses:
*      200:
*        description: Successfully retrieved the collection details.
*      400:
*        description: Collection doesn't exist.
*      500:
*        description: Server-side error. Please try again or check your IDs.
*/
//get collection by ID
router.get('/getCollectionbycId',/* authMiddleware.authenticateToken, */collectionController.getCollectionbyId)

/**
 * @swagger
 * /collection/getCollectionbyUserId/{id}:
 *  get:
 *   summary: Get list of Collections of a specific User.
 *   tags: 
 *    - Create Collections
 *   parameters:
 *    - name: id
 *      in: path
 *      description: ID of User. Use id 113.
 *      required: true
 *      type: integer
 *      format: int64
 *   responses:
 *    201:
 *     description: Get collection by User Id.
 *    404:
 *     description: Collection with this Id doesn't exists.
 *    500:
 *     description: Server side error please try again or check your IDs.
 */

//get collection by ID
router.get('/getCollectionbyUserId/:id',/* authMiddleware.authenticateToken, */collectionController.getCollectionbyUserId)
/**
 * @swagger
 * /collection/getActivityByCollectionId:
 *  get:
 *   summary: Get Activity by collection ID.
 *   tags: 
 *    - Create Collections
 *   parameters:
 *    - name: id
 *      in: query
 *      description: Try collection id 8.
 *      required: true
 *      type: integer
 *      format: int64
 *    - name: page_number
 *      in: query
 *      description: Send Page number. Positive numbers only.
 *      required: false
 *      type: integer
 *      format: int64
 *    - name: page_size
 *      in: query
 *      description: Number of items that you want in one page. Positive numbers only.
 *      required: false
 *      type: integer
 *      format: int64
 *   responses:
 *    200:
 *     description: Success
 *    400:
 *     description: Error.
 */

//get all items on sale
router.get('/getActivityByCollectionId', collectionController.getActivityByCollectionId)

//get platfrom fee

router.get('/getplatformfee',/* authMiddleware.authenticateToken, */collectionController.platformfee)

/**
 * @swagger
 * /collection/getCollectionbycId:
 *  get:
 *   summary: Get details about Platform Fee.
 *   tags: 
 *    - Create Collections
 *   parameters:
 *   
 *   responses:
 *    200:
 *     description: Get Fee Percentage.
 *    404:
 *     description: Collection with this Id doesn't exists.
 *    500:
 *     description: Server side error please try again or check your IDs.
 */



/**
 * @swagger
 * /collection/checkCustomUrl/{customUrl}:
 *   get:
 *     summary: Check if Custom URL is available or not.
 *     tags:
 *       - Create Collections
 *     parameters:
 *       - in: path
 *         name: customUrl
 *         description: Custom URL to check availability
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Custom URL availability status.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 available:
 *                   type: boolean
 *                   description: Indicates if the custom URL is available or not.
 *       500:
 *         description: An error occurred on the server.
 */

router.get('/checkCustomUrl/:customUrl', collectionController.checkCollectionCustomUrl);



module.exports = router;