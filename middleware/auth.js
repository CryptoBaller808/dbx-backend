/**
 * Authentication Middleware for Admin Routes
 * Simple token-based authentication for MVP
 */

const jwt = require('jsonwebtoken');

// Simple admin credentials for MVP (in production, use proper user management)
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'DBX2024!Admin', // Strong password for production
  email: 'admin@dbx.exchange'
};

// JWT secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'dbx-admin-secret-key-2024';
const JWT_EXPIRES_IN = '24h';

/**
 * Generate JWT token for admin
 */
const generateToken = (adminData) => {
  return jwt.sign(
    {
      id: adminData.id || 1,
      username: adminData.username,
      email: adminData.email,
      role: 'admin',
      iat: Date.now()
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * Verify JWT token
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

/**
 * Admin login function
 */
const adminLogin = async (username, password) => {
  try {
    // Simple credential check for MVP
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
      const adminData = {
        id: 1,
        username: ADMIN_CREDENTIALS.username,
        email: ADMIN_CREDENTIALS.email,
        role: 'admin',
        loginTime: new Date()
      };

      const token = generateToken(adminData);
      
      return {
        success: true,
        token,
        admin: {
          id: adminData.id,
          username: adminData.username,
          email: adminData.email,
          role: adminData.role
        },
        expiresIn: JWT_EXPIRES_IN
      };
    } else {
      return {
        success: false,
        message: 'Invalid username or password'
      };
    }
  } catch (error) {
    console.error('❌ [Auth] Login error:', error);
    return {
      success: false,
      message: 'Authentication failed'
    };
  }
};

/**
 * Authentication middleware
 */
const authenticateAdmin = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'No authorization header provided'
      });
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Check if token is for admin role
    if (decoded.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    // Add admin info to request
    req.admin = decoded;
    next();
    
  } catch (error) {
    console.error('❌ [Auth] Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

/**
 * Optional authentication middleware (for public endpoints that can benefit from auth)
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : authHeader;

      if (token) {
        const decoded = verifyToken(token);
        if (decoded) {
          req.admin = decoded;
        }
      }
    }
    
    next();
  } catch (error) {
    // Don't fail on optional auth errors
    next();
  }
};

/**
 * Check if user is authenticated
 */
const isAuthenticated = (req) => {
  return req.admin && req.admin.role === 'admin';
};

/**
 * Refresh token
 */
const refreshToken = (req, res) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    const newToken = generateToken(req.admin);
    
    return res.json({
      success: true,
      token: newToken,
      expiresIn: JWT_EXPIRES_IN,
      admin: {
        id: req.admin.id,
        username: req.admin.username,
        email: req.admin.email,
        role: req.admin.role
      }
    });
  } catch (error) {
    console.error('❌ [Auth] Token refresh error:', error);
    return res.status(500).json({
      success: false,
      message: 'Token refresh failed'
    });
  }
};

/**
 * Get admin profile
 */
const getAdminProfile = (req, res) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    return res.json({
      success: true,
      admin: {
        id: req.admin.id,
        username: req.admin.username,
        email: req.admin.email,
        role: req.admin.role,
        loginTime: req.admin.iat ? new Date(req.admin.iat) : null
      }
    });
  } catch (error) {
    console.error('❌ [Auth] Profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get profile'
    });
  }
};

module.exports = {
  generateToken,
  verifyToken,
  adminLogin,
  authenticateAdmin,
  optionalAuth,
  isAuthenticated,
  refreshToken,
  getAdminProfile,
  ADMIN_CREDENTIALS
};

