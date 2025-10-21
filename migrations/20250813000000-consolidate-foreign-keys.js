'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🚀 [FK Consolidation] Starting foreign key consolidation migration...');
    
    try {
      // Helper function to check if constraint exists
      const constraintExists = async (tableName, constraintName) => {
        const result = await queryInterface.sequelize.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.table_constraints 
            WHERE table_schema = 'public' 
            AND table_name = '${tableName}' 
            AND constraint_name = '${constraintName}'
          );
        `, { type: queryInterface.sequelize.QueryTypes.SELECT });
        return result[0].exists;
      };

      // Helper function to check if table exists
      const tableExists = async (tableName) => {
        const result = await queryInterface.sequelize.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '${tableName}'
          );
        `, { type: queryInterface.sequelize.QueryTypes.SELECT });
        return result[0].exists;
      };

      // Helper function to check if column exists
      const columnExists = async (tableName, columnName) => {
        const result = await queryInterface.sequelize.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = '${tableName}' 
            AND column_name = '${columnName}'
          );
        `, { type: queryInterface.sequelize.QueryTypes.SELECT });
        return result[0].exists;
      };

      // 1. Clean up duplicate role_id constraints
      console.log('🧹 [FK Consolidation] Cleaning up duplicate role_id constraints...');
      
      if (await tableExists('users')) {
        // Remove old constraints if they exist
        const oldConstraints = ['fk_role_id', 'fk_users_roles'];
        for (const constraintName of oldConstraints) {
          if (await constraintExists('users', constraintName)) {
            console.log(`🗑️ [FK Consolidation] Removing duplicate constraint: ${constraintName}`);
            await queryInterface.removeConstraint('users', constraintName);
          }
        }

        // Ensure role_id column exists with proper definition
        if (!(await columnExists('users', 'role_id'))) {
          console.log('📦 [FK Consolidation] Adding role_id column...');
          await queryInterface.addColumn('users', 'role_id', {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 2
          });
        } else {
          console.log('🔧 [FK Consolidation] Updating role_id column...');
          await queryInterface.changeColumn('users', 'role_id', {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 2
          });
        }

        // Add the consolidated foreign key constraint
        if (!(await constraintExists('users', 'fk_users_role_id'))) {
          console.log('🔗 [FK Consolidation] Adding consolidated users.role_id foreign key...');
          await queryInterface.addConstraint('users', {
            fields: ['role_id'],
            type: 'foreign key',
            name: 'fk_users_role_id',
            references: {
              table: 'roles',
              field: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
          });
        }
      }

      // 2. Fix NFT Collections foreign keys
      console.log('🎨 [FK Consolidation] Setting up NFT Collections foreign keys...');
      
      if (await tableExists('nft_collections')) {
        // creator_id foreign key
        if (!(await constraintExists('nft_collections', 'fk_nft_collections_creator_id'))) {
          console.log('🔗 [FK Consolidation] Adding nft_collections.creator_id foreign key...');
          await queryInterface.addConstraint('nft_collections', {
            fields: ['creator_id'],
            type: 'foreign key',
            name: 'fk_nft_collections_creator_id',
            references: {
              table: 'users',
              field: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          });
        }

        // category_id foreign key (if categories table exists)
        if (await tableExists('categories') && !(await constraintExists('nft_collections', 'fk_nft_collections_category_id'))) {
          console.log('🔗 [FK Consolidation] Adding nft_collections.category_id foreign key...');
          await queryInterface.addConstraint('nft_collections', {
            fields: ['category_id'],
            type: 'foreign key',
            name: 'fk_nft_collections_category_id',
            references: {
              table: 'categories',
              field: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
          });
        }
      }

      // 3. Fix Tokens foreign keys (if needed)
      console.log('🪙 [FK Consolidation] Setting up Tokens foreign keys...');
      
      if (await tableExists('tokens') && await tableExists('admins')) {
        // addedBy foreign key (if column exists)
        if (await columnExists('tokens', 'addedBy') && !(await constraintExists('tokens', 'fk_tokens_added_by'))) {
          console.log('🔗 [FK Consolidation] Adding tokens.addedBy foreign key...');
          await queryInterface.addConstraint('tokens', {
            fields: ['addedBy'],
            type: 'foreign key',
            name: 'fk_tokens_added_by',
            references: {
              table: 'admins',
              field: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
          });
        }
      }

      console.log('✅ [FK Consolidation] Foreign key consolidation completed successfully');
      
    } catch (error) {
      console.error('❌ [FK Consolidation] Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('↩️ [FK Consolidation] Rolling back foreign key consolidation...');
    
    try {
      // Remove consolidated constraints
      const constraintsToRemove = [
        { table: 'users', constraint: 'fk_users_role_id' },
        { table: 'nft_collections', constraint: 'fk_nft_collections_creator_id' },
        { table: 'nft_collections', constraint: 'fk_nft_collections_category_id' },
        { table: 'tokens', constraint: 'fk_tokens_added_by' }
      ];

      for (const { table, constraint } of constraintsToRemove) {
        try {
          await queryInterface.removeConstraint(table, constraint);
          console.log(`✅ [FK Consolidation] Removed constraint: ${table}.${constraint}`);
        } catch (error) {
          console.log(`ℹ️ [FK Consolidation] Constraint ${table}.${constraint} not found or already removed`);
        }
      }
      
      console.log('✅ [FK Consolidation] Rollback completed');
      
    } catch (error) {
      console.error('❌ [FK Consolidation] Rollback failed:', error);
      throw error;
    }
  }
};

