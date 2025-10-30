/**
 * Seed Runner for Boot-Time Seeding
 * Runs idempotent seeds when DBX_SEED_ON_BOOT=true
 */
const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

async function runSeeds() {
  try {
    // Check if seeding is enabled
    if (process.env.DBX_SEED_ON_BOOT !== 'true') {
      console.log('[SEED] DBX_SEED_ON_BOOT not set to true, skipping seeds');
      return;
    }

    console.log('[SEED] Starting boot-time seeding...');

    // Get database connection
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: process.env.NODE_ENV === 'production' ? {
          require: true,
          rejectUnauthorized: false
        } : false
      }
    });

    // Test connection
    await sequelize.authenticate();
    console.log('[SEED] Database connection established');

    // Get queryInterface
    const queryInterface = sequelize.getQueryInterface();

    // Load and run seed files
    const seedsDir = path.join(__dirname, '..', 'seeders');
    const seedFiles = fs.readdirSync(seedsDir)
      .filter(file => file.endsWith('.js'))
      .sort(); // Run in order

    for (const file of seedFiles) {
      // Only run admin-tokens seed
      if (!file.includes('admin-tokens')) {
        continue;
      }

      console.log(`[SEED] Running: ${file}`);
      const seedModule = require(path.join(seedsDir, file));
      
      if (seedModule.up) {
        await seedModule.up(queryInterface, Sequelize);
      }
    }

    console.log('[SEED] Boot-time seeding completed successfully');
    await sequelize.close();
  } catch (error) {
    console.error('[SEED] Error during boot-time seeding:', error);
    // Don't throw - allow server to start even if seeding fails
  }
}

module.exports = { runSeeds };

