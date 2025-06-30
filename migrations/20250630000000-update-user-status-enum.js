'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Step 1: Temporarily convert status column to TEXT to avoid boolean casting error
    console.log('🔧 [Migration] Step 1: Temporarily converting status column to TEXT...');
    await queryInterface.sequelize.query(`ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT;`);
    await queryInterface.sequelize.query(`ALTER TABLE "users" ALTER COLUMN "status" DROP NOT NULL;`);
    await queryInterface.sequelize.query(`ALTER TABLE "users" ALTER COLUMN "status" TYPE TEXT;`);

    // Step 2: Safely create the ENUM type if it doesn't exist
    console.log('🔧 [Migration] Step 2: Safely creating ENUM type...');
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

    // Step 3: Convert the column to the ENUM using TEXT cast
    console.log('🔧 [Migration] Step 3: Converting column to ENUM using TEXT cast...');
    await queryInterface.sequelize.query(`
      ALTER TABLE "users"
          ALTER COLUMN "status"
          TYPE "public"."enum_users_status"
          USING ("status"::"public"."enum_users_status");
    `);

    // Step 4: Reapply constraints
    console.log('🔧 [Migration] Step 4: Reapplying constraints...');
    await queryInterface.sequelize.query(`ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'active';`);
    await queryInterface.sequelize.query(`ALTER TABLE "users" ALTER COLUMN "status" SET NOT NULL;`);

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

