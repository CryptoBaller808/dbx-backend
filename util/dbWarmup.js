/**
 * DB Warmup utility for non-blocking server startup
 * Initializes database connection asynchronously after server starts
 */
const { sequelize } = require('./sequelize');

exports.init = async () => {
  console.log('[DB] Warmup starting...');
  
  try {
    await sequelize.authenticate();
    console.log('[DB] Connected via DATABASE_URL');
    
    // Optional: lazy migrations/seed guarded by env flag
    if (process.env.DBX_RUN_MIGRATIONS_ON_BOOT === 'true') {
      console.log('[DB] Running migrations on boot...');
      // Add migration logic here if needed
    }
    
    return true;
  } catch (error) {
    console.error('[DB] Warmup error:', error?.message || error);
    throw error;
  }
};

