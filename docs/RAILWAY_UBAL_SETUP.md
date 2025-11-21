# Railway UBAL Environment Setup

## Required Environment Variables for UBAL Activation

Add the following environment variables in Railway dashboard:

### 1. Navigate to Railway Dashboard
1. Go to https://railway.app/
2. Select your `dbx-backend` service
3. Click on "Variables" tab

### 2. Add UBAL RPC URLs

Add these **4 required** environment variables:

```bash
# XRP Ledger RPC URL
UBAL_XRP_RPC_URL=wss://xrplcluster.com

# Stellar Network RPC URL
UBAL_XLM_RPC_URL=https://horizon.stellar.org

# XDC Network RPC URL
UBAL_XDC_RPC_URL=https://rpc.xinfin.network

# Bitcoin Network RPC URL
UBAL_BTC_RPC_URL=https://blockstream.info/api
```

### 3. Verify Existing Variables

Ensure these are still set (should already exist):

```bash
# XUMM should remain disabled during UBAL activation
ENABLE_XUMM=false

# Database URL (should already be set by Railway)
DATABASE_URL=postgresql://...

# Other required variables
NODE_ENV=production
PORT=10000
JWT_SECRET=...
ENCRYPTION_KEY=...
FRONTEND_URL=...
```

### 4. Save and Deploy

1. Click "Add Variable" for each UBAL RPC URL
2. Railway will automatically trigger a redeploy
3. Monitor deployment logs for:
   - Migration execution
   - Seeder execution
   - UBAL initialization

### Expected Logs After Deployment

```
🚀 [Startup] Starting DBX Backend with migrations...
🔄 [Startup] Running database migrations...
✅ [Startup] Migration output:
   Sequelize CLI [Node: 18.x.x, CLI: 6.x.x]
   == 20251120000000-create-blockchains-table: migrating =======
   🔗 [Blockchains] Creating blockchains table...
   == 20251120000000-create-blockchains-table: migrated (0.123s)

🌱 [Startup] Running database seeders...
✅ [Startup] Seeder output:
   Sequelize CLI [Node: 18.x.x, CLI: 6.x.x]
   == 20251120000001-seed-blockchains: migrating =======
   🌱 [Blockchains Seeder] Seeding blockchains...
   == 20251120000001-seed-blockchains: migrated (0.234s)

🚀 [Startup] Starting server...
═══════════════════════════════════════════════════════════
🚀 SERVER.JS IS RUNNING ON RENDER - THIS IS THE TRUE ENGINE
[DBX BACKEND] Crash detectors installed
...
[UBAL] Initializing blockchain adapters...
[UBAL] XRP adapter initialized
[UBAL] XLM adapter initialized
[UBAL] XDC adapter initialized
[UBAL] BTC adapter initialized
✅ [STARTUP] UBAL initialization complete
```

### Troubleshooting

#### If migrations fail:
- Check DATABASE_URL is set correctly
- Migrations are idempotent - safe to redeploy
- Check logs for specific error messages

#### If UBAL initialization fails:
- Verify all 4 UBAL_*_RPC_URL variables are set
- Check RPC URLs are accessible
- Warnings about unreachable RPCs are OK (will retry)
- Fatal errors will show in logs

#### If server won't start:
- Check for `[DBX BACKEND] UNCAUGHT EXCEPTION` in logs
- Verify DATABASE_URL is correct
- Check all required env vars are set

### Verification Commands

Once deployed, verify UBAL is active:

```bash
# Check health endpoint
curl https://your-backend.railway.app/health

# Check blockchains endpoint (if available)
curl https://your-backend.railway.app/api/blockchains

# Check logs in Railway dashboard
# Look for: [UBAL] XRP adapter initialized
```

### Rollback Plan

If UBAL causes issues:

1. Remove UBAL environment variables
2. Railway will redeploy
3. UBAL will skip initialization
4. Backend will run without UBAL

### Next Steps After UBAL Activation

1. ✅ Verify UBAL initialization in logs
2. ✅ Test blockchain endpoints
3. ✅ Monitor for errors
4. ⏳ Re-enable XUMM when ready (set `ENABLE_XUMM=true`)

---

**Created**: November 13, 2024  
**For**: UBAL Activation on Railway  
**Status**: Ready for deployment
