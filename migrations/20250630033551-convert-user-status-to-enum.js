'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
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
  },

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
