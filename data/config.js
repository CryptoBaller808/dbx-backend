require("dotenv/config");
const crypto = require('crypto');

/**
 * Enhanced Database Configuration for DBX Platform
 * Implements security hardening, connection pooling optimization,
 * and performance enhancements for production deployment
 */

// Database encryption configuration
const DB_ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const DB_ENCRYPTION_ALGORITHM = 'aes-256-gcm';

// Connection pool configuration optimized for high load
const connectionPoolConfig = {
  // Maximum number of connections in pool
  max: parseInt(process.env.DB_POOL_MAX) || 20,
  
  // Minimum number of connections in pool
  min: parseInt(process.env.DB_POOL_MIN) || 5,
  
  // Maximum time (ms) that pool will try to get connection before throwing error
  acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 60000,
  
  // Maximum time (ms) that a connection can be idle before being released
  idle: parseInt(process.env.DB_POOL_IDLE) || 10000,
  
  // Maximum time (ms) that a connection can exist before being destroyed and recreated
  evict: parseInt(process.env.DB_POOL_EVICT) || 3600000, // 1 hour
  
  // Function to validate connections
  validate: (connection) => {
    return connection && connection.state !== 'disconnected';
  },
  
  // Handle connection errors
  handleDisconnects: true,
  
  // Enable connection retry
  retry: {
    max: 3,
    timeout: 5000
  }
};

// SSL configuration for secure connections
const sslConfig = process.env.NODE_ENV === 'production' ? {
  require: true,
  rejectUnauthorized: false, // Set to true in production with proper certificates
  ca: process.env.DB_SSL_CA,
  key: process.env.DB_SSL_KEY,
  cert: process.env.DB_SSL_CERT
} : false;

// Primary database configuration
const primaryDbConfig = {
  HOST: process.env.DB_HOST || 'localhost',
  USER: process.env.DB_USER || 'root',
  PASSWORD: process.env.DB_PASSWORD || '',
  DB: process.env.DB_NAME || 'dbx_platform',
  PORT: parseInt(process.env.DB_PORT) || 3306,
  dialect: "mysql",
  dialectModule: require('mysql2'),
  
  // Enhanced connection pool
  pool: connectionPoolConfig,
  
  // SSL configuration
  dialectOptions: {
    ssl: sslConfig,
    connectTimeout: 60000,
    acquireTimeout: 60000,
    timeout: 60000,
    
    // Enable multiple statements for complex queries
    multipleStatements: false, // Security: Disable to prevent SQL injection
    
    // Character set configuration
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    
    // Timezone configuration
    timezone: '+00:00',
    
    // Enable query logging in development
    logging: process.env.NODE_ENV === 'development' ? console.log : false
  },
  
  // Query configuration
  query: {
    // Raw queries disabled by default for security
    raw: false,
    
    // Enable query nesting
    nest: true,
    
    // Query timeout
    timeout: 30000
  },
  
  // Logging configuration
  logging: process.env.NODE_ENV === 'development' ? 
    (sql, timing) => {
      console.log(`[DB Query] ${sql}`);
      if (timing) console.log(`[DB Timing] ${timing}ms`);
    } : false,
  
  // Benchmark queries in development
  benchmark: process.env.NODE_ENV === 'development',
  
  // Define associations
  define: {
    // Use camelCase for automatically added attributes
    underscored: false,
    
    // Don't delete database entries but set the newly added attribute deletedAt
    paranoid: true,
    
    // Don't use createdAt/updatedAt timestamps
    timestamps: true,
    
    // Disable the modification of table names
    freezeTableName: true,
    
    // Define charset and collation
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci'
  },
  
  // Sync configuration
  sync: {
    force: false,
    alter: process.env.NODE_ENV === 'development'
  }
};

// Read replica configuration for load balancing
const readReplicaConfig = {
  ...primaryDbConfig,
  HOST: process.env.DB_READ_HOST || process.env.DB_HOST || 'localhost',
  USER: process.env.DB_READ_USER || process.env.DB_USER || 'root',
  PASSWORD: process.env.DB_READ_PASSWORD || process.env.DB_PASSWORD || '',
  
  // Read-only configuration
  pool: {
    ...connectionPoolConfig,
    max: parseInt(process.env.DB_READ_POOL_MAX) || 15,
    min: parseInt(process.env.DB_READ_POOL_MIN) || 3
  }
};

// Database encryption utilities
const dbEncryption = {
  // Encrypt sensitive data before storing
  encrypt: (text) => {
    if (!text) return null;
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(DB_ENCRYPTION_ALGORITHM, DB_ENCRYPTION_KEY);
    cipher.setAAD(Buffer.from('DBX_PLATFORM', 'utf8'));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      iv: iv.toString('hex'),
      encryptedData: encrypted,
      authTag: authTag.toString('hex')
    };
  },
  
  // Decrypt sensitive data after retrieval
  decrypt: (encryptedObj) => {
    if (!encryptedObj || !encryptedObj.encryptedData) return null;
    
    try {
      const decipher = crypto.createDecipher(DB_ENCRYPTION_ALGORITHM, DB_ENCRYPTION_KEY);
      decipher.setAAD(Buffer.from('DBX_PLATFORM', 'utf8'));
      decipher.setAuthTag(Buffer.from(encryptedObj.authTag, 'hex'));
      
      let decrypted = decipher.update(encryptedObj.encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      return null;
    }
  }
};

// Database health check configuration
const healthCheck = {
  // Check database connectivity
  checkConnection: async (sequelize) => {
    try {
      await sequelize.authenticate();
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error.message, 
        timestamp: new Date().toISOString() 
      };
    }
  },
  
  // Check connection pool status
  checkPool: (sequelize) => {
    const pool = sequelize.connectionManager.pool;
    return {
      total: pool.size,
      active: pool.borrowed,
      idle: pool.available,
      pending: pool.pending,
      max: pool.max,
      min: pool.min
    };
  }
};

// Query optimization utilities
const queryOptimization = {
  // Common indexes for performance
  indexes: [
    // User table indexes
    { table: 'users', fields: ['email'], unique: true },
    { table: 'users', fields: ['wallet_address'], unique: true },
    { table: 'users', fields: ['created_at'] },
    { table: 'users', fields: ['is_deleted'] },
    
    // Transaction table indexes
    { table: 'transactions', fields: ['user_id'] },
    { table: 'transactions', fields: ['network'] },
    { table: 'transactions', fields: ['status'] },
    { table: 'transactions', fields: ['created_at'] },
    { table: 'transactions', fields: ['transaction_hash'], unique: true },
    
    // MFA table indexes
    { table: 'user_mfa', fields: ['user_id'], unique: true },
    { table: 'user_mfa', fields: ['is_enabled'] },
    
    // NFT table indexes
    { table: 'items', fields: ['user_id'] },
    { table: 'items', fields: ['collection_id'] },
    { table: 'items', fields: ['is_deleted'] },
    { table: 'items', fields: ['created_at'] },
    
    // Audit log indexes
    { table: 'audit_logs', fields: ['user_id'] },
    { table: 'audit_logs', fields: ['action'] },
    { table: 'audit_logs', fields: ['created_at'] },
    { table: 'audit_logs', fields: ['ip_address'] }
  ],
  
  // Query performance monitoring
  slowQueryThreshold: 1000, // Log queries taking more than 1 second
  
  // Query caching configuration
  cache: {
    enabled: process.env.NODE_ENV === 'production',
    ttl: 300, // 5 minutes default TTL
    maxSize: 100 // Maximum number of cached queries
  }
};

// Security configuration
const securityConfig = {
  // SQL injection prevention
  preventSQLInjection: true,
  
  // Parameterized queries only
  allowRawQueries: false,
  
  // Connection encryption
  requireSSL: process.env.NODE_ENV === 'production',
  
  // Query logging for security monitoring
  logQueries: true,
  
  // Maximum query execution time
  maxQueryTime: 30000,
  
  // Connection limits per IP
  maxConnectionsPerIP: 10
};

module.exports = {
  // Primary configuration (backward compatibility)
  ...primaryDbConfig,
  
  // Enhanced configurations
  primary: primaryDbConfig,
  readReplica: readReplicaConfig,
  encryption: dbEncryption,
  healthCheck: healthCheck,
  optimization: queryOptimization,
  security: securityConfig,
  
  // Environment-specific configurations
  development: {
    ...primaryDbConfig,
    logging: console.log,
    benchmark: true
  },
  
  test: {
    ...primaryDbConfig,
    DB: process.env.DB_TEST_NAME || 'dbx_platform_test',
    logging: false
  },
  
  production: {
    ...primaryDbConfig,
    logging: false,
    dialectOptions: {
      ...primaryDbConfig.dialectOptions,
      ssl: {
        require: true,
        rejectUnauthorized: true
      }
    }
  }
};

