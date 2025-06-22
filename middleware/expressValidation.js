const { body, param, query, validationResult } = require('express-validator');

/**
 * Express-validator based validation rules for DBX Platform
 * Provides additional validation layer using express-validator
 * for route-specific validation requirements
 */

// User registration validation
const validateUserRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format'),
  
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be 8-128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  
  body('walletAddress')
    .notEmpty()
    .withMessage('Wallet address is required')
    .custom((value, { req }) => {
      const network = req.body.network || 'ethereum';
      return validateAddressByNetwork(value, network);
    }),
  
  body('network')
    .isIn(['ethereum', 'xrp', 'solana', 'stellar', 'xdc', 'avalanche', 'polygon', 'bsc'])
    .withMessage('Invalid network specified'),
  
  body('termsAccepted')
    .isBoolean()
    .equals(true)
    .withMessage('Terms and conditions must be accepted')
];

// User login validation
const validateUserLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  body('mfaToken')
    .optional()
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('MFA token must be 6 digits')
];

// Transaction validation
const validateTransaction = [
  body('network')
    .isIn(['ethereum', 'xrp', 'solana', 'stellar', 'xdc', 'avalanche', 'polygon', 'bsc'])
    .withMessage('Invalid network specified'),
  
  body('type')
    .isIn(['send', 'receive', 'swap', 'bridge', 'stake', 'unstake'])
    .withMessage('Invalid transaction type'),
  
  body('fromAddress')
    .notEmpty()
    .withMessage('From address is required')
    .custom((value, { req }) => {
      return validateAddressByNetwork(value, req.body.network);
    }),
  
  body('toAddress')
    .notEmpty()
    .withMessage('To address is required')
    .custom((value, { req }) => {
      return validateAddressByNetwork(value, req.body.network);
    }),
  
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .custom((value, { req }) => {
      return validateAmountByNetwork(value, req.body.network);
    }),
  
  body('gasPrice')
    .optional()
    .isNumeric()
    .withMessage('Gas price must be numeric'),
  
  body('gasLimit')
    .optional()
    .isNumeric()
    .withMessage('Gas limit must be numeric')
];

// Swap transaction validation
const validateSwapTransaction = [
  body('fromNetwork')
    .isIn(['ethereum', 'xrp', 'solana', 'stellar', 'xdc', 'avalanche', 'polygon', 'bsc'])
    .withMessage('Invalid from network'),
  
  body('toNetwork')
    .isIn(['ethereum', 'xrp', 'solana', 'stellar', 'xdc', 'avalanche', 'polygon', 'bsc'])
    .withMessage('Invalid to network'),
  
  body('fromAsset')
    .notEmpty()
    .withMessage('From asset is required'),
  
  body('toAsset')
    .notEmpty()
    .withMessage('To asset is required'),
  
  body('fromAmount')
    .notEmpty()
    .withMessage('From amount is required')
    .custom((value, { req }) => {
      return validateAmountByNetwork(value, req.body.fromNetwork);
    }),
  
  body('slippageTolerance')
    .optional()
    .isFloat({ min: 0.1, max: 50 })
    .withMessage('Slippage tolerance must be between 0.1% and 50%'),
  
  body('deadline')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Deadline must be a positive integer (minutes)')
];

// NFT validation
const validateNFTOperation = [
  body('network')
    .isIn(['ethereum', 'xdc', 'avalanche', 'polygon', 'bsc'])
    .withMessage('Invalid network for NFT operations'),
  
  body('contractAddress')
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid contract address format'),
  
  body('tokenId')
    .notEmpty()
    .withMessage('Token ID is required'),
  
  body('price')
    .optional()
    .custom((value, { req }) => {
      return validateAmountByNetwork(value, req.body.network);
    })
];

// Admin validation
const validateAdminOperation = [
  body('adminPassword')
    .notEmpty()
    .withMessage('Admin password is required'),
  
  body('operation')
    .isIn(['block_user', 'unblock_user', 'delete_user', 'update_settings', 'view_logs'])
    .withMessage('Invalid admin operation'),
  
  body('targetUserId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid user ID'),
  
  body('reason')
    .optional()
    .isLength({ min: 10, max: 500 })
    .withMessage('Reason must be 10-500 characters')
];

// File upload validation
const validateFileUpload = [
  body('fileType')
    .isIn(['image/jpeg', 'image/png', 'image/gif', 'application/pdf'])
    .withMessage('Invalid file type'),
  
  body('fileSize')
    .isInt({ min: 1, max: 10485760 }) // 10MB
    .withMessage('File size must be between 1 byte and 10MB')
];

// Query parameter validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be between 1 and 1000'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'amount', 'status'])
    .withMessage('Invalid sort field'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

// Parameter validation
const validateUserId = [
  param('userId')
    .isInt({ min: 1 })
    .withMessage('Invalid user ID')
];

const validateTransactionId = [
  param('transactionId')
    .isLength({ min: 10, max: 100 })
    .withMessage('Invalid transaction ID format')
];

// Custom validation functions
const validateAddressByNetwork = (address, network) => {
  const addressPatterns = {
    ethereum: /^0x[a-fA-F0-9]{40}$/,
    xdc: /^0x[a-fA-F0-9]{40}$/,
    avalanche: /^0x[a-fA-F0-9]{40}$/,
    polygon: /^0x[a-fA-F0-9]{40}$/,
    bsc: /^0x[a-fA-F0-9]{40}$/,
    xrp: /^r[1-9A-HJ-NP-Za-km-z]{25,34}$/,
    solana: /^[1-9A-HJ-NP-Za-km-z]{44}$/,
    stellar: /^G[A-Z2-7]{55}$/
  };

  const pattern = addressPatterns[network];
  if (!pattern) {
    throw new Error(`Unsupported network: ${network}`);
  }

  if (!pattern.test(address)) {
    throw new Error(`Invalid ${network} address format`);
  }

  return true;
};

const validateAmountByNetwork = (amount, network) => {
  const amountPatterns = {
    ethereum: /^\d+(\.\d{1,18})?$/,
    xdc: /^\d+(\.\d{1,18})?$/,
    avalanche: /^\d+(\.\d{1,18})?$/,
    polygon: /^\d+(\.\d{1,18})?$/,
    bsc: /^\d+(\.\d{1,18})?$/,
    xrp: /^\d+(\.\d{1,6})?$/,
    solana: /^\d+(\.\d{1,9})?$/,
    stellar: /^\d+(\.\d{1,7})?$/
  };

  const pattern = amountPatterns[network];
  if (!pattern) {
    throw new Error(`Unsupported network: ${network}`);
  }

  if (!pattern.test(amount)) {
    throw new Error(`Invalid ${network} amount format`);
  }

  // Additional validation for minimum amounts
  const numAmount = parseFloat(amount);
  if (numAmount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  // Network-specific minimum amounts
  const minimumAmounts = {
    ethereum: 0.000001,
    xdc: 0.000001,
    avalanche: 0.000001,
    polygon: 0.000001,
    bsc: 0.000001,
    xrp: 0.000001,
    solana: 0.000000001,
    stellar: 0.0000001
  };

  if (numAmount < minimumAmounts[network]) {
    throw new Error(`Amount below minimum for ${network}: ${minimumAmounts[network]}`);
  }

  return true;
};

// Validation result handler middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map(error => ({
      field: error.param,
      message: error.msg,
      value: error.value,
      location: error.location
    }));

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: validationErrors
    });
  }

  next();
};

// Rate limiting validation
const validateRateLimit = (req, res, next) => {
  // Add rate limiting headers
  res.set({
    'X-RateLimit-Limit': req.rateLimit?.limit || 100,
    'X-RateLimit-Remaining': req.rateLimit?.remaining || 99,
    'X-RateLimit-Reset': req.rateLimit?.reset || Date.now() + 900000
  });

  next();
};

module.exports = {
  validateUserRegistration,
  validateUserLogin,
  validateTransaction,
  validateSwapTransaction,
  validateNFTOperation,
  validateAdminOperation,
  validateFileUpload,
  validatePagination,
  validateUserId,
  validateTransactionId,
  validateAddressByNetwork,
  validateAmountByNetwork,
  handleValidationErrors,
  validateRateLimit
};

