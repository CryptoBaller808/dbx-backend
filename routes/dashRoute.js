const express = require("express");
const router = express.Router();
const authMiddleware = require('../services/authMiddleware.js')
const saleController = require('../controllers/saleController.js')
const collectionController = require('../controllers/collectionController.js')

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
  *   name: Sales and Purchases
  *   description: Sales and Purchase related APIs
  */

 /**
  * @swagger
  * tags:
  *   name: User Dashboard
  *   description: User Dashboard related APIs for both WEB and MOBILE
  */
/**
 * @swagger
 * /userdashboard/incomingBidReq:
 *  get:
 *   summary: 
 *   tags: 
 *    - User Dashboard
 *   parameters:
 *    - name: user_id
 *      in: query
 *      description: User Id
 *      required: false
 *      type: integer
 *      format: int64 
 *   responses:
 *    200:
 *     description: Success
 *    400:
 *     description: Error.
 */

//post all items on sale
router.get('/incomingBidReq', saleController.incomingBidReq)
/**
 * @swagger
 * /userdashboard/rewardBid:
 *  post:
 *   summary: 
 *   tags: 
 *    - User Dashboard
 *   parameters:
 *    - name: user_id
 *      in: query
 *      description: Owner Id
 *      required: false
 *      type: integer
 *      format: int64 
 *    - name: item_id
 *      in: query
 *      description: item Id
 *      required: false
 *      type: integer
 *      format: int64 
 *    - name: bid_id
 *      in: query
 *      description: bid Id
 *      required: false
 *      type: integer
 *      format: int64 
 *   responses:
 *    200:
 *     description: Success
 *    400:
 *     description: Error.
 */

//post all items on sale
router.post('/rewardBid', saleController.rewardBid)
/**
 * @swagger
 * /userdashboard/getOutgoingBidsByUserId:
 *  get:
 *   summary: 
 *   tags: 
 *    - User Dashboard
 *   parameters:
 *    - name: user_id
 *      in: query
 *      description: User Id
 *      required: false
 *      type: integer
 *      format: int64 
 *   responses:
 *    200:
 *     description: Success
 *    400:
 *     description: Error.
 */

//post all items on sale
router.get('/getOutgoingBidsByUserId', saleController.getOutgoingBidsByUserId)


/**
 * @swagger
 * /userdashboard/getCollectionbyuserId/{id}:
 *  get:
 *   summary:
 *   tags: 
 *    - User Dashboard
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
router.get('/getCollectionbyuserId/:id',authMiddleware.authenticateToken,collectionController.getCollectionbyUserId)

module.exports = router;