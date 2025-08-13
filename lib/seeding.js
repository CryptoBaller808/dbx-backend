/**
 * Idempotent Seeding Logic
 * Safely creates roles and admin user with transaction support
 */

const bcrypt = require('bcrypt');

/**
 * Ensure roles exist in the database
 * @param {Object} sequelize - Sequelize instance
 * @param {Object} transaction - Database transaction (optional)
 * @returns {Object} Roles creation result
 */
async function ensureRoles(sequelize, transaction = null) {
  try {
    console.log('[SEED] Ensuring roles exist...');
    
    const roles = [
      { name: 'Admin', description: 'Administrator role with full access' },
      { name: 'User', description: 'Standard user role' }
    ];
    
    const results = [];
    
    for (const role of roles) {
      const [result] = await sequelize.query(`
        INSERT INTO roles (name, description, "createdAt", "updatedAt")
        VALUES (:name, :description, NOW(), NOW())
        ON CONFLICT (name) DO NOTHING
        RETURNING id, name;
      `, {
        replacements: role,
        type: sequelize.QueryTypes.SELECT,
        transaction
      });
      
      if (result) {
        console.log(`[SEED] Created role: ${result.name}`);
        results.push({ action: 'created', role: result.name });
      } else {
        // Role already exists, get its ID
        const [existing] = await sequelize.query(`
          SELECT id, name FROM roles WHERE name = :name;
        `, {
          replacements: { name: role.name },
          type: sequelize.QueryTypes.SELECT,
          transaction
        });
        
        if (existing) {
          console.log(`[SEED] Role already exists: ${existing.name}`);
          results.push({ action: 'exists', role: existing.name });
        }
      }
    }
    
    return { success: true, roles: results };
    
  } catch (error) {
    console.error('[SEED] Failed to ensure roles:', error.message);
    throw error;
  }
}

/**
 * Upsert admin user in the database
 * @param {Object} sequelize - Sequelize instance
 * @param {Object} transaction - Database transaction (optional)
 * @returns {Object} Admin user creation result
 */
async function upsertAdminUser(sequelize, transaction = null) {
  try {
    console.log('[SEED] Upserting admin user...');
    
    // Get admin credentials from environment
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@dbx.com';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe!123';
    
    // Get Admin role ID
    const [adminRole] = await sequelize.query(`
      SELECT id FROM roles WHERE name = 'Admin';
    `, {
      type: sequelize.QueryTypes.SELECT,
      transaction
    });
    
    if (!adminRole) {
      throw new Error('Admin role not found - ensure roles are created first');
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    
    // Extract username from email (part before @)
    const username = adminEmail.split('@')[0];
    
    // Upsert admin user
    const [result] = await sequelize.query(`
      INSERT INTO "Admins" (username, email, password_hash, role_id, "createdAt", "updatedAt")
      VALUES (:username, :email, :passwordHash, :roleId, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        role_id = EXCLUDED.role_id,
        "updatedAt" = NOW()
      RETURNING id, username, email;
    `, {
      replacements: {
        username,
        email: adminEmail,
        passwordHash,
        roleId: adminRole.id
      },
      type: sequelize.QueryTypes.SELECT,
      transaction
    });
    
    if (result) {
      console.log(`[SEED] Admin user upserted: ${result.email}`);
      return {
        success: true,
        admin: {
          id: result.id,
          username: result.username,
          email: result.email,
          action: 'upserted'
        }
      };
    } else {
      throw new Error('Failed to upsert admin user');
    }
    
  } catch (error) {
    console.error('[SEED] Failed to upsert admin user:', error.message);
    throw error;
  }
}

/**
 * Run complete seeding process (roles + admin user)
 * @param {Object} sequelize - Sequelize instance
 * @returns {Object} Seeding results
 */
async function runSeed(sequelize) {
  let transaction;
  
  try {
    console.log('[SEED] Starting idempotent seeding process...');
    
    if (!sequelize) {
      throw new Error('Sequelize instance is required');
    }
    
    // Start transaction
    transaction = await sequelize.transaction();
    
    // Ensure roles exist
    const rolesResult = await ensureRoles(sequelize, transaction);
    
    // Upsert admin user
    const adminResult = await upsertAdminUser(sequelize, transaction);
    
    // Commit transaction
    await transaction.commit();
    
    const summary = `Roles ensured (${rolesResult.roles.length}); Admin upserted: ${adminResult.admin.email}`;
    console.log(`[SEED] ${summary}`);
    
    return {
      success: true,
      summary,
      roles: rolesResult.roles,
      admin: adminResult.admin
    };
    
  } catch (error) {
    // Rollback transaction on error
    if (transaction) {
      await transaction.rollback();
    }
    
    console.error('[SEED] Seeding process failed:', error.message);
    
    return {
      success: false,
      summary: `Seeding failed: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Check seeding status (roles and admin user existence)
 * @param {Object} sequelize - Sequelize instance
 * @returns {Object} Seeding status
 */
async function checkSeedStatus(sequelize) {
  try {
    if (!sequelize) {
      return { error: 'Sequelize instance not available' };
    }
    
    // Check roles
    const [rolesResult] = await sequelize.query(`
      SELECT name FROM roles WHERE name IN ('Admin', 'User') ORDER BY name;
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    const roles = {
      Admin: false,
      User: false
    };
    
    if (Array.isArray(rolesResult)) {
      rolesResult.forEach(role => {
        if (roles.hasOwnProperty(role.name)) {
          roles[role.name] = true;
        }
      });
    } else if (rolesResult && rolesResult.name) {
      if (roles.hasOwnProperty(rolesResult.name)) {
        roles[rolesResult.name] = true;
      }
    }
    
    // Check admin user
    const [adminResult] = await sequelize.query(`
      SELECT a.id, a.username, a.email, r.name as role_name
      FROM "Admins" a
      LEFT JOIN roles r ON a.role_id = r.id
      WHERE r.name = 'Admin'
      LIMIT 1;
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    const adminPresent = !!adminResult;
    const adminInfo = adminPresent ? {
      id: adminResult.id,
      username: adminResult.username,
      email: adminResult.email,
      role: adminResult.role_name
    } : null;
    
    return {
      roles,
      adminPresent,
      adminInfo,
      ready: roles.Admin && roles.User && adminPresent
    };
    
  } catch (error) {
    console.error('[SEED] Failed to check seed status:', error.message);
    return { error: error.message };
  }
}

module.exports = {
  runSeed,
  checkSeedStatus,
  ensureRoles,
  upsertAdminUser
};

