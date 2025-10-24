/**
 * Token Routes
 * Admin token management endpoints
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const tokenController = require('../controllers/tokenController');

// Multer configuration for logo uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG, JPEG, WebP, and SVG are allowed.'));
    }
  },
});

// Admin authentication middleware (checks X-Admin-Key header)
const adminAuth = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'] || req.headers['X-Admin-Key'];
  const expectedKey = process.env.ADMIN_KEY;

  if (!expectedKey) {
    console.error('[Token Routes] ADMIN_KEY not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!adminKey || adminKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing X-Admin-Key' });
  }

  next();
};

// Public endpoints (no authentication required)
router.get('/tokens', tokenController.getTokens);
router.get('/pairs', tokenController.getPairs);

// Admin endpoints (require X-Admin-Key header)
router.post('/token', adminAuth, tokenController.createToken);
router.put('/token/:id', adminAuth, tokenController.updateToken);
router.delete('/token/:id', adminAuth, tokenController.deleteToken);
router.post('/token/:id/logo', adminAuth, upload.single('logo'), tokenController.uploadLogo);

module.exports = router;

