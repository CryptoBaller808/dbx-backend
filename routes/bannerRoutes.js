const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/bannerController');

// Banner routes (mounted at /admin, so these become /admin/banner/upload, /admin/banners, /admin/banner/:id)
router.post('/banner/upload', bannerController.uploadBanner);
router.get('/banners', bannerController.getBanners);
router.delete('/banner/:id', bannerController.deleteBanner);

module.exports = router;
