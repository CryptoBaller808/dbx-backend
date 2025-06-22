const express = require("express");
const router = express.Router();
const authMiddleware = require('../services/authMiddleware.js')
const userController = require('../controllers/userController.js')
const saleController = require('../controllers/saleController.js')


//delete user
//router.post('/Profile/DeleteProfile',authMiddleware.authenticateToken,  userController.DeleteProfile)

//list all users
//router.get('/a/aAllUsers',authMiddleware.authenticateToken, userController.aAllUser)
//list all users
// router.get('/AllUsers', userController.AllUser)



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
  *   name: Profile Page
  *   description: User Profile Page related apis
  */

/**
 * @swagger
 * /profiles/getuserProfile/{id}:
 *  get:
 *   summary: Get User Profile details by user id.
 *   tags: 
 *    - Profile Page
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
router.get('/getuserProfile/:id', /* authMiddleware.authenticateToken, */userController.getuserProfile)

/**
 * @swagger
 * /profiles/wishlist:
 *  get:
 *   summary: Get User wishlist by user id.
 *   tags: 
 *    - Profile Page
 *   parameters:
 *    - name: id
 *      in: query
 *      description: ID of user. Use id 113
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
 *     description: Wishllist by user ID
 *    404:
 *     description: User does't exists.
 */

//get user profile by user id
router.get('/wishlist', /* authMiddleware.authenticateToken, */userController.wishlist)



/**
 * @swagger
 * /profiles/addWishlist:
 *  post:
 *   summary: Add item to User wishlist.
 *   tags: 
 *    - Profile Page
 *   requestBody: 
 *    description: Request is made with json body
 *    required: true
 *    content:
 *     application/json:
 *      schema:
 *       type: object
 *       properties:
 *        user_id:
 *         type: integer
 *        item_id:
 *         type: integer
 *   responses:
 *    201:
 *     description: Item added to wishlist
 *    400:
 *     description: Error in adding wishlist.
 */

//update users
router.post('/addWishlist',/* authMiddleware.authenticateToken, */userController.addWishlist)


/**
 * @swagger
 * /profiles/removeWishlist:
 *  post:
 *   summary: delete item to User wishlist.
 *   tags: 
 *    - Profile Page
 *   requestBody: 
 *    description: Request is made with json body
 *    required: true
 *    content:
 *     application/json:
 *      schema:
 *       type: object
 *       properties:
 *        user_id:
 *         type: integer
 *        item_id:
 *         type: integer
 *   responses:
 *    201:
 *     description: Item deleted to wishlist
 *    400:
 *     description: Error in deleting wishlist.
 */

//update users
router.post('/removeWishlist',/* authMiddleware.authenticateToken, */userController.removeWishlist)

/**
 * @swagger
 * /profiles/updateUser:
 *  post:
 *   summary: Update User profile.
 *   tags: 
 *    - Profile Page
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
router.post('/updateUser',/* authMiddleware.authenticateToken, */userController.uploadImg,userController.updateUser)



/**
 * @swagger
 * /profiles/uploadProfilePicture:
 *  post:
 *   summary: Update User Profile Pics Only
 *   tags: 
 *    - Profile Page
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
 *        profile_image:
 *         type: string
 *         format: binary
 *        cover_image:
 *         type: string
 *         format: binary
 *   responses:
 *    200:
 *     description: Updated Successfully
 *    500:
 *     description: There was an error while uploading the image.
 */

//update user profile picture
router.post('/uploadProfilePicture',/* authMiddleware.authenticateToken, */userController.uploadImg,userController.uploadProfilePicture)



// Sales and Purchases
/**
 * @swagger
 * /profiles/getAllItemsOnSaleByUserId:
 *  get:
 *   summary: Get All Items on Sale By User ID.
 *   tags: 
 *    - Profile Page
 *   parameters:
 *    - name: id
 *      in: query
 *      description: ID of user. Use id 113
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
router.get('/getAllItemsOnSaleByUserId', saleController.getAllItemsOnSaleByUserId)

// Sales and Purchases
/**
 * @swagger
 * /profiles/getCollectedItemsByUserIdAndCategoryId:
 *  get:
 *   summary: Get All Items Collected By User ID And Category ID.
 *   tags: 
 *    - Profile Page
 *   parameters:
 *    - name: user_id
 *      in: query
 *      description: ID of user. Use id 113
 *      required: true
 *      type: integer
 *      format: int64
 *    - name: cat_id
 *      in: query
 *      description: ID of Category. Use between id 0-7
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
router.get('/getCollectedItemsByUserIdAndCategoryId', saleController.getCollectedItemsByUserIdAndCategoryId)

// Sales and Purchases
/**
 * @swagger
 * /profiles/getCollectedItemsByUserId:
 *  get:
 *   summary: Get All Items Collected By User ID.
 *   tags: 
 *    - Profile Page
 *   parameters:
 *    - name: id
 *      in: query
 *      description: ID of user. Use id 113
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
router.get('/getCollectedItemsByUserId', saleController.getCollectedItemsByUserId)
// Sales and Purchases
/**
 * @swagger
 * /profiles/getCreatedItemsByUserId:
 *  get:
 *   summary: Get All Items Created By UserID.
 *   tags: 
 *    - Profile Page
 *   parameters:
 *    - name: id
 *      in: query
 *      description: ID of user. Use id 113
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
router.get('/getCreatedItemsByUserId', saleController.getCreatedItemsByUserId)

// Sales and Purchases
/**
 * @swagger
 * /profiles/getCreatedItemsByUserIdAndCategoryId:
 *  get:
 *   summary: Get All Items Created By User and Category.
 *   tags: 
 *    - Profile Page
 *   parameters:
 *    - name: user_id
 *      in: query
 *      description: ID of user. Use id 113
 *      required: true
 *      type: integer
 *      format: int64
 *    - name: cat_id
 *      in: query
 *      description: ID of Category. Use id between 0-7.
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
router.get('/getCreatedItemsByUserIdAndCategoryId', saleController.getCreatedItemsByUserIdAndCategoryId)
// Sales and Purchases
/**
 * @swagger
 * /profiles/getActivityByUserId:
 *  get:
 *   summary: Get Favorite Items By User ID.
 *   tags: 
 *    - Profile Page
 *   parameters:
 *    - name: id
 *      in: query
 *      description: ID of user. Use id 113
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
router.get('/getActivityByUserId', saleController.getActivityByUserId)
// Sales and Purchases
/**
 * @swagger
 * /profiles/getFavoriteItemsByUserId:
 *  get:
 *   summary: Get Favorite Items By User ID.
 *   tags: 
 *    - Profile Page
 *   parameters:
 *    - name: id
 *      in: query
 *      description: ID of user. Use id 113
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
router.get('/getFavoriteItemsByUserId', saleController.getFavoriteItemsByUserId)

// Sales and Purchases
/**
 * @swagger
 * /profiles/getItemsOnSaleByUserIdAndCategoryId:
 *  post:
 *   summary: Get All Items on Sale By User ID and Category ID.
 *   tags: 
 *    - Profile Page
 *   parameters:
 *    - name: user_id
 *      in: query
 *      description: ID of user. Use id 113
 *      required: true
 *      type: integer
 *      format: int64
 *    - name: category_id
 *      in: query
 *      description: ID of category. Use id 0-7.
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
router.post('/getItemsOnSaleByUserIdAndCategoryId', saleController.getItemsOnSaleByUserIdAndCategoryId)

// Sales and Purchases
/**
 * @swagger
 * /profiles/searchForUserId:
 *  post:
 *   summary: Search Items and Collections for a specific User.
 *   tags: 
 *    - Profile Page
 *   requestBody: 
 *    description: Send user id and search string.
 *    required: true
 *    content:
 *     application/json:
 *      schema:
 *       type: object
 *       properties:
 *        user_id:
 *         type: integer
 *        search_string:
 *         type: string
 *   responses:
 *    200:
 *     description: Success
 *    400:
 *     description: Error.
 */

//get all items on sale
router.post('/searchForUserId', saleController.searchForUserId)

module.exports = router;