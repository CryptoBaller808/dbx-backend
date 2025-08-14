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
      try {
        // Try ON CONFLICT approach first (preferred when unique constraint exists)
        const [result] = await sequelize.query(`
          INSERT INTO roles (name, description, created_at, updated_at)
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
        
      } catch (onConflictError) {
        // Fallback: use WHERE NOT EXISTS (for missing unique constraints)
        console.warn(`[SEED] ON CONFLICT failed for role ${role.name}, using WHERE NOT EXISTS fallback:`, onConflictError.message);
        
        try {
          const [insertResult] = await sequelize.query(`
            INSERT INTO roles (name, description, created_at, updated_at)
            SELECT :name, :description, NOW(), NOW()
            WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = :name)
            RETURNING id, name;
          `, {
            replacements: role,
            type: sequelize.QueryTypes.SELECT,
            transaction
          });
          
          if (insertResult) {
            console.log(`[SEED] Created role (fallback): ${insertResult.name}`);
            results.push({ action: 'created_fallback', role: insertResult.name });
          } else {
            // Role already exists
            const [existing] = await sequelize.query(`
              SELECT id, name FROM roles WHERE name = :name;
            `, {
              replacements: { name: role.name },
              type: sequelize.QueryTypes.SELECT,
              transaction
            });
            
            if (existing) {
              console.log(`[SEED] Role already exists (fallback): ${existing.name}`);
              results.push({ action: 'exists_fallback', role: existing.name });
            }
          }
          
        } catch (fallbackError) {
          console.error(`[SEED] Both ON CONFLICT and WHERE NOT EXISTS failed for role ${role.name}:`, fallbackError.message);
          throw fallbackError;
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
    
    // Check if role_id column exists
    const [columnCheck] = await sequelize.query(`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Admins' AND column_name = 'role_id'
      ) as role_id_column_exists;
    `, {
      type: sequelize.QueryTypes.SELECT,
      transaction
    });
    
    const roleIdColumnExists = columnCheck.role_id_column_exists || false;
    
    let result;
    
    if (roleIdColumnExists) {
      // Use role_id if column exists
      console.log('[SEED] Using role_id column for admin user upsert');
      
      try {
        // Try ON CONFLICT approach first (preferred when unique constraint exists)
        [result] = await sequelize.query(`
          INSERT INTO "Admins" (username, email, password_hash, role_id, created_at, updated_at)
          VALUES (:username, :email, :passwordHash, :roleId, NOW(), NOW())
          ON CONFLICT (email) DO UPDATE SET
            password_hash = EXCLUDED.password_hash,
            role_id = EXCLUDED.role_id,
            updated_at = NOW()
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
        
      } catch (onConflictError) {
        // Fallback: UPDATE-then-INSERT pattern (for missing unique constraints)
        console.warn('[SEED] ON CONFLICT failed for admin user, using UPDATE-then-INSERT fallback:', onConflictError.message);
        
        // First, try to update existing admin
        const [updateResult] = await sequelize.query(`
          UPDATE "Admins" 
          SET password_hash = :passwordHash, role_id = :roleId, updated_at = NOW()
          WHERE email = :email
          RETURNING id, username, email;
        `, {
          replacements: {
            email: adminEmail,
            passwordHash,
            roleId: adminRole.id
          },
          type: sequelize.QueryTypes.SELECT,
          transaction
        });
        
        if (updateResult) {
          console.log(`[SEED] Updated existing admin user (fallback): ${updateResult.email}`);
          result = updateResult;
        } else {
          // No existing admin, insert new one
          [result] = await sequelize.query(`
            INSERT INTO "Admins" (username, email, password_hash, role_id, created_at, updated_at)
            VALUES (:username, :email, :passwordHash, :roleId, NOW(), NOW())
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
          
          console.log(`[SEED] Created new admin user (fallback): ${result.email}`);
        }
      }
      
    } else {
      // Fallback: create without role_id (for backward compatibility)
      console.log('[SEED] role_id column not found, creating admin user without role_id');
      
      try {
        // Try ON CONFLICT approach first
        [result] = await sequelize.query(`
          INSERT INTO "Admins" (username, email, password_hash, created_at, updated_at)
          VALUES (:username, :email, :passwordHash, NOW(), NOW())
          ON CONFLICT (email) DO UPDATE SET
            password_hash = EXCLUDED.password_hash,
            updated_at = NOW()
          RETURNING id, username, email;
        `, {
          replacements: {
            username,
            email: adminEmail,
            passwordHash
          },
          type: sequelize.QueryTypes.SELECT,
          transaction
        });
        
      } catch (onConflictError) {
        // Fallback: UPDATE-then-INSERT pattern (for missing unique constraints)
        console.warn('[SEED] ON CONFLICT failed for admin user (no role_id), using UPDATE-then-INSERT fallback:', onConflictError.message);
        
        // First, try to update existing admin
        const [updateResult] = await sequelize.query(`
          UPDATE "Admins" 
          SET password_hash = :passwordHash, updated_at = NOW()
          WHERE email = :email
          RETURNING id, username, email;
        `, {
          replacements: {
            email: adminEmail,
            passwordHash
          },
          type: sequelize.QueryTypes.SELECT,
          transaction
        });
        
        if (updateResult) {
          console.log(`[SEED] Updated existing admin user (no role_id fallback): ${updateResult.email}`);
          result = updateResult;
        } else {
          // No existing admin, insert new one
          [result] = await sequelize.query(`
            INSERT INTO "Admins" (username, email, password_hash, created_at, updated_at)
            VALUES (:username, :email, :passwordHash, NOW(), NOW())
            RETURNING id, username, email;
          `, {
            replacements: {
              username,
              email: adminEmail,
              passwordHash
            },
            type: sequelize.QueryTypes.SELECT,
            transaction
          });
          
          console.log(`[SEED] Created new admin user (no role_id fallback): ${result.email}`);
        }
      }
    }
    
    if (result) {
      console.log(`[SEED] Admin user upserted: ${result.email} (role_id column exists: ${roleIdColumnExists})`);
      return {
        success: true,
        admin: {
          id: result.id,
          username: result.username,
          email: result.email,
          action: 'upserted',
          hasRoleId: roleIdColumnExists
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
    
    // Check roles using EXISTS for robustness
    const [rolesCheck] = await sequelize.query(`
      SELECT 
        EXISTS(SELECT 1 FROM roles WHERE name = 'Admin') as admin_role_exists,
        EXISTS(SELECT 1 FROM roles WHERE name = 'User') as user_role_exists;
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    const roles = {
      Admin: rolesCheck.admin_role_exists || false,
      User: rolesCheck.user_role_exists || false
    };
    
    // Check if role_id column exists in Admins table
    const [columnCheck] = await sequelize.query(`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Admins' AND column_name = 'role_id'
      ) as role_id_column_exists;
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    const roleIdColumnExists = columnCheck.role_id_column_exists || false;
    
    // Check admin user existence (with fallback for missing role_id column)
    let adminResult = null;
    let adminPresent = false;
    let adminInfo = null;
    
    try {
      if (roleIdColumnExists) {
        // Use JOIN query if role_id column exists
        [adminResult] = await sequelize.query(`
          SELECT a.id, a.username, a.email, r.name as role_name
          FROM "Admins" a
          LEFT JOIN roles r ON a.role_id = r.id
          WHERE r.name = 'Admin'
          LIMIT 1;
        `, {
          type: sequelize.QueryTypes.SELECT
        });
      } else {
        // Fallback: just check if admin user exists (without role check)
        const seedEmail = process.env.SEED_ADMIN_EMAIL || 'admin@dbx.com';
        [adminResult] = await sequelize.query(`
          SELECT id, username, email
          FROM "Admins"
          WHERE email = :seedEmail
          LIMIT 1;
        `, {
          replacements: { seedEmail },
          type: sequelize.QueryTypes.SELECT
        });
        
        if (adminResult) {
          adminResult.role_name = 'Admin'; // Assume admin role for existing user
        }
      }
      
      adminPresent = !!adminResult;
      adminInfo = adminPresent ? {
        id: adminResult.id,
        username: adminResult.username,
        email: adminResult.email,
        role: adminResult.role_name || 'Unknown'
      } : null;
      
    } catch (adminCheckError) {
      console.warn('[SEED-CHECK] Admin user check failed:', adminCheckError.message);
      adminPresent = false;
      adminInfo = null;
    }
    
    return {
      roles,
      adminPresent,
      adminInfo,
      ready: roles.Admin && roles.User && adminPresent,
      metadata: {
        roleIdColumnExists,
        seedEmail: process.env.SEED_ADMIN_EMAIL || 'admin@dbx.com'
      }
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

