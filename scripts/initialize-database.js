/**
 * Database initialization script
 * Standardized to use Sequelize consistently
 */
const db = require('../models');
const config = require('../config');
const { Umzug, SequelizeStorage } = require('umzug');
const path = require('path');

/**
 * Run pending migrations
 */
async function runMigrations() {
  try {
    console.log('🔄 [Database] Running pending migrations...');
    
    const umzug = new Umzug({
      migrations: {
        glob: path.join(__dirname, '../migrations/*.js'),
        resolve: ({ name, path, context }) => {
          const migration = require(path);
          return {
            name,
            up: async () => migration.up(context.queryInterface, context.Sequelize),
            down: async () => migration.down(context.queryInterface, context.Sequelize),
          };
        },
      },
      context: {
        queryInterface: db.sequelize.getQueryInterface(),
        Sequelize: db.Sequelize,
      },
      storage: new SequelizeStorage({
        sequelize: db.sequelize,
        tableName: 'SequelizeMeta',
      }),
      logger: console,
    });

    const pendingMigrations = await umzug.pending();
    if (pendingMigrations.length > 0) {
      console.log(`📋 [Database] Found ${pendingMigrations.length} pending migrations`);
      await umzug.up();
      console.log('✅ [Database] All migrations completed successfully');
    } else {
      console.log('✅ [Database] No pending migrations found');
    }
    
    return true;
  } catch (error) {
    console.error('❌ [Database] Migration failed:', error.message);
    console.error('❌ [Database] Error details:', error);
    return false;
  }
}

/**
 * Initialize database with default data
 */
async function initializeDatabase() {
  try {
    console.log('🔄 [Database] Starting database initialization...');
    
    // Run migrations first
    const migrationSuccess = await runMigrations();
    if (!migrationSuccess) {
      console.warn('⚠️ [Database] Migrations failed, but continuing with initialization...');
    }
    
    // Sync all models with database - create missing tables (safe mode)
    try {
      await db.sequelize.sync({ alter: true });
      console.log('✅ [Database] Database synchronized with table creation/alteration');
    } catch (syncError) {
      console.warn('⚠️ [Database] Global sync failed, attempting individual model sync:', syncError.message);
    }
    
    // Verify critical models individually with error handling
    const criticalModels = [
      { name: 'NFTAuction', aliases: ['NFTAuction', 'nft_auctions'] },
      { name: 'SystemAlert', aliases: ['SystemAlert', 'system_alerts'] },
      { name: 'User', aliases: ['User', 'users'] },
      { name: 'SystemHealthLog', aliases: ['SystemHealthLog', 'system_health_logs'] }
    ];

    for (const modelInfo of criticalModels) {
      let model = null;
      let foundAlias = null;

      // Find the model by trying different aliases
      for (const alias of modelInfo.aliases) {
        if (db[alias]) {
          model = db[alias];
          foundAlias = alias;
          break;
        }
      }

      if (model) {
        try {
          console.log(`🔄 [Database] Syncing ${modelInfo.name} model (found as ${foundAlias})...`);
          await model.sync({ alter: true });
          console.log(`✅ [Database] ${modelInfo.name} table synchronized successfully`);
        } catch (modelError) {
          console.error(`❌ [Database] Failed to sync ${modelInfo.name} model:`, modelError.message);
          // Continue with other models instead of failing completely
        }
      } else {
        console.warn(`⚠️ [Database] ${modelInfo.name} model not found in db object!`);
        console.log(`📋 [Database] Tried aliases: ${modelInfo.aliases.join(', ')}`);
      }
    }

    // Log available models for debugging
    const availableModels = Object.keys(db).filter(key => key !== 'Sequelize' && key !== 'sequelize');
    console.log('📋 [Database] Available models:', availableModels.join(', '));

    // Check if roles exist, create default roles if not (with error handling)
    try {
      if (db.roles) {
        const roleCount = await db.roles.count();
        if (roleCount === 0) {
          console.log('🔄 [Database] Creating default roles...');
          await db.roles.bulkCreate([
            {
              name: 'admin',
              description: 'Administrator with full access',
              permissions: JSON.stringify({
                users: ['read', 'write', 'delete'],
                items: ['read', 'write', 'delete'],
                collections: ['read', 'write', 'delete'],
                settings: ['read', 'write']
              })
            },
            {
              name: 'user',
              description: 'Regular user',
              permissions: JSON.stringify({
                users: ['read'],
                items: ['read', 'write'],
                collections: ['read', 'write'],
                settings: ['read']
              })
            }
          ]);
          console.log('✅ [Database] Default roles created');
        }
      }
    } catch (rolesError) {
      console.warn('⚠️ [Database] Could not create default roles:', rolesError.message);
      // Continue with initialization even if roles fail
    }

    // Check if blockchains exist, create default blockchains if not
    try {
      if (db.blockchain_list) {
        const blockchainCount = await db.blockchain_list.count();
        if (blockchainCount === 0) {
          console.log('🔄 [Database] Creating default blockchains...');
          await db.blockchain_list.bulkCreate([
            {
              name: 'XRP Ledger',
              symbol: 'XRP',
              chainId: 'xrp',
              nodeUrl: 'wss://s1.ripple.com',
              explorerUrl: 'https://livenet.xrpl.org/transactions/',
              nativeCurrency: 'XRP',
              decimals: 6,
              adapterType: 'xrp',
              isActive: true,
              logo: '/images/blockchains/xrp.png'
            },
            {
              name: 'Stellar',
              symbol: 'XLM',
              chainId: 'xlm',
              nodeUrl: 'https://horizon.stellar.org',
              explorerUrl: 'https://stellar.expert/explorer/public/tx/',
              nativeCurrency: 'XLM',
              decimals: 7,
              adapterType: 'stellar',
              isActive: true,
              logo: '/images/blockchains/xlm.png'
            }
          ]);
          console.log('✅ [Database] Default blockchains created');
        }
      }

      // Check if currencies exist, create default currencies if not
      if (db.currency_list) {
        const currencyCount = await db.currency_list.count();
        if (currencyCount === 0) {
          console.log('🔄 [Database] Creating default currencies...');
          await db.currency_list.bulkCreate([
            {
              name: 'XRP',
              symbol: 'XRP',
              decimals: 6,
              chainId: 'xrp',
              isNative: true,
              logo: '/images/currencies/xrp.png',
              isActive: true
            },
            {
              name: 'Stellar Lumens',
              symbol: 'XLM',
              decimals: 7,
              chainId: 'xlm',
              isNative: true,
              logo: '/images/currencies/xlm.png',
              isActive: true
            }
          ]);
          console.log('✅ [Database] Default currencies created');
        }
      }
    } catch (blockchainError) {
      console.warn('⚠️ [Database] Could not create default blockchains/currencies:', blockchainError.message);
      // Continue with initialization even if blockchain setup fails
    }

    console.log('✅ [Database] Database initialization completed successfully');
    return true;
  } catch (error) {
    console.error('❌ [Database] Database initialization failed:', error);
    return false;
  }
}

// Run initialization if this script is executed directly
if (require.main === module) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { initializeDatabase, runMigrations };

