const Joi = require('joi');

/**
 * Enhanced Input Validation Framework for DBX Platform
 * Provides comprehensive validation schemas for all supported blockchain networks
 * and transaction types with proper error handling and security measures
 */

// Blockchain-specific validation schemas
const blockchainValidationSchemas = {
  // Ethereum and EVM-compatible networks (ETH, XDC, AVAX, MATIC, BNB)
  ethereum: {
    address: Joi.string()
      .pattern(/^0x[a-fA-F0-9]{40}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid Ethereum address format',
        'any.required': 'Ethereum address is required'
      }),
    amount: Joi.string()
      .pattern(/^\d+(\.\d{1,18})?$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid amount format (max 18 decimals)',
        'any.required': 'Amount is required'
      }),
    gasPrice: Joi.string()
      .pattern(/^\d+$/)
      .optional()
      .messages({
        'string.pattern.base': 'Gas price must be a valid number'
      }),
    gasLimit: Joi.string()
      .pattern(/^\d+$/)
      .optional()
      .messages({
        'string.pattern.base': 'Gas limit must be a valid number'
      }),
    nonce: Joi.number()
      .integer()
      .min(0)
      .optional()
      .messages({
        'number.base': 'Nonce must be a number',
        'number.integer': 'Nonce must be an integer',
        'number.min': 'Nonce must be non-negative'
      }),
    tokenAddress: Joi.string()
      .pattern(/^0x[a-fA-F0-9]{40}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid token contract address format'
      })
  },

  // XRP Ledger
  xrp: {
    address: Joi.string()
      .pattern(/^r[1-9A-HJ-NP-Za-km-z]{25,34}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid XRP address format',
        'any.required': 'XRP address is required'
      }),
    amount: Joi.string()
      .pattern(/^\d+(\.\d{1,6})?$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid XRP amount format (max 6 decimals)',
        'any.required': 'Amount is required'
      }),
    destinationTag: Joi.number()
      .integer()
      .min(0)
      .max(4294967295)
      .optional()
      .messages({
        'number.base': 'Destination tag must be a number',
        'number.integer': 'Destination tag must be an integer',
        'number.min': 'Destination tag must be non-negative',
        'number.max': 'Destination tag must be less than 4294967296'
      }),
    fee: Joi.string()
      .pattern(/^\d+(\.\d{1,6})?$/)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid fee format'
      }),
    sequence: Joi.number()
      .integer()
      .min(1)
      .optional()
      .messages({
        'number.base': 'Sequence must be a number',
        'number.integer': 'Sequence must be an integer',
        'number.min': 'Sequence must be positive'
      })
  },

  // Solana
  solana: {
    address: Joi.string()
      .length(44)
      .pattern(/^[1-9A-HJ-NP-Za-km-z]+$/)
      .required()
      .messages({
        'string.length': 'Solana address must be 44 characters',
        'string.pattern.base': 'Invalid Solana address format',
        'any.required': 'Solana address is required'
      }),
    amount: Joi.string()
      .pattern(/^\d+(\.\d{1,9})?$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid SOL amount format (max 9 decimals)',
        'any.required': 'Amount is required'
      }),
    tokenMint: Joi.string()
      .length(44)
      .pattern(/^[1-9A-HJ-NP-Za-km-z]+$/)
      .optional()
      .messages({
        'string.length': 'Token mint address must be 44 characters',
        'string.pattern.base': 'Invalid token mint address format'
      }),
    priorityFee: Joi.number()
      .integer()
      .min(0)
      .optional()
      .messages({
        'number.base': 'Priority fee must be a number',
        'number.integer': 'Priority fee must be an integer',
        'number.min': 'Priority fee must be non-negative'
      })
  },

  // Stellar
  stellar: {
    address: Joi.string()
      .pattern(/^G[A-Z2-7]{55}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid Stellar address format',
        'any.required': 'Stellar address is required'
      }),
    amount: Joi.string()
      .pattern(/^\d+(\.\d{1,7})?$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid XLM amount format (max 7 decimals)',
        'any.required': 'Amount is required'
      }),
    memo: Joi.string()
      .max(28)
      .optional()
      .messages({
        'string.max': 'Memo must be 28 characters or less'
      }),
    memoType: Joi.string()
      .valid('text', 'id', 'hash', 'return')
      .optional()
      .messages({
        'any.only': 'Memo type must be one of: text, id, hash, return'
      }),
    assetCode: Joi.string()
      .max(12)
      .optional()
      .messages({
        'string.max': 'Asset code must be 12 characters or less'
      }),
    assetIssuer: Joi.string()
      .pattern(/^G[A-Z2-7]{55}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid asset issuer address format'
      })
  }
};

// Common validation schemas
const commonValidationSchemas = {
  // User authentication
  userAuth: {
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Invalid email format',
        'any.required': 'Email is required'
      }),
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters',
        'string.max': 'Password must be less than 128 characters',
        'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character',
        'any.required': 'Password is required'
      }),
    walletAddress: Joi.string()
      .required()
      .messages({
        'any.required': 'Wallet address is required'
      })
  },

  // Transaction validation
  transaction: {
    network: Joi.string()
      .valid('ethereum', 'xrp', 'solana', 'stellar', 'xdc', 'avalanche', 'polygon', 'bsc')
      .required()
      .messages({
        'any.only': 'Invalid network specified',
        'any.required': 'Network is required'
      }),
    type: Joi.string()
      .valid('send', 'receive', 'swap', 'bridge', 'stake', 'unstake')
      .required()
      .messages({
        'any.only': 'Invalid transaction type',
        'any.required': 'Transaction type is required'
      }),
    timestamp: Joi.date()
      .iso()
      .optional()
      .messages({
        'date.format': 'Invalid timestamp format'
      })
  },

  // API pagination and filtering
  pagination: {
    page: Joi.number()
      .integer()
      .min(1)
      .max(1000)
      .default(1)
      .messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1',
        'number.max': 'Page must be less than 1000'
      }),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(20)
      .messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit must be less than 100'
      }),
    sortBy: Joi.string()
      .valid('createdAt', 'updatedAt', 'amount', 'status')
      .default('createdAt')
      .messages({
        'any.only': 'Invalid sort field'
      }),
    sortOrder: Joi.string()
      .valid('asc', 'desc')
      .default('desc')
      .messages({
        'any.only': 'Sort order must be asc or desc'
      })
  },

  // File upload validation
  fileUpload: {
    fileType: Joi.string()
      .valid('image/jpeg', 'image/png', 'image/gif', 'application/pdf')
      .required()
      .messages({
        'any.only': 'Invalid file type',
        'any.required': 'File type is required'
      }),
    fileSize: Joi.number()
      .integer()
      .min(1)
      .max(10485760) // 10MB
      .required()
      .messages({
        'number.base': 'File size must be a number',
        'number.integer': 'File size must be an integer',
        'number.min': 'File size must be greater than 0',
        'number.max': 'File size must be less than 10MB',
        'any.required': 'File size is required'
      })
  }
};

// Validation middleware factory
const createValidationMiddleware = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = source === 'body' ? req.body : 
                  source === 'params' ? req.params : 
                  source === 'query' ? req.query : req[source];

    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
    }

    // Replace the original data with validated and sanitized data
    if (source === 'body') req.body = value;
    else if (source === 'params') req.params = value;
    else if (source === 'query') req.query = value;
    else req[source] = value;

    next();
  };
};

// Network-specific validation middleware
const validateBlockchainTransaction = (network) => {
  return createValidationMiddleware(
    Joi.object({
      ...blockchainValidationSchemas[network],
      ...commonValidationSchemas.transaction
    })
  );
};

// Address validation utility
const validateAddress = (address, network) => {
  const schema = blockchainValidationSchemas[network]?.address;
  if (!schema) {
    throw new Error(`Unsupported network: ${network}`);
  }

  const { error } = schema.validate(address);
  return !error;
};

// Amount validation utility
const validateAmount = (amount, network) => {
  const schema = blockchainValidationSchemas[network]?.amount;
  if (!schema) {
    throw new Error(`Unsupported network: ${network}`);
  }

  const { error } = schema.validate(amount);
  return !error;
};

// Comprehensive transaction validation
const validateTransactionData = (transactionData) => {
  const { network } = transactionData;
  
  if (!blockchainValidationSchemas[network]) {
    throw new Error(`Unsupported network: ${network}`);
  }

  const schema = Joi.object({
    ...blockchainValidationSchemas[network],
    ...commonValidationSchemas.transaction
  });

  const { error, value } = schema.validate(transactionData, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const validationErrors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context.value
    }));
    
    throw new Error(`Validation failed: ${JSON.stringify(validationErrors)}`);
  }

  return value;
};

// Security validation for sensitive operations
const validateSensitiveOperation = createValidationMiddleware(
  Joi.object({
    mfaToken: Joi.string()
      .length(6)
      .pattern(/^\d{6}$/)
      .required()
      .messages({
        'string.length': 'MFA token must be 6 digits',
        'string.pattern.base': 'MFA token must contain only digits',
        'any.required': 'MFA token is required for this operation'
      }),
    confirmationCode: Joi.string()
      .length(8)
      .pattern(/^[A-Z0-9]{8}$/)
      .optional()
      .messages({
        'string.length': 'Confirmation code must be 8 characters',
        'string.pattern.base': 'Invalid confirmation code format'
      })
  })
);

module.exports = {
  blockchainValidationSchemas,
  commonValidationSchemas,
  createValidationMiddleware,
  validateBlockchainTransaction,
  validateAddress,
  validateAmount,
  validateTransactionData,
  validateSensitiveOperation
};

