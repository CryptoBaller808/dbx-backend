/**
 * Admin Dashboard Routes - Token & Banner CRUD APIs
 * Full Send Implementation for DBX MVP
 */

const express = require('express');
const router = express.Router();

// Mock requireRole middleware to prevent crashes
const requireRole = (roles) => (req, res, next) => {
  console.warn(`[Bypassed RBAC] Admin route requires roles: ${roles.join(', ')}`);
  // TODO: Restore proper RBAC after Phase 2
  next();
};

// Mock authenticateToken middleware
const authenticateToken = (req, res, next) => {
  console.warn('[Bypassed Auth] Admin token authentication bypassed');
  // TODO: Restore proper auth after Phase 2
  next();
};

// Mock data for testing - will be replaced with actual DB operations
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
    title: 'Welcome to DBX Exchange',
    imageUrl: 'https://via.placeholder.com/800x200/4F46E5/FFFFFF?text=DBX+Exchange',
    link: '/exchange',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 2,
    title: 'Trade with Confidence',
    imageUrl: 'https://via.placeholder.com/800x200/059669/FFFFFF?text=Secure+Trading',
    link: '/security',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// =============================================================================
// TOKEN CRUD ENDPOINTS
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
    try {
      const { name, symbol, network, contract, logoUrl, active = true } = req.body;
      
      // Basic validation
      if (!name || !symbol || !network) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, symbol, network'
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

      console.log(`[Admin] Created new token: ${symbol} on ${network}`);

      res.status(201).json({
        success: true,
        message: 'Token created successfully',
        data: newToken
      });

    } catch (error) {
      console.error('[Admin] Token creation error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
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
    try {
      const { network, active } = req.query;
      let filteredTokens = [...mockTokens];

      // Filter by network if provided
      if (network) {
        filteredTokens = filteredTokens.filter(token => 
          token.network.toLowerCase() === network.toLowerCase()
        );
      }

      // Filter by active status if provided
      if (active !== undefined) {
        const isActive = active === 'true';
        filteredTokens = filteredTokens.filter(token => token.active === isActive);
      }

      console.log(`[Admin] Retrieved ${filteredTokens.length} tokens`);

      res.json({
        success: true,
        message: 'Tokens retrieved successfully',
        data: filteredTokens,
        total: filteredTokens.length
      });

    } catch (error) {
      console.error('[Admin] Token retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
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
    try {
      const { id } = req.params;
      const { name, symbol, network, contract, logoUrl, active } = req.body;

      // Find token by ID
      const tokenIndex = mockTokens.findIndex(token => token.id === parseInt(id));
      
      if (tokenIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Token not found'
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

      console.log(`[Admin] Updated token ID ${id}: ${updatedToken.symbol}`);

      res.json({
        success: true,
        message: 'Token updated successfully',
        data: updatedToken
      });

    } catch (error) {
      console.error('[Admin] Token update error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
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
    try {
      const { id } = req.params;

      // Find token by ID
      const tokenIndex = mockTokens.findIndex(token => token.id === parseInt(id));
      
      if (tokenIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Token not found'
        });
      }

      const deletedToken = mockTokens[tokenIndex];
      mockTokens.splice(tokenIndex, 1);

      console.log(`[Admin] Deleted token ID ${id}: ${deletedToken.symbol}`);

      res.json({
        success: true,
        message: 'Token deleted successfully',
        data: deletedToken
      });

    } catch (error) {
      console.error('[Admin] Token deletion error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

// =============================================================================
// BANNER CRUD ENDPOINTS
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
    try {
      const { title, imageUrl, link, active = true } = req.body;

      // Basic validation
      if (!title || !imageUrl) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: title, imageUrl'
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

      console.log(`[Admin] Created new banner: ${title}`);

      res.status(201).json({
        success: true,
        message: 'Banner created successfully',
        data: newBanner
      });

    } catch (error) {
      console.error('[Admin] Banner creation error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
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
    try {
      const { active } = req.query;
      let filteredBanners = [...mockBanners];

      // Filter by active status if provided
      if (active !== undefined) {
        const isActive = active === 'true';
        filteredBanners = filteredBanners.filter(banner => banner.active === isActive);
      }

      console.log(`[Admin] Retrieved ${filteredBanners.length} banners`);

      res.json({
        success: true,
        message: 'Banners retrieved successfully',
        data: filteredBanners,
        total: filteredBanners.length
      });

    } catch (error) {
      console.error('[Admin] Banner retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
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
    try {
      const { id } = req.params;
      const { title, imageUrl, link, active } = req.body;

      // Find banner by ID
      const bannerIndex = mockBanners.findIndex(banner => banner.id === parseInt(id));
      
      if (bannerIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Banner not found'
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

      console.log(`[Admin] Updated banner ID ${id}: ${updatedBanner.title}`);

      res.json({
        success: true,
        message: 'Banner updated successfully',
        data: updatedBanner
      });

    } catch (error) {
      console.error('[Admin] Banner update error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
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
    try {
      const { id } = req.params;

      // Find banner by ID
      const bannerIndex = mockBanners.findIndex(banner => banner.id === parseInt(id));
      
      if (bannerIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Banner not found'
        });
      }

      const deletedBanner = mockBanners[bannerIndex];
      mockBanners.splice(bannerIndex, 1);

      console.log(`[Admin] Deleted banner ID ${id}: ${deletedBanner.title}`);

      res.json({
        success: true,
        message: 'Banner deleted successfully',
        data: deletedBanner
      });

    } catch (error) {
      console.error('[Admin] Banner deletion error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

// =============================================================================
// HEALTH CHECK ENDPOINT
// =============================================================================

/**
 * @route GET /admindashboard/health
 * @desc Admin dashboard health check
 * @access Public
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Admin Dashboard API is running',
    timestamp: new Date().toISOString(),
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
    }
  });
});

module.exports = router;

