# Trade Quote Preview Mode

This document outlines the functionality of the trade quote preview mode, a feature designed to allow users to get indicative quotes for large trades without triggering balance or volume validation errors.

## Feature Flag

Preview mode is controlled by the following environment variable:

- `TRADE_QUOTE_PREVIEW_ENABLED`: Set to `true` to enable the preview mode functionality.

Additionally, a safety cap is in place, configured by:

- `TRADE_QUOTE_PREVIEW_MAX_NOTIONAL_USD`: The maximum notional value in USD allowed for a preview quote. Defaults to `500000`.

## Endpoint

`GET /api/trade/quote`

### Parameters

- `base`: The base currency of the trading pair.
- `quote`: The quote currency of the trading pair.
- `side`: The side of the trade (`buy` or `sell`).
- `amount`: The amount of the base currency to trade.
- `preview`: Set to `true` to activate preview mode.

### Behavior

When `TRADE_QUOTE_PREVIEW_ENABLED` is `true` and the `preview=true` parameter is included in the request, the endpoint will:

1.  **Skip Validation**: It will bypass all balance, position limit, and KYC checks.
2.  **Compute Indicative Quote**: It will calculate an indicative quote using the same pricing logic as a normal trade.
3.  **Enforce Safety Cap**: It will check if the notional value of the trade exceeds `TRADE_QUOTE_PREVIEW_MAX_NOTIONAL_USD`. If it does, it will return a `400 PREVIEW_LIMIT` error.
4.  **Return Preview Payload**: On success, it will return a `200 OK` response with a special payload indicating that the quote is a preview.

If `preview` is not set to `true`, the endpoint will behave exactly as it did before, with all validation checks in place.

### Responses

#### Successful Preview Quote (200 OK)

```json
{
  "ok": true,
  "mode": "preview",
  "price": 2.30,
  "base": "XRP",
  "quote": "USDT",
  "side": "buy",
  "amountBase": 60000,
  "notionalUsd": 138000,
  "routing": { ... },
  "chosen": { ... },
  "policy": { ... },
  "validation": {
    "preview": true,
    "skippedChecks": ["balance", "positionLimits", "kyc"],
    "capUsd": 500000
  },
  "ts": 1678886400000
}
```

#### Preview Cap Exceeded (400 Bad Request)

```json
{
  "ok": false,
  "code": "PREVIEW_LIMIT",
  "message": "Preview notional exceeds cap.",
  "details": {
    "capUsd": 500000,
    "notionalUsd": 600000
  }
}
```

#### Normal Validation Error (400 Bad Request)

When `preview` is not used and validation fails, the response remains the same:

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "Order exceeds available balance. Needed ≈ 138000 USDT, available 0 USDT.",
  "details": {
    "requiredQuote": 138000,
    "availableQuote": 0
  }
}
```

## cURL Examples

### Control: Normal Quote (Fails Validation)

```bash
curl -i "https://dbx-backend-api-production-98f3.up.railway.app/api/trade/quote?base=XRP&quote=USDT&side=buy&amount=60000"
```

### Preview Mode (Successful)

```bash
curl -i "https://dbx-backend-api-production-98f3.up.railway.app/api/trade/quote?base=XRP&quote=USDT&side=buy&amount=60000&preview=true"
```

### Preview Cap Test (Fails)

Assuming `TRADE_QUOTE_PREVIEW_MAX_NOTIONAL_USD` is set to `100000`:

```bash
curl -i "https://dbx-backend-api-production-98f3.up.railway.app/api/trade/quote?base=XRP&quote=USDT&side=buy&amount=60000&preview=true"
```
