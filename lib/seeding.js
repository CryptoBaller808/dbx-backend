/**
 * Dynamic schema probe and seeding utilities for Admins table
 * Handles any schema including required columns like name (NOT NULL, no default)
 */

const bcrypt = require('bcryptjs');

/**
 * Detect Admins table schema and build column mapping
 * @param {Object} sequelize - Sequelize instance
 * @returns {Object} Schema information and column mapping
 */
async function detectAdminsSchema(sequelize) {
  console.log('[SEED] Probing Admins table schema...');
  
  const rows = await sequelize.query(`
    SELECT column_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='Admins'
    ORDER BY column_name
  `, { type: sequelize.QueryTypes.SELECT });

  const cols = rows.map(r => r.column_name);
  const requiredNoDefault = rows
    .filter(r => r.is_nullable === 'NO' && r.column_default == null)
    .map(r => r.column_name);

  console.log('[SEED] Available Admins columns:', cols);
  console.log('[SEED] Required (no default):', requiredNoDefault);

  const has = n => cols.includes(n);
  const quote = n => /[A-Z]/.test(n) ? `"${n}"` : n;

  // Build column mapping with priority order
  const mapping = {
    password: has('password_hash') ? 'password_hash' : 
              (has('password') ? 'password' : 
              (has('passwordHash') ? '"passwordHash"' : null)),
    created: has('created_at') ? 'created_at' : 
             (has('createdAt') ? '"createdAt"' : null),
    updated: has('updated_at') ? 'updated_at' : 
             (has('updatedAt') ? '"updatedAt"' : null),
    hasUsername: has('username'),
    nameRequired: has('name') && requiredNoDefault.includes('name'),
  };

  console.log('[SEED] Column mapping:', mapping);

  // Validate required columns exist
  if (!mapping.password) {
    throw new Error(`[SEED] No password column found. Available: ${cols.join(', ')}. Expected: password_hash, password, or passwordHash`);
  }
  if (!mapping.created || !mapping.updated) {
    throw new Error(`[SEED] Missing timestamp columns. Available: ${cols.join(', ')}. Expected: created_at/createdAt and updated_at/updatedAt`);
  }

  return { cols, requiredNoDefault, mapping, quote };
}

/**
 * Build values object for admin user upsert
 * @param {Object} options - Configuration options
 * @returns {Object} Values for UPDATE and INSERT operations
 */
function buildAdminValues({ mapping, email, passwordHash, roleId }) {
  console.log('[SEED] Building admin user values...');
  
  const nameValue = process.env.SEED_ADMIN_NAME || 'Admin';
  const usernameValue = process.env.SEED_ADMIN_USERNAME || 'admin';

  // Base values for UPDATE
  const updateValues = {
    email,
    role_id: roleId,
    [mapping.password]: passwordHash,
    [mapping.updated]: 'NOW()',
  };

  // Additional values for INSERT (includes created timestamp)
  const insertValues = {
    ...updateValues,
    [mapping.created]: 'NOW()',
  };

  // Add optional columns if they exist
  if (mapping.hasUsername) {
    updateValues.username = usernameValue;
    insertValues.username = usernameValue;
  }

  if (mapping.nameRequired) {
    updateValues.name = nameValue;
    insertValues.name = nameValue;
    console.log('[SEED] Including required name column:', nameValue);
  }

  return { updateValues, insertValues };
}

/**
 * Validate that all required columns are covered
 * @param {Array} requiredNoDefault - Required columns with no default
 * @param {Object} insertValues - Values being inserted
 * @param {Object} mapping - Column mapping with timestamp info
 * @throws {Error} If any required columns are missing
 */
function validateRequiredColumns(requiredNoDefault, insertValues, mapping) {
  console.log('[SEED] Validating required columns coverage...');
  
  const providedColumns = new Set(Object.keys(insertValues));
  
  // Exclude timestamp columns that are covered by NOW() from required check
  const timestampColumns = new Set();
  if (mapping.created) timestampColumns.add(mapping.created.replace(/"/g, ''));
  if (mapping.updated) timestampColumns.add(mapping.updated.replace(/"/g, ''));
  
  console.log('[SEED] Timestamp columns covered by NOW():', Array.from(timestampColumns));
  
  const missing = requiredNoDefault.filter(col => {
    // Column is covered if it's provided OR it's a timestamp column with NOW()
    return !providedColumns.has(col) && !timestampColumns.has(col);
  });
  
  if (missing.length > 0) {
    const suggestions = missing.map(col => {
      switch (col) {
        case 'name': return 'SEED_ADMIN_NAME';
        case 'username': return 'SEED_ADMIN_USERNAME';
        case 'first_name': return 'SEED_ADMIN_FIRST_NAME';
        case 'last_name': return 'SEED_ADMIN_LAST_NAME';
        default: return `SEED_ADMIN_${col.toUpperCase()}`;
      }
    });
    
    throw new Error(
      `[SEED] Admins table requires non-null columns with no defaults: ${missing.join(', ')}. ` +
      `Provide environment variables: ${suggestions.join(', ')} or add DB defaults for these columns.`
    );
  }
  
  console.log('[SEED] ✅ All required columns covered (including timestamps via NOW())');
}

/**
 * Build SQL queries for UPDATE and INSERT operations
 * @param {Object} options - Configuration options
 * @returns {Object} SQL queries and replacements
 */
function buildSqlQueries({ updateValues, insertValues, mapping }) {
  console.log('[SEED] Building SQL queries...');
  
  // Build UPDATE query
  const updateSetClauses = Object.keys(updateValues)
    .filter(key => key !== 'email') // Don't update email in WHERE clause
    .map(key => {
      const value = updateValues[key];
      return value === 'NOW()' ? `${key} = NOW()` : `${key} = :${key}`;
    });
  
  const updateSql = `
    UPDATE "Admins"
    SET ${updateSetClauses.join(', ')}
    WHERE email = :email
    RETURNING id, email;
  `;

  // Build INSERT query
  const insertColumns = Object.keys(insertValues);
  const insertPlaceholders = insertColumns.map(key => {
    const value = insertValues[key];
    return value === 'NOW()' ? 'NOW()' : `:${key}`;
  });
  
  const insertSql = `
    INSERT INTO "Admins" (${insertColumns.join(', ')})
    VALUES (${insertPlaceholders.join(', ')})
    RETURNING id, email;
  `;

  // Build replacements object (exclude NOW() values)
  const replacements = {};
  [...Object.keys(updateValues), ...Object.keys(insertValues)].forEach(key => {
    const value = updateValues[key] || insertValues[key];
    if (value !== 'NOW()') {
      replacements[key] = value;
    }
  });

  return { updateSql, insertSql, replacements };
}

/**
 * Comprehensive admin user seeding with dynamic schema adaptation
 * @param {Object} options - Configuration options
 * @returns {Object} Seeding result
 */
async function ensureRolesAndAdmin({ sequelize, email, plainPassword, roleName = 'Admin', transaction }) {
  console.log('[SEED] Starting comprehensive admin seeding...');
  
  try {
    // Step 1: Detect schema
    const { cols, requiredNoDefault, mapping } = await detectAdminsSchema(sequelize);
    
    // Step 2: Probe roles table schema for timestamp columns
    console.log('[SEED] Probing roles table schema...');
    const rolesRows = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='roles'
      ORDER BY column_name
    `, { type: sequelize.QueryTypes.SELECT });
    
    const rolesCols = rolesRows.map(r => r.column_name);
    const rolesHas = n => rolesCols.includes(n);
    
    // Determine timestamp column names for roles table
    const rolesCreated = rolesHas('created_at') ? 'created_at' : 
                        (rolesHas('createdAt') ? '"createdAt"' : 'created_at');
    const rolesUpdated = rolesHas('updated_at') ? 'updated_at' : 
                        (rolesHas('updatedAt') ? '"updatedAt"' : 'updated_at');
    
    console.log('[SEED] Roles table columns:', rolesCols);
    console.log('[SEED] Using timestamp columns:', { created: rolesCreated, updated: rolesUpdated });
    
    // Step 3: Upsert roles with detected schema
    console.log('[SEED] Upserting roles...');
    await sequelize.query(`
      INSERT INTO roles (name, description, ${rolesCreated}, ${rolesUpdated})
      VALUES ('Admin','Administrator role with full access', NOW(), NOW()),
             ('User','Standard user role', NOW(), NOW())
      ON CONFLICT (name) DO NOTHING;
    `, { transaction });
    
    console.log('[SEED] ✅ Roles upserted (Admin, User)');
    
    // Step 4: Get role ID
    console.log('[SEED] Fetching Admin role ID...');
    const [roleResults] = await sequelize.query(`
      SELECT id FROM roles WHERE name = :roleName LIMIT 1;
    `, {
      replacements: { roleName },
      transaction
    });
    
    if (!roleResults || roleResults.length === 0) {
      throw new Error(`[SEED] ${roleName} role not found after upsert`);
    }
    
    const roleId = roleResults[0].id;
    console.log('[SEED] Admin role ID:', roleId);
    
    // Step 5: Hash password
    console.log('[SEED] Hashing admin password...');
    const passwordHash = await bcrypt.hash(plainPassword, 12);
    console.log('[SEED] Password hashed successfully');
    
    // Step 6: Build values
    const { updateValues, insertValues } = buildAdminValues({
      mapping,
      email,
      passwordHash,
      roleId
    });
    
    // Step 7: Validate required columns
    validateRequiredColumns(requiredNoDefault, insertValues, mapping);
    
    // Step 8: Build SQL queries
    const { updateSql, insertSql, replacements } = buildSqlQueries({
      updateValues,
      insertValues,
      mapping
    });
    
    // Step 9: Execute UPDATE-then-INSERT pattern
    console.log('[SEED] Attempting UPDATE first...');
    
    const [updateResults] = await sequelize.query(updateSql, {
      replacements,
      transaction
    });
    
    let adminUser;
    
    if (updateResults && updateResults.length > 0) {
      // UPDATE succeeded
      adminUser = updateResults[0];
      console.log('[SEED] ✅ Admin user updated:', { id: adminUser.id, email: adminUser.email });
    } else {
      // UPDATE returned zero rows, do INSERT
      console.log('[SEED] No existing admin found, inserting new admin...');
      
      const [insertResults] = await sequelize.query(insertSql, {
        replacements,
        transaction
      });
      
      if (!insertResults || insertResults.length === 0) {
        throw new Error('[SEED] Admin user INSERT failed - no results returned');
      }
      
      adminUser = insertResults[0];
      console.log('[SEED] ✅ Admin user inserted:', { id: adminUser.id, email: adminUser.email });
    }
    
    console.log('[SEED] ✅ Admin user upserted successfully:', email);
    
    return {
      success: true,
      rolesUpserted: true,
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        role_id: roleId
      },
      schemaInfo: {
        availableColumns: cols,
        requiredNoDefault,
        columnMapping: mapping
      }
    };
    
  } catch (error) {
    console.error('[SEED] ❌ Admin seeding failed:', error.message);
    console.error('[SEED] Stack trace:', error.stack);
    
    // Attach schema context to error for debugging
    if (typeof cols !== 'undefined' && typeof mapping !== 'undefined') {
      error.schemaInfo = {
        availableColumns: cols,
        requiredNoDefault: requiredNoDefault || [],
        columnMapping: mapping
      };
    }
    
    throw error;
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
    const rolesResult = await sequelize.query(`
      SELECT 
        EXISTS(SELECT 1 FROM roles WHERE name = 'Admin') as admin_role_exists,
        EXISTS(SELECT 1 FROM roles WHERE name = 'User') as user_role_exists;
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    const roles = {
      Admin: (rolesResult[0] && rolesResult[0].admin_role_exists) || false,
      User: (rolesResult[0] && rolesResult[0].user_role_exists) || false
    };
    
    // Check if role_id column exists in Admins table
    const columnResult = await sequelize.query(`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Admins' AND column_name = 'role_id'
      ) as role_id_column_exists;
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    const roleIdColumnExists = (columnResult[0] && columnResult[0].role_id_column_exists) || false;
    
    // Check admin user existence with live query (no caching)
    let adminResult = null;
    let adminPresent = false;
    let adminInfo = null;
    
    try {
      if (roleIdColumnExists) {
        // Use JOIN query if role_id column exists - LIVE QUERY
        const adminQueryResult = await sequelize.query(`
          SELECT a.id, a.username, a.email, r.name as role_name
          FROM "Admins" a
          LEFT JOIN roles r ON a.role_id = r.id
          WHERE r.name = 'Admin'
          LIMIT 1;
        `, {
          type: sequelize.QueryTypes.SELECT
        });
        adminResult = adminQueryResult[0] || null;
      } else {
        // Fallback: just check if admin user exists (without role check) - LIVE QUERY
        const seedEmail = process.env.SEED_ADMIN_EMAIL || 'admin@dbx.com';
        const adminQueryResult = await sequelize.query(`
          SELECT id, username, email
          FROM "Admins"
          WHERE email = :seedEmail
          LIMIT 1;
        `, {
          replacements: { seedEmail },
          type: sequelize.QueryTypes.SELECT
        });
        
        adminResult = adminQueryResult[0] || null;
        if (adminResult) {
          adminResult.role_name = 'Admin'; // Assume admin role for existing user
        }
      }
      
      // Use EXISTS query for more accurate adminPresent check
      const adminExistsResult = await sequelize.query(`
        SELECT EXISTS(SELECT 1 FROM "Admins") AS admin_present;
      `, {
        type: sequelize.QueryTypes.SELECT
      });
      
      adminPresent = (adminExistsResult[0] && adminExistsResult[0].admin_present) || false;
      adminInfo = adminResult ? {
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

/**
 * Legacy compatibility wrapper for runSeed
 * @param {Object} sequelize - Sequelize instance
 * @returns {Object} Seeding results
 */
async function runSeed(sequelize) {
  let transaction;
  
  try {
    console.log('[SEED] Starting legacy compatibility seeding...');
    
    if (!sequelize) {
      throw new Error('Sequelize instance is required');
    }
    
    // Start transaction
    transaction = await sequelize.transaction();
    
    // Get admin credentials from environment
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@dbx.com';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe!123';
    
    // Use new comprehensive seeding function
    const result = await ensureRolesAndAdmin({
      sequelize,
      email: adminEmail,
      plainPassword: adminPassword,
      transaction
    });
    
    // Commit transaction
    await transaction.commit();
    
    const summary = `Roles ensured; Admin upserted: ${result.admin.email}`;
    console.log(`[SEED] ${summary}`);
    
    return {
      success: true,
      summary,
      roles: [
        { action: 'upserted', role: 'Admin' },
        { action: 'upserted', role: 'User' }
      ],
      admin: {
        id: result.admin.id,
        email: result.admin.email,
        action: 'upserted'
      }
    };
    
  } catch (error) {
    // Rollback transaction on error
    if (transaction) {
      await transaction.rollback();
    }
    
    console.error('[SEED] Legacy seeding process failed:', error.message);
    
    return {
      success: false,
      summary: `Seeding failed: ${error.message}`,
      error: error.message
    };
  }
}

module.exports = {
  detectAdminsSchema,
  buildAdminValues,
  validateRequiredColumns,
  buildSqlQueries,
  ensureRolesAndAdmin,
  runSeed,
  checkSeedStatus
};

