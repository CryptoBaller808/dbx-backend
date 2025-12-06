# Stage 6: Route Execution Configuration

## Environment Variables

### Required Variables

```bash
# XRPL Network Configuration
XRPL_NETWORK=testnet           # 'testnet' | 'mainnet'
TESTNET=wss://s.altnet.rippletest.net:51233  # XRPL Testnet WebSocket URL

# Execution Mode
XRPL_EXECUTION_MODE=demo       # 'demo' | 'disabled' | 'production'
```

### Demo Wallet Configuration (Testnet Only)

```bash
# Demo Source Wallet (sends XRP)
DEMO_XRPL_SOURCE_ADDRESS=rN7n7otQDd6FczFgLdlqtyMVrn3z4zQnJa
DEMO_XRPL_SOURCE_SEED=sEd7VBbQbqGvZrXKjNQABxqGVJ8yjqG

# Demo Destination Wallet (receives XRP)
DEMO_XRPL_DEST_ADDRESS=rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY
DEMO_XRPL_DEST_SEED=sEd7VBbQbqGvZrXKjNQABxqGVJ8yjqG
```

**⚠️ IMPORTANT**: These are testnet demo wallets only. Never use real mainnet keys in environment variables.

## Execution Modes

### Demo Mode (`XRPL_EXECUTION_MODE=demo`)

- **Purpose**: Testing and development
- **Network**: XRPL Testnet only
- **Wallets**: Uses demo wallets from environment
- **Safety**: No real funds at risk
- **Behavior**: Executes real testnet transactions with demo wallets

### Disabled Mode (`XRPL_EXECUTION_MODE=disabled`)

- **Purpose**: Temporarily disable execution
- **Behavior**: Returns `EXECUTION_DISABLED` error for all execution requests
- **Use Case**: Maintenance, debugging, or temporary shutdown

### Production Mode (`XRPL_EXECUTION_MODE=production`)

- **Purpose**: Live mainnet execution (future)
- **Status**: **NOT IMPLEMENTED IN STAGE 6**
- **Behavior**: Returns `INVALID_EXECUTION_MODE` error in Stage 6
- **Future**: Will require user wallets, authentication, and real mainnet keys

## Configuration Examples

### Development (Local)

```bash
# .env.local
XRPL_NETWORK=testnet
TESTNET=wss://s.altnet.rippletest.net:51233
XRPL_EXECUTION_MODE=demo
DEMO_XRPL_SOURCE_ADDRESS=rN7n7otQDd6FczFgLdlqtyMVrn3z4zQnJa
DEMO_XRPL_SOURCE_SEED=sEd7VBbQbqGvZrXKjNQABxqGVJ8yjqG
DEMO_XRPL_DEST_ADDRESS=rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY
DEMO_XRPL_DEST_SEED=sEd7VBbQbqGvZrXKjNQABxqGVJ8yjqG
```

### Staging

```bash
# .env.staging
XRPL_NETWORK=testnet
TESTNET=wss://s.altnet.rippletest.net:51233
XRPL_EXECUTION_MODE=demo
# Use same demo wallets as development
```

### Production (Future)

```bash
# .env.production
XRPL_NETWORK=mainnet
TESTNET=wss://xrplcluster.com
XRPL_EXECUTION_MODE=production
# Will require different wallet management strategy
```

## Safety Checks

### Built-in Safety Features

1. **Execution Mode Validation**
   - Checks `XRPL_EXECUTION_MODE` before execution
   - Rejects production mode in Stage 6
   - Allows demo mode only

2. **Chain Validation**
   - Only XRPL routes are executed
   - Returns `UNSUPPORTED_CHAIN` for non-XRPL routes

3. **Path Type Validation**
   - Only supports: `direct`, `XRPL_AMM`, `XRPL_DEX`
   - Returns `UNSUPPORTED_PATH_TYPE` for other types

4. **Parameter Validation**
   - Validates required parameters (base, quote, amount)
   - Validates amount is positive number
   - Validates side is 'sell' or 'buy'

5. **Demo Wallet Isolation**
   - Uses dedicated demo wallets
   - Never touches user wallets in Stage 6
   - Testnet only

## Logging

### Structured Logging Format

All execution logs include:

```javascript
{
  timestamp: '2024-12-06T...',
  component: 'RouteExecution',
  action: 'execute',
  routeId: 'route_...',
  base: 'XRP',
  quote: 'USDT',
  amount: '10',
  side: 'sell',
  chain: 'XRPL',
  executionMode: 'demo',
  transactionHash: '...',
  ledgerIndex: 123456,
  executionTimeMs: 1234,
  status: 'success' | 'failed'
}
```

### Log Levels

- **INFO**: Normal execution flow
- **WARN**: Non-critical issues (e.g., unsupported chain)
- **ERROR**: Execution failures, transaction errors

### Example Logs

```
[RouteExecution] Initialized with execution mode: demo
[RouteExecution] Executing route: {base: 'XRP', quote: 'USDT', amount: '10', ...}
[RouteExecution] Route selected: {chain: 'XRPL', pathType: 'direct', ...}
[RouteExecution][XRPL] Executing XRPL route: {pathType: 'direct', amount: '10', ...}
[XRPLTransactionService] Connecting to XRPL...
[XRPLTransactionService] Transaction prepared: {TransactionType: 'Payment', ...}
[XRPLTransactionService] Transaction signed: ABC123...
[XRPLTransactionService] Transaction result: {hash: 'ABC123...', result: 'tesSUCCESS', ...}
[RouteExecution][XRPL] Transaction confirmed: {hash: 'ABC123...', ledgerIndex: 123456, ...}
```

## Monitoring

### Key Metrics to Monitor

1. **Execution Success Rate**
   - Track `success: true` vs `success: false` responses
   - Alert if success rate drops below 90%

2. **Execution Time**
   - Track `executionTimeMs` in responses
   - Alert if average exceeds 10 seconds

3. **Transaction Confirmation Time**
   - Track time from submission to ledger confirmation
   - Alert if exceeds 30 seconds

4. **Error Rates by Type**
   - Track `errorCode` distribution
   - Alert on unexpected error codes

5. **Chain Usage**
   - Track which chains are being executed
   - Should be 100% XRPL in Stage 6

### Monitoring Queries

```javascript
// Success rate (last hour)
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful,
  (SUM(CASE WHEN success = true THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as success_rate
FROM route_executions
WHERE timestamp > NOW() - INTERVAL '1 hour';

// Average execution time
SELECT AVG(executionTimeMs) as avg_ms
FROM route_executions
WHERE timestamp > NOW() - INTERVAL '1 hour'
  AND success = true;

// Error distribution
SELECT errorCode, COUNT(*) as count
FROM route_executions
WHERE timestamp > NOW() - INTERVAL '1 hour'
  AND success = false
GROUP BY errorCode
ORDER BY count DESC;
```

## Troubleshooting

### Common Issues

#### 1. "EXECUTION_DISABLED" Error

**Cause**: `XRPL_EXECUTION_MODE=disabled`

**Solution**: Set `XRPL_EXECUTION_MODE=demo` in environment

#### 2. "UNSUPPORTED_CHAIN" Error

**Cause**: Trying to execute non-XRPL route

**Solution**: Stage 6 only supports XRPL. Use XRPL pairs (XRP/USDT, etc.)

#### 3. "NO_ROUTE" Error

**Cause**: No valid route found for given parameters

**Solution**: Check liquidity configuration, verify token pair is supported

#### 4. "EXECUTION_FAILED" Error

**Cause**: XRPL transaction failed

**Solution**: 
- Check XRPL network connectivity
- Verify demo wallet has sufficient balance
- Check XRPL testnet status

#### 5. Transaction Timeout

**Cause**: XRPL network slow or unavailable

**Solution**:
- Check XRPL testnet status: https://xrpl.org/xrp-testnet-faucet.html
- Verify WebSocket URL is correct
- Increase timeout if needed

## Security Considerations

### Stage 6 Security

1. **Demo Wallets Only**
   - Never use real mainnet keys
   - Demo wallets are public testnet wallets
   - No real funds at risk

2. **No User Wallet Access**
   - Stage 6 doesn't touch user wallets
   - All transactions use demo wallets
   - User authentication not required yet

3. **Testnet Only**
   - All transactions on XRPL Testnet
   - No mainnet access in Stage 6
   - Mainnet requires future implementation

### Future Security (Production)

1. **User Wallet Integration**
   - Require user authentication
   - Use user's own XUMM wallet
   - Never store user seeds

2. **Transaction Signing**
   - Sign transactions client-side
   - Use XUMM payload flow
   - Backend only submits signed transactions

3. **Rate Limiting**
   - Limit executions per user
   - Prevent abuse
   - Monitor for suspicious activity

4. **Audit Logging**
   - Log all execution attempts
   - Track user actions
   - Enable forensic analysis

## Testing

### Manual Testing

```bash
# 1. Start backend
npm start

# 2. Run Stage 6 tests
node tests/stage6_route_execution_test.js

# 3. Manual API test
curl -X POST http://localhost:3001/api/routing/execute \
  -H "Content-Type: application/json" \
  -d '{
    "base": "XRP",
    "quote": "USDT",
    "amount": "10",
    "side": "sell",
    "fromChain": "XRPL",
    "toChain": "XRPL",
    "mode": "auto",
    "preview": true,
    "executionMode": "demo"
  }'
```

### Expected Test Results

- **Total Tests**: 8
- **Expected Pass Rate**: 100%
- **Expected Failures**: 0

### Test Coverage

- ✅ Happy-path XRPL execution
- ✅ Unsupported chain rejection
- ✅ Invalid parameters handling
- ✅ Missing parameters validation
- ✅ Invalid amount validation
- ✅ Invalid side validation
- ✅ Buy side execution
- ✅ Execution mode validation

## Deployment Checklist

### Pre-Deployment

- [ ] Set `XRPL_EXECUTION_MODE=demo`
- [ ] Set `XRPL_NETWORK=testnet`
- [ ] Configure demo wallet addresses
- [ ] Verify XRPL testnet connectivity
- [ ] Run Stage 6 test suite
- [ ] Verify all tests pass

### Post-Deployment

- [ ] Verify `/api/routing/execute` endpoint is accessible
- [ ] Test with curl or Postman
- [ ] Check logs for execution flow
- [ ] Monitor error rates
- [ ] Verify transactions on XRPL testnet explorer

### Rollback Plan

If issues arise:

1. Set `XRPL_EXECUTION_MODE=disabled`
2. Verify execution requests return `EXECUTION_DISABLED` error
3. Fix issues
4. Re-enable with `XRPL_EXECUTION_MODE=demo`

## Support

For issues or questions:

- Check logs for `[RouteExecution]` and `[XRPLTransactionService]` messages
- Verify environment variables are set correctly
- Run Stage 6 test suite to verify functionality
- Check XRPL testnet status if transactions fail
