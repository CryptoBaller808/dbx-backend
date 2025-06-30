#!/usr/bin/env node

/**
 * Standalone migration runner script
 * Usage: 
 *   node scripts/run-migrations.js        # Run pending migrations
 *   node scripts/run-migrations.js up     # Run pending migrations
 *   node scripts/run-migrations.js down   # Rollback last migration
 *   node scripts/run-migrations.js status # Show migration status
 */

const { Umzug, SequelizeStorage } = require('umzug');
const path = require('path');

// Initialize database connection
const db = require('../models');

async function runMigrations() {
  try {
    console.log('🔄 [Migration] Initializing migration runner...');
    
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

    const command = process.argv[2] || 'up';

    switch (command) {
      case 'up':
        console.log('🔄 [Migration] Running pending migrations...');
        const pendingMigrations = await umzug.pending();
        if (pendingMigrations.length > 0) {
          console.log(`📋 [Migration] Found ${pendingMigrations.length} pending migrations:`);
          pendingMigrations.forEach(migration => {
            console.log(`  - ${migration.name}`);
          });
          await umzug.up();
          console.log('✅ [Migration] All migrations completed successfully');
        } else {
          console.log('✅ [Migration] No pending migrations found');
        }
        break;

      case 'down':
        console.log('🔄 [Migration] Rolling back last migration...');
        const executedMigrations = await umzug.executed();
        if (executedMigrations.length > 0) {
          const lastMigration = executedMigrations[executedMigrations.length - 1];
          console.log(`📋 [Migration] Rolling back: ${lastMigration.name}`);
          await umzug.down({ to: lastMigration.name });
          console.log('✅ [Migration] Rollback completed successfully');
        } else {
          console.log('ℹ️ [Migration] No migrations to rollback');
        }
        break;

      case 'status':
        console.log('📋 [Migration] Migration status:');
        const executed = await umzug.executed();
        const pending = await umzug.pending();
        
        console.log(`\n✅ Executed migrations (${executed.length}):`);
        if (executed.length > 0) {
          executed.forEach(migration => {
            console.log(`  ✓ ${migration.name}`);
          });
        } else {
          console.log('  (none)');
        }
        
        console.log(`\n⏳ Pending migrations (${pending.length}):`);
        if (pending.length > 0) {
          pending.forEach(migration => {
            console.log(`  ○ ${migration.name}`);
          });
        } else {
          console.log('  (none)');
        }
        break;

      default:
        console.error('❌ [Migration] Invalid command. Use: up, down, or status');
        process.exit(1);
    }

    await db.sequelize.close();
    console.log('🔄 [Migration] Database connection closed');
    process.exit(0);

  } catch (error) {
    console.error('❌ [Migration] Migration failed:', error.message);
    console.error('❌ [Migration] Error details:', error);
    await db.sequelize.close();
    process.exit(1);
  }
}

// Run migrations
runMigrations();

