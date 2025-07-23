const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Banner, Token } = require('../models');
const { 
  adminLogin, 
  authenticateAdmin, 
  refreshToken, 
  getAdminProfile 
} = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allow images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// ==================== AUTHENTICATION ROUTES ====================

/**
 * @swagger
 * /admindashboard/auth/login:
 *   post:
 *     summary: Admin login
 *     tags: [Admin Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    const result = await adminLogin(username, password);
    
    if (result.success) {
      console.log(`✅ [Admin Auth] Login successful for ${username}`);
      return res.json(result);
    } else {
      console.log(`❌ [Admin Auth] Login failed for ${username}`);
      return res.status(401).json(result);
    }
  } catch (error) {
    console.error('❌ [Admin Auth] Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /admindashboard/auth/refresh:
 *   post:
 *     summary: Refresh admin token
 *     tags: [Admin Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Not authenticated
 */
router.post('/auth/refresh', authenticateAdmin, refreshToken);

/**
 * @swagger
 * /admindashboard/auth/profile:
 *   get:
 *     summary: Get admin profile
 *     tags: [Admin Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *       401:
 *         description: Not authenticated
 */
router.get('/auth/profile', authenticateAdmin, getAdminProfile);

/**
 * @swagger
 * /admindashboard/auth/logout:
 *   post:
 *     summary: Admin logout
 *     tags: [Admin Auth]
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/auth/logout', (req, res) => {
  // For JWT, logout is handled client-side by removing the token
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// ==================== BANNER MANAGEMENT ROUTES ====================

/**
 * @swagger
 * /admindashboard/banner/upload:
 *   post:
 *     summary: Upload a new banner
 *     tags: [Banner Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - placement
 *               - image
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               placement:
 *                 type: string
 *                 enum: [exchange, swap, nft]
 *               altText:
 *                 type: string
 *               link:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Banner uploaded successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not authenticated
 */
router.post('/banner/upload', authenticateAdmin, upload.single('image'), async (req, res) => {
  try {
    const { title, description, placement, altText, link } = req.body;
    
    if (!title || !placement || !req.file) {
      return res.status(400).json({
        success: false,
        message: 'Title, placement, and image are required'
      });
    }

    const bannerData = {
      title,
      description: description || '',
      placement,
      altText: altText || title,
      link: link || '',
      image: `/uploads/${req.file.filename}`,
      status: true,
      createdBy: req.admin.id
    };

    const banner = await Banner.create(bannerData);
    
    console.log(`✅ [Admin] Banner uploaded: ${title} for ${placement}`);
    
    res.json({
      success: true,
      message: 'Banner uploaded successfully',
      banner: banner
    });
  } catch (error) {
    console.error('❌ [Admin] Banner upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload banner'
    });
  }
});

/**
 * @swagger
 * /admindashboard/banner/get:
 *   get:
 *     summary: Get all banners
 *     tags: [Banner Management]
 *     parameters:
 *       - in: query
 *         name: placement
 *         schema:
 *           type: string
 *         description: Filter by placement
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Banners retrieved successfully
 */
router.get('/banner/get', async (req, res) => {
  try {
    const { placement, active } = req.query;
    
    let whereClause = {};
    if (placement) whereClause.placement = placement;
    if (active !== undefined) whereClause.status = active === 'true';

    const banners = await Banner.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });
    
    console.log(`✅ [Admin] Retrieved ${banners.length} banners`);
    
    res.json({
      success: true,
      banners: banners,
      count: banners.length
    });
  } catch (error) {
    console.error('❌ [Admin] Banner fetch error:', error);
    
    // Return fallback banners on error
    const fallbackBanners = [
      {
        id: 1,
        title: 'Welcome to DBX Exchange',
        description: 'Trade cryptocurrencies with confidence',
        image: '/images/banners/exchange-banner-1.jpg',
        placement: 'exchange',
        status: true,
        createdAt: new Date()
      },
      {
        id: 2,
        title: 'Swap Tokens Instantly',
        description: 'Fast and secure token swapping',
        image: '/images/banners/swap-banner-1.jpg',
        placement: 'swap',
        status: true,
        createdAt: new Date()
      },
      {
        id: 3,
        title: 'Discover NFTs',
        description: 'Explore unique digital collectibles',
        image: '/images/banners/nft-banner-1.jpg',
        placement: 'nft',
        status: true,
        createdAt: new Date()
      }
    ];
    
    res.json({
      success: true,
      banners: fallbackBanners,
      count: fallbackBanners.length,
      fallback: true
    });
  }
});

/**
 * @swagger
 * /admindashboard/banner/update/{id}:
 *   put:
 *     summary: Update a banner
 *     tags: [Banner Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Banner updated successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Banner not found
 */
router.put('/banner/update/:id', authenticateAdmin, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, placement, altText, link, status } = req.body;
    
    const banner = await Banner.findByPk(id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    const updateData = {
      title: title || banner.title,
      description: description || banner.description,
      placement: placement || banner.placement,
      altText: altText || banner.altText,
      link: link || banner.link,
      status: status !== undefined ? status : banner.status
    };

    if (req.file) {
      updateData.image = `/uploads/${req.file.filename}`;
    }

    await banner.update(updateData);
    
    console.log(`✅ [Admin] Banner updated: ${id}`);
    
    res.json({
      success: true,
      message: 'Banner updated successfully',
      banner: banner
    });
  } catch (error) {
    console.error('❌ [Admin] Banner update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update banner'
    });
  }
});

/**
 * @swagger
 * /admindashboard/banner/delete/{id}:
 *   delete:
 *     summary: Delete a banner
 *     tags: [Banner Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Banner deleted successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Banner not found
 */
router.delete('/banner/delete/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const banner = await Banner.findByPk(id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    await banner.destroy();
    
    console.log(`✅ [Admin] Banner deleted: ${id}`);
    
    res.json({
      success: true,
      message: 'Banner deleted successfully'
    });
  } catch (error) {
    console.error('❌ [Admin] Banner delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete banner'
    });
  }
});

// ==================== TOKEN MANAGEMENT ROUTES ====================

/**
 * @swagger
 * /admindashboard/token/upload:
 *   post:
 *     summary: Upload a new token
 *     tags: [Token Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - symbol
 *               - network
 *             properties:
 *               name:
 *                 type: string
 *               symbol:
 *                 type: string
 *               network:
 *                 type: string
 *               contractAddress:
 *                 type: string
 *               icon:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Token uploaded successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not authenticated
 */
router.post('/token/upload', authenticateAdmin, upload.single('icon'), async (req, res) => {
  try {
    const { name, symbol, network, contractAddress } = req.body;
    
    if (!name || !symbol || !network) {
      return res.status(400).json({
        success: false,
        message: 'Name, symbol, and network are required'
      });
    }

    const tokenData = {
      name,
      symbol: symbol.toUpperCase(),
      network,
      contractAddress: contractAddress || '',
      icon: req.file ? `/uploads/${req.file.filename}` : null,
      status: true,
      createdBy: req.admin.id
    };

    const token = await Token.create(tokenData);
    
    console.log(`✅ [Admin] Token uploaded: ${symbol} on ${network}`);
    
    res.json({
      success: true,
      message: 'Token uploaded successfully',
      token: token
    });
  } catch (error) {
    console.error('❌ [Admin] Token upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload token'
    });
  }
});

/**
 * @swagger
 * /admindashboard/token/get:
 *   get:
 *     summary: Get all tokens
 *     tags: [Token Management]
 *     parameters:
 *       - in: query
 *         name: network
 *         schema:
 *           type: string
 *         description: Filter by network
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Tokens retrieved successfully
 */
router.get('/token/get', async (req, res) => {
  try {
    const { network, active } = req.query;
    
    let whereClause = {};
    if (network) whereClause.network = network;
    if (active !== undefined) whereClause.status = active === 'true';

    const tokens = await Token.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });
    
    console.log(`✅ [Admin] Retrieved ${tokens.length} tokens`);
    
    res.json({
      success: true,
      tokens: tokens,
      count: tokens.length
    });
  } catch (error) {
    console.error('❌ [Admin] Token fetch error:', error);
    
    // Return fallback tokens on error
    const fallbackTokens = [
      {
        id: 1,
        name: 'Bitcoin',
        symbol: 'BTC',
        network: 'Bitcoin',
        contractAddress: '',
        icon: '/images/networks/bitcoin.png',
        status: true,
        createdAt: new Date()
      },
      {
        id: 2,
        name: 'Ethereum',
        symbol: 'ETH',
        network: 'Ethereum',
        contractAddress: '',
        icon: '/images/networks/ethereum.png',
        status: true,
        createdAt: new Date()
      },
      {
        id: 3,
        name: 'XRP',
        symbol: 'XRP',
        network: 'XRP Ledger',
        contractAddress: '',
        icon: '/images/networks/xrp.png',
        status: true,
        createdAt: new Date()
      }
    ];
    
    res.json({
      success: true,
      tokens: fallbackTokens,
      count: fallbackTokens.length,
      fallback: true
    });
  }
});

/**
 * @swagger
 * /admindashboard/token/update/{id}:
 *   put:
 *     summary: Update a token
 *     tags: [Token Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Token updated successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Token not found
 */
router.put('/token/update/:id', authenticateAdmin, upload.single('icon'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, symbol, network, contractAddress, status } = req.body;
    
    const token = await Token.findByPk(id);
    if (!token) {
      return res.status(404).json({
        success: false,
        message: 'Token not found'
      });
    }

    const updateData = {
      name: name || token.name,
      symbol: symbol ? symbol.toUpperCase() : token.symbol,
      network: network || token.network,
      contractAddress: contractAddress || token.contractAddress,
      status: status !== undefined ? status : token.status
    };

    if (req.file) {
      updateData.icon = `/uploads/${req.file.filename}`;
    }

    await token.update(updateData);
    
    console.log(`✅ [Admin] Token updated: ${id}`);
    
    res.json({
      success: true,
      message: 'Token updated successfully',
      token: token
    });
  } catch (error) {
    console.error('❌ [Admin] Token update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update token'
    });
  }
});

/**
 * @swagger
 * /admindashboard/token/delete/{id}:
 *   delete:
 *     summary: Delete a token
 *     tags: [Token Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Token deleted successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Token not found
 */
router.delete('/token/delete/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const token = await Token.findByPk(id);
    if (!token) {
      return res.status(404).json({
        success: false,
        message: 'Token not found'
      });
    }

    await token.destroy();
    
    console.log(`✅ [Admin] Token deleted: ${id}`);
    
    res.json({
      success: true,
      message: 'Token deleted successfully'
    });
  } catch (error) {
    console.error('❌ [Admin] Token delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete token'
    });
  }
});

module.exports = router;

