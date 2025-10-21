const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/bannerController');

// Banner routes
router.post('/upload', bannerController.uploadBanner);
router.get('/', bannerController.getBanners);
router.delete('/:id', bannerController.deleteBanner);

module.exports = router;
