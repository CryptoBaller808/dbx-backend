
const express = require("express");
const router = express.Router();
const authMiddleware = require('../services/authMiddleware.js')
const itemController = require('../controllers/itemController.js')

//mint NFT
router.post('/mintNFT',authMiddleware.authenticateToken,itemController.mintNFT)

module.exports = router;