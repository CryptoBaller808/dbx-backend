/**
 * Admin CRUD Routes - Bypass Implementation
 * Full CRUD functionality for tokens and banners with /admin-api/ path structure
 * Bypasses ghost route conflicts and provides immediate admin functionality
 */

const express = require('express');
const router = express.Router();

// Mock data for tokens and banners
let tokens = [
  {
    id: 1,
    name: "Bitcoin",
    symbol: "BTC",
    network: "Bitcoin",
    contractAddress: null,
    icon: "/images/networks/bitcoin.png",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    status: "active"
  },
  {
    id: 2,
    name: "Ethereum",
    symbol: "ETH",
    network: "Ethereum",
    contractAddress: null,
    icon: "/images/networks/ethereum.png",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    status: "active"
  },
  {
    id: 3,
    name: "BNB",
    symbol: "BNB",
    network: "BNB Smart Chain",
    contractAddress: null,
    icon: "/images/networks/bnb.png",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    status: "active"
  }
];

let banners = [
  {
    id: 1,
    title: "Welcome to DBX Exchange",
    altText: "DBX Exchange welcome banner",
    placement: "exchange",
    image: "/images/banners/welcome-exchange.jpg",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    status: "active"
  },
  {
    id: 2,
    title: "Trade with Confidence",
    altText: "DBX secure trading banner",
    placement: "trading",
    image: "/images/banners/secure-trading.jpg",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    status: "active"
  },
  {
    id: 3,
    title: "Multi-Chain Support",
    altText: "DBX multi-chain banner",
    placement: "features",
    image: "/images/banners/multi-chain.jpg",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    status: "active"
  }
];

// Auto-increment counters
let tokenIdCounter = 4;
let bannerIdCounter = 4;

// Utility functions
const validateTokenData = (data) => {
  const errors = [];
  
  if (!data.name || data.name.trim().length === 0) {
    errors.push('Token name is required');
  }
  if (!data.symbol || data.symbol.trim().length === 0) {
    errors.push('Token symbol is required');
  }
  if (!data.network || data.network.trim().length === 0) {
    errors.push('Network is required');
  }
  
  return errors;
};

const validateBannerData = (data) => {
  const errors = [];
  
  if (!data.title || data.title.trim().length === 0) {
    errors.push('Banner title is required');
  }
  if (!data.placement || data.placement.trim().length === 0) {
    errors.push('Banner placement is required');
  }
  
  return errors;
};

// ================================
// TOKEN CRUD ENDPOINTS
// ================================

/**
 * GET /admin-api/token/list
 * Retrieve all tokens
 */
router.get('/token/list', (req, res) => {
  try {
    console.log('🔍 [ADMIN-CRUD] Token list requested - adminCrudRoutes.js ACTIVE');
    
    const activeTokens = tokens.filter(token => token.status === 'active');
    
    res.json({
      success: true,
      message: 'BYPASS ROUTE: Tokens retrieved successfully from adminCrudRoutes.js',
      data: activeTokens,
      total: activeTokens.length,
      source: 'adminCrudRoutes.js',
      endpoint: 'GET /admin-api/token/list'
    });
    
  } catch (error) {
    console.error('❌ [ADMIN-CRUD] Token list error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      source: 'adminCrudRoutes.js'
    });
  }
});

/**
 * POST /admin-api/token/create
 * Create a new token
 */
router.post('/token/create', (req, res) => {
  try {
    console.log('🔍 [ADMIN-CRUD] Token create requested:', req.body);
    
    const validationErrors = validateTokenData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors,
        source: 'adminCrudRoutes.js'
      });
    }
    
    const newToken = {
      id: tokenIdCounter++,
      name: req.body.name.trim(),
      symbol: req.body.symbol.trim().toUpperCase(),
      network: req.body.network.trim(),
      contractAddress: req.body.contractAddress || null,
      icon: req.body.icon || `/images/networks/${req.body.symbol.toLowerCase()}.png`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active'
    };
    
    tokens.push(newToken);
    
    console.log('✅ [ADMIN-CRUD] Token created successfully:', newToken);
    
    res.status(201).json({
      success: true,
      message: 'Token created successfully',
      data: newToken,
      source: 'adminCrudRoutes.js',
      endpoint: 'POST /admin-api/token/create'
    });
    
  } catch (error) {
    console.error('❌ [ADMIN-CRUD] Token create error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      source: 'adminCrudRoutes.js'
    });
  }
});

/**
 * PUT /admin-api/token/update/:id
 * Update an existing token
 */
router.put('/token/update/:id', (req, res) => {
  try {
    const tokenId = parseInt(req.params.id);
    console.log(`🔍 [ADMIN-CRUD] Token update requested for ID: ${tokenId}`, req.body);
    
    const tokenIndex = tokens.findIndex(token => token.id === tokenId);
    if (tokenIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Token not found',
        source: 'adminCrudRoutes.js'
      });
    }
    
    const validationErrors = validateTokenData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors,
        source: 'adminCrudRoutes.js'
      });
    }
    
    // Update token data
    tokens[tokenIndex] = {
      ...tokens[tokenIndex],
      name: req.body.name.trim(),
      symbol: req.body.symbol.trim().toUpperCase(),
      network: req.body.network.trim(),
      contractAddress: req.body.contractAddress || null,
      icon: req.body.icon || tokens[tokenIndex].icon,
      updatedAt: new Date().toISOString()
    };
    
    console.log('✅ [ADMIN-CRUD] Token updated successfully:', tokens[tokenIndex]);
    
    res.json({
      success: true,
      message: 'Token updated successfully',
      data: tokens[tokenIndex],
      source: 'adminCrudRoutes.js',
      endpoint: `PUT /admin-api/token/update/${tokenId}`
    });
    
  } catch (error) {
    console.error('❌ [ADMIN-CRUD] Token update error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      source: 'adminCrudRoutes.js'
    });
  }
});

/**
 * DELETE /admin-api/token/delete/:id
 * Delete a token (soft delete by setting status to inactive)
 */
router.delete('/token/delete/:id', (req, res) => {
  try {
    const tokenId = parseInt(req.params.id);
    console.log(`🔍 [ADMIN-CRUD] Token delete requested for ID: ${tokenId}`);
    
    const tokenIndex = tokens.findIndex(token => token.id === tokenId);
    if (tokenIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Token not found',
        source: 'adminCrudRoutes.js'
      });
    }
    
    // Soft delete by setting status to inactive
    tokens[tokenIndex].status = 'inactive';
    tokens[tokenIndex].updatedAt = new Date().toISOString();
    
    console.log('✅ [ADMIN-CRUD] Token deleted successfully:', tokens[tokenIndex]);
    
    res.json({
      success: true,
      message: 'Token deleted successfully',
      data: tokens[tokenIndex],
      source: 'adminCrudRoutes.js',
      endpoint: `DELETE /admin-api/token/delete/${tokenId}`
    });
    
  } catch (error) {
    console.error('❌ [ADMIN-CRUD] Token delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      source: 'adminCrudRoutes.js'
    });
  }
});

// ================================
// BANNER CRUD ENDPOINTS
// ================================

/**
 * GET /admin-api/banner/list
 * Retrieve all banners
 */
router.get('/banner/list', (req, res) => {
  try {
    console.log('🔍 [ADMIN-CRUD] Banner list requested - adminCrudRoutes.js ACTIVE');
    
    const activeBanners = banners.filter(banner => banner.status === 'active');
    
    res.json({
      success: true,
      message: 'BYPASS ROUTE: Banners retrieved successfully from adminCrudRoutes.js',
      data: activeBanners,
      total: activeBanners.length,
      source: 'adminCrudRoutes.js',
      endpoint: 'GET /admin-api/banner/list'
    });
    
  } catch (error) {
    console.error('❌ [ADMIN-CRUD] Banner list error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      source: 'adminCrudRoutes.js'
    });
  }
});

/**
 * POST /admin-api/banner/create
 * Create a new banner
 */
router.post('/banner/create', (req, res) => {
  try {
    console.log('🔍 [ADMIN-CRUD] Banner create requested:', req.body);
    
    const validationErrors = validateBannerData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors,
        source: 'adminCrudRoutes.js'
      });
    }
    
    const newBanner = {
      id: bannerIdCounter++,
      title: req.body.title.trim(),
      altText: req.body.altText || req.body.title.trim(),
      placement: req.body.placement.trim(),
      image: req.body.image || `/images/banners/banner-${bannerIdCounter}.jpg`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active'
    };
    
    banners.push(newBanner);
    
    console.log('✅ [ADMIN-CRUD] Banner created successfully:', newBanner);
    
    res.status(201).json({
      success: true,
      message: 'Banner created successfully',
      data: newBanner,
      source: 'adminCrudRoutes.js',
      endpoint: 'POST /admin-api/banner/create'
    });
    
  } catch (error) {
    console.error('❌ [ADMIN-CRUD] Banner create error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      source: 'adminCrudRoutes.js'
    });
  }
});

/**
 * PUT /admin-api/banner/update/:id
 * Update an existing banner
 */
router.put('/banner/update/:id', (req, res) => {
  try {
    const bannerId = parseInt(req.params.id);
    console.log(`🔍 [ADMIN-CRUD] Banner update requested for ID: ${bannerId}`, req.body);
    
    const bannerIndex = banners.findIndex(banner => banner.id === bannerId);
    if (bannerIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Banner not found',
        source: 'adminCrudRoutes.js'
      });
    }
    
    const validationErrors = validateBannerData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors,
        source: 'adminCrudRoutes.js'
      });
    }
    
    // Update banner data
    banners[bannerIndex] = {
      ...banners[bannerIndex],
      title: req.body.title.trim(),
      altText: req.body.altText || req.body.title.trim(),
      placement: req.body.placement.trim(),
      image: req.body.image || banners[bannerIndex].image,
      updatedAt: new Date().toISOString()
    };
    
    console.log('✅ [ADMIN-CRUD] Banner updated successfully:', banners[bannerIndex]);
    
    res.json({
      success: true,
      message: 'Banner updated successfully',
      data: banners[bannerIndex],
      source: 'adminCrudRoutes.js',
      endpoint: `PUT /admin-api/banner/update/${bannerId}`
    });
    
  } catch (error) {
    console.error('❌ [ADMIN-CRUD] Banner update error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      source: 'adminCrudRoutes.js'
    });
  }
});

/**
 * DELETE /admin-api/banner/delete/:id
 * Delete a banner (soft delete by setting status to inactive)
 */
router.delete('/banner/delete/:id', (req, res) => {
  try {
    const bannerId = parseInt(req.params.id);
    console.log(`🔍 [ADMIN-CRUD] Banner delete requested for ID: ${bannerId}`);
    
    const bannerIndex = banners.findIndex(banner => banner.id === bannerId);
    if (bannerIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Banner not found',
        source: 'adminCrudRoutes.js'
      });
    }
    
    // Soft delete by setting status to inactive
    banners[bannerIndex].status = 'inactive';
    banners[bannerIndex].updatedAt = new Date().toISOString();
    
    console.log('✅ [ADMIN-CRUD] Banner deleted successfully:', banners[bannerIndex]);
    
    res.json({
      success: true,
      message: 'Banner deleted successfully',
      data: banners[bannerIndex],
      source: 'adminCrudRoutes.js',
      endpoint: `DELETE /admin-api/banner/delete/${bannerId}`
    });
    
  } catch (error) {
    console.error('❌ [ADMIN-CRUD] Banner delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      source: 'adminCrudRoutes.js'
    });
  }
});

// ================================
// HEALTH CHECK ENDPOINT
// ================================

/**
 * GET /admin-api/health
 * Health check for admin CRUD routes
 */
router.get('/health', (req, res) => {
  console.log('🔍 [ADMIN-CRUD] Health check requested - adminCrudRoutes.js ACTIVE');
  
  res.json({
    success: true,
    message: 'Admin CRUD routes are operational',
    version: '1.0.0',
    source: 'adminCrudRoutes.js',
    timestamp: new Date().toISOString(),
    endpoints: {
      tokens: {
        list: 'GET /admin-api/token/list',
        create: 'POST /admin-api/token/create',
        update: 'PUT /admin-api/token/update/:id',
        delete: 'DELETE /admin-api/token/delete/:id'
      },
      banners: {
        list: 'GET /admin-api/banner/list',
        create: 'POST /admin-api/banner/create',
        update: 'PUT /admin-api/banner/update/:id',
        delete: 'DELETE /admin-api/banner/delete/:id'
      }
    },
    stats: {
      totalTokens: tokens.filter(t => t.status === 'active').length,
      totalBanners: banners.filter(b => b.status === 'active').length
    }
  });
});

console.log('🚀 [ADMIN-CRUD] adminCrudRoutes.js loaded successfully - BYPASS ROUTES ACTIVE');

module.exports = router;

