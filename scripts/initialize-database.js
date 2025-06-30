/**
 * Database initialization script
 * Standardized to use Sequelize consistently
 */
const db = require('../models');
const config = require('../config');

/**
 * Update user status column to ENUM if needed
 */
async function updateUserStatusColumn() {
  try {
    console.log('🔄 [Database] Checking user status column...');
    
    // Check if the status column exists and what type it is
    const [results] = await db.sequelize.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'status';
    `);
    
    if (results.length > 0) {
      const statusColumn = results[0];
      console.log(`📋 [Database] Current status column type: ${statusColumn.data_type} (${statusColumn.udt_name})`);
      
      // If it's not already the correct ENUM, perform safe migration
      if (statusColumn.udt_name !== 'enum_users_status') {
        console.log('🔄 [Database] Performing safe status column migration...');
        
        // Step 1: Temporarily convert status column to TEXT to avoid boolean casting error
        console.log('🔧 [Database] Step 1: Temporarily converting status column to TEXT...');
        await db.sequelize.query(`ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT;`);
        await db.sequelize.query(`ALTER TABLE "users" ALTER COLUMN "status" DROP NOT NULL;`);
        await db.sequelize.query(`ALTER TABLE "users" ALTER COLUMN "status" TYPE TEXT;`);
        console.log('✅ [Database] Status column converted to TEXT with constraints dropped');
        
        // Step 2: Safely create the ENUM type if it doesn't exist
        console.log('🔧 [Database] Step 2: Safely creating ENUM type...');
        await db.sequelize.query(`
          DO $$
          BEGIN
              CREATE TYPE "public"."enum_users_status" AS ENUM (
                  'active', 'pending', 'suspended', 'banned', 'deleted'
              );
          EXCEPTION
              WHEN duplicate_object THEN NULL;
          END
          $$;
        `);
        console.log('✅ [Database] ENUM type created or already exists');
        
        // Step 3: Convert the column to the ENUM using TEXT cast
        console.log('🔧 [Database] Step 3: Converting column to ENUM using TEXT cast...');
        await db.sequelize.query(`
          ALTER TABLE "users"
              ALTER COLUMN "status"
              TYPE "public"."enum_users_status"
              USING ("status"::"public"."enum_users_status");
        `);
        console.log('✅ [Database] Status column converted to ENUM');
        
        // Step 4: Reapply constraints
        console.log('🔧 [Database] Step 4: Reapplying constraints...');
        await db.sequelize.query(`ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'active';`);
        await db.sequelize.query(`ALTER TABLE "users" ALTER COLUMN "status" SET NOT NULL;`);
        console.log('✅ [Database] Constraints reapplied successfully');
        
        console.log('✅ [Database] Status column migration completed successfully');
        
        // Verify the migration worked
        console.log('🔄 [Database] Verifying migration...');
        const [verifyResults] = await db.sequelize.query(`
          SELECT COUNT(*) as count FROM "users" WHERE "status" = 'active';
        `);
        console.log(`✅ [Database] Verification: Found ${verifyResults[0].count} users with 'active' status`);
        
      } else {
        console.log('✅ [Database] Status column is already ENUM type');
      }
    } else {
      console.log('⚠️ [Database] Status column not found in users table');
    }
    
    return true;
  } catch (error) {
    console.warn('⚠️ [Database] Failed to update status column:', error.message);
    console.warn('⚠️ [Database] Error details:', error);
    return false;
  }
}

/**
 * Initialize database with default data
 */
async function initializeDatabase() {
  try {
    console.log('🔄 [Database] Starting database initialization...');
    
    // Update user status column to ENUM if needed
    await updateUserStatusColumn();
    
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
      const roleCount = await db.roles.count();
      if (roleCount === 0) {
        console.log('Creating default roles...');
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
      console.log('Default roles created');
      }
    } catch (rolesError) {
      console.warn('⚠️ [Database] Could not create default roles:', rolesError.message);
      // Continue with initialization even if roles fail
    }

    // Check if blockchains exist, create default blockchains if not
    try {
      const blockchainCount = await db.blockchain_list.count();
      if (blockchainCount === 0) {
        console.log('Creating default blockchains...');
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
      console.log('Default blockchains created');
    }

    // Check if currencies exist, create default currencies if not
    const currencyCount = await db.currency_list.count();
    if (currencyCount === 0) {
      console.log('Creating default currencies...');
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
      console.log('Default currencies created');
      }
    } catch (blockchainError) {
      console.warn('⚠️ [Database] Could not create default blockchains/currencies:', blockchainError.message);
      // Continue with initialization even if blockchain setup fails
    }

    console.log('Database initialization completed successfully');
    return true;
  } catch (error) {
    console.error('Database initialization failed:', error);
    return false;
  }
}

// Run initialization if this script is executed directly
if (require.main === module) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { initializeDatabase };
