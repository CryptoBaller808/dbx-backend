/**
 * Admin Authentication Routes
 * Proper JWT-based authentication for admin panel
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { respondWithError, isDebugEnabled, withContext } = require('../lib/debug');

// Async wrapper to ensure all errors hit centralized debug
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// JWT secret - REQUIRED in production
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ [AdminAuth] FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

/**
 * Dynamic password column resolution helper
 * @param {Object} sequelize - Sequelize instance
 * @param {string} tableName - Table name to check
 * @returns {Object} { availableColumns, resolvedPasswordField }
 */
async function resolvePasswordColumn(sequelize, tableName) {
  const columns = await sequelize.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = :tableName OR LOWER(table_name) = LOWER(:tableName)
    ORDER BY ordinal_position
  `, {
    replacements: { tableName },
    type: sequelize.QueryTypes.SELECT
  });
  
  const availableColumns = columns.map(col => col.column_name);
  
  // Detect password column in order of preference
  let resolvedPasswordField;
  if (availableColumns.includes('passwordHash')) {
    resolvedPasswordField = '"passwordHash"'; // Quoted camelCase
  } else if (availableColumns.includes('password_hash')) {
    resolvedPasswordField = 'password_hash';
  } else if (availableColumns.includes('password')) {
    resolvedPasswordField = 'password';
  } else {
    throw new Error('No password column found in Admins table');
  }
  
  return { availableColumns, resolvedPasswordField };
}

/**
 * @route POST /admindashboard/auth/login
 * @desc Admin login with JWT token generation
 * @access Public
 */
router.post('/auth/login', wrap(async (req, res) => {
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
  
  // Ensure database connection is available
  if (!sequelize) {
    throw new Error('Database connection not available');
  }
  
  // Resolve password column dynamically
  const { availableColumns, resolvedPasswordField } = await resolvePasswordColumn(sequelize, 'Admins');
  
  // Build context for error reporting
  const context = {
    where: 'auth-login',
    availableColumns,
    resolvedPasswordField,
    seedDebug: isDebugEnabled()
  };
  
  // Find admin user with dynamic password column
  const rows = await sequelize.query(`
    SELECT id, email, role_id, ${resolvedPasswordField} AS password_value
    FROM "Admins"
    WHERE email = :email
    LIMIT 1
  `, {
    replacements: { email: identifier },
    type: sequelize.QueryTypes.SELECT,
    logging: false
  });
  
  const admin = Array.isArray(rows) ? rows[0] : rows;
  if (!admin || !admin.password_value) {
    console.log('❌ [AdminAuth] Admin user not found:', identifier);
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
      ...(isDebugEnabled() && { requestId: req.requestId })
    });
  }
  
  // Verify password using resolved password field
  const isValidPassword = await bcrypt.compare(password, admin.password_value);
  
  if (!isValidPassword) {
    console.log('❌ [AdminAuth] Invalid password for:', identifier);
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
      ...(isDebugEnabled() && { requestId: req.requestId })
    });
  }
  
  // Generate JWT token with backward compatibility
  const tokenPayload = {
    sub: admin.id,
    id: admin.id,  // Backward compatibility
    email: admin.email,
    role_id: admin.role_id,
    typ: 'admin'
  };
  
  const token = jwt.sign(tokenPayload, JWT_SECRET, { 
    expiresIn: '12h',
    issuer: 'dbx-backend',
    audience: 'dbx-admin'
  });
  
  console.log('✅ [AdminAuth] Login successful for:', identifier);
  
  res.json({
    success: true,
    token,
    user: {
      id: admin.id,
      email: admin.email,
      role_id: admin.role_id
    },
    ...(isDebugEnabled() && { requestId: req.requestId })
  });
}));

/**
 * @route GET /admindashboard/auth/login-preflight
 * @desc Get login schema information for debugging
 * @access Public (only when DEBUG_ENDPOINTS=1)
 */
router.get('/auth/login-preflight', wrap(async (req, res) => {
  // Only available when DEBUG_ENDPOINTS is enabled
  if (process.env.DEBUG_ENDPOINTS !== '1') {
    return res.status(404).json({
      success: false,
      message: 'Not found'
    });
  }
  
  const { sequelize } = require('../models');
  
  if (!sequelize) {
    throw new Error('Database connection not available');
  }
  
  const { availableColumns, resolvedPasswordField } = await resolvePasswordColumn(sequelize, 'Admins');
  
  res.json({
    resolvedPasswordField,
    availableColumns,
    where: 'auth-login-preflight',
    debugEnabled: isDebugEnabled(),
    timestamp: new Date().toISOString()
  });
}));

/**
 * @route GET /admindashboard/auth/profile
 * @desc Get admin profile from JWT token
 * @access Private (requires valid JWT)
 */
router.get('/auth/profile', wrap(async (req, res) => {
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
  
  // Resolve admin ID from token (support both sub and id)
  const adminId = decoded?.sub ?? decoded?.id;
  if (!adminId) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token payload'
    });
  }
  
  // Get fresh admin data from database
  const { sequelize } = require('../models');
  
  if (!sequelize) {
    throw new Error('Database connection not available');
  }
  
  const rows = await sequelize.query(`
    SELECT "id", "email", "role_id", "name", "createdAt", "updatedAt"
    FROM "Admins"
    WHERE "id" = :adminId
    LIMIT 1
  `, {
    replacements: { adminId: Number(adminId) },
    type: sequelize.QueryTypes.SELECT,
    logging: false
  });
  
  const admin = Array.isArray(rows) ? rows[0] : rows;
  if (!admin) {
    return res.status(404).json({
      success: false,
      message: 'Admin user not found'
    });
  }
  
  res.set('Cache-Control', 'no-store');
  res.json({
    success: true,
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role_id: admin.role_id,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt
    },
    ...(isDebugEnabled() && { requestId: req.requestId })
  });
}));

module.exports = router;

