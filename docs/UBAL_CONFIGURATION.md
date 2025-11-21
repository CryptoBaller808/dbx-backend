# UBAL (Unified Blockchain Abstraction Layer) Configuration Guide

## Overview

The Unified Blockchain Abstraction Layer (UBAL) provides a standardized interface for interacting with multiple blockchain networks. This guide explains how to configure and use UBAL in the DBX backend.

## Supported Blockchains

UBAL currently supports the following 4 blockchain networks:

| Blockchain | Symbol | Chain ID | Adapter Type | RPC Env Var |
|------------|--------|----------|--------------|-------------|
| XRP Ledger | XRP | xrpl | account | UBAL_XRP_RPC_URL |
| Stellar | XLM | stellar | account | UBAL_XLM_RPC_URL |
| XDC Network | XDC | xdc | evm | UBAL_XDC_RPC_URL |
| Bitcoin | BTC | bitcoin | utxo | UBAL_BTC_RPC_URL |

## Configuration Steps

### 1. Run Database Migrations

The blockchains table must exist before UBAL can initialize:

```bash
# On Railway or local environment
npx sequelize-cli db:migrate --url "$DATABASE_URL"
```

This will create the `blockchains` table with the proper schema.

### 2. Seed Blockchain Records

Populate the blockchains table with the 4 supported chains:

```bash
# On Railway or local environment
npx sequelize-cli db:seed:all --url "$DATABASE_URL"
```

This seeder is idempotent - safe to run multiple times without creating duplicates.

### 3. Configure Environment Variables

Set the RPC URLs for each blockchain network in your environment:

```bash
# XRP Ledger
UBAL_XRP_RPC_URL=wss://xrplcluster.com

# Stellar Network
UBAL_XLM_RPC_URL=https://horizon.stellar.org

# XDC Network
UBAL_XDC_RPC_URL=https://rpc.xinfin.network

# Bitcoin Network (optional - not fully implemented yet)
UBAL_BTC_RPC_URL=https://blockstream.info/api
```

**Important Notes:**
- RPC URLs are loaded **ONLY** from environment variables
- No RPC URLs are hardcoded in the codebase
- Missing RPC URLs will result in that chain being skipped (with warnings)
- The server will still start even if some chains are not configured

### 4. Optional: Disable Blockchain Initialization

If you need to temporarily disable blockchain initialization:

```bash
DBX_SKIP_CHAIN_INIT=true
```

## Error Handling & Graceful Degradation

UBAL implements graceful per-chain failure handling:

### Per-Chain Failure
If a single blockchain adapter fails to initialize:
- ❌ Error is logged with full details
- ⚠️ Warning is issued
- ✅ Other chains continue to initialize
- ✅ Server continues to start

### Missing RPC URL
If an RPC URL is not configured:
- ⚠️ Warning: "No RPC URL configured for [Chain Name]"
- ⚠️ Warning: "Please set [ENV_VAR_NAME] environment variable"
- ⚠️ Warning: "Skipping [chain] - chain will not be available"
- ✅ Other chains continue to initialize

### No Blockchains Configured
If no blockchain adapters are registered:
- ⚠️ Warning: "No blockchain adapters registered!"
- ⚠️ Checklist printed:
  1. Database contains blockchain records (run seeders)
  2. Environment variables are set (UBAL_*_RPC_URL)
  3. Blockchains are marked as active in database
- ✅ Server continues to start (blockchain features disabled)

### Missing Migrations/Seeders
If the blockchains table doesn't exist:
- ❌ Error: "Blockchains table does not exist"
- ❌ Error: "Please run migrations: npx sequelize-cli db:migrate"
- 🛑 Server initialization fails (expected behavior)

## Initialization Flow

1. **Check Environment** → Skip if `DBX_SKIP_CHAIN_INIT=true`
2. **Validate Database** → Ensure models are available
3. **Validate Blockchain Model** → Ensure model exists
4. **Check Table Existence** → Verify blockchains table exists
5. **Test Table Access** → Count records and verify accessibility
6. **Create Configuration Manager** → Initialize with Blockchain model
7. **Load from Database** → Fetch blockchain records
8. **Per-Chain Processing:**
   - Check if chain is active
   - Load RPC URL from environment variable
   - Skip if RPC URL missing (with warning)
   - Build adapter configuration
   - Initialize chain-specific adapter
   - Register adapter (XRP/Stellar/XDC/Bitcoin)
   - Handle errors gracefully
9. **Complete Initialization** → Log success with adapter count

## Adapter Types

### Account-Based Adapters
- **XRP Ledger (xrpl)**: Uses ripple-lib/xrpl.js
- **Stellar (stellar)**: Uses stellar-sdk

Account-based chains use account models instead of UTXOs.

### EVM Adapters
- **XDC Network (xdc)**: EVM-compatible, uses web3.js/ethers.js

EVM chains are Ethereum-compatible and support smart contracts.

### UTXO Adapters
- **Bitcoin (bitcoin)**: Uses UTXO model (not fully implemented yet)

UTXO chains use unspent transaction outputs instead of account balances.

## Verification

After configuration, verify UBAL initialization in the logs:

```
[Blockchain Services] 🚀 Initializing blockchain services with UBAL...
[Blockchain Services] 🔍 Checking blockchains table...
[Blockchain Services] ✅ Blockchains table accessible (4 records)
[Blockchain Services] 🔧 Creating configuration manager...
[Blockchain Services] 🔧 Creating adapter registry...
[Blockchain Registry] Loading blockchain configurations from database...
[Blockchain Registry] Loaded 4 configurations from database
[Blockchain Registry] 🔧 Configuring XRP Ledger with RPC from env: UBAL_XRP_RPC_URL
[Blockchain Registry] ✅ XRP adapter registered successfully
[Blockchain Registry] 🔧 Configuring Stellar with RPC from env: UBAL_XLM_RPC_URL
[Blockchain Registry] ✅ Stellar adapter registered successfully
[Blockchain Registry] 🔧 Configuring XDC with RPC from env: UBAL_XDC_RPC_URL
[Blockchain Registry] ✅ XDC adapter registered successfully
[Blockchain Registry] ✅ Successfully registered 3 blockchain adapters
[Blockchain Services] All services initialized successfully
```

## Troubleshooting

### Problem: "Blockchains table does not exist"
**Solution:** Run migrations
```bash
npx sequelize-cli db:migrate --url "$DATABASE_URL"
```

### Problem: "No blockchain records found in database"
**Solution:** Run seeders
```bash
npx sequelize-cli db:seed:all --url "$DATABASE_URL"
```

### Problem: "No RPC URL configured for [Chain]"
**Solution:** Set the appropriate environment variable
```bash
# Example for XRP
UBAL_XRP_RPC_URL=wss://xrplcluster.com
```

### Problem: "No blockchain adapters registered"
**Solution:** Check all three requirements:
1. Migrations have been run
2. Seeders have been run
3. Environment variables are set

### Problem: "Failed to register [Chain] adapter"
**Solution:** Check the error details in logs:
- Verify RPC URL is accessible
- Check network connectivity
- Verify adapter dependencies are installed

## Railway Deployment

When deploying to Railway, run these commands in order:

```bash
# 1. Run migrations
npx sequelize-cli db:migrate --url "$DATABASE_URL"

# 2. Run seeders
npx sequelize-cli db:seed:all --url "$DATABASE_URL"

# 3. Verify in Railway environment variables:
UBAL_XRP_RPC_URL=wss://xrplcluster.com
UBAL_XLM_RPC_URL=https://horizon.stellar.org
UBAL_XDC_RPC_URL=https://rpc.xinfin.network
UBAL_BTC_RPC_URL=https://blockstream.info/api

# 4. Restart the service
```

## Security Best Practices

1. **Never commit RPC URLs to git** - Always use environment variables
2. **Use production RPC endpoints** - Ensure reliability and uptime
3. **Monitor RPC usage** - Some providers have rate limits
4. **Rotate credentials** - If using authenticated RPC endpoints
5. **Use WSS for production** - Secure WebSocket connections

## Additional Resources

- [Enhanced Blockchain Adapter Documentation](./enhanced-blockchain-adapter.md)
- [Blockchain Abstraction Layer API](./blockchain-abstraction-layer-api.md)
- [Migration Guide](./migrations.md)
- [Seeder Guide](./seeders.md)

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Verify all configuration steps have been completed
3. Check Railway environment variables
4. Review this documentation
5. Contact the development team

---

**Last Updated:** November 20, 2025  
**Version:** 1.0.0
