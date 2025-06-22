const express = require("express");
const router = express.Router();
const authMiddleware = require('../services/authMiddleware.js')
const saleController = require('../controllers/saleController.js')


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
  *   name: Landing and Explore Page
  *   description: Website Landing and Explore Page related APIs
  */

 /**
  * @swagger
  * tags:
  *   name: User Dashboard
  *   description: Bids related APIs
  */


/**
 * @swagger
 * /sale/sell/sellNFT:
 *  post:
 *   summary: Sell an Nft to someone or put on marketplace.
 *   tags: 
 *    - Sales and Purchases 
 *   requestBody: 
 *    description: Request is made with json body
 *    required: false
 *    content:
 *     application/json:
 *      schema:
 *       type: object
 *       properties:
 *        item_id:
 *         type: integer
 *         required: true
 *        user_id:
 *         type: integer
 *         required: true
 *        sale_type:
 *         type: integer
 *         required: true
 *         description: 1 for fix price, 2 for timed auction and 3 for unlimited auction.
 *        fix_price:
 *         type: number
 *        put_on_marketplace:
 *         type: boolean
 *         example: true 
 *        t_auction_start_date:
 *         type: string
 *         example: 2022-08-24 06:29:14 UTC 
 *        t_auction_end_date:
 *         type: string
 *         example: 2022-08-25 06:29:14 UTC 
 *        t_auction_minimum_bid:  
 *         type: number
 *        t_auction_reserve_price:
 *         type: number
 *   responses:
 *    200:
 *     description: Success
 *    400:
 *     description: Error.
 */

//    multipart/form-data: requires MULTER as middleware.
//mark on sale
router.post('/sell/sellNFT', saleController.sellNFT)

//Sales and Purchases
/**
 * @swagger
 * /sale/getHomePageNfts:
 *  get:
 *   summary: Home Page Nfts
 *   tags: 
 *    - Landing and Explore Page
 *   requestBody: 
 *    description: Request is made with json body. Sale Type 1 = Fixed price, 2 = Timed Auction and 3 = Unlimited Auction
 *   responses:
 *    200:
 *     description: Success.Sale Type 1 = Fixed price, 2 = Timed Auction and 3 = Unlimited Auction
 *    400:
 *     description: Error.
 */

//get all items on sale
router.get('/getHomePageNfts', saleController.getHomePageNfts)
/**
 * @swagger
 * /sale/getHotBids:
 *  get:
 *   summary: Hot Bids
 *   tags: 
 *    - Landing and Explore Page
 *   parameters:
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
 *     description: Success.Sale Type 1 = Fixed price, 2 = Timed Auction and 3 = Unlimited Auction
 *    400:
 *     description: Error.
 */

//get all items on sale
router.get('/getHotBids', saleController.getHotBids)

//Sales and Purchases
/**
 * @swagger
 * /sale/getAllitemsOnSale:
 *  get:
 *   summary: Explore Section
 *   tags: 
 *    - Landing and Explore Page
 *   parameters:
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
 *     description: Success.Sale Type 1 = Fixed price, 2 = Timed Auction and 3 = Unlimited Auction
 *    400:
 *     description: Error.
 */

//get all items on sale
router.get('/getAllitemsOnSale', saleController.getAllitemsOnSale)

//Sales and Purchases
/**
 * @swagger
 * /sale/getAuctionItemsOnSale:
 *  get:
 *   summary: Live Auction Timed NFTs.
 *   tags: 
 *    - Landing and Explore Page
 *   parameters:
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
 *     description: Success.Sale Type 1 = Fixed price, 2 = Timed Auction and 3 = Unlimited Auction
 *    400:
 *     description: Error.
 */

//get all items on sale
router.get('/getAuctionItemsOnSale', saleController.getAuctionItemsOnSale)

//Sales and Purchases
/**
 * @swagger
 * /sale/getUnlimitedAuctionItemsOnSale:
 *  get:
 *   summary: Live Auction Unlimited Timed NFTs.
 *   tags: 
 *    - Landing and Explore Page
 *   parameters:
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
 *     description: Success.Sale Type 1 = Fixed price, 2 = Timed Auction and 3 = Unlimited Auction
 *    400:
 *     description: Error.
 */

//get all items on sale
router.get('/getUnlimitedAuctionItemsOnSale', saleController.getUnlimitedAuctionItemsOnSale)
//Sales and Purchases
/**
 * @swagger
 * /sale/getFixedItemsOnSale:
 *  get:
 *   summary: Fixed prices NFTs on sale.
 *   tags: 
 *    - Landing and Explore Page
 *   parameters:
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
 *     description: Success.Sale Type 1 = Fixed price, 2 = Timed Auction and 3 = Unlimited Auction
 *    400:
 *     description: Error.
 */

//get all items on sale
router.get('/getFixedItemsOnSale', saleController.getFixedItemsOnSale)
//Sales and Purchases
/**
 * @swagger
 * /sale/search:
 *  post:
 *   summary: Search items for Collectin, Items or User.
 *   tags: 
 *    - Landing and Explore Page
 *   requestBody: 
 *    description: Request is made with json body
 *    required: true
 *    content:
 *     application/json:
 *      schema:
 *       type: object
 *       properties:
 *        string:
 *         type: string
 *   responses:
 *    200:
 *     description: Success
 *    400:
 *     description: Error.
 */

//get all items on sale
router.post('/search', saleController.search)

// Sales and Purchases
/**
 * @swagger
 * /sale/getBidById/{id}:
 *  get:
 *   summary: Get Specific Item on Sale.
 *   tags: 
 *    - Landing and Explore Page 
 *   parameters:
 *    - name: id
 *      in: path
 *      description: ID of item on sale. try 3.
 *      required: true
 *      type: integer
 *      format: int64
 *   responses:
 *    200:
 *     description: Success
 *    400:
 *     description: Error.
 */

//get all items on sale
router.get('/getBidById/:id', saleController.getBidById)

/**
 * @swagger
 * /sale/buyFixPriceItem:
 *    post:
 *   summary: Buy an item on sale with fixed price.
 *   tags: 
 *    - Sales and Purchases 
 *   requestBody: 
 *    description: Request is made with json body
 *    content:
 *     application/json:
 *      schema:
 *       type: object
 *       properties:
 *        item_id:
 *         type: integer
 *        user_id:
 *         type: integer
 *   responses:
 *    200:
 *     description: Success
 *    400:
 *     description: Error.
 */

//post all items on sale
router.post('/buyFixPriceItem', saleController.buyFixPriceItem)


// NFT Accept Offer for Ficed price 
router.post('/buyFixPriceNFTs', saleController.buyFixPriceNft)

/**
 * @swagger
 * /sale/buyFixPriceNFTs:
 *  post:
 *   summary: Buy or Bid on an item on sale.
 *   tags: 
 *    - Sales and Purchases 
 *   requestBody: 
 *    description: Request is made with json body
 *    content:
 *     application/json:
 *      schema:
 *       type: object
 *       properties:
 *        item_id:
 *         type: integer
 *        user_id:
 *         type: integer
 *       
 *   responses:
 *    200:
 *     description: Success
 *    400:
 *     description: Error.
 */




/**
 * @swagger
 * /sale/buyNFT:
 *  post:
 *   summary: Buy or Bid on an item on sale.
 *   tags: 
 *    - Sales and Purchases 
 *   requestBody: 
 *    description: Request is made with json body
 *    content:
 *     application/json:
 *      schema:
 *       type: object
 *       properties:
 *        item_id:
 *         type: integer
 *        user_id:
 *         type: integer
 *        sale_type:
 *         type: integer
 *        bid_price:
 *         type: string
 *        bid_expire:
 *         type: string
 *         example: 2023-03-25 06:29:14 UTC 
 *   responses:
 *    200:
 *     description: Success
 *    400:
 *     description: Error.
 */

//post all items on sale``
router.post('/buyNFT', saleController.bidOnNFT)


/**
 * @swagger
 * /sale/cc:
 *  post:
 *   summary: Buy or Bid on an item on sale.
 *   tags: 
 *    - Sales and Purchases 
 *   requestBody: 
 *    description: Request is made with json body
 *    content:
 *     application/json:
 *      schema:
 *       type: object
 *       properties:
 *        userid:
 *         type: string
 *         example: 233445
 *        email:
 *         type: string
 *         example: title@title.com
 *        webname:
 *         type: string
 *         example: website
 *        username:
 *         type: string
 *         example: noobbb
 *        tempid:
 *         type: integer 
 *         example: 29223
 *        key:
 *         type: string
 *         example: e061a4eda9014f08a8462a173bf265b0
 *   responses:
 *    200:
 *     description: Success
 *    400:
 *     description: Error.
 */

router.post('/cc',  saleController.convertcreator)
module.exports = router;