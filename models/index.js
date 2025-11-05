/**
 * Database Models Index
 * Centralized model definitions and database initialization
 */

const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

// Environment configuration
const env = process.env.NODE_ENV || 'development';

// Enable SQL logging for startup diagnostics
const enableStartupSQL = process.env.DBX_LOG_SQL === 'true';
console.log(`🔍 [SQL Logging] DBX_LOG_SQL=${process.env.DBX_LOG_SQL}, enableStartupSQL=${enableStartupSQL}`);

// Database configuration
let sequelize;

if (process.env.DATABASE_URL) {
  // Production: Use DATABASE_URL from environment with optimized pool settings
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    logging: enableStartupSQL ? console.log : (env === 'development' ? console.log : false),
    pool: {
      max: 10,        // Increased from 5 for better concurrency
      min: 1,         // Always keep 1 connection alive
      acquire: 20000, // 20 seconds to acquire connection
      idle: 10000,    // 10 seconds before closing idle connections
      evict: 10000    // 10 seconds eviction timeout
    }
  });
} else {
  // Development: Use individual connection parameters with optimized pool
  sequelize = new Sequelize(
    process.env.DB_NAME || 'dbx_development',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASSWORD || 'password',
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: enableStartupSQL ? console.log : (env === 'development' ? console.log : false),
      pool: {
        max: 10,        // Increased from 5 for better concurrency
        min: 1,         // Always keep 1 connection alive
        acquire: 20000, // 20 seconds to acquire connection
        idle: 10000,    // 10 seconds before closing idle connections
        evict: 10000    // 10 seconds eviction timeout
      }
    }
  );
}

// Database object to hold models
const db = {};

// Import models
const basename = path.basename(__filename);

// Define models manually to avoid file system issues
const models = [
  'userModel.js',
  'roleModel.js',
  'tokenModel.js',  // Added Token model for Phase 2
  'NFT.js',
  'NFTAuction.js',
  'NFTBid.js',
  'NFTBridgeTransaction.js',
  'NFTCollection.js',
  'NFTRoyalty.js',
  'NFTTransaction.js',
  'AuditLog.js',
  'CreatorVerification.js',
  'CurrencyList.js',
  'SystemAlert.js',
  'SystemHealthLog.js',
  'UserMFA.js',
  'accountOffers.js',
  'bannerModel.js',
  'blockchainModel.js',
  'calcolModel.js',
  'categoriesModel.js',
  'collectionItemModel.js',
  'collectionsModel.js',
  'currenciesModel.js',
  'itemActivityModel.js',
  'itemBidsModel.js',
  'itemModel.js',
  'itemPropertiesModel.js',
  'itemSaleInfoModel.js',
  'settingsModel.js',
  'transactionsModel.js',
  'wishlistModel.js',
  'UserBalance.js'  // Milestone 4: Balance Engine
];

models.forEach(file => {
  try {
    const modelPath = path.join(__dirname, file);
    if (fs.existsSync(modelPath)) {
      const model = require(modelPath)(sequelize, DataTypes);
      db[model.name] = model;
      console.log(`✅ [Models] Loaded model: ${model.name}`);
    } else {
      console.warn(`⚠️  [Models] Model file not found: ${file}`);
    }
  } catch (error) {
    console.error(`❌ [Models] Error loading model ${file}:`, error.message);
  }
});

// Manually register Admin model
try {
  const AdminModel = require(path.join(__dirname, 'Admin.js'))(sequelize, DataTypes);
  db[AdminModel.name] = AdminModel;
  console.log(`✅ [Models] Loaded model: ${AdminModel.name}`);
} catch (error) {
  console.error('❌ [Models] Failed to load Admin model:', error.message);
}

// Set up associations
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    try {
      db[modelName].associate(db);
      console.log(`✅ [Models] Associated model: ${modelName}`);
    } catch (error) {
      console.error(`❌ [Models] Error associating model ${modelName}:`, error.message);
    }
  }
});

// Manual associations for User and Role models
try {
  if (db.User && db.Role) {
    // User belongs to Role
    db.User.belongsTo(db.Role, {
      foreignKey: 'role_id',
      as: 'role'
    });
    
    // Role has many Users
    db.Role.hasMany(db.User, {
      foreignKey: 'role_id',
      as: 'users'
    });
    
    console.log('✅ [Models] Manual associations created: User <-> Role');
  }
} catch (error) {
  console.error('❌ [Models] Error in manual associations:', error.message);
}

// Initialize database connection
const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ [Database] Database connection established successfully');
    
    // MIGRATION-FIRST APPROACH: Skip sync in light mode and production
    if (process.env.DBX_STARTUP_MODE === 'light') {
      console.log('🚀 [LIGHT START] Skipping database sync in light mode');
    } else if (env === 'production') {
      console.log('🏭 [PRODUCTION] Using migration-first approach - no sync/alter in production');
      console.log('🏭 [PRODUCTION] Database schema managed by migrations only');
      // REMOVED: sequelize.sync() in production - migrations handle schema changes
    } else if (env === 'development' && process.env.DBX_STARTUP_MODE === 'full') {
      // Only allow sync in development with explicit full mode for debugging
      console.log('🔧 [DEVELOPMENT] Running sync with alter for debugging (full mode only)');
      await sequelize.sync({ alter: true });
      console.log('✅ [Database] Database models synchronized (development - with alter for debugging)');
    } else {
      console.log('🔧 [DEVELOPMENT] Skipping sync - use DBX_STARTUP_MODE=full to enable sync for debugging');
    }
    
    console.log('🎯 [Models] Available models:', Object.keys(db).filter(key => key !== 'Sequelize' && key !== 'sequelize'));
    
    return sequelize;
  } catch (error) {
    console.error('❌ [Database] Database connection failed:', error);
    throw error;
  }
};

// Export database object and initialization function
db.sequelize = sequelize;
db.Sequelize = Sequelize;
db.initializeDatabase = initializeDatabase;

module.exports = db;
