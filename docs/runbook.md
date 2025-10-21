# DBX Backend Operations Runbook

## Overview
This runbook covers essential operations for maintaining the DBX backend authentication system in production.

## JWT Secret Rotation

### When to Rotate
- Suspected compromise
- Scheduled rotation (recommended: every 90 days)
- Security incident response

### Steps
1. **Generate new secret**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

2. **Update Railway environment**:
   - Go to Railway Dashboard → dbx-backend service → Variables
   - Update `JWT_SECRET` with new value
   - Deploy will restart service automatically

3. **Verify rotation**:
   ```bash
   # Old tokens should return 401
   curl -H "Authorization: Bearer <old-token>" \
     https://dbx-backend-api-production-98f3.up.railway.app/admindashboard/auth/profile
   
   # New login should work
   curl -X POST -H "Content-Type: application/json" \
     -d '{"email":"admin@dbx.com","password":"<password>"}' \
     https://dbx-backend-api-production-98f3.up.railway.app/admindashboard/auth/login
   ```

### Zero-Downtime Rotation (Advanced)
For zero-downtime rotation, implement JWT key versioning:
1. Add `JWT_SECRET_V2` alongside `JWT_SECRET`
2. Update code to accept both keys for verification
3. Use new key for signing
4. After all old tokens expire, remove `JWT_SECRET`

## Diagnosing 503 Errors

### Common Causes
1. **Database connection pool exhausted**
2. **Database server unavailable**
3. **Network connectivity issues**
4. **Resource constraints (CPU/Memory)**

### Diagnostic Steps

1. **Check readiness endpoint**:
   ```bash
   curl https://dbx-backend-api-production-98f3.up.railway.app/diag/ready
   ```
   Look for:
   - `ready: false`
   - `dbAuthenticated: false`
   - `pool.waiting > 0`

2. **Check Railway logs**:
   - Look for database connection errors
   - Check for pool timeout messages
   - Monitor memory/CPU usage

3. **Database connectivity test**:
   ```bash
   # Check if database is responding
   curl https://dbx-backend-api-production-98f3.up.railway.app/health
   ```

### Resolution Steps
1. **Pool exhaustion**: Restart service to reset connections
2. **Database down**: Check database service status
3. **Resource constraints**: Scale up Railway service
4. **Network issues**: Check Railway network status

## Safe Admin Re-seeding

### When Needed
- Admin user accidentally deleted
- Password reset required
- Role corruption

### Script-Based Approach (Recommended)
Create a one-time migration script instead of using HTTP endpoints:

```javascript
// scripts/reseed-admin.js
const { sequelize } = require('../models');
const bcrypt = require('bcrypt');

async function reseedAdmin() {
  try {
    // Find or create Admin role
    const [adminRole] = await sequelize.query(`
      INSERT INTO "Roles" (name, "createdAt", "updatedAt")
      VALUES ('Admin', NOW(), NOW())
      ON CONFLICT (name) DO UPDATE SET "updatedAt" = NOW()
      RETURNING id
    `);
    
    // Hash password
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    
    // Upsert admin user
    await sequelize.query(`
      INSERT INTO "Admins" (email, password, role_id, name, "createdAt", "updatedAt")
      VALUES (:email, :password, :roleId, 'Admin', NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET
        password = EXCLUDED.password,
        role_id = EXCLUDED.role_id,
        "updatedAt" = NOW()
    `, {
      replacements: {
        email: process.env.ADMIN_EMAIL,
        password: hashedPassword,
        roleId: adminRole.id
      }
    });
    
    console.log('✅ Admin user reseeded successfully');
  } catch (error) {
    console.error('❌ Reseed failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  reseedAdmin().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { reseedAdmin };
```

### Execution
```bash
# Set environment variables
export ADMIN_EMAIL="admin@dbx.com"
export ADMIN_PASSWORD="new-secure-password"

# Run script
node scripts/reseed-admin.js
```

## Rollback Procedures

### Application Rollback
1. **Via Railway Dashboard**:
   - Go to Deployments tab
   - Click "Redeploy" on previous stable deployment

2. **Via Git**:
   ```bash
   # Revert to previous commit
   git revert <commit-sha>
   git push origin new-branch-exchange-logic
   ```

### Database Rollback
1. **Backup first**:
   ```bash
   # Create backup before rollback
   pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql
   ```

2. **Migration rollback**:
   ```bash
   # Rollback last migration
   npx sequelize-cli db:migrate:undo
   
   # Rollback to specific migration
   npx sequelize-cli db:migrate:undo:all --to <migration-name>
   ```

### Emergency Procedures
1. **Service completely down**:
   - Check Railway service status
   - Verify database connectivity
   - Check environment variables
   - Review recent deployments

2. **Authentication broken**:
   - Verify JWT_SECRET is set
   - Check admin user exists in database
   - Test with fresh login credentials

## Monitoring & Alerts

### Key Metrics to Monitor
- Login success rate (should be >95%)
- Average login latency (should be <500ms)
- 401 error rate (spikes indicate attacks)
- 503 error rate (indicates service issues)
- Database pool waiting connections (should be 0)

### Health Check Endpoints
- `/health` - Basic service health
- `/diag/ready` - Detailed readiness with metrics
- `/diag/version` - Deployment verification

### Log Patterns to Alert On
```
# Authentication failures spike
[AUDIT] login-attempt | result:failed

# Database connection issues
[DB] Connection pool exhausted
[DB] Authentication failed

# Service errors
[ERROR] 503 Service Unavailable
[ERROR] Database connection timeout
```

## Security Considerations

### Production Environment Variables
**Required**:
- `JWT_SECRET` - Strong random string (64+ chars)

**Forbidden in Production**:
- `DEBUG_ENDPOINTS`
- `ALLOW_SEED_DIRECT`
- `SEED_WEB_KEY`
- `SEED_ADMIN_*`
- `RUN_*_ON_BOOT`

### Audit Logging
- All login attempts are logged with hashed emails
- No raw passwords or credentials in logs
- Request IDs for correlation with Railway logs

### Rate Limiting
- Login endpoint: 5 attempts per minute per IP
- Adjust in development only, keep strict in production

## Contact Information

### Escalation Path
1. **Application Issues**: Check Railway dashboard and logs
2. **Database Issues**: Check database service provider
3. **Security Incidents**: Rotate JWT secret immediately

### Useful Commands
```bash
# Check service health
curl https://dbx-backend-api-production-98f3.up.railway.app/health

# Test authentication flow
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"admin@dbx.com","password":"password"}' \
  https://dbx-backend-api-production-98f3.up.railway.app/admindashboard/auth/login

# Check readiness with metrics
curl https://dbx-backend-api-production-98f3.up.railway.app/diag/ready
```

