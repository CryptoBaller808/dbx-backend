'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 🛑 DISABLED: This legacy migration conflicts with the smart migration
    // 🛑 The smart migration (20250630070000-legacy-status-data-cleanup.js) handles this properly
    console.log('🛑 [DISABLED MIGRATION] This migration has been disabled to prevent conflicts');
    console.log('🛑 The smart migration handles BOOLEAN to ENUM conversion properly');
    return; // Exit early to prevent execution
    
    /* DISABLED CODE - CAUSES POSTGRESQL ERROR 22P02
    // Drop constraints first
    console.log('🔧 [Migration] Step 1: Dropping constraints...');
    await queryInterface.sequelize.query(`ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT;`);
    await queryInterface.sequelize.query(`ALTER TABLE "users" ALTER COLUMN "status" DROP NOT NULL;`);

    // 🔧 Convert to TEXT
    console.log('🔧 [Migration] Step 2: Converting to TEXT...');
    await queryInterface.sequelize.query(`ALTER TABLE "users" ALTER COLUMN "status" TYPE TEXT;`);

    // Safely create enum type
    console.log('🔧 [Migration] Step 3: Creating ENUM type safely...');
    await queryInterface.sequelize.query(`
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

    // 🔄 Convert from TEXT to ENUM
    console.log('🔧 [Migration] Step 4: Converting from TEXT to ENUM...');
    await queryInterface.sequelize.query(`
      ALTER TABLE "users"
        ALTER COLUMN "status"
        TYPE "public"."enum_users_status"
        USING ("status"::"public"."enum_users_status");
    `);

    // Reapply constraints
    console.log('🔧 [Migration] Step 5: Reapplying constraints...');
    await queryInterface.sequelize.query(`ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'active';`);
    await queryInterface.sequelize.query(`ALTER TABLE "users" ALTER COLUMN "status" SET NOT NULL;`);

    // Verify the migration worked
    console.log('🔄 [Migration] Verifying migration...');
    const [verifyResults] = await queryInterface.sequelize.query(`
      SELECT COUNT(*) as count FROM "users" WHERE "status" = 'active';
    `);
    console.log(`✅ [Migration] Verification: Found ${verifyResults[0].count} users with 'active' status`);
    */

  async down(queryInterface, Sequelize) {
    // Revert back to boolean
    await queryInterface.changeColumn('users', 'status', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });

    // Drop the ENUM type
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "public"."enum_users_status";
    `);
  }
};

