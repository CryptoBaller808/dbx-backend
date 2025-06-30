'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Step 1: Convert status column to TEXT, preserving existing values
    console.log('🔧 [Migration] Step 1: Converting status column to TEXT, preserving existing values...');
    await queryInterface.sequelize.query(`
      ALTER TABLE "users"
      ALTER COLUMN "status" TYPE TEXT
      USING CASE
        WHEN "status" IS TRUE THEN 'active'
        WHEN "status" IS FALSE THEN 'inactive'
        ELSE "status"
      END;
    `);

    // Step 2: Create ENUM (safely)
    console.log('🔧 [Migration] Step 2: Creating ENUM type safely...');
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        CREATE TYPE "public"."enum_users_status" AS ENUM ('active', 'pending', 'suspended', 'banned', 'deleted');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END;
      $$;
    `);

    // Step 3: Change column to use the ENUM
    console.log('🔧 [Migration] Step 3: Changing column to use the ENUM...');
    await queryInterface.sequelize.query(`
      ALTER TABLE "users"
      ALTER COLUMN "status" TYPE "public"."enum_users_status"
      USING ("status"::"public"."enum_users_status");
    `);

    // Step 4: Set NOT NULL and DEFAULT
    console.log('🔧 [Migration] Step 4: Setting NOT NULL and DEFAULT constraints...');
    await queryInterface.sequelize.query(`
      ALTER TABLE "users"
      ALTER COLUMN "status" SET NOT NULL,
      ALTER COLUMN "status" SET DEFAULT 'active';
    `);

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

