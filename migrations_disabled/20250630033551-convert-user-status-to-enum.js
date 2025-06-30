'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 🛑 DISABLED: This legacy migration conflicts with the smart migration
    // 🛑 The smart migration (20250630070000-legacy-status-data-cleanup.js) handles this properly
    console.log('🛑 [DISABLED MIGRATION] This migration has been disabled to prevent conflicts');
    console.log('🛑 The smart migration handles BOOLEAN to ENUM conversion properly');
    return; // Exit early to prevent execution
    
    /* DISABLED CODE - CAUSES POSTGRESQL ERROR 22P02
    // Step 1: Create ENUM type (with try/catch logic in SQL to avoid conflict)
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_users_status') THEN
          CREATE TYPE "enum_users_status" AS ENUM ('active', 'pending', 'suspended', 'banned', 'deleted');
        END IF;
      END
      $$;
    `);

    // Step 2: Temporarily cast all current "status" values to text to avoid boolean casting error
    await queryInterface.sequelize.query(`
      ALTER TABLE "users"
      ALTER COLUMN "status" TYPE TEXT;
    `);

    // Step 3: Alter the "status" column to use the new ENUM type, casting from TEXT
    await queryInterface.sequelize.query(`
      ALTER TABLE "users"
      ALTER COLUMN "status" TYPE "enum_users_status" USING status::"enum_users_status";
    `);

    // Step 4: Set NOT NULL and DEFAULT 'active'
    await queryInterface.sequelize.query(`
      ALTER TABLE "users"
      ALTER COLUMN "status" SET DEFAULT 'active',
      ALTER COLUMN "status" SET NOT NULL;
    `);
    */

  down: async (queryInterface, Sequelize) => {
    // Optional: Reverse enum change back to TEXT if needed
    await queryInterface.sequelize.query(`
      ALTER TABLE "users"
      ALTER COLUMN "status" TYPE TEXT;
    `);

    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_users_status";
    `);
  }
};
