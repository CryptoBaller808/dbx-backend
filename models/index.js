/**
 * Enhanced Database configuration utility
 * Implements security hardening, connection pooling,
 * and performance optimization for DBX Platform
 */
const { Sequelize, DataTypes } = require("sequelize");
const path = require("path");
const fs = require("fs");

// Initialize Sequelize with environment configuration
let sequelize;

// Database configuration
const config = {
  development: {
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'dbx_development',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    logging: console.log,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    logging: false,
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000
    }
  }
};

// Determine environment
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Validate DATABASE_URL for production
if (env === 'production' && dbConfig.use_env_variable) {
  const databaseUrl = process.env[dbConfig.use_env_variable];
  
  if (!databaseUrl) {
    console.error('❌ [Database] CRITICAL ERROR: DATABASE_URL environment variable is not set!');
    console.error('📋 [Database] Please set DATABASE_URL in your Render dashboard with this format:');
    console.error('🔗 [Database] postgresql://username:password@hostname:port/database_name');
    console.error('📝 [Database] Example: postgresql://dbx_user:secure_password@dpg-abc123-a.oregon-postgres.render.com:5432/dbx_production');
    console.error('⚙️  [Database] In Render Dashboard:');
    console.error('   1. Go to your service dashboard');
    console.error('   2. Click "Environment" tab');
    console.error('   3. Add: DATABASE_URL = your_postgresql_connection_string');
    console.error('   4. Redeploy the service');
    throw new Error('DATABASE_URL environment variable is required for production deployment');
  }
  
  // Validate DATABASE_URL format
  try {
    const url = new URL(databaseUrl);
    if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
      throw new Error('Invalid protocol');
    }
    if (!url.hostname || !url.pathname) {
      throw new Error('Missing hostname or database name');
    }
    console.log('✅ [Database] DATABASE_URL format validation passed');
    console.log(`🔗 [Database] Connecting to: ${url.hostname}:${url.port || 5432}${url.pathname}`);
  } catch (error) {
    console.error('❌ [Database] CRITICAL ERROR: Invalid DATABASE_URL format!');
    console.error('🔗 [Database] Current DATABASE_URL:', databaseUrl.substring(0, 20) + '...');
    console.error('📋 [Database] Required format: postgresql://username:password@hostname:port/database_name');
    console.error('📝 [Database] Example: postgresql://dbx_user:secure_password@dpg-abc123-a.oregon-postgres.render.com:5432/dbx_production');
    console.error('🔧 [Database] Error details:', error.message);
    throw new Error(`Invalid DATABASE_URL format: ${error.message}`);
  }
}

// Initialize Sequelize with enhanced error handling
try {
  if (dbConfig.use_env_variable) {
    const databaseUrl = process.env[dbConfig.use_env_variable];
    console.log('🔄 [Database] Initializing Sequelize with DATABASE_URL...');
    sequelize = new Sequelize(databaseUrl, dbConfig);
  } else {
    console.log('🔄 [Database] Initializing Sequelize with individual parameters...');
    sequelize = new Sequelize(
      dbConfig.database,
      dbConfig.username,
      dbConfig.password,
      dbConfig
    );
  }
  console.log('✅ [Database] Sequelize instance created successfully');
} catch (error) {
  console.error('❌ [Database] CRITICAL ERROR: Failed to create Sequelize instance!');
  console.error('🔧 [Database] Error details:', error.message);
  if (env === 'production') {
    console.error('📋 [Database] For Render deployment, ensure DATABASE_URL is set correctly:');
    console.error('   Format: postgresql://username:password@hostname:port/database_name');
    console.error('   Example: postgresql://dbx_user:secure_password@dpg-abc123-a.oregon-postgres.render.com:5432/dbx_production');
  }
  throw error;
}

// Initialize database object
const db = {};

// Assign Sequelize instances
db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Import models dynamically with proper naming
const modelsDir = __dirname;
const consolidatedDir = path.join(modelsDir, 'consolidated');

console.log('🔄 [Models] Loading models...');

// Import consolidated models first
if (fs.existsSync(consolidatedDir)) {
  fs.readdirSync(consolidatedDir)
    .filter(file => {
      return (file.indexOf('.') !== 0) && (file !== 'index.js') && (file.slice(-3) === '.js');
    })
    .forEach(file => {
      try {
        const model = require(path.join(consolidatedDir, file))(sequelize, DataTypes);
        const modelName = file.replace('.js', '').replace('Model', '');
        
        // Standardize model names
        if (modelName === 'user') {
          db.users = model;
          db.User = model;
        } else if (modelName === 'role') {
          db.roles = model;
          db.Role = model;
        } else if (modelName === 'collections') {
          db.collections = model;
          db.Collection = model;
        } else if (modelName === 'item') {
          db.items = model;
          db.Item = model;
        } else {
          db[modelName] = model;
        }
        
        console.log(`✅ [Models] Loaded consolidated model: ${modelName}`);
      } catch (error) {
        console.warn(`⚠️  [Models] Warning: Could not load consolidated model ${file}:`, error.message);
      }
    });
}

// Import main models directory
fs.readdirSync(modelsDir)
  .filter(file => {
    return (file.indexOf('.') !== 0) && 
           (file !== 'index.js') && 
           (file.slice(-3) === '.js') &&
           !fs.statSync(path.join(modelsDir, file)).isDirectory();
  })
  .forEach(file => {
    try {
      const model = require(path.join(modelsDir, file))(sequelize, DataTypes);
      const modelName = file.replace('.js', '');
      
      // Standardize model names for associations
      if (modelName === 'CreatorVerification') {
        db.creator_verifications = model;
        db.CreatorVerification = model;
      } else if (modelName === 'UserMFA') {
        db.user_mfa = model;
        db.UserMFA = model;
      } else if (modelName === 'UserMFA_backup') {
        db.UserMFABackup = model;
      } else if (modelName === 'AuditLog') {
        db.audit_logs = model;
        db.AuditLog = model;
      } else if (modelName.startsWith('NFT')) {
        const snakeName = modelName.replace(/([A-Z])/g, '_$1').toLowerCase().substring(1);
        db[snakeName] = model;
        db[modelName] = model;
      } else {
        db[modelName.toLowerCase()] = model;
        db[modelName] = model;
      }
      
      console.log(`✅ [Models] Loaded main model: ${modelName}`);
    } catch (error) {
      console.warn(`⚠️  [Models] Warning: Could not load main model ${file}:`, error.message);
    }
  });

console.log('🔄 [Models] Setting up model associations...');

// Define model associations AFTER all models are loaded
Object.keys(db).forEach(modelName => {
  if (db[modelName] && typeof db[modelName].associate === 'function') {
    try {
      console.log(`🔗 [Models] Setting up associations for: ${modelName}`);
      db[modelName].associate(db);
    } catch (error) {
      console.error(`❌ [Models] Error setting up associations for ${modelName}:`, error.message);
      console.error(`🔧 [Models] Available models:`, Object.keys(db).filter(key => key !== 'Sequelize' && key !== 'sequelize'));
    }
  }
});

// Manual associations for legacy compatibility
try {
  // Collections and Items
  if (db.collections && db.items) {
    db.collections.hasMany(db.items, {
      as: "collection_items_count",
      foreignKey: "collection_id",
    });

    db.items.belongsTo(db.collections, {
      as: "item_collection",
      foreignKey: "collection_id",
    });
  }

  // Items and Sale Info
  if (db.items && db.itemsaleinfo) {
    db.items.hasOne(db.itemsaleinfo, {
      as: "item_sale_info",
      foreignKey: "item_id",
    });

    db.items.hasOne(db.itemsaleinfo, { 
      as: "hot_bids", 
      foreignKey: "item_id" 
    });

    db.items.hasOne(db.itemsaleinfo, {
      as: "live_auctions",
      foreignKey: "item_id",
    });

    db.items.hasOne(db.itemsaleinfo, { 
      as: "explore", 
      foreignKey: "item_id" 
    });

    db.itemsaleinfo.belongsTo(db.items, {
      as: "item_sale_info_item",
      foreignKey: "item_id",
    });
  }

  // Items and Bids
  if (db.items && db.itembids) {
    db.items.hasMany(db.itembids, {
      as: "item_bids",
      foreignKey: "item_id",
    });

    db.itembids.belongsTo(db.items, {
      as: "item_bids_item",
      foreignKey: "item_id",
    });
  }

  // Users and Bids
  if (db.users && db.itembids) {
    db.users.hasMany(db.itembids, {
      as: "user_bids",
      foreignKey: "user_id",
    });

    db.itembids.belongsTo(db.users, {
      as: "item_bids_user",
      foreignKey: "user_id",
    });
  }

  // Users and Items
  if (db.users && db.items) {
    db.users.hasMany(db.items, {
      as: "user_items",
      foreignKey: "user_id",
    });

    db.items.belongsTo(db.users, {
      as: "item_user",
      foreignKey: "user_id",
    });
  }

  // Users and Collections
  if (db.users && db.collections) {
    db.users.hasMany(db.collections, {
      as: "user_collections",
      foreignKey: "user_id",
    });

    db.collections.belongsTo(db.users, {
      as: "collection_user",
      foreignKey: "user_id",
    });
  }

  console.log('✅ [Models] Manual associations completed');
} catch (error) {
  console.error('❌ [Models] Error in manual associations:', error.message);
}

// Initialize database connection
const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ [Database] Database connection established successfully');
    
    // Sync models in development
    if (env === 'development') {
      await sequelize.sync({ alter: true });
      console.log('✅ [Database] Database models synchronized');
    }
    
    console.log('🎯 [Models] Available models:', Object.keys(db).filter(key => key !== 'Sequelize' && key !== 'sequelize'));
    
    return sequelize;
  } catch (error) {
    console.error('❌ [Database] Database connection failed:', error);
    throw error;
  }
};

// Export database object and initialization function
db.initializeDatabase = initializeDatabase;

module.exports = db;

