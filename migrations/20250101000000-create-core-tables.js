'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🚀 [Core Tables] Creating core database tables...');
    
    try {
      // 1. Create roles table first (referenced by users)
      console.log('👥 [Core Tables] Creating roles table...');
      await queryInterface.createTable('roles', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        name: {
          type: Sequelize.STRING(255),
          allowNull: false,
          unique: true,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        permissions: {
          type: Sequelize.JSONB,
          defaultValue: {},
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      // Insert default roles
      await queryInterface.bulkInsert('roles', [
        {
          id: 1,
          name: 'admin',
          description: 'Administrator role with full access',
          permissions: JSON.stringify({ all: true }),
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          name: 'user',
          description: 'Regular user role',
          permissions: JSON.stringify({ basic: true }),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      // 2. Create users table
      console.log('👤 [Core Tables] Creating users table...');
      await queryInterface.createTable('users', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        username: {
          type: Sequelize.STRING(255),
          allowNull: false,
          unique: true,
        },
        email: {
          type: Sequelize.STRING(255),
          allowNull: false,
          unique: true,
        },
        password: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        first_name: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        last_name: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        profile_image: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        cover_image: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        bio: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        website: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        twitter: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        instagram: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        role_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 2,
          // Foreign key will be added by separate migration
        },
        status: {
          type: Sequelize.STRING(255),
          allowNull: false,
          defaultValue: 'active',
        },
        email_verified: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },
        verification_token: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        reset_password_token: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        reset_password_expires: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        xrp_wallet_address: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        xlm_wallet_address: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        xdc_wallet_address: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        solana_wallet_address: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        sanctions_checked: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      // 3. Create categories table (referenced by nft_collections)
      console.log('📂 [Core Tables] Creating categories table...');
      await queryInterface.createTable('categories', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        name: {
          type: Sequelize.STRING(255),
          allowNull: false,
          unique: true,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        icon: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      // Insert default categories
      await queryInterface.bulkInsert('categories', [
        {
          id: 1,
          name: 'Art',
          description: 'Digital art and creative works',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          name: 'Gaming',
          description: 'Gaming-related NFTs',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 3,
          name: 'Music',
          description: 'Music and audio NFTs',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      // 4. Create admins table (referenced by tokens)
      console.log('👨‍💼 [Core Tables] Creating admins table...');
      await queryInterface.createTable('admins', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        username: {
          type: Sequelize.STRING(255),
          allowNull: false,
          unique: true,
        },
        email: {
          type: Sequelize.STRING(255),
          allowNull: false,
          unique: true,
        },
        password: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        role: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'admin',
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      console.log('✅ [Core Tables] Core tables created successfully');
      
    } catch (error) {
      console.error('❌ [Core Tables] Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('↩️ [Core Tables] Rolling back core tables...');
    
    try {
      // Drop tables in reverse order (respecting foreign key dependencies)
      await queryInterface.dropTable('admins');
      await queryInterface.dropTable('categories');
      await queryInterface.dropTable('users');
      await queryInterface.dropTable('roles');
      
      console.log('✅ [Core Tables] Rollback completed');
      
    } catch (error) {
      console.error('❌ [Core Tables] Rollback failed:', error);
      throw error;
    }
  }
};

