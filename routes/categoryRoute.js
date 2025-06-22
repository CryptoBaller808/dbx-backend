const express = require("express");
const router = express.Router();
const authMiddleware = require('../services/authMiddleware.js')
const userController = require('../controllers/userController.js')
const collectionController = require('../controllers/collectionController.js')


 /**
  * @swagger
  * tags:
  *   name: Category
  *   description: Category related apis
  */

/**
 * @swagger
 * /category/getCategories:
 *  get:
 *   summary: 
 *   tags: 
 *    - Category 
 *   responses:
 *    201:
 *     description: The list of all categories.
 *    500:
 *     description: Server side error.
 */


//get categories
router.get('/getCategories',userController.getCategories)

/**
 * @swagger
 * /category/getItemsByCategories:
 *  get:
 *   summary: 
 *   tags: 
 *    - Category 
 *   parameters:
 *    - name: id
 *      in: query
 *      description: Category Id.
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
 *    201:
 *     description: The list of all categories.
 *    500:
 *     description: Server side error.
 */


//get all items categories
router.get('/getItemsByCategories',collectionController.getItemsByCategories)

module.exports = router;