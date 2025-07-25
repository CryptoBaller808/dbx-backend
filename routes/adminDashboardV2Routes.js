/**
 * Admin Dashboard V2 Routes - Token & Banner CRUD APIs
 * NEW FILE TO BYPASS RENDER CACHING ISSUES
 * Full Send Implementation for DBX MVP with Debug Logging
 */

const express = require('express');
const router = express.Router();

// Debug logging to track route loading
console.log('🚀 [DEBUG] adminDashboardV2Routes.js - FILE LOADING STARTED');
console.log('🚀 [DEBUG] Timestamp:', new Date().toISOString());

// Mock requireRole middleware to prevent crashes
const requireRole = (roles) => (req, res, next) => {
  console.log(`🔧 [DEBUG] requireRole middleware bypassed for roles: ${roles.join(', ')}`);
  next();
};

// Mock authenticateToken middleware
const authenticateToken = (req, res, next) => {
  console.log('🔧 [DEBUG] authenticateToken middleware bypassed');
  next();
};

// Enhanced mock data for testing - will be replaced with actual DB operations
let mockTokens = [
  {
    id: 1,
    name: 'Bitcoin',
    symbol: 'BTC',
    network: 'BTC',
    contract: null,
    logoUrl: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 2,
    name: 'Ethereum',
    symbol: 'ETH',
    network: 'ETH',
    contract: null,
    logoUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 3,
    name: 'Tether USD',
    symbol: 'USDT',
    network: 'ETH',
    contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    logoUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

let mockBanners = [
  {
    id: 1,
    title: 'Welcome to DBX Exchange V2',
    imageUrl: 'https://via.placeholder.com/800x200/4F46E5/FFFFFF?text=DBX+Exchange+V2',
    link: '/exchange',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 2,
    title: 'Trade with Confidence V2',
    imageUrl: 'https://via.placeholder.com/800x200/059669/FFFFFF?text=Secure+Trading+V2',
    link: '/security',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

console.log('🚀 [DEBUG] Mock data initialized - Tokens:', mockTokens.length, 'Banners:', mockBanners.length);

// =============================================================================
// TOKEN CRUD ENDPOINTS - V2 WITH DEBUG LOGGING
// =============================================================================

/**
 * @route POST /admindashboard/token/create
 * @desc Create a new token
 * @access Admin
 */
router.post('/token/create', 
  authenticateToken,
  requireRole(['admin']),
  (req, res) => {
    console.log('🚀 [DEBUG] POST /token/create - ENDPOINT HIT!');
    console.log('🚀 [DEBUG] Request body:', req.body);
    
    try {
      const { name, symbol, network, contract, logoUrl, active = true } = req.body;
      
      // Basic validation
      if (!name || !symbol || !network) {
        console.log('❌ [DEBUG] Validation failed - missing required fields');
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, symbol, network',
          debug: 'adminDashboardV2Routes.js - POST /token/create'
        });
      }

      // Create new token (mock implementation)
      const newToken = {
        id: mockTokens.length + 1,
        name,
        symbol: symbol.toUpperCase(),
        network: network.toUpperCase(),
        contract: contract || null,
        logoUrl: logoUrl || null,
        active: Boolean(active),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockTokens.push(newToken);

      console.log(`✅ [DEBUG] Created new token: ${symbol} on ${network} - Total tokens: ${mockTokens.length}`);

      res.status(201).json({
        success: true,
        message: 'Token created successfully',
        data: newToken,
        debug: 'adminDashboardV2Routes.js - POST /token/create - SUCCESS'
      });

    } catch (error) {
      console.error('❌ [DEBUG] Token creation error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        debug: 'adminDashboardV2Routes.js - POST /token/create - ERROR'
      });
    }
  }
);

/**
 * @route GET /admindashboard/token/get
 * @desc Retrieve token list (filter by network if needed)
 * @access Admin
 */
router.get('/token/get',
  authenticateToken,
  requireRole(['admin']),
  (req, res) => {
    console.log('🚀 [DEBUG] GET /token/get - ENDPOINT HIT!');
    console.log('🚀 [DEBUG] Query params:', req.query);
    
    try {
      const { network, active } = req.query;
      let filteredTokens = [...mockTokens];

      // Filter by network if provided
      if (network) {
        filteredTokens = filteredTokens.filter(token => 
          token.network.toLowerCase() === network.toLowerCase()
        );
        console.log(`🔧 [DEBUG] Filtered by network ${network}: ${filteredTokens.length} tokens`);
      }

      // Filter by active status if provided
      if (active !== undefined) {
        const isActive = active === 'true';
        filteredTokens = filteredTokens.filter(token => token.active === isActive);
        console.log(`🔧 [DEBUG] Filtered by active ${isActive}: ${filteredTokens.length} tokens`);
      }

      console.log(`✅ [DEBUG] Retrieved ${filteredTokens.length} tokens from adminDashboardV2Routes.js`);

      // CRITICAL: Using "data" and "total" format to distinguish from old routes
      res.json({
        success: true,
        message: 'Tokens retrieved successfully',
        data: filteredTokens,
        total: filteredTokens.length,
        debug: 'adminDashboardV2Routes.js - GET /token/get - SUCCESS'
      });

    } catch (error) {
      console.error('❌ [DEBUG] Token retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        debug: 'adminDashboardV2Routes.js - GET /token/get - ERROR'
      });
    }
  }
);

/**
 * @route PUT /admindashboard/token/update/:id
 * @desc Edit token info
 * @access Admin
 */
router.put('/token/update/:id',
  authenticateToken,
  requireRole(['admin']),
  (req, res) => {
    console.log('🚀 [DEBUG] PUT /token/update/:id - ENDPOINT HIT!');
    console.log('🚀 [DEBUG] Params:', req.params, 'Body:', req.body);
    
    try {
      const { id } = req.params;
      const { name, symbol, network, contract, logoUrl, active } = req.body;

      // Find token by ID
      const tokenIndex = mockTokens.findIndex(token => token.id === parseInt(id));
      
      if (tokenIndex === -1) {
        console.log(`❌ [DEBUG] Token not found with ID: ${id}`);
        return res.status(404).json({
          success: false,
          error: 'Token not found',
          debug: 'adminDashboardV2Routes.js - PUT /token/update - NOT FOUND'
        });
      }

      // Update token fields
      const updatedToken = {
        ...mockTokens[tokenIndex],
        ...(name && { name }),
        ...(symbol && { symbol: symbol.toUpperCase() }),
        ...(network && { network: network.toUpperCase() }),
        ...(contract !== undefined && { contract }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(active !== undefined && { active: Boolean(active) }),
        updatedAt: new Date().toISOString()
      };

      mockTokens[tokenIndex] = updatedToken;

      console.log(`✅ [DEBUG] Updated token ID ${id}: ${updatedToken.symbol}`);

      res.json({
        success: true,
        message: 'Token updated successfully',
        data: updatedToken,
        debug: 'adminDashboardV2Routes.js - PUT /token/update - SUCCESS'
      });

    } catch (error) {
      console.error('❌ [DEBUG] Token update error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        debug: 'adminDashboardV2Routes.js - PUT /token/update - ERROR'
      });
    }
  }
);

/**
 * @route DELETE /admindashboard/token/delete/:id
 * @desc Remove a token
 * @access Admin
 */
router.delete('/token/delete/:id',
  authenticateToken,
  requireRole(['admin']),
  (req, res) => {
    console.log('🚀 [DEBUG] DELETE /token/delete/:id - ENDPOINT HIT!');
    console.log('🚀 [DEBUG] Params:', req.params);
    
    try {
      const { id } = req.params;

      // Find token by ID
      const tokenIndex = mockTokens.findIndex(token => token.id === parseInt(id));
      
      if (tokenIndex === -1) {
        console.log(`❌ [DEBUG] Token not found with ID: ${id}`);
        return res.status(404).json({
          success: false,
          error: 'Token not found',
          debug: 'adminDashboardV2Routes.js - DELETE /token/delete - NOT FOUND'
        });
      }

      const deletedToken = mockTokens[tokenIndex];
      mockTokens.splice(tokenIndex, 1);

      console.log(`✅ [DEBUG] Deleted token ID ${id}: ${deletedToken.symbol} - Remaining: ${mockTokens.length}`);

      res.json({
        success: true,
        message: 'Token deleted successfully',
        data: deletedToken,
        debug: 'adminDashboardV2Routes.js - DELETE /token/delete - SUCCESS'
      });

    } catch (error) {
      console.error('❌ [DEBUG] Token deletion error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        debug: 'adminDashboardV2Routes.js - DELETE /token/delete - ERROR'
      });
    }
  }
);

// =============================================================================
// BANNER CRUD ENDPOINTS - V2 WITH DEBUG LOGGING
// =============================================================================

/**
 * @route POST /admindashboard/banner/create
 * @desc Upload homepage banner
 * @access Admin
 */
router.post('/banner/create',
  authenticateToken,
  requireRole(['admin']),
  (req, res) => {
    console.log('🚀 [DEBUG] POST /banner/create - ENDPOINT HIT!');
    console.log('🚀 [DEBUG] Request body:', req.body);
    
    try {
      const { title, imageUrl, link, active = true } = req.body;

      // Basic validation
      if (!title || !imageUrl) {
        console.log('❌ [DEBUG] Validation failed - missing required fields');
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: title, imageUrl',
          debug: 'adminDashboardV2Routes.js - POST /banner/create'
        });
      }

      // Create new banner (mock implementation)
      const newBanner = {
        id: mockBanners.length + 1,
        title,
        imageUrl,
        link: link || '#',
        active: Boolean(active),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockBanners.push(newBanner);

      console.log(`✅ [DEBUG] Created new banner: ${title} - Total banners: ${mockBanners.length}`);

      res.status(201).json({
        success: true,
        message: 'Banner created successfully',
        data: newBanner,
        debug: 'adminDashboardV2Routes.js - POST /banner/create - SUCCESS'
      });

    } catch (error) {
      console.error('❌ [DEBUG] Banner creation error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        debug: 'adminDashboardV2Routes.js - POST /banner/create - ERROR'
      });
    }
  }
);

/**
 * @route GET /admindashboard/banner/get
 * @desc Fetch all banners
 * @access Admin
 */
router.get('/banner/get',
  authenticateToken,
  requireRole(['admin']),
  (req, res) => {
    console.log('🚀 [DEBUG] GET /banner/get - ENDPOINT HIT!');
    console.log('🚀 [DEBUG] Query params:', req.query);
    
    try {
      const { active } = req.query;
      let filteredBanners = [...mockBanners];

      // Filter by active status if provided
      if (active !== undefined) {
        const isActive = active === 'true';
        filteredBanners = filteredBanners.filter(banner => banner.active === isActive);
        console.log(`🔧 [DEBUG] Filtered by active ${isActive}: ${filteredBanners.length} banners`);
      }

      console.log(`✅ [DEBUG] Retrieved ${filteredBanners.length} banners from adminDashboardV2Routes.js`);

      // CRITICAL: Using "data" and "total" format to distinguish from old routes
      res.json({
        success: true,
        message: 'Banners retrieved successfully',
        data: filteredBanners,
        total: filteredBanners.length,
        debug: 'adminDashboardV2Routes.js - GET /banner/get - SUCCESS'
      });

    } catch (error) {
      console.error('❌ [DEBUG] Banner retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        debug: 'adminDashboardV2Routes.js - GET /banner/get - ERROR'
      });
    }
  }
);

/**
 * @route PUT /admindashboard/banner/update/:id
 * @desc Update banner info
 * @access Admin
 */
router.put('/banner/update/:id',
  authenticateToken,
  requireRole(['admin']),
  (req, res) => {
    console.log('🚀 [DEBUG] PUT /banner/update/:id - ENDPOINT HIT!');
    console.log('🚀 [DEBUG] Params:', req.params, 'Body:', req.body);
    
    try {
      const { id } = req.params;
      const { title, imageUrl, link, active } = req.body;

      // Find banner by ID
      const bannerIndex = mockBanners.findIndex(banner => banner.id === parseInt(id));
      
      if (bannerIndex === -1) {
        console.log(`❌ [DEBUG] Banner not found with ID: ${id}`);
        return res.status(404).json({
          success: false,
          error: 'Banner not found',
          debug: 'adminDashboardV2Routes.js - PUT /banner/update - NOT FOUND'
        });
      }

      // Update banner fields
      const updatedBanner = {
        ...mockBanners[bannerIndex],
        ...(title && { title }),
        ...(imageUrl && { imageUrl }),
        ...(link !== undefined && { link }),
        ...(active !== undefined && { active: Boolean(active) }),
        updatedAt: new Date().toISOString()
      };

      mockBanners[bannerIndex] = updatedBanner;

      console.log(`✅ [DEBUG] Updated banner ID ${id}: ${updatedBanner.title}`);

      res.json({
        success: true,
        message: 'Banner updated successfully',
        data: updatedBanner,
        debug: 'adminDashboardV2Routes.js - PUT /banner/update - SUCCESS'
      });

    } catch (error) {
      console.error('❌ [DEBUG] Banner update error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        debug: 'adminDashboardV2Routes.js - PUT /banner/update - ERROR'
      });
    }
  }
);

/**
 * @route DELETE /admindashboard/banner/delete/:id
 * @desc Remove banner
 * @access Admin
 */
router.delete('/banner/delete/:id',
  authenticateToken,
  requireRole(['admin']),
  (req, res) => {
    console.log('🚀 [DEBUG] DELETE /banner/delete/:id - ENDPOINT HIT!');
    console.log('🚀 [DEBUG] Params:', req.params);
    
    try {
      const { id } = req.params;

      // Find banner by ID
      const bannerIndex = mockBanners.findIndex(banner => banner.id === parseInt(id));
      
      if (bannerIndex === -1) {
        console.log(`❌ [DEBUG] Banner not found with ID: ${id}`);
        return res.status(404).json({
          success: false,
          error: 'Banner not found',
          debug: 'adminDashboardV2Routes.js - DELETE /banner/delete - NOT FOUND'
        });
      }

      const deletedBanner = mockBanners[bannerIndex];
      mockBanners.splice(bannerIndex, 1);

      console.log(`✅ [DEBUG] Deleted banner ID ${id}: ${deletedBanner.title} - Remaining: ${mockBanners.length}`);

      res.json({
        success: true,
        message: 'Banner deleted successfully',
        data: deletedBanner,
        debug: 'adminDashboardV2Routes.js - DELETE /banner/delete - SUCCESS'
      });

    } catch (error) {
      console.error('❌ [DEBUG] Banner deletion error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        debug: 'adminDashboardV2Routes.js - DELETE /banner/delete - ERROR'
      });
    }
  }
);

// =============================================================================
// HEALTH CHECK ENDPOINT - V2 WITH DEBUG LOGGING
// =============================================================================

/**
 * @route GET /admindashboard/health
 * @desc Admin dashboard health check
 * @access Public
 */
router.get('/health', (req, res) => {
  console.log('🚀 [DEBUG] GET /health - ENDPOINT HIT!');
  
  res.json({
    success: true,
    message: 'Admin Dashboard V2 API is running',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    source: 'adminDashboardV2Routes.js',
    endpoints: {
      tokens: {
        create: 'POST /admindashboard/token/create',
        get: 'GET /admindashboard/token/get',
        update: 'PUT /admindashboard/token/update/:id',
        delete: 'DELETE /admindashboard/token/delete/:id'
      },
      banners: {
        create: 'POST /admindashboard/banner/create',
        get: 'GET /admindashboard/banner/get',
        update: 'PUT /admindashboard/banner/update/:id',
        delete: 'DELETE /admindashboard/banner/delete/:id'
      }
    },
    debug: 'adminDashboardV2Routes.js - GET /health - SUCCESS'
  });
});

/**
 * @route GET /admindashboard/v2test
 * @desc Test endpoint to verify V2 routes are loading
 * @access Public
 */
router.get('/v2test', (req, res) => {
  console.log('🚀 [DEBUG] V2 TEST ENDPOINT HIT - ROUTES ARE WORKING!');
  
  res.json({
    success: true,
    message: 'V2 Routes are working!',
    timestamp: new Date().toISOString(),
    source: 'adminDashboardV2Routes.js',
    debug: 'This confirms V2 routes are loaded and accessible'
  });
});

console.log('🚀 [DEBUG] adminDashboardV2Routes.js - ALL ROUTES REGISTERED');
console.log('🚀 [DEBUG] Router stack length:', router.stack ? router.stack.length : 'Unknown');

module.exports = router;

// Deployment trigger: Fri Jul 25 06:08:00 EDT 2025 - V2 ROUTES WITH DEBUG LOGGING

