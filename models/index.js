/**
 * Database Models Index
 * Centralized model definitions and database initialization
 */

const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

// Environment configuration
const env = process.env.NODE_ENV || 'development';

// Database configuration
let sequelize;

if (process.env.DATABASE_URL) {
  // Production: Use DATABASE_URL from environment
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    logging: env === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
} else {
  // Development: Use individual connection parameters
  sequelize = new Sequelize(
    process.env.DB_NAME || 'dbx_development',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASSWORD || 'password',
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: env === 'development' ? console.log : false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
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
  'wishlistModel.js'
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
    
    // FIXED: Use alter: false to prevent conflicting ALTER queries
    if (env === 'development') {
      await sequelize.sync({ alter: false });
      console.log('✅ [Database] Database models synchronized (development - no alter)');
    } else if (env === 'production') {
      // PRODUCTION: Use safest possible sync - no alter, no force
      // This will only create tables if they don't exist, no modifications to existing tables
      await sequelize.sync({ force: false, alter: false });
      console.log('✅ [Database] Database models synchronized (production - safe mode, no alter)');
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
