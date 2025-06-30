'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // First, create the ENUM type
    await queryInterface.sequelize.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_users_status') THEN
          CREATE TYPE enum_users_status AS ENUM('active', 'pending', 'suspended', 'banned', 'deleted');
        END IF;
      END $$;
    `);

    // Update existing boolean values to string equivalents
    await queryInterface.sequelize.query(`
      UPDATE users 
      SET status = CASE 
        WHEN status::boolean = true THEN 'active'::text
        WHEN status::boolean = false THEN 'suspended'::text
        ELSE 'active'::text
      END;
    `);

    // Change the column type to ENUM
    await queryInterface.changeColumn('users', 'status', {
      type: Sequelize.ENUM('active', 'pending', 'suspended', 'banned', 'deleted'),
      allowNull: false,
      defaultValue: 'active'
    });
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
      DROP TYPE IF EXISTS enum_users_status;
    `);
  }
};

