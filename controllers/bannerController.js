const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// In-memory banner storage (replace with database in production)
let banners = [];

// File to persist banners data
const BANNERS_FILE = path.join(__dirname, '../data/banners.json');

// Load banners from file on startup
async function loadBanners() {
  try {
    const data = await fs.readFile(BANNERS_FILE, 'utf8');
    banners = JSON.parse(data);
    console.log(`✅ [Banner] Loaded ${banners.length} banners from storage`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('📁 [Banner] No existing banners file, starting fresh');
      banners = [];
    } else {
      console.error('❌ [Banner] Error loading banners:', error.message);
      banners = [];
    }
  }
}

// Save banners to file
async function saveBanners() {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(BANNERS_FILE);
    await fs.mkdir(dataDir, { recursive: true });
    
    await fs.writeFile(BANNERS_FILE, JSON.stringify(banners, null, 2));
    console.log(`💾 [Banner] Saved ${banners.length} banners to storage`);
  } catch (error) {
    console.error('❌ [Banner] Error saving banners:', error.message);
  }
}

// Initialize banners on module load
loadBanners();

// Admin authentication middleware
const requireAdminAuth = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  
  if (!adminKey) {
    return res.status(401).json({
      error: 'admin_auth_required',
      message: 'Admin authentication required. Provide x-admin-key header.'
    });
  }
  
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({
      error: 'admin_auth_invalid',
      message: 'Invalid admin key provided.'
    });
  }
  
  next();
};

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check MIME type
    const allowedMimes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${allowedMimes.join(', ')}`), false);
    }
  }
});

// Validate placement enum
const validatePlacement = (placement) => {
  const validPlacements = ['home', 'exchange', 'global-header'];
  return validPlacements.includes(placement);
};

/**
 * Upload banner endpoint
 * POST /admin/banner/upload
 */
exports.uploadBanner = [
  requireAdminAuth,
  upload.single('image'),
  async (req, res) => {
    try {
      const { title, placement, altText } = req.body;
      
      // Validate required fields
      if (!title || !placement) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Title and placement are required fields.'
        });
      }
      
      // Validate placement
      if (!validatePlacement(placement)) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Invalid placement. Must be one of: home, exchange, global-header'
        });
      }
      
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Image file is required.'
        });
      }
      
      console.log(`📤 [Banner] Uploading banner: ${title} (${placement})`);
      
      // Upload to Cloudinary
      const uploadResult = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            folder: 'dbx/banners',
            resource_type: 'image',
            transformation: [
              { quality: 'auto:good' },
              { fetch_format: 'auto' }
            ]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(req.file.buffer);
      });
      
      // Create banner record
      const banner = {
        id: uuidv4(),
        title: title.trim(),
        placement,
        altText: altText ? altText.trim() : '',
        url: uploadResult.secure_url,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        cloudinaryId: uploadResult.public_id,
        createdAt: Date.now()
      };
      
      // Add to banners array and save
      banners.unshift(banner); // Add to beginning (latest first)
      await saveBanners();
      
      console.log(`✅ [Banner] Banner uploaded successfully: ${banner.id}`);
      
      // Return banner data (excluding cloudinaryId for security)
      const { cloudinaryId, ...publicBanner } = banner;
      res.status(200).json(publicBanner);
      
    } catch (error) {
      console.error('❌ [Banner] Upload error:', error.message);
      
      if (error.message.includes('Invalid file type')) {
        return res.status(400).json({
          error: 'validation_error',
          message: error.message
        });
      }
      
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'validation_error',
          message: 'File size too large. Maximum size is 5MB.'
        });
      }
      
      res.status(500).json({
        error: 'upload_failed',
        message: 'Failed to upload banner. Please try again.'
      });
    }
  }
];

/**
 * Get banners endpoint
 * GET /admin/banners?placement=home
 */
exports.getBanners = [
  async (req, res) => {
    try {
      const { placement } = req.query;
      
      let filteredBanners = [...banners];
      
      // Filter by placement if specified
      if (placement) {
        if (!validatePlacement(placement)) {
          return res.status(400).json({
            error: 'validation_error',
            message: 'Invalid placement. Must be one of: home, exchange, global-header'
          });
        }
        filteredBanners = banners.filter(banner => banner.placement === placement);
      }
      
      // Remove cloudinaryId from response for security
      const publicBanners = filteredBanners.map(({ cloudinaryId, ...banner }) => banner);
      
      console.log(`📋 [Banner] Retrieved ${publicBanners.length} banners${placement ? ` for placement: ${placement}` : ''}`);
      
      res.status(200).json(publicBanners);
      
    } catch (error) {
      console.error('❌ [Banner] Get banners error:', error.message);
      res.status(500).json({
        error: 'fetch_failed',
        message: 'Failed to retrieve banners.'
      });
    }
  }
];

/**
 * Delete banner endpoint
 * DELETE /admin/banner/:id
 */
exports.deleteBanner = [
  requireAdminAuth,
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // Find banner
      const bannerIndex = banners.findIndex(banner => banner.id === id);
      if (bannerIndex === -1) {
        return res.status(404).json({
          error: 'banner_not_found',
          message: 'Banner not found.'
        });
      }
      
      const banner = banners[bannerIndex];
      console.log(`🗑️ [Banner] Deleting banner: ${banner.title} (${banner.id})`);
      
      // Delete from Cloudinary
      try {
        await cloudinary.uploader.destroy(banner.cloudinaryId);
        console.log(`✅ [Banner] Deleted from Cloudinary: ${banner.cloudinaryId}`);
      } catch (cloudinaryError) {
        console.warn(`⚠️ [Banner] Failed to delete from Cloudinary: ${cloudinaryError.message}`);
        // Continue with local deletion even if Cloudinary fails
      }
      
      // Remove from banners array
      banners.splice(bannerIndex, 1);
      await saveBanners();
      
      console.log(`✅ [Banner] Banner deleted successfully: ${id}`);
      
      res.status(200).json({
        success: true,
        message: 'Banner deleted successfully.'
      });
      
    } catch (error) {
      console.error('❌ [Banner] Delete error:', error.message);
      res.status(500).json({
        error: 'delete_failed',
        message: 'Failed to delete banner.'
      });
    }
  }
];

// Export middleware for use in routes
exports.requireAdminAuth = requireAdminAuth;
