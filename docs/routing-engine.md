# Smart Hybrid Liquidity Routing Engine

## Overview

The DBX Routing Engine implements intelligent, threshold-based liquidity routing across multiple blockchain networks and liquidity providers. It automatically selects the best execution venue(s) based on trade size, optimizing for price, liquidity depth, and settlement speed.

## Strategy

The engine uses a **Smart Hybrid** approach with three tiers:

### Tier 1: Small Trades (< $1,000)
**Strategy**: Best Effective Price  
**Goal**: Minimize total cost (fees + slippage)

For retail-sized trades, the router prioritizes the lowest all-in cost by comparing effective prices across all venues.

### Tier 2: Medium Trades ($1,000 - $25,000)
**Strategy**: Deepest Liquidity  
**Goal**: Minimize slippage and price impact

For institutional-sized trades, the router prioritizes venues with the highest liquidity scores to reduce market impact.

### Tier 3: Large Trades (> $25,000)
**Strategy**: Smart Split  
**Goal**: Distribute risk and maximize fill rate

For large trades, the router splits the order across the top 2 venues proportionally based on their liquidity scores.

## Providers

The engine queries 5 liquidity providers in parallel:

| Provider | Network | Type | Fee (bps) | Best For |
|----------|---------|------|-----------|----------|
| **XRPL GateHub** | XRPL | Institutional | 20 | Mid-size XRP trades |
| **XRPL Bitstamp** | XRPL | Institutional | 15 | Large XRP trades |
| **XRPL USDX** | XRPL | Retail | 25 | Small XRP trades |
| **Stellar USDC** | Stellar | Anchor | 10 | XLM/USDC pairs |
| **XDC USDT** | XDC Network | Wrapped | 30 | XDC-native assets |

## Configuration

### Environment Variables

```bash
# Enable/disable routing engine
ROUTING_ENGINE_V1=true

# Logging level: debug | info | warn
ROUTING_ENGINE_LOG=info

# Threshold for "large" trades (switches from best-price to deep-liquidity)
ROUTING_THRESHOLD_LARGE_USD=1000

# Threshold for split execution (switches from single to multi-venue)
ROUTING_THRESHOLD_SPLIT_USD=25000
```

### Feature Flag

The routing engine is **feature-flagged**. When disabled (`ROUTING_ENGINE_V1=false`), routing endpoints return:

```json
{
  "ok": false,
  "code": "ROUTING_DISABLED"
}
```

## API Endpoints

### GET /api/price/routing-quote

Get a routing recommendation for a specific trade.

**Query Parameters**:
- `base` (string, required): Base currency (e.g., `XRP`)
- `quote` (string, required): Quote currency (e.g., `USDT`)
- `amountUsd` (number, required): Trade size in USD
- `side` (string, required): `buy` or `sell`

**Example Request**:
```bash
curl "https://api.example.com/api/price/routing-quote?base=XRP&quote=USDT&amountUsd=500&side=buy"
```

**Example Response** (Small Trade):
```json
{
  "ok": true,
  "route": {
    "primary": "xrpl-usdx"
  },
  "chosen": {
    "price": 0.52,
    "feeBps": 25,
    "liquidityScore": 0.90,
    "estConfirmMs": 4500,
    "source": "xrpl-usdx",
    "totalCostBps": 35,
    "reason": "best-price"
  },
  "candidates": [
    {
      "price": 0.52,
      "feeBps": 25,
      "liquidityScore": 0.90,
      "estConfirmMs": 4500,
      "source": "xrpl-usdx"
    },
    {
      "price": 0.52,
      "feeBps": 20,
      "liquidityScore": 0.85,
      "estConfirmMs": 4000,
      "source": "xrpl-gatehub"
    }
  ],
  "policy": {
    "strategy": "smart-hybrid",
    "thresholds": {
      "large": 1000,
      "split": 25000
    }
  }
}
```

**Example Response** (Large Trade with Split):
```json
{
  "ok": true,
  "route": {
    "primary": "xrpl-bitstamp",
    "splits": [
      { "source": "xrpl-bitstamp", "pct": 55 },
      { "source": "xrpl-gatehub", "pct": 45 }
    ]
  },
  "chosen": {
    "price": 0.52,
    "feeBps": 17,
    "liquidityScore": 0.88,
    "estConfirmMs": 3700,
    "source": "split:xrpl-bitstamp/xrpl-gatehub",
    "reason": "smart-split"
  },
  "candidates": [...],
  "policy": {...}
}
```

### GET /api/price/quote (Enhanced)

The existing quote endpoint now accepts optional routing parameters:

**Query Parameters**:
- `pair` (string, required): Trading pair (e.g., `XRPUSDT`, `XRP-USDT`)
- `amountUsd` (number, optional): Trade size for routing
- `side` (string, optional): `buy` or `sell`

**Example Request**:
```bash
curl "https://api.example.com/api/price/quote?pair=XRP-USDT&amountUsd=1500&side=buy"
```

**Example Response**:
```json
{
  "price": 0.52,
  "base": "XRP",
  "quote": "USDT",
  "source": "binance",
  "ts": 1762500000000,
  "routing": {
    "ok": true,
    "route": {...},
    "chosen": {...}
  }
}
```

## Admin Endpoints

### GET /api/admin/routing/last

Get recent routing decisions for monitoring.

**Query Parameters**:
- `limit` (number, optional, default: 50): Number of decisions to return

**Example Request**:
```bash
curl "https://api.example.com/api/admin/routing/last?limit=10"
```

**Example Response**:
```json
{
  "ok": true,
  "count": 10,
  "decisions": [
    {
      "timestamp": "2025-11-07T10:30:45.123Z",
      "base": "XRP",
      "quote": "USDT",
      "amountUsd": 1500,
      "side": "buy",
      "chosenSource": "xrpl-bitstamp",
      "price": 0.52,
      "feeBps": 15,
      "liquidityScore": 0.95,
      "estConfirmMs": 3500,
      "split": false,
      "elapsedMs": 45
    }
  ]
}
```

### GET /api/admin/routing/config

Get current routing engine configuration.

**Example Response**:
```json
{
  "ok": true,
  "config": {
    "enabled": true,
    "logLevel": "info",
    "thresholds": {
      "large": 1000,
      "split": 25000
    }
  }
}
```

## Logging

When `ROUTING_ENGINE_LOG` is set to `debug` or `info`, the router logs each decision:

```
[routing] XRP/USDT buy amountUsd=500, picked=xrpl-usdx, price=0.520000, feeBps=25, liq=0.90, ms=42, split=false
[routing] XRP/USDT buy amountUsd=50000, picked=split:xrpl-bitstamp/xrpl-gatehub, price=0.520000, feeBps=17, liq=0.88, ms=51, split=true
```

## Decision Logic

The router uses the following metrics to evaluate candidates:

### Liquidity Score (0-1)
Estimated from orderbook depth and historical fill rates. Higher is better.

### Fee (basis points)
Venue-specific trading fee. Lower is better.

### Slippage (basis points)
Estimated as `(1 - liquidityScore) * 100`. Lower liquidity = higher slippage.

### Total Cost (basis points)
`feeBps + slippageBps`. Used for best-price comparison.

### Effective Price
Adjusted price including total cost:
- Buy: `price * (1 + totalCostBps / 10000)`
- Sell: `price * (1 - totalCostBps / 10000)`

## Testing

Run unit tests:
```bash
npm test -- routing
```

Test specific thresholds:
```bash
# Small trade (< $1k) - should pick best price
curl ".../routing-quote?base=XRP&quote=USDT&amountUsd=500&side=buy"

# Medium trade ($1k-$25k) - should pick deepest liquidity
curl ".../routing-quote?base=XRP&quote=USDT&amountUsd=1500&side=buy"

# Large trade (> $25k) - should split across top 2
curl ".../routing-quote?base=XRP&quote=USDT&amountUsd=50000&side=buy"
```

## Future Enhancements

- **Real-time orderbook integration** for live liquidity scores
- **Historical performance tracking** to refine provider rankings
- **Dynamic threshold adjustment** based on market conditions
- **Multi-hop routing** for exotic pairs
- **MEV protection** for large trades
- **Limit order routing** with time-in-force options

## Support

For questions or issues, contact the DBX engineering team or submit a ticket at https://help.manus.im.
