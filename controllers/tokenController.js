/**
 * Token Controller
 * Handles CRUD operations for admin-managed tokens
 * DBX 61 Implementation - Prompt C: Robust validation with friendly errors
 */

const { v4: uuidv4 } = require('uuid');
const cloudinary = require('cloudinary').v2;

// In-memory token storage (following banner pattern for consistency)
let tokens = [];

/**
 * Validate token creation/update data
 * Returns { valid: boolean, errors: {} }
 */
function validateTokenData(data, isUpdate = false) {
  const errors = {};
  
  // Symbol validation
  if (!isUpdate || data.symbol !== undefined) {
    if (!data.symbol) {
      errors.symbol = 'Symbol is required';
    } else if (typeof data.symbol !== 'string') {
      errors.symbol = 'Symbol must be a string';
    } else if (!/^[A-Z0-9]+$/.test(data.symbol.toUpperCase())) {
      errors.symbol = 'Symbol must contain only uppercase letters A-Z and numbers 0-9';
    } else if (data.symbol.length < 1 || data.symbol.length > 10) {
      errors.symbol = 'Symbol must be between 1 and 10 characters';
    }
  }
  
  // Name validation
  if (!isUpdate || data.name !== undefined) {
    if (!data.name) {
      errors.name = 'Name is required';
    } else if (typeof data.name !== 'string') {
      errors.name = 'Name must be a string';
    } else if (data.name.trim().length < 1) {
      errors.name = 'Name cannot be empty';
    } else if (data.name.length > 100) {
      errors.name = 'Name must be 100 characters or less';
    }
  }
  
  // Decimals validation
  if (!isUpdate || data.decimals !== undefined) {
    if (data.decimals === undefined || data.decimals === null) {
      errors.decimals = 'Decimals is required';
    } else {
      const dec = Number(data.decimals);
      if (!Number.isInteger(dec)) {
        errors.decimals = 'Decimals must be an integer';
      } else if (dec < 0 || dec > 18) {
        errors.decimals = 'Decimals must be between 0 and 18';
      }
    }
  }
  
  // Chain validation
  if (!isUpdate || data.chain !== undefined) {
    if (!data.chain) {
      errors.chain = 'Chain is required';
    } else if (typeof data.chain !== 'string') {
      errors.chain = 'Chain must be a string';
    } else if (data.chain.trim().length < 1) {
      errors.chain = 'Chain cannot be empty';
    }
  }
  
  // DefaultQuote validation
  if (!isUpdate || data.defaultQuote !== undefined) {
    if (!data.defaultQuote) {
      errors.defaultQuote = 'Default quote is required';
    } else if (typeof data.defaultQuote !== 'string') {
      errors.defaultQuote = 'Default quote must be a string';
    } else if (!/^[A-Z0-9]+$/.test(data.defaultQuote.toUpperCase())) {
      errors.defaultQuote = 'Default quote must contain only uppercase letters A-Z and numbers 0-9';
    }
  }
  
  // Sort validation
  if (!isUpdate || data.sort !== undefined) {
    if (data.sort === undefined || data.sort === null) {
      errors.sort = 'Sort is required';
    } else {
      const sortNum = Number(data.sort);
      if (!Number.isInteger(sortNum)) {
        errors.sort = 'Sort must be an integer';
      } else if (sortNum < 0) {
        errors.sort = 'Sort must be a positive integer';
      }
    }
  }
  
  // Active validation
  if (!isUpdate || data.active !== undefined) {
    if (data.active === undefined || data.active === null) {
      errors.active = 'Active status is required';
    } else if (typeof data.active !== 'boolean') {
      errors.active = 'Active must be a boolean (true or false)';
    }
  }
  
  // PriceProvider validation
  if (!isUpdate || data.priceProvider !== undefined) {
    if (!data.priceProvider) {
      errors.priceProvider = 'Price provider is required';
    } else if (typeof data.priceProvider !== 'string') {
      errors.priceProvider = 'Price provider must be a string';
    } else {
      const validProviders = ['binance', 'coingecko', 'coincap', 'kucoin', 'dbx'];
      if (!validProviders.includes(data.priceProvider.toLowerCase())) {
        errors.priceProvider = `Price provider must be one of: ${validProviders.join(', ')}`;
      }
    }
  }
  
  // Contract validation (optional)
  if (data.contract !== undefined && data.contract !== null && data.contract !== '') {
    if (typeof data.contract !== 'string') {
      errors.contract = 'Contract must be a string';
    } else if (data.contract.length > 200) {
      errors.contract = 'Contract address must be 200 characters or less';
    }
  }
  
  // TvSymbol validation (optional)
  if (data.tvSymbol !== undefined && data.tvSymbol !== null && data.tvSymbol !== '') {
    if (typeof data.tvSymbol !== 'string') {
      errors.tvSymbol = 'TradingView symbol must be a string';
    } else if (data.tvSymbol.length > 50) {
      errors.tvSymbol = 'TradingView symbol must be 50 characters or less';
    }
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * GET /admin/tokens
 * Public endpoint - List all tokens with optional filtering
 */
exports.getTokens = async (req, res) => {
  try {
    const { active } = req.query;
    
    let filteredTokens = tokens;
    
    // Filter by active status if specified
    if (active !== undefined) {
      const isActive = active === 'true';
      filteredTokens = tokens.filter(token => token.active === isActive);
    }
    
    // Sort by sort field, then by symbol
    filteredTokens.sort((a, b) => {
      if (a.sort !== b.sort) return a.sort - b.sort;
      return a.symbol.localeCompare(b.symbol);
    });
    
    // Set cache headers
    res.set('Cache-Control', 'public, max-age=60');
    
    res.json(filteredTokens);
  } catch (error) {
    console.error('[Token API] Error fetching tokens:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch tokens',
      code: 'TOKEN_LIST_UNEXPECTED'
    });
  }
};

/**
 * GET /admin/pairs
 * Public endpoint - Get computed list of allowed trading pairs
 */
exports.getPairs = async (req, res) => {
  try {
    const activeTokens = tokens.filter(token => token.active);
    
    // Generate pairs: each active token paired with its defaultQuote
    const pairs = activeTokens.map(token => ({
      base: token.symbol,
      quote: token.defaultQuote,
      baseToken: token,
    }));
    
    // Set cache headers
    res.set('Cache-Control', 'public, max-age=60');
    
    res.json(pairs);
  } catch (error) {
    console.error('[Token API] Error fetching pairs:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch pairs',
      code: 'TOKEN_PAIRS_UNEXPECTED'
    });
  }
};

/**
 * POST /admin/token
 * Admin endpoint - Create new token
 * NO Cloudinary dependency - logo upload is separate
 */
exports.createToken = async (req, res) => {
  try {
    console.log('[TOKEN_CREATE] Request body:', JSON.stringify(req.body, null, 2));
    
    const {
      symbol,
      name,
      decimals,
      chain,
      contract,
      defaultQuote,
      active,
      sort,
      priceProvider,
      tvSymbol,
    } = req.body;
    
    // Validate input
    const validation = validateTokenData(req.body, false);
    if (!validation.valid) {
      console.warn('[TOKEN_CREATE] Validation errors:', validation.errors);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }
    
    // Check if symbol already exists
    const existingToken = tokens.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
    if (existingToken) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: {
          symbol: 'A token with this symbol already exists'
        }
      });
    }
    
    const now = Date.now();
    const newToken = {
      id: uuidv4(),
      symbol: symbol.toUpperCase(),
      name: name.trim(),
      decimals: parseInt(decimals),
      chain: chain.trim(),
      contract: contract ? contract.trim() : null,
      defaultQuote: defaultQuote.toUpperCase(),
      active: active,
      sort: parseInt(sort),
      priceProvider: priceProvider.toLowerCase(),
      tvSymbol: tvSymbol ? tvSymbol.trim() : `${symbol.toUpperCase()}/${defaultQuote.toUpperCase()}`,
      logoUrl: null, // Logo is uploaded separately
      createdAt: now,
      updatedAt: now,
    };
    
    tokens.push(newToken);
    
    console.log(`[Token API] Created token: ${newToken.symbol}`);
    res.status(201).json({
      success: true,
      message: 'Token created successfully',
      data: newToken
    });
  } catch (error) {
    console.error('[TOKEN_CREATE] Unexpected error:', error);
    res.status(500).json({ 
      success: false,
      message: 'An unexpected error occurred while creating the token',
      code: 'TOKEN_CREATE_UNEXPECTED'
    });
  }
};

/**
 * PUT /admin/token/:id
 * Admin endpoint - Update existing token
 */
exports.updateToken = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const tokenIndex = tokens.findIndex(t => t.id === id);
    if (tokenIndex === -1) {
      return res.status(404).json({ 
        success: false,
        message: 'Token not found' 
      });
    }
    
    const token = tokens[tokenIndex];
    
    // Validate updates
    const validation = validateTokenData(updates, true);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }
    
    // Check symbol uniqueness if changing
    if (updates.symbol && updates.symbol.toUpperCase() !== token.symbol) {
      const existingToken = tokens.find(t => t.id !== id && t.symbol.toUpperCase() === updates.symbol.toUpperCase());
      if (existingToken) {
        return res.status(400).json({ 
          success: false,
          message: 'Validation failed',
          errors: {
            symbol: 'A token with this symbol already exists'
          }
        });
      }
    }
    
    // Update token
    const updatedToken = {
      ...token,
      ...updates,
      id: token.id, // Preserve ID
      symbol: updates.symbol ? updates.symbol.toUpperCase() : token.symbol,
      name: updates.name ? updates.name.trim() : token.name,
      decimals: updates.decimals !== undefined ? parseInt(updates.decimals) : token.decimals,
      chain: updates.chain ? updates.chain.trim() : token.chain,
      contract: updates.contract !== undefined ? (updates.contract ? updates.contract.trim() : null) : token.contract,
      defaultQuote: updates.defaultQuote ? updates.defaultQuote.toUpperCase() : token.defaultQuote,
      sort: updates.sort !== undefined ? parseInt(updates.sort) : token.sort,
      priceProvider: updates.priceProvider ? updates.priceProvider.toLowerCase() : token.priceProvider,
      tvSymbol: updates.tvSymbol !== undefined ? (updates.tvSymbol ? updates.tvSymbol.trim() : token.tvSymbol) : token.tvSymbol,
      updatedAt: Date.now(),
    };
    
    tokens[tokenIndex] = updatedToken;
    
    console.log(`[Token API] Updated token: ${updatedToken.symbol}`);
    res.json({
      success: true,
      message: 'Token updated successfully',
      data: updatedToken
    });
  } catch (error) {
    console.error('[Token API] Unexpected error updating token:', error);
    res.status(500).json({ 
      success: false,
      message: 'An unexpected error occurred while updating the token',
      code: 'TOKEN_UPDATE_UNEXPECTED'
    });
  }
};

/**
 * DELETE /admin/token/:id
 * Admin endpoint - Delete token (soft delete by default)
 */
exports.deleteToken = async (req, res) => {
  try {
    const { id } = req.params;
    const { hard } = req.query; // ?hard=true for hard delete
    
    const tokenIndex = tokens.findIndex(t => t.id === id);
    if (tokenIndex === -1) {
      return res.status(404).json({ 
        success: false,
        message: 'Token not found' 
      });
    }
    
    const token = tokens[tokenIndex];
    
    if (hard === 'true') {
      // Hard delete: remove from array and delete logo from Cloudinary
      tokens.splice(tokenIndex, 1);
      
      // Delete logo from Cloudinary if exists
      if (token.logoUrl) {
        try {
          // Extract public_id from Cloudinary URL
          const urlParts = token.logoUrl.split('/');
          const filename = urlParts[urlParts.length - 1];
          const publicId = `dbx-token-logos/${filename.split('.')[0]}`;
          
          await cloudinary.uploader.destroy(publicId);
          console.log(`[Token API] Deleted logo from Cloudinary: ${publicId}`);
        } catch (cloudinaryError) {
          console.warn('[Token API] Failed to delete logo from Cloudinary:', cloudinaryError.message);
          // Don't fail the request if Cloudinary delete fails
        }
      }
      
      console.log(`[Token API] Hard deleted token: ${token.symbol}`);
      res.json({ 
        success: true,
        message: 'Token permanently deleted' 
      });
    } else {
      // Soft delete: set active to false
      tokens[tokenIndex].active = false;
      tokens[tokenIndex].updatedAt = Date.now();
      
      console.log(`[Token API] Soft deleted token: ${token.symbol}`);
      res.json({ 
        success: true,
        message: 'Token deactivated',
        data: tokens[tokenIndex]
      });
    }
  } catch (error) {
    console.error('[Token API] Unexpected error deleting token:', error);
    res.status(500).json({ 
      success: false,
      message: 'An unexpected error occurred while deleting the token',
      code: 'TOKEN_DELETE_UNEXPECTED'
    });
  }
};

/**
 * POST /admin/token/:id/logo
 * Admin endpoint - Upload token logo to Cloudinary
 */
exports.uploadLogo = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
      return res.status(503).json({
        success: false,
        message: 'Logo upload is not available - Cloudinary not configured',
        code: 'CLOUDINARY_NOT_CONFIGURED'
      });
    }
    
    const tokenIndex = tokens.findIndex(t => t.id === id);
    if (tokenIndex === -1) {
      return res.status(404).json({ 
        success: false,
        message: 'Token not found' 
      });
    }
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'No file uploaded' 
      });
    }
    
    const token = tokens[tokenIndex];
    
    // Delete old logo if exists
    if (token.logoUrl) {
      try {
        const urlParts = token.logoUrl.split('/');
        const filename = urlParts[urlParts.length - 1];
        const publicId = `dbx-token-logos/${filename.split('.')[0]}`;
        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.warn('[Token API] Failed to delete old logo:', err.message);
      }
    }
    
    // Upload new logo
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'dbx-token-logos',
      public_id: `${token.symbol.toLowerCase()}_${Date.now()}`,
      transformation: [
        { width: 256, height: 256, crop: 'fill' },
        { quality: 'auto', fetch_format: 'auto' }
      ]
    });
    
    // Update token with new logo URL
    tokens[tokenIndex].logoUrl = result.secure_url;
    tokens[tokenIndex].updatedAt = Date.now();
    
    console.log(`[Token API] Uploaded logo for token: ${token.symbol}`);
    res.json({
      success: true,
      message: 'Logo uploaded successfully',
      data: {
        logoUrl: result.secure_url,
        token: tokens[tokenIndex]
      }
    });
  } catch (error) {
    console.error('[Token API] Unexpected error uploading logo:', error);
    res.status(500).json({ 
      success: false,
      message: 'An unexpected error occurred while uploading the logo',
      code: 'TOKEN_LOGO_UPLOAD_UNEXPECTED'
    });
  }
};

/**
 * GET /admin/health/token
 * Health check endpoint for ops
 */
exports.healthCheck = async (req, res) => {
  try {
    res.json({
      env: {
        hasAdminKey: !!process.env.ADMIN_KEY,
        hasCloudinary: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY)
      },
      routes: {
        create: true,
        uploadLogo: true
      },
      stats: {
        totalTokens: tokens.length,
        activeTokens: tokens.filter(t => t.active).length
      }
    });
  } catch (error) {
    console.error('[Token API] Error in health check:', error);
    res.status(500).json({ 
      success: false,
      message: 'Health check failed',
      code: 'TOKEN_HEALTH_UNEXPECTED'
    });
  }
};

/**
 * Initialize seed data
 */
exports.initializeSeedData = () => {
  if (tokens.length > 0) {
    console.log('[Token API] Tokens already initialized');
    return;
  }
  
  const now = Date.now();
  const seedTokens = [
    { symbol: 'BTC', name: 'Bitcoin', chain: 'BTC', decimals: 8, defaultQuote: 'USDT', priceProvider: 'binance', tvSymbol: 'BTCUSDT', sort: 1 },
    { symbol: 'ETH', name: 'Ethereum', chain: 'ETH', decimals: 18, defaultQuote: 'USDT', priceProvider: 'binance', tvSymbol: 'ETHUSDT', sort: 2 },
    { symbol: 'XRP', name: 'Ripple', chain: 'XRP', decimals: 6, defaultQuote: 'USDT', priceProvider: 'binance', tvSymbol: 'XRPUSDT', sort: 3 },
    { symbol: 'XLM', name: 'Stellar', chain: 'XLM', decimals: 7, defaultQuote: 'USDT', priceProvider: 'binance', tvSymbol: 'XLMUSDT', sort: 4 },
    { symbol: 'MATIC', name: 'Polygon', chain: 'MATIC', decimals: 18, defaultQuote: 'USDT', priceProvider: 'binance', tvSymbol: 'MATICUSDT', sort: 5 },
    { symbol: 'BNB', name: 'Binance Coin', chain: 'BSC', decimals: 18, defaultQuote: 'USDT', priceProvider: 'binance', tvSymbol: 'BNBUSDT', sort: 6 },
    { symbol: 'SOL', name: 'Solana', chain: 'SOL', decimals: 9, defaultQuote: 'USDT', priceProvider: 'binance', tvSymbol: 'SOLUSDT', sort: 7 },
    { symbol: 'AVAX', name: 'Avalanche', chain: 'AVAX', decimals: 18, defaultQuote: 'USDT', priceProvider: 'binance', tvSymbol: 'AVAXUSDT', sort: 8 },
    { symbol: 'XDC', name: 'XDC Network', chain: 'XDC', decimals: 18, defaultQuote: 'USDT', priceProvider: 'kucoin', tvSymbol: 'XDCUSDT', sort: 9 },
  ];
  
  tokens = seedTokens.map(seed => ({
    id: uuidv4(),
    symbol: seed.symbol,
    name: seed.name,
    decimals: seed.decimals,
    chain: seed.chain,
    contract: null,
    defaultQuote: seed.defaultQuote,
    active: true,
    sort: seed.sort,
    priceProvider: seed.priceProvider,
    tvSymbol: seed.tvSymbol,
    logoUrl: null,
    createdAt: now,
    updatedAt: now,
  }));
  
  console.log(`[Token API] Initialized ${tokens.length} seed tokens`);
};

