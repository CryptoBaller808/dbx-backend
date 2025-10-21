/**
 * API Admin Routes - Isolated CRUD System
 * Path: /api/admin/*
 * Purpose: Bypass ghost route conflicts with clean, isolated admin functionality
 * Created: 2025-07-26 - Ghost Slaying Implementation
 */

const express = require('express');
const router = express.Router();

console.log("🚀 [API-ADMIN] Loading apiAdminRoutes.js - GHOST BYPASS SYSTEM INITIALIZING...");

// ================================
// MOCK DATA - SHARED WITH EXISTING SYSTEM
// ================================

// Mock token data (shared with existing endpoints)
const mockTokens = [
  {
    id: 1,
    name: 'Bitcoin',
    symbol: 'BTC',
    network: 'Bitcoin',
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
    network: 'Ethereum',
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
    network: 'Ethereum',
    contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    logoUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Mock banner data (shared with existing endpoints)
const mockBanners = [
  {
    id: 1,
    title: 'Welcome to DBX Exchange',
    altText: 'DBX Exchange welcome banner',
    placement: 'exchange',
    image: '/images/banners/welcome-exchange.jpg',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 2,
    title: 'Trade with Confidence',
    altText: 'Secure trading banner',
    placement: 'trading',
    image: '/images/banners/secure-trading.jpg',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 3,
    title: 'Join the Future of Finance',
    altText: 'Future finance banner',
    placement: 'homepage',
    image: '/images/banners/future-finance.jpg',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

console.log("✅ [API-ADMIN] Mock data initialized - Tokens:", mockTokens.length, "Banners:", mockBanners.length);

// ================================
// TOKEN CRUD ENDPOINTS
// ================================

/**
 * @route GET /api/admin/token/list
 * @desc List all tokens with filtering options
 * @access Admin
 */
router.get('/token/list', (req, res) => {
  try {
    console.log('🔍 [API-ADMIN] GET /api/admin/token/list - Request received');
    
    const { network, active } = req.query;
    let filteredTokens = [...mockTokens];

    // Filter by network if provided
    if (network) {
      filteredTokens = filteredTokens.filter(token => 
        token.network.toLowerCase() === network.toLowerCase()
      );
      console.log(`🔍 [API-ADMIN] Filtered by network '${network}': ${filteredTokens.length} tokens`);
    }

    // Filter by active status if provided
    if (active !== undefined) {
      const isActive = active === 'true';
      filteredTokens = filteredTokens.filter(token => token.active === isActive);
      console.log(`🔍 [API-ADMIN] Filtered by active '${isActive}': ${filteredTokens.length} tokens`);
    }

    console.log(`✅ [API-ADMIN] Token list retrieved successfully: ${filteredTokens.length} tokens`);

    res.json({
      success: true,
      message: 'Tokens retrieved successfully',
      data: filteredTokens,
      total: filteredTokens.length,
      source: 'apiAdminRoutes.js',
      endpoint: 'GET /api/admin/token/list',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [API-ADMIN] Token list error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      source: 'apiAdminRoutes.js'
    });
  }
});

/**
 * @route POST /api/admin/token/create
 * @desc Create a new token
 * @access Admin
 */
router.post('/token/create', (req, res) => {
  try {
    console.log('🔍 [API-ADMIN] POST /api/admin/token/create - Request received:', req.body);
    
    // Validation
    if (!req.body.name || !req.body.symbol || !req.body.network) {
      console.log('❌ [API-ADMIN] Token create validation failed - Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: ['Token name, symbol, and network are required'],
        source: 'apiAdminRoutes.js'
      });
    }
    
    // Check for duplicate symbol
    const existingToken = mockTokens.find(token => 
      token.symbol.toLowerCase() === req.body.symbol.toLowerCase()
    );
    
    if (existingToken) {
      console.log(`❌ [API-ADMIN] Token create failed - Symbol '${req.body.symbol}' already exists`);
      return res.status(409).json({
        success: false,
        error: 'Token symbol already exists',
        source: 'apiAdminRoutes.js'
      });
    }
    
    // Create new token
    const newToken = {
      id: Math.max(...mockTokens.map(t => t.id)) + 1,
      name: req.body.name.trim(),
      symbol: req.body.symbol.trim().toUpperCase(),
      network: req.body.network.trim(),
      contract: req.body.contract || null,
      logoUrl: req.body.logoUrl || `https://cryptologos.cc/logos/${req.body.symbol.toLowerCase()}-logo.png`,
      active: req.body.active !== undefined ? req.body.active : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    mockTokens.push(newToken);
    
    console.log('✅ [API-ADMIN] Token created successfully:', newToken);
    
    res.status(201).json({
      success: true,
      message: 'Token created successfully',
      data: newToken,
      source: 'apiAdminRoutes.js',
      endpoint: 'POST /api/admin/token/create',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [API-ADMIN] Token create error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      source: 'apiAdminRoutes.js'
    });
  }
});

/**
 * @route PUT /api/admin/token/update/:id
 * @desc Update an existing token
 * @access Admin
 */
router.put('/token/update/:id', (req, res) => {
  try {
    const tokenId = parseInt(req.params.id);
    console.log(`🔍 [API-ADMIN] PUT /api/admin/token/update/${tokenId} - Request received:`, req.body);
    
    const tokenIndex = mockTokens.findIndex(token => token.id === tokenId);
    if (tokenIndex === -1) {
      console.log(`❌ [API-ADMIN] Token update failed - Token ID ${tokenId} not found`);
      return res.status(404).json({
        success: false,
        error: 'Token not found',
        source: 'apiAdminRoutes.js'
      });
    }
    
    // Validation
    if (!req.body.name || !req.body.symbol || !req.body.network) {
      console.log('❌ [API-ADMIN] Token update validation failed - Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: ['Token name, symbol, and network are required'],
        source: 'apiAdminRoutes.js'
      });
    }
    
    // Check for duplicate symbol (excluding current token)
    const existingToken = mockTokens.find(token => 
      token.symbol.toLowerCase() === req.body.symbol.toLowerCase() && token.id !== tokenId
    );
    
    if (existingToken) {
      console.log(`❌ [API-ADMIN] Token update failed - Symbol '${req.body.symbol}' already exists`);
      return res.status(409).json({
        success: false,
        error: 'Token symbol already exists',
        source: 'apiAdminRoutes.js'
      });
    }
    
    // Update token
    const originalToken = { ...mockTokens[tokenIndex] };
    mockTokens[tokenIndex] = {
      ...mockTokens[tokenIndex],
      name: req.body.name.trim(),
      symbol: req.body.symbol.trim().toUpperCase(),
      network: req.body.network.trim(),
      contract: req.body.contract !== undefined ? req.body.contract : mockTokens[tokenIndex].contract,
      logoUrl: req.body.logoUrl || mockTokens[tokenIndex].logoUrl,
      active: req.body.active !== undefined ? req.body.active : mockTokens[tokenIndex].active,
      updatedAt: new Date().toISOString()
    };
    
    console.log('✅ [API-ADMIN] Token updated successfully:', mockTokens[tokenIndex]);
    
    res.json({
      success: true,
      message: 'Token updated successfully',
      data: mockTokens[tokenIndex],
      source: 'apiAdminRoutes.js',
      endpoint: `PUT /api/admin/token/update/${tokenId}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [API-ADMIN] Token update error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      source: 'apiAdminRoutes.js'
    });
  }
});

/**
 * @route DELETE /api/admin/token/delete/:id
 * @desc Delete a token (soft delete by setting active to false)
 * @access Admin
 */
router.delete('/token/delete/:id', (req, res) => {
  try {
    const tokenId = parseInt(req.params.id);
    console.log(`🔍 [API-ADMIN] DELETE /api/admin/token/delete/${tokenId} - Request received`);
    
    const tokenIndex = mockTokens.findIndex(token => token.id === tokenId);
    if (tokenIndex === -1) {
      console.log(`❌ [API-ADMIN] Token delete failed - Token ID ${tokenId} not found`);
      return res.status(404).json({
        success: false,
        error: 'Token not found',
        source: 'apiAdminRoutes.js'
      });
    }
    
    // Soft delete by setting active to false
    mockTokens[tokenIndex].active = false;
    mockTokens[tokenIndex].updatedAt = new Date().toISOString();
    
    console.log('✅ [API-ADMIN] Token deleted successfully (soft delete):', mockTokens[tokenIndex]);
    
    res.json({
      success: true,
      message: 'Token deleted successfully',
      data: mockTokens[tokenIndex],
      source: 'apiAdminRoutes.js',
      endpoint: `DELETE /api/admin/token/delete/${tokenId}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [API-ADMIN] Token delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      source: 'apiAdminRoutes.js'
    });
  }
});

// ================================
// BANNER CRUD ENDPOINTS
// ================================

/**
 * @route GET /api/admin/banner/list
 * @desc List all banners with filtering options
 * @access Admin
 */
router.get('/banner/list', (req, res) => {
  try {
    console.log('🔍 [API-ADMIN] GET /api/admin/banner/list - Request received');
    
    const { placement, active } = req.query;
    let filteredBanners = [...mockBanners];

    // Filter by placement if provided
    if (placement) {
      filteredBanners = filteredBanners.filter(banner => 
        banner.placement.toLowerCase() === placement.toLowerCase()
      );
      console.log(`🔍 [API-ADMIN] Filtered by placement '${placement}': ${filteredBanners.length} banners`);
    }

    // Filter by active status if provided
    if (active !== undefined) {
      const isActive = active === 'true';
      filteredBanners = filteredBanners.filter(banner => banner.active === isActive);
      console.log(`🔍 [API-ADMIN] Filtered by active '${isActive}': ${filteredBanners.length} banners`);
    }

    console.log(`✅ [API-ADMIN] Banner list retrieved successfully: ${filteredBanners.length} banners`);

    res.json({
      success: true,
      message: 'Banners retrieved successfully',
      data: filteredBanners,
      total: filteredBanners.length,
      source: 'apiAdminRoutes.js',
      endpoint: 'GET /api/admin/banner/list',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [API-ADMIN] Banner list error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      source: 'apiAdminRoutes.js'
    });
  }
});

/**
 * @route POST /api/admin/banner/create
 * @desc Create a new banner
 * @access Admin
 */
router.post('/banner/create', (req, res) => {
  try {
    console.log('🔍 [API-ADMIN] POST /api/admin/banner/create - Request received:', req.body);
    
    // Validation
    if (!req.body.title || !req.body.placement || !req.body.image) {
      console.log('❌ [API-ADMIN] Banner create validation failed - Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: ['Banner title, placement, and image are required'],
        source: 'apiAdminRoutes.js'
      });
    }
    
    // Create new banner
    const newBanner = {
      id: Math.max(...mockBanners.map(b => b.id)) + 1,
      title: req.body.title.trim(),
      altText: req.body.altText || req.body.title.trim(),
      placement: req.body.placement.trim().toLowerCase(),
      image: req.body.image.trim(),
      active: req.body.active !== undefined ? req.body.active : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    mockBanners.push(newBanner);
    
    console.log('✅ [API-ADMIN] Banner created successfully:', newBanner);
    
    res.status(201).json({
      success: true,
      message: 'Banner created successfully',
      data: newBanner,
      source: 'apiAdminRoutes.js',
      endpoint: 'POST /api/admin/banner/create',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [API-ADMIN] Banner create error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      source: 'apiAdminRoutes.js'
    });
  }
});

/**
 * @route PUT /api/admin/banner/update/:id
 * @desc Update an existing banner
 * @access Admin
 */
router.put('/banner/update/:id', (req, res) => {
  try {
    const bannerId = parseInt(req.params.id);
    console.log(`🔍 [API-ADMIN] PUT /api/admin/banner/update/${bannerId} - Request received:`, req.body);
    
    const bannerIndex = mockBanners.findIndex(banner => banner.id === bannerId);
    if (bannerIndex === -1) {
      console.log(`❌ [API-ADMIN] Banner update failed - Banner ID ${bannerId} not found`);
      return res.status(404).json({
        success: false,
        error: 'Banner not found',
        source: 'apiAdminRoutes.js'
      });
    }
    
    // Validation
    if (!req.body.title || !req.body.placement || !req.body.image) {
      console.log('❌ [API-ADMIN] Banner update validation failed - Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: ['Banner title, placement, and image are required'],
        source: 'apiAdminRoutes.js'
      });
    }
    
    // Update banner
    mockBanners[bannerIndex] = {
      ...mockBanners[bannerIndex],
      title: req.body.title.trim(),
      altText: req.body.altText || req.body.title.trim(),
      placement: req.body.placement.trim().toLowerCase(),
      image: req.body.image.trim(),
      active: req.body.active !== undefined ? req.body.active : mockBanners[bannerIndex].active,
      updatedAt: new Date().toISOString()
    };
    
    console.log('✅ [API-ADMIN] Banner updated successfully:', mockBanners[bannerIndex]);
    
    res.json({
      success: true,
      message: 'Banner updated successfully',
      data: mockBanners[bannerIndex],
      source: 'apiAdminRoutes.js',
      endpoint: `PUT /api/admin/banner/update/${bannerId}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [API-ADMIN] Banner update error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      source: 'apiAdminRoutes.js'
    });
  }
});

/**
 * @route DELETE /api/admin/banner/delete/:id
 * @desc Delete a banner (soft delete by setting active to false)
 * @access Admin
 */
router.delete('/banner/delete/:id', (req, res) => {
  try {
    const bannerId = parseInt(req.params.id);
    console.log(`🔍 [API-ADMIN] DELETE /api/admin/banner/delete/${bannerId} - Request received`);
    
    const bannerIndex = mockBanners.findIndex(banner => banner.id === bannerId);
    if (bannerIndex === -1) {
      console.log(`❌ [API-ADMIN] Banner delete failed - Banner ID ${bannerId} not found`);
      return res.status(404).json({
        success: false,
        error: 'Banner not found',
        source: 'apiAdminRoutes.js'
      });
    }
    
    // Soft delete by setting active to false
    mockBanners[bannerIndex].active = false;
    mockBanners[bannerIndex].updatedAt = new Date().toISOString();
    
    console.log('✅ [API-ADMIN] Banner deleted successfully (soft delete):', mockBanners[bannerIndex]);
    
    res.json({
      success: true,
      message: 'Banner deleted successfully',
      data: mockBanners[bannerIndex],
      source: 'apiAdminRoutes.js',
      endpoint: `DELETE /api/admin/banner/delete/${bannerId}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [API-ADMIN] Banner delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      source: 'apiAdminRoutes.js'
    });
  }
});

// ================================
// HEALTH CHECK ENDPOINT
// ================================

/**
 * @route GET /api/admin/health
 * @desc Health check for API admin system
 * @access Public
 */
router.get('/health', (req, res) => {
  console.log('🔍 [API-ADMIN] GET /api/admin/health - Health check requested');
  
  res.json({
    success: true,
    message: 'API Admin system is healthy',
    system: 'DBX Backend - API Admin Routes',
    version: '1.0.0',
    status: 'HEALTHY',
    endpoints: {
      tokens: {
        list: 'GET /api/admin/token/list',
        create: 'POST /api/admin/token/create',
        update: 'PUT /api/admin/token/update/:id',
        delete: 'DELETE /api/admin/token/delete/:id'
      },
      banners: {
        list: 'GET /api/admin/banner/list',
        create: 'POST /api/admin/banner/create',
        update: 'PUT /api/admin/banner/update/:id',
        delete: 'DELETE /api/admin/banner/delete/:id'
      }
    },
    data_status: {
      tokens: mockTokens.length,
      banners: mockBanners.length,
      active_tokens: mockTokens.filter(t => t.active).length,
      active_banners: mockBanners.filter(b => b.active).length
    },
    source: 'apiAdminRoutes.js',
    timestamp: new Date().toISOString()
  });
});

console.log("✅ [API-ADMIN] All routes defined successfully - GHOST BYPASS SYSTEM READY!");
console.log("🎯 [API-ADMIN] Available endpoints:");
console.log("🎯 [API-ADMIN] - GET    /api/admin/token/list");
console.log("🎯 [API-ADMIN] - POST   /api/admin/token/create");
console.log("🎯 [API-ADMIN] - PUT    /api/admin/token/update/:id");
console.log("🎯 [API-ADMIN] - DELETE /api/admin/token/delete/:id");
console.log("🎯 [API-ADMIN] - GET    /api/admin/banner/list");
console.log("🎯 [API-ADMIN] - POST   /api/admin/banner/create");
console.log("🎯 [API-ADMIN] - PUT    /api/admin/banner/update/:id");
console.log("🎯 [API-ADMIN] - DELETE /api/admin/banner/delete/:id");
console.log("🎯 [API-ADMIN] - GET    /api/admin/health");

module.exports = router;

