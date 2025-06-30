'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Step 1: Pre-convert status to strings (if still boolean or any other type)
    console.log('🔄 [Migration] Step 1: Pre-converting status column to TEXT...');
    await queryInterface.sequelize.query(`
      ALTER TABLE "users"
      ALTER COLUMN "status" TYPE TEXT USING CASE
        WHEN "status" IS TRUE THEN 'active'
        WHEN "status" IS FALSE THEN 'inactive'
        WHEN "status"::text = 'true' THEN 'active'
        WHEN "status"::text = 'false' THEN 'inactive'
        WHEN "status"::text = '1' THEN 'active'
        WHEN "status"::text = '0' THEN 'inactive'
        ELSE COALESCE("status"::text, 'active')
      END;
    `);

    // Step 2: Create the ENUM type safely
    console.log('🔄 [Migration] Step 2: Creating ENUM type safely...');
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        CREATE TYPE "public"."enum_users_status" AS ENUM ('active', 'pending', 'suspended', 'banned', 'deleted');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END;
      $$;
    `);

    // Step 3: Convert status to ENUM
    console.log('🔄 [Migration] Step 3: Converting status column to ENUM...');
    await queryInterface.changeColumn('users', 'status', {
      type: Sequelize.ENUM('active', 'pending', 'suspended', 'banned', 'deleted'),
      allowNull: false,
      defaultValue: 'active'
    });

    // Verify the migration worked
    console.log('🔄 [Migration] Verifying migration...');
    const [verifyResults] = await queryInterface.sequelize.query(`
      SELECT COUNT(*) as count FROM "users" WHERE "status" = 'active';
    `);
    console.log(`✅ [Migration] Verification: Found ${verifyResults[0].count} users with 'active' status`);
  },

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

