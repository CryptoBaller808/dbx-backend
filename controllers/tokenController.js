/**
 * Token Controller
 * Handles CRUD operations for admin-managed tokens
 * DBX-62a: Postgres persistence with Sequelize
 */

const { v4: uuidv4 } = require('uuid');
const cloudinary = require('cloudinary').v2;
const db = require('../models');
const AdminToken = db.AdminToken;

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
    
    const where = {};
    
    // Filter by active status if specified
    if (active !== undefined) {
      where.active = active === 'true';
    }
    
    const tokens = await AdminToken.findAll({
      where,
      order: [
        ['sort', 'ASC'],
        ['symbol', 'ASC']
      ]
    });
    
    // Set cache headers
    res.set('Cache-Control', 'public, max-age=60');
    
    res.json(tokens);
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
    const activeTokens = await AdminToken.findAll({
      where: { active: true },
      order: [
        ['sort', 'ASC'],
        ['symbol', 'ASC']
      ]
    });
    
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
    const existingToken = await AdminToken.findOne({
      where: { symbol: symbol.toUpperCase() }
    });
    
    if (existingToken) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: {
          symbol: 'A token with this symbol already exists'
        }
      });
    }
    
    const newToken = await AdminToken.create({
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
    });
    
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
    
    const token = await AdminToken.findByPk(id);
    if (!token) {
      return res.status(404).json({ 
        success: false,
        message: 'Token not found' 
      });
    }
    
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
      const existingToken = await AdminToken.findOne({
        where: { 
          symbol: updates.symbol.toUpperCase(),
          id: { [db.Sequelize.Op.ne]: id }
        }
      });
      
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
    const updateData = {};
    if (updates.symbol !== undefined) updateData.symbol = updates.symbol.toUpperCase();
    if (updates.name !== undefined) updateData.name = updates.name.trim();
    if (updates.decimals !== undefined) updateData.decimals = parseInt(updates.decimals);
    if (updates.chain !== undefined) updateData.chain = updates.chain.trim();
    if (updates.contract !== undefined) updateData.contract = updates.contract ? updates.contract.trim() : null;
    if (updates.defaultQuote !== undefined) updateData.defaultQuote = updates.defaultQuote.toUpperCase();
    if (updates.active !== undefined) updateData.active = updates.active;
    if (updates.sort !== undefined) updateData.sort = parseInt(updates.sort);
    if (updates.priceProvider !== undefined) updateData.priceProvider = updates.priceProvider.toLowerCase();
    if (updates.tvSymbol !== undefined) updateData.tvSymbol = updates.tvSymbol ? updates.tvSymbol.trim() : null;
    
    await token.update(updateData);
    
    console.log(`[Token API] Updated token: ${token.symbol}`);
    res.json({
      success: true,
      message: 'Token updated successfully',
      data: token
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
    
    const token = await AdminToken.findByPk(id);
    if (!token) {
      return res.status(404).json({ 
        success: false,
        message: 'Token not found' 
      });
    }
    
    if (hard === 'true') {
      // Hard delete: remove from database and delete logo from Cloudinary
      const logoUrl = token.logoUrl;
      
      await token.destroy();
      
      // Delete logo from Cloudinary if exists
      if (logoUrl) {
        try {
          // Extract public_id from Cloudinary URL
          const urlParts = logoUrl.split('/');
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
      await token.update({ active: false });
      
      console.log(`[Token API] Soft deleted token: ${token.symbol}`);
      res.json({ 
        success: true,
        message: 'Token deactivated',
        data: token
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
    console.log(`[TOKEN_LOGO] Starting upload for token ID: ${id}`);
    
    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
      console.error('[TOKEN_LOGO] ERROR Cloudinary not configured');
      return res.status(503).json({
        success: false,
        message: 'Logo upload is not available - Cloudinary not configured',
        code: 'CLOUDINARY_NOT_CONFIGURED'
      });
    }
    
    const token = await AdminToken.findByPk(id);
    if (!token) {
      console.error(`[TOKEN_LOGO] ERROR Token not found: ${id}`);
      return res.status(404).json({ 
        success: false,
        message: 'Token not found' 
      });
    }
    
    if (!req.file) {
      console.error('[TOKEN_LOGO] ERROR No file in request');
      return res.status(400).json({ 
        success: false,
        message: 'No file uploaded' 
      });
    }
    
    console.log(`[TOKEN_LOGO] Preflight OK`);
    console.log(`[TOKEN_LOGO] File accepted path=${req.file.path} size=${req.file.size}`);
    
    // Delete old logo if exists
    if (token.logoUrl) {
      try {
        const urlParts = token.logoUrl.split('/');
        const filename = urlParts[urlParts.length - 1];
        const publicId = `dbx-token-logos/${filename.split('.')[0]}`;
        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.warn('[TOKEN_LOGO] Failed to delete old logo:', err.message);
      }
    }
    
    // Upload new logo
    console.log(`[TOKEN_LOGO] Uploading token=${id} name=${req.file.originalname} size=${req.file.size}`);
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'dbx-token-logos',
      public_id: `${token.symbol.toLowerCase()}_${Date.now()}`,
      transformation: [
        { width: 256, height: 256, crop: 'fill' },
        { quality: 'auto', fetch_format: 'auto' }
      ]
    });
    console.log(`[TOKEN_LOGO] Uploaded url=${result.secure_url}`);
    
    // Update token with new logo URL
    await token.update({ logoUrl: result.secure_url });
    
    console.log(`[TOKEN_LOGO] Logo updated in database for token: ${token.symbol}`);
    
    // Clean up temp file
    const fs = require('fs');
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.warn('[TOKEN_LOGO] Failed to delete temp file:', err.message);
      });
    }
    
    res.json({
      success: true,
      message: 'Logo uploaded successfully',
      data: {
        logoUrl: result.secure_url,
        token: token
      }
    });
  } catch (error) {
    console.error('[TOKEN_LOGO] ERROR Unexpected error:', error.message);
    console.error('[Token API] Full error:', error);
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
    const totalTokens = await AdminToken.count();
    const activeTokens = await AdminToken.count({ where: { active: true } });
    
    res.json({
      env: {
        hasAdminKey: !!process.env.ADMIN_KEY,
        hasCloudinary: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY),
        hasDatabase: !!process.env.DATABASE_URL
      },
      routes: {
        create: true,
        uploadLogo: true
      },
      stats: {
        totalTokens,
        activeTokens
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

