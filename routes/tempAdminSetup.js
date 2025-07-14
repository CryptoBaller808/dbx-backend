const express = require('express');
const router = express.Router();
const { Sequelize, DataTypes } = require('sequelize');

// Temporary endpoint to manually create admin user
router.post('/user/manualCreateAdmin', async (req, res) => {
  let sequelize;
  
  try {
    console.log('🔄 [TempAdmin] Starting manual admin creation...');
    
    // Create direct Sequelize connection
    sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      logging: console.log
    });
    
    console.log('🔄 [TempAdmin] Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ [TempAdmin] Database connection successful');
    
    // Define Role model
    const Role = sequelize.define('Role', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: DataTypes.STRING(255),
        unique: true,
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT
      },
      permissions: {
        type: DataTypes.JSONB,
        defaultValue: {}
      }
    }, {
      tableName: 'roles',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    });
    
    // Define User model
    const User = sequelize.define('User', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      username: {
        type: DataTypes.STRING(255),
        unique: true
      },
      email: {
        type: DataTypes.STRING(255),
        unique: true,
        allowNull: false
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      first_name: {
        type: DataTypes.STRING(255)
      },
      last_name: {
        type: DataTypes.STRING(255)
      },
      role_id: {
        type: DataTypes.INTEGER,
        references: {
          model: Role,
          key: 'id'
        }
      },
      status: {
        type: DataTypes.STRING(50),
        defaultValue: 'active'
      },
      email_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      }
    }, {
      tableName: 'users',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    });
    
    // Define associations
    User.belongsTo(Role, { foreignKey: 'role_id' });
    Role.hasMany(User, { foreignKey: 'role_id' });
    
    console.log('🔄 [TempAdmin] Syncing database tables...');
    await sequelize.sync({ alter: true });
    console.log('✅ [TempAdmin] Database tables synced successfully');
    
    // Create or find admin role
    console.log('🔄 [TempAdmin] Creating/finding admin role...');
    const [adminRole, roleCreated] = await Role.findOrCreate({
      where: { name: 'admin' },
      defaults: {
        name: 'admin',
        description: 'Administrator role with full access',
        permissions: { all: true }
      }
    });
    
    if (roleCreated) {
      console.log('✅ [TempAdmin] Admin role created with ID:', adminRole.id);
    } else {
      console.log('✅ [TempAdmin] Admin role found with ID:', adminRole.id);
    }
    
    // Create or find admin user
    console.log('🔄 [TempAdmin] Creating/finding admin user...');
    const [adminUser, userCreated] = await User.findOrCreate({
      where: { email: 'admin@dbx.com' },
      defaults: {
        username: 'admin',
        email: 'admin@dbx.com',
        password: '$2a$10$rOvHjHcw/c1q.Aq8Q2FdUeJ8H7ScqXxqWxG7tJ9kGqE8mNvZxQK4G',
        first_name: 'Admin',
        last_name: 'User',
        role_id: adminRole.id,
        status: 'active',
        email_verified: true
      }
    });
    
    if (userCreated) {
      console.log('✅ [TempAdmin] Admin user created successfully:');
      console.log('   ID:', adminUser.id);
      console.log('   Email:', adminUser.email);
      console.log('   Username:', adminUser.username);
      console.log('   Role ID:', adminUser.role_id);
    } else {
      console.log('✅ [TempAdmin] Admin user already exists with ID:', adminUser.id);
    }
    
    return res.json({
      success: true,
      message: 'Admin created',
      details: {
        role_created: roleCreated,
        user_created: userCreated,
        admin_id: adminUser.id,
        role_id: adminRole.id
      }
    });
    
  } catch (error) {
    console.error('❌ [TempAdmin] Error:', error);
    console.error('🔧 [TempAdmin] Error message:', error.message);
    console.error('📋 [TempAdmin] Stack trace:', error.stack);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to create admin',
      error: error.message,
      stack: error.stack
    });
  } finally {
    if (sequelize) {
      await sequelize.close();
      console.log('🔄 [TempAdmin] Database connection closed');
    }
  }
});

module.exports = router;

