/**
 * Database initialization script
 * Standardized to use Sequelize consistently
 */
const db = require('../models');
const config = require('../config');

/**
 * Initialize database with default data
 */
async function initializeDatabase() {
  try {
    // Sync all models with database - create missing tables
    await db.sequelize.sync({ alter: true });
    console.log('Database synchronized with table creation/alteration');
    
    // Verify NFTAuction table creation
    if (db.NFTAuction) {
      console.log('✅ [Database] NFTAuction model found, ensuring table exists...');
      await db.NFTAuction.sync({ alter: true });
      console.log('✅ [Database] NFTAuction table synchronized successfully');
    } else {
      console.error('❌ [Database] NFTAuction model not found in db object!');
      console.log('📋 [Database] Available models:', Object.keys(db).filter(key => key !== 'Sequelize' && key !== 'sequelize'));
    }

    // Check if roles exist, create default roles if not
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

    // Check if blockchains exist, create default blockchains if not
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
