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

// Import models dynamically
const modelsDir = __dirname;
const consolidatedDir = path.join(modelsDir, 'consolidated');

// Import consolidated models
if (fs.existsSync(consolidatedDir)) {
  fs.readdirSync(consolidatedDir)
    .filter(file => {
      return (file.indexOf('.') !== 0) && (file !== 'index.js') && (file.slice(-3) === '.js');
    })
    .forEach(file => {
      const model = require(path.join(consolidatedDir, file))(sequelize, DataTypes);
      const modelName = file.replace('.js', '').toLowerCase();
      db[modelName] = model;
    });
}

// Import main models directory
fs.readdirSync(modelsDir)
  .filter(file => {
    return (file.indexOf('.') !== 0) && 
           (file !== 'index.js') && 
           (file.slice(-3) === '.js') &&
           (file !== 'consolidated');
  })
  .forEach(file => {
    try {
      const model = require(path.join(modelsDir, file))(sequelize, DataTypes);
      const modelName = file.replace('.js', '').toLowerCase();
      db[modelName] = model;
    } catch (error) {
      console.warn(`[Models] Warning: Could not load model ${file}:`, error.message);
    }
  });

// Define model associations
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Enhanced model relationships
if (db.collectionsmodel && db.itemmodel) {
  db.collectionsmodel.hasMany(db.itemmodel, {
    as: "collection_items_count",
    foreignKey: "collection_id",
  });

  db.itemmodel.belongsTo(db.collectionsmodel, {
    as: "item_collection",
    foreignKey: "collection_id",
  });
}

if (db.itemmodel && db.itemsaleinfomodel) {
  db.itemmodel.hasOne(db.itemsaleinfomodel, {
    as: "item_sale_info",
    foreignKey: "item_id",
  });

  db.itemmodel.hasOne(db.itemsaleinfomodel, { 
    as: "hot_bids", 
    foreignKey: "item_id" 
  });

  db.itemmodel.hasOne(db.itemsaleinfomodel, {
    as: "live_auctions",
    foreignKey: "item_id",
  });

  db.itemmodel.hasOne(db.itemsaleinfomodel, { 
    as: "explore", 
    foreignKey: "item_id" 
  });

  db.itemsaleinfomodel.belongsTo(db.itemmodel, {
    as: "item_sale_info_item",
    foreignKey: "item_id",
  });
}

if (db.itemmodel && db.itembidsmodel) {
  db.itemmodel.hasMany(db.itembidsmodel, {
    as: "item_bids",
    foreignKey: "item_id",
  });

  db.itembidsmodel.belongsTo(db.itemmodel, {
    as: "item_bids_item",
    foreignKey: "item_id",
  });
}

if (db.usermodel && db.itembidsmodel) {
  db.usermodel.hasMany(db.itembidsmodel, {
    as: "user_bids",
    foreignKey: "user_id",
  });

  db.itembidsmodel.belongsTo(db.usermodel, {
    as: "item_bids_user",
    foreignKey: "user_id",
  });
}

if (db.usermodel && db.itemmodel) {
  db.usermodel.hasMany(db.itemmodel, {
    as: "user_items",
    foreignKey: "user_id",
  });

  db.itemmodel.belongsTo(db.usermodel, {
    as: "item_user",
    foreignKey: "user_id",
  });
}

if (db.usermodel && db.collectionsmodel) {
  db.usermodel.hasMany(db.collectionsmodel, {
    as: "user_collections",
    foreignKey: "user_id",
  });

  db.collectionsmodel.belongsTo(db.usermodel, {
    as: "collection_user",
    foreignKey: "user_id",
  });
}

// NFT model relationships
if (db.nft && db.nftcollection) {
  db.nftcollection.hasMany(db.nft, {
    as: "nfts",
    foreignKey: "collection_id",
  });

  db.nft.belongsTo(db.nftcollection, {
    as: "collection",
    foreignKey: "collection_id",
  });
}

if (db.nft && db.nftauction) {
  db.nft.hasMany(db.nftauction, {
    as: "auctions",
    foreignKey: "nft_id",
  });

  db.nftauction.belongsTo(db.nft, {
    as: "nft",
    foreignKey: "nft_id",
  });
}

if (db.nftauction && db.nftbid) {
  db.nftauction.hasMany(db.nftbid, {
    as: "bids",
    foreignKey: "auction_id",
  });

  db.nftbid.belongsTo(db.nftauction, {
    as: "auction",
    foreignKey: "auction_id",
  });
}

// Initialize database connection
const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('[Models] Database connection established successfully');
    
    // Sync models in development
    if (env === 'development') {
      await sequelize.sync({ alter: true });
      console.log('[Models] Database models synchronized');
    }
    
    return sequelize;
  } catch (error) {
    console.error('[Models] Database connection failed:', error);
    throw error;
  }
};

// Export database object and initialization function
db.initializeDatabase = initializeDatabase;

module.exports = db;

