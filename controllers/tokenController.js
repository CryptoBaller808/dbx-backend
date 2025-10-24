/**
 * Token Controller
 * Handles CRUD operations for admin-managed tokens
 * DBX 61 Implementation
 */

const { v4: uuidv4 } = require('uuid');
const cloudinary = require('cloudinary').v2;

// In-memory token storage (following banner pattern for consistency)
let tokens = [];

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
    res.status(500).json({ error: 'Failed to fetch tokens' });
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
    res.status(500).json({ error: 'Failed to fetch pairs' });
  }
};

/**
 * POST /admin/token
 * Admin endpoint - Create new token
 */
exports.createToken = async (req, res) => {
  try {
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
    
    // Validation
    if (!symbol || !name || !chain || decimals === undefined || !priceProvider) {
      return res.status(400).json({ 
        error: 'Missing required fields: symbol, name, chain, decimals, priceProvider' 
      });
    }
    
    // Check if symbol already exists
    if (tokens.find(t => t.symbol.toUpperCase() === symbol.toUpperCase())) {
      return res.status(400).json({ error: 'Token with this symbol already exists' });
    }
    
    // Validate decimals
    if (typeof decimals !== 'number' || decimals < 0 || decimals > 18) {
      return res.status(400).json({ error: 'Decimals must be a number between 0 and 18' });
    }
    
    const now = Date.now();
    const newToken = {
      id: uuidv4(),
      symbol: symbol.toUpperCase(),
      name,
      decimals: parseInt(decimals),
      chain,
      contract: contract || null,
      defaultQuote: defaultQuote || 'USDT',
      active: active !== undefined ? active : true,
      sort: sort !== undefined ? parseInt(sort) : 999,
      priceProvider: priceProvider || 'binance',
      tvSymbol: tvSymbol || `${symbol.toUpperCase()}/USDT`,
      logoUrl: null,
      createdAt: now,
      updatedAt: now,
    };
    
    tokens.push(newToken);
    
    console.log(`[Token API] Created token: ${newToken.symbol}`);
    res.status(201).json(newToken);
  } catch (error) {
    console.error('[Token API] Error creating token:', error);
    res.status(500).json({ error: 'Failed to create token' });
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
      return res.status(404).json({ error: 'Token not found' });
    }
    
    const token = tokens[tokenIndex];
    
    // Validate symbol uniqueness if changing
    if (updates.symbol && updates.symbol.toUpperCase() !== token.symbol) {
      if (tokens.find(t => t.symbol.toUpperCase() === updates.symbol.toUpperCase())) {
        return res.status(400).json({ error: 'Token with this symbol already exists' });
      }
    }
    
    // Validate decimals if provided
    if (updates.decimals !== undefined) {
      if (typeof updates.decimals !== 'number' || updates.decimals < 0 || updates.decimals > 18) {
        return res.status(400).json({ error: 'Decimals must be a number between 0 and 18' });
      }
    }
    
    // Update token
    const updatedToken = {
      ...token,
      ...updates,
      id: token.id, // Preserve ID
      symbol: updates.symbol ? updates.symbol.toUpperCase() : token.symbol,
      decimals: updates.decimals !== undefined ? parseInt(updates.decimals) : token.decimals,
      sort: updates.sort !== undefined ? parseInt(updates.sort) : token.sort,
      updatedAt: Date.now(),
    };
    
    tokens[tokenIndex] = updatedToken;
    
    console.log(`[Token API] Updated token: ${updatedToken.symbol}`);
    res.json(updatedToken);
  } catch (error) {
    console.error('[Token API] Error updating token:', error);
    res.status(500).json({ error: 'Failed to update token' });
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
      return res.status(404).json({ error: 'Token not found' });
    }
    
    const token = tokens[tokenIndex];
    
    if (hard === 'true') {
      // Hard delete: remove from array and delete logo from Cloudinary
      if (token.logoUrl) {
        try {
          // Extract public_id from Cloudinary URL
          const matches = token.logoUrl.match(/\/dbx-token-logos\/([^/.]+)/);
          if (matches && matches[1]) {
            await cloudinary.uploader.destroy(`dbx-token-logos/${matches[1]}`);
            console.log(`[Token API] Deleted logo for token: ${token.symbol}`);
          }
        } catch (err) {
          console.error('[Token API] Error deleting logo:', err);
        }
      }
      
      tokens.splice(tokenIndex, 1);
      console.log(`[Token API] Hard deleted token: ${token.symbol}`);
      res.json({ message: 'Token deleted', id });
    } else {
      // Soft delete: set active to false
      tokens[tokenIndex] = {
        ...token,
        active: false,
        updatedAt: Date.now(),
      };
      console.log(`[Token API] Soft deleted token: ${token.symbol}`);
      res.json(tokens[tokenIndex]);
    }
  } catch (error) {
    console.error('[Token API] Error deleting token:', error);
    res.status(500).json({ error: 'Failed to delete token' });
  }
};

/**
 * POST /admin/token/:id/logo
 * Admin endpoint - Upload/replace token logo
 */
exports.uploadLogo = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const tokenIndex = tokens.findIndex(t => t.id === id);
    if (tokenIndex === -1) {
      return res.status(404).json({ error: 'Token not found' });
    }
    
    const token = tokens[tokenIndex];
    
    // Delete old logo if exists
    if (token.logoUrl) {
      try {
        const matches = token.logoUrl.match(/\/dbx-token-logos\/([^/.]+)/);
        if (matches && matches[1]) {
          await cloudinary.uploader.destroy(`dbx-token-logos/${matches[1]}`);
        }
      } catch (err) {
        console.error('[Token API] Error deleting old logo:', err);
      }
    }
    
    // Upload new logo to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'dbx-token-logos',
          transformation: [
            { width: 256, height: 256, crop: 'fill', gravity: 'center' },
            { quality: 'auto', fetch_format: 'auto' }
          ],
          allowed_formats: ['png', 'jpg', 'jpeg', 'webp', 'svg'],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      
      uploadStream.end(req.file.buffer);
    });
    
    // Update token with new logo URL
    tokens[tokenIndex] = {
      ...token,
      logoUrl: result.secure_url,
      updatedAt: Date.now(),
    };
    
    console.log(`[Token API] Uploaded logo for token: ${token.symbol}`);
    res.json({ logoUrl: result.secure_url, token: tokens[tokenIndex] });
  } catch (error) {
    console.error('[Token API] Error uploading logo:', error);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
};

/**
 * Initialize with seed data
 */
exports.initializeSeedData = () => {
  if (tokens.length > 0) {
    console.log('[Token API] Tokens already initialized');
    return;
  }
  
  const seedTokens = [
    {
      id: uuidv4(),
      symbol: 'BTC',
      name: 'Bitcoin',
      decimals: 8,
      chain: 'BTC',
      contract: null,
      defaultQuote: 'USDT',
      active: true,
      sort: 1,
      priceProvider: 'binance',
      tvSymbol: 'BTCUSDT',
      logoUrl: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: uuidv4(),
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      chain: 'ETH',
      contract: null,
      defaultQuote: 'USDT',
      active: true,
      sort: 2,
      priceProvider: 'binance',
      tvSymbol: 'ETHUSDT',
      logoUrl: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: uuidv4(),
      symbol: 'XRP',
      name: 'Ripple',
      decimals: 6,
      chain: 'XRP',
      contract: null,
      defaultQuote: 'USDT',
      active: true,
      sort: 3,
      priceProvider: 'binance',
      tvSymbol: 'XRPUSDT',
      logoUrl: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: uuidv4(),
      symbol: 'XLM',
      name: 'Stellar',
      decimals: 7,
      chain: 'XLM',
      contract: null,
      defaultQuote: 'USDT',
      active: true,
      sort: 4,
      priceProvider: 'binance',
      tvSymbol: 'XLMUSDT',
      logoUrl: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: uuidv4(),
      symbol: 'MATIC',
      name: 'Polygon',
      decimals: 18,
      chain: 'MATIC',
      contract: null,
      defaultQuote: 'USDT',
      active: true,
      sort: 5,
      priceProvider: 'binance',
      tvSymbol: 'MATICUSDT',
      logoUrl: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: uuidv4(),
      symbol: 'BNB',
      name: 'BNB',
      decimals: 18,
      chain: 'BSC',
      contract: null,
      defaultQuote: 'USDT',
      active: true,
      sort: 6,
      priceProvider: 'binance',
      tvSymbol: 'BNBUSDT',
      logoUrl: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: uuidv4(),
      symbol: 'SOL',
      name: 'Solana',
      decimals: 9,
      chain: 'SOL',
      contract: null,
      defaultQuote: 'USDT',
      active: true,
      sort: 7,
      priceProvider: 'binance',
      tvSymbol: 'SOLUSDT',
      logoUrl: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: uuidv4(),
      symbol: 'AVAX',
      name: 'Avalanche',
      decimals: 18,
      chain: 'AVAX',
      contract: null,
      defaultQuote: 'USDT',
      active: true,
      sort: 8,
      priceProvider: 'binance',
      tvSymbol: 'AVAXUSDT',
      logoUrl: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: uuidv4(),
      symbol: 'XDC',
      name: 'XDC Network',
      decimals: 18,
      chain: 'XDC',
      contract: null,
      defaultQuote: 'USDT',
      active: true,
      sort: 9,
      priceProvider: 'kucoin',
      tvSymbol: 'XDCUSDT',
      logoUrl: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];
  
  tokens = seedTokens;
  console.log(`[Token API] Initialized with ${tokens.length} seed tokens`);
};

