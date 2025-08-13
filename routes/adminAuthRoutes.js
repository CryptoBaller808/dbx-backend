/**
 * Admin Authentication Routes
 * Proper JWT-based authentication for admin panel
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// JWT secret - in production this should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'dbx-admin-secret-key-change-in-production';

/**
 * @route POST /admindashboard/auth/login
 * @desc Admin login with JWT token generation
 * @access Public
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { email, username, password } = req.body || {};
    
    console.log('🔐 [AdminAuth] Login attempt:', { 
      email: email ? email.substring(0, 3) + '***' : undefined,
      username: username ? username.substring(0, 3) + '***' : undefined 
    });
    
    // Validate required fields
    if (!password || (!email && !username)) {
      return res.status(400).json({
        success: false,
        message: 'Email/username and password are required'
      });
    }
    
    // Normalize identifier (email takes precedence if both provided)
    const identifier = (email || username).toLowerCase().trim();
    
    // Get database connection
    const { sequelize } = require('../models');
    
    // Find admin user by email or username
    const [users] = await sequelize.query(`
      SELECT u.id, u.username, u.email, u.password, u.first_name, u.last_name, 
             u.status, r.name as role_name, r.id as role_id
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE (u.username = :identifier OR u.email = :identifier)
      AND u.status = 'active'
      AND r.name = 'admin'
    `, {
      replacements: { identifier },
      type: sequelize.QueryTypes.SELECT
    });
    
    if (users.length === 0) {
      console.log('❌ [AdminAuth] Admin user not found:', identifier);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    const user = users[0];
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      console.log('❌ [AdminAuth] Invalid password for user:', identifier);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role_name,
        role_id: user.role_id
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('✅ [AdminAuth] Login successful for:', identifier);
    
    res.json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role_name,
        roleId: user.role_id
      }
    });
    
  } catch (error) {
    console.error('❌ [AdminAuth] Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

/**
 * @route GET /admindashboard/auth/profile
 * @desc Get admin profile from JWT token
 * @access Private (requires valid JWT)
 */
router.get('/auth/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get fresh user data from database
    const { sequelize } = require('../models');
    
    const [users] = await sequelize.query(`
      SELECT u.id, u.username, u.email, u.first_name, u.last_name, 
             u.status, r.name as role_name, r.id as role_id
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = :userId
      AND u.status = 'active'
      AND r.name = 'admin'
    `, {
      replacements: { userId: decoded.id },
      type: sequelize.QueryTypes.SELECT
    });
    
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Admin user not found or inactive'
      });
    }
    
    const user = users[0];
    
    res.json({
      success: true,
      admin: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role_name,
        roleId: user.role_id
      }
    });
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    
    console.error('❌ [AdminAuth] Profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
      error: error.message
    });
  }
});

/**
 * @route POST /admindashboard/auth/refresh
 * @desc Refresh JWT token
 * @access Private (requires valid JWT)
 */
router.post('/auth/refresh', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }
    
    const token = authHeader.substring(7);
    
    // Verify current token (even if expired, we can still decode it)
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        // Allow refresh of expired tokens within a reasonable time window
        decoded = jwt.decode(token);
        const now = Math.floor(Date.now() / 1000);
        const expiredTime = decoded.exp;
        
        // Allow refresh within 7 days of expiration
        if (now - expiredTime > 7 * 24 * 60 * 60) {
          return res.status(401).json({
            success: false,
            message: 'Token too old to refresh'
          });
        }
      } else {
        throw error;
      }
    }
    
    // Generate new token
    const newToken = jwt.sign(
      {
        id: decoded.id,
        username: decoded.username,
        email: decoded.email,
        role: decoded.role,
        role_id: decoded.role_id
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      message: 'Token refreshed successfully',
      token: newToken
    });
    
  } catch (error) {
    console.error('❌ [AdminAuth] Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: 'Failed to refresh token',
      error: error.message
    });
  }
});

/**
 * @route POST /admindashboard/auth/logout
 * @desc Admin logout (client-side token removal)
 * @access Private
 */
router.post('/auth/logout', (req, res) => {
  // In a stateless JWT system, logout is handled client-side by removing the token
  // In a more sophisticated system, you might maintain a blacklist of tokens
  
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

/**
 * Middleware to authenticate JWT tokens
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

/**
 * Middleware to require admin role
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin role required.'
    });
  }
  next();
};

// Export router and middleware
module.exports = {
  router,
  authenticateToken,
  requireAdmin
};

