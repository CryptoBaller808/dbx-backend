# Admin Token Manager API - DBX 61

## Overview

The Admin Token Manager provides a complete CRUD API for managing tradeable tokens on the DBX Exchange. Admins can create, update, deactivate, and delete tokens, as well as upload token logos to Cloudinary.

## API Endpoints

### Public Endpoints (No Authentication)

#### GET /admin/tokens
List all tokens with optional filtering.

**Query Parameters:**
- `active` (optional): Filter by active status (`true` or `false`)

**Response:**
```json
[
  {
    "id": "uuid",
    "symbol": "BTC",
    "name": "Bitcoin",
    "decimals": 8,
    "chain": "BTC",
    "contract": null,
    "defaultQuote": "USDT",
    "active": true,
    "sort": 1,
    "priceProvider": "binance",
    "tvSymbol": "BTCUSDT",
    "logoUrl": "https://res.cloudinary.com/...",
    "createdAt": 1234567890,
    "updatedAt": 1234567890
  }
]
```

**Cache:** `Cache-Control: public, max-age=60`

**Example:**
```bash
curl https://dbx-backend-api-production-98f3.up.railway.app/admin/tokens?active=true
```

---

#### GET /admin/pairs
Get computed list of allowed trading pairs.

**Response:**
```json
[
  {
    "base": "BTC",
    "quote": "USDT",
    "baseToken": { /* full token object */ }
  }
]
```

**Cache:** `Cache-Control: public, max-age=60`

**Example:**
```bash
curl https://dbx-backend-api-production-98f3.up.railway.app/admin/pairs
```

---

### Admin Endpoints (Require X-Admin-Key Header)

#### POST /admin/token
Create a new token.

**Headers:**
- `X-Admin-Key`: Admin API key (matches `ADMIN_KEY` environment variable)
- `Content-Type`: `application/json`

**Request Body:**
```json
{
  "symbol": "TEST",
  "name": "Test Token",
  "decimals": 18,
  "chain": "ETH",
  "contract": "0x...",
  "defaultQuote": "USDT",
  "active": true,
  "sort": 10,
  "priceProvider": "binance",
  "tvSymbol": "TESTUSDT"
}
```

**Required Fields:**
- `symbol` (string, uppercase)
- `name` (string)
- `decimals` (number, 0-18)
- `chain` (string)
- `priceProvider` (string: `binance`, `coingecko`, `coincap`, `kucoin`, `dbx`)

**Optional Fields:**
- `contract` (string): Contract address for EVM tokens
- `defaultQuote` (string, default: `USDT`)
- `active` (boolean, default: `true`)
- `sort` (number, default: `999`)
- `tvSymbol` (string, default: `{SYMBOL}/USDT`)

**Response:** Created token object (201)

**Example:**
```bash
curl -X POST https://dbx-backend-api-production-98f3.up.railway.app/admin/token \
  -H "X-Admin-Key: your-admin-key" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "TEST",
    "name": "Test Token",
    "decimals": 18,
    "chain": "ETH",
    "priceProvider": "binance"
  }'
```

---

#### PUT /admin/token/:id
Update an existing token.

**Headers:**
- `X-Admin-Key`: Admin API key

**Request Body:** Same as POST (all fields optional)

**Response:** Updated token object (200)

**Example:**
```bash
curl -X PUT https://dbx-backend-api-production-98f3.up.railway.app/admin/token/uuid \
  -H "X-Admin-Key: your-admin-key" \
  -H "Content-Type: application/json" \
  -d '{"active": false}'
```

---

#### DELETE /admin/token/:id
Delete a token (soft delete by default).

**Headers:**
- `X-Admin-Key`: Admin API key

**Query Parameters:**
- `hard` (optional): Set to `true` for hard delete (removes from database and deletes logo from Cloudinary)

**Response:**
- Soft delete: Updated token object with `active: false` (200)
- Hard delete: `{"message": "Token deleted", "id": "uuid"}` (200)

**Example (Soft Delete):**
```bash
curl -X DELETE https://dbx-backend-api-production-98f3.up.railway.app/admin/token/uuid \
  -H "X-Admin-Key: your-admin-key"
```

**Example (Hard Delete):**
```bash
curl -X DELETE "https://dbx-backend-api-production-98f3.up.railway.app/admin/token/uuid?hard=true" \
  -H "X-Admin-Key: your-admin-key"
```

---

#### POST /admin/token/:id/logo
Upload or replace a token logo.

**Headers:**
- `X-Admin-Key`: Admin API key
- `Content-Type`: `multipart/form-data`

**Form Data:**
- `logo`: Image file (PNG, JPEG, WebP, SVG, ≤5MB)

**Response:**
```json
{
  "logoUrl": "https://res.cloudinary.com/...",
  "token": { /* updated token object */ }
}
```

**Cloudinary Configuration:**
- Folder: `dbx-token-logos`
- Transformation: 256x256, square crop, auto quality, auto format
- Variants: 64x64, 128x128, 256x256

**Example:**
```bash
curl -X POST https://dbx-backend-api-production-98f3.up.railway.app/admin/token/uuid/logo \
  -H "X-Admin-Key: your-admin-key" \
  -F "logo=@token-logo.png"
```

---

## Token Model

```typescript
interface Token {
  id: string;                    // UUID
  symbol: string;                // Uppercase, unique
  name: string;                  // Display name
  decimals: number;              // 0-18
  chain: string;                 // BTC, ETH, BSC, XRP, XDC, etc.
  contract: string | null;       // Contract address (if applicable)
  defaultQuote: string;          // Default quote currency (usually USDT)
  active: boolean;               // Visibility flag
  sort: number;                  // UI ordering
  priceProvider: string;         // binance, coingecko, coincap, kucoin, dbx
  tvSymbol: string;              // TradingView symbol (e.g., BTCUSDT)
  logoUrl: string | null;        // Cloudinary URL
  createdAt: number;             // Unix timestamp
  updatedAt: number;             // Unix timestamp
}
```

---

## Seed Data

The API initializes with 9 pre-configured tokens:

| Symbol | Name | Decimals | Chain | Provider |
| ------ | ---- | -------- | ----- | -------- |
| BTC | Bitcoin | 8 | BTC | binance |
| ETH | Ethereum | 18 | ETH | binance |
| XRP | Ripple | 6 | XRP | binance |
| XLM | Stellar | 7 | XLM | binance |
| MATIC | Polygon | 18 | MATIC | binance |
| BNB | BNB | 18 | BSC | binance |
| SOL | Solana | 9 | SOL | binance |
| AVAX | Avalanche | 18 | AVAX | binance |
| XDC | XDC Network | 18 | XDC | kucoin |

---

## CORS Configuration

The token API uses the same CORS configuration as the banner API:

**Allowed Origins:**
- `https://dbx-admin.onrender.com`
- `https://dbx-admin-staging.onrender.com`
- `https://dbx-frontend.onrender.com`
- `https://dbx-frontend-staging.onrender.com`

**Allowed Methods:**
- `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`

**Allowed Headers:**
- `Content-Type`, `Authorization`, `X-Admin-Key`, `x-admin-key`

**Preflight:**
- OPTIONS requests return `204 No Content`

---

## Environment Variables

```bash
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Admin Authentication
ADMIN_KEY=your-secure-admin-key
```

---

## How to Add a New Token

### Via API (cURL)

```bash
# 1. Create the token
curl -X POST https://dbx-backend-api-production-98f3.up.railway.app/admin/token \
  -H "X-Admin-Key: your-admin-key" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "NEWTOKEN",
    "name": "New Token",
    "decimals": 18,
    "chain": "ETH",
    "contract": "0x1234567890abcdef",
    "priceProvider": "binance",
    "sort": 100
  }'

# 2. Upload a logo (save the token ID from step 1)
curl -X POST https://dbx-backend-api-production-98f3.up.railway.app/admin/token/{token-id}/logo \
  -H "X-Admin-Key: your-admin-key" \
  -F "logo=@newtoken-logo.png"

# 3. Verify the token appears in the list
curl https://dbx-backend-api-production-98f3.up.railway.app/admin/tokens?active=true
```

### Via Admin Panel

1. Navigate to **Token Manager** in the admin panel
2. Click **Create Token**
3. Fill in the form:
   - Symbol (e.g., `NEWTOKEN`)
   - Name (e.g., `New Token`)
   - Chain (e.g., `ETH`)
   - Decimals (e.g., `18`)
   - Price Provider (e.g., `binance`)
   - Sort order (e.g., `100`)
4. Upload a logo (PNG, JPEG, WebP, SVG, ≤5MB)
5. Click **Save**
6. Token will appear in the Exchange and Swap pages

---

## Error Handling

All endpoints return JSON error responses:

```json
{
  "error": "Error message description"
}
```

**Common Status Codes:**
- `200`: Success
- `201`: Created
- `400`: Bad Request (validation error)
- `401`: Unauthorized (missing or invalid X-Admin-Key)
- `404`: Not Found
- `500`: Internal Server Error

---

## Testing

```bash
# Test public endpoints
curl https://dbx-backend-api-production-98f3.up.railway.app/admin/tokens
curl https://dbx-backend-api-production-98f3.up.railway.app/admin/pairs

# Test admin endpoints (requires X-Admin-Key)
curl -X POST https://dbx-backend-api-production-98f3.up.railway.app/admin/token \
  -H "X-Admin-Key: your-admin-key" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"TEST","name":"Test","decimals":18,"chain":"ETH","priceProvider":"binance"}'

# Test CORS preflight
curl -i -X OPTIONS https://dbx-backend-api-production-98f3.up.railway.app/admin/token \
  -H "Origin: https://dbx-admin.onrender.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: x-admin-key,content-type"
```

---

## Notes

- **Storage:** Currently uses in-memory storage (following the banner pattern). Data will be lost on server restart. Migrate to database for persistence.
- **Logo Storage:** Logos are stored in Cloudinary's `dbx-token-logos` folder with automatic optimization.
- **Soft Delete:** By default, DELETE sets `active: false`. Use `?hard=true` for permanent deletion.
- **Caching:** Public endpoints are cached for 60 seconds. Clear cache by waiting or restarting the server.
- **Price Providers:** Supported providers are `binance`, `coingecko`, `coincap`, `kucoin`, and `dbx`.

---

## Changelog

### DBX 61 (October 2025)
- Initial implementation of Admin Token Manager API
- CRUD endpoints for token management
- Cloudinary logo upload with automatic optimization
- Seed data with 9 pre-configured tokens
- CORS configuration matching banner API
- Cache headers for performance

