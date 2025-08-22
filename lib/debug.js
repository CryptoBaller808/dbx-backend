// lib/debug.js
// Centralized debug system for DBX backend

/**
 * Coerce environment variable to boolean
 * @param {string} v - Environment variable value
 * @returns {boolean} True if value is truthy
 */
function coerceBool(v) {
  return ['1','true','yes','on'].includes(String(v ?? '').toLowerCase());
}

/**
 * Check if debug mode is enabled
 * @returns {boolean} True if SEED_DEBUG=1 is set
 */
function isDebug() {
  return coerceBool(process.env.SEED_DEBUG);
}

/**
 * Serialize error object for JSON response
 * @param {Error} err - Error object to serialize
 * @returns {Object} Serialized error object
 */
function serializeError(err) {
  const out = {
    name: err?.name,
    message: err?.message,
  };
  
  // Attach SQL/parameters if present (Sequelize / raw)
  if (err?.sql) out.sql = err.sql;
  if (err?.parameters) out.parameters = err.parameters;
  
  // Include parent error details for Sequelize errors
  if (err?.parent) {
    if (err.parent.sql) out.sql = err.parent.sql;
    if (err.parent.parameters) out.parameters = err.parent.parameters;
    if (err.parent.detail) out.detail = err.parent.detail;
    if (err.parent.constraint) out.constraint = err.parent.constraint;
    if (err.parent.table) out.table = err.parent.table;
    if (err.parent.schema) out.schema = err.parent.schema;
  }
  
  // Include first stack line only
  if (err?.stack) out.stackTop = String(err.stack).split('\n').slice(0,2).join(' | ');
  
  // Pass through any custom context we attach (e.g., schema probe)
  if (err?.context) out.context = err.context;
  
  return out;
}

/**
 * Create context object for error responses
 * @param {Object} contextData - Additional context data
 * @returns {Object} Context object
 */
function withContext(contextData) {
  return contextData || {};
}

/**
 * Send standardized error response (Owen's specification)
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Error} err - Error object
 * @param {Object} context - Additional context (where, phase, probe, etc.)
 * @returns {Response} Express response
 */
function respondWithError(req, res, err, context = {}) {
  const debug = isDebug();
  
  // Generate request ID for tracking
  const requestId = require('crypto').randomBytes(8).toString('hex');
  
  const payload = {
    success: false,
    message: 'Server error',
    error: debug ? serializeError(err) : 'Internal server error',
    requestId,
    timestamp: new Date().toISOString(),
  };
  
  // Add context information in debug mode
  if (debug && context) {
    if (context.where) payload.where = context.where;
    if (context.phase) payload.phase = context.phase;
    if (context.probe) payload.probe = context.probe;
    // Include any additional context data
    Object.keys(context).forEach(key => {
      if (!['where', 'phase', 'probe'].includes(key)) {
        payload[key] = context[key];
      }
    });
  }
  
  // Add x-request-id header for Railway log tracking
  res.set('x-request-id', requestId);
  
  // Log to Railway logs for debugging
  const logPrefix = context.where ? `[${context.where.toUpperCase()}-ERROR]` : '[ERROR]';
  console.error(`${logPrefix} RequestID: ${requestId}`, JSON.stringify(payload, null, 2));
  
  return res.status(500).json(payload);
}

/**
 * Legacy function for backward compatibility
 * @param {Response} res - Express response object
 * @param {Error} err - Error object
 * @param {string} where - Location where error occurred
 * @returns {Response} Express response
 */
function respondError(res, err, where) {
  // Convert to new format
  return respondWithError(null, res, err, { where });
}

/**
 * Check if debug mode is enabled (alias for consistency)
 * @returns {boolean} True if SEED_DEBUG=1 is set
 */
function isDebugEnabled() {
  return isDebug();
}

module.exports = { 
  isDebug, 
  isDebugEnabled,
  coerceBool, 
  respondError, 
  respondWithError,
  serializeError,
  withContext
};

