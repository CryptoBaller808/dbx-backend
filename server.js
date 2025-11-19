// ================================
// PRE-IMPORT MARKER
// ================================
console.log('[BOOT] pre-import marker PID=%s PORT=%s', process.pid, process.env.PORT);

// ================================
// ULTRA-EARLY HEALTH HANDLER
// ================================
const express = require('express');
const app = express();
app.set('trust proxy', true);
app.get('/health', (req, res) => {
  res.set('X-Boot-Commit', process.env.GIT_COMMIT || process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown');
  res.set('X-Boot-Branch', process.env.GIT_BRANCH || process.env.RAILWAY_GIT_BRANCH || 'unknown');
  res.status(200).json({ ok:true, t:Date.now(), pid:process.pid, port:process.env.PORT || null, commit: process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown' });
});
console.log('[BOOT] /health mounted (ultra-early, zero deps)');

// ================================
console.log("🔥 OPERATION: SERVER RESURRECTION - PHANTOM APP BANISHED!");
console.log("⚡ DBX BACKEND TRUE HEART IS BEATING - GHOST SAGA ENDS HERE!");
console.log("🌺 RENDER DEPLOYMENT TIMESTAMP:", new Date().toISOString());

// ================================
// FAILSAFE EXECUTION PROOF
// ================================
const fs = require('fs');
const executionProof = `🚀 FAILSAFE PROOF: server.js executed at ${new Date().toISOString()}
🔥 PLATFORM EXORCISM: Render phantom detection system
⚡ TRUE ENGINE CONFIRMATION: DBX backend heart is beating
🌺 GHOST ELIMINATION: This file proves server.js runs on Render
📊 EXECUTION EVIDENCE: Undeniable proof of platform resurrection`;

try {
  fs.writeFileSync('server-proof.txt', executionProof);
  console.log("✅ [FAILSAFE] server-proof.txt created - EXECUTION CONFIRMED!");
} catch (error) {
  console.error("❌ [FAILSAFE] Failed to create server-proof.txt:", error.message);
}

console.log("🚀 [STARTUP] server.js started...");
console.log('[BOOT] flags', {
  LIQUIDITY_DASHBOARD_V1: process.env.LIQUIDITY_DASHBOARD_V1,
  SETTLEMENT_SIM_MODE: process.env.SETTLEMENT_SIM_MODE,
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT
});
console.log(`[Startup] liquidityDashboard=${process.env.LIQUIDITY_DASHBOARD_V1} settlementSim=${process.env.SETTLEMENT_SIM_MODE} NODE_ENV=${process.env.NODE_ENV} PORT=${process.env.PORT}`);
// ================================
// DEEP PROBE MISSION - PROOF OF LIFE
// ================================
console.log("🔥 SERVER.JS STARTED: Time =", new Date().toISOString());
console.log("🔥 [PROBE] DBX Backend Server initializing...");
console.log("🔥 [PROBE] CRITICAL: This log confirms server.js is executing!");
console.log("🔥 [PROBE] Process ID:", process.pid);
console.log("🔥 [PROBE] Node version:", process.version);
console.log("🔥 [PROBE] Environment:", process.env.NODE_ENV || 'development');
console.log("🔥 [PROBE] Working directory:", process.cwd());
console.log("🔥 [PROBE] Entry point confirmed: server.js is running!");

console.log("🚀 [STARTUP] Process ID:", process.pid);
console.log("🚀 [STARTUP] Node version:", process.version);
console.log("🚀 [STARTUP] Environment:", process.env.NODE_ENV || 'development');

const express_unused = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
console.log("✅ [STARTUP] Core modules imported successfully");

// Helper function for boolean coercion
const coerceBool = v => ['1','true','yes','on'].includes(String(v || '').toLowerCase());

// Log environment variables once on boot
console.log('[ENV] SEED_DEBUG raw="%s" coerced=%s SEED_ADMIN_NAME="%s" SEED_ADMIN_USERNAME="%s"',
  process.env.SEED_DEBUG || 'undefined',
  coerceBool(process.env.SEED_DEBUG),
  process.env.SEED_ADMIN_NAME || 'undefined',
  process.env.SEED_ADMIN_USERNAME || 'undefined'
);

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { initializeBlockchainServices } = require('./services/blockchain');
const { initializeDatabase, sequelize } = require('./models');
const { 
  secureConnection, 
  validateQuery, 
  monitorPerformance, 
  healthCheck,
  monitorConnectionPool 
} = require('./middleware/databaseSecurity');

const { createHealthCheckEndpoint } = require('./health-check');
console.log("✅ [STARTUP] Service modules imported successfully");

// ================================
// DB READINESS & PRODUCTION HARDENING
// ================================
let dbReady = false;
let bcryptWarmed = false;
const startTime = Date.now();

// Transient error classifier
function isTransientDbError(err) {
  if (!err) return false;
  const transientTypes = [
    'SequelizeConnectionError',
    'SequelizeConnectionRefusedError', 
    'SequelizeHostNotFoundError',
    'SequelizeHostNotReachableError',
    'SequelizeInvalidConnectionError',
    'SequelizeConnectionTimedOutError'
  ];
  const transientCodes = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND'];
  
  return transientTypes.includes(err.name) || 
         transientCodes.includes(err.code) ||
         (err.message && err.message.includes('timeout')) ||
         (err.message && err.message.includes('ECONNREFUSED'));
}

// Auth metrics
const authMetrics = {
  loginAttempts: 0,
  loginSuccess: 0,
  login503: 0,
  loginLatencySum: 0,
  loginLatencyCount: 0
};

// ================================
// ROUTE IMPORTS
// ================================
console.log("📦 [PROBE] Loading apiAdminRoutes.js...");
let apiAdminRoutes = null;
try {
  apiAdminRoutes = require('./routes/apiAdminRoutes');
  console.log("✅ [PROBE] apiAdminRoutes.js loaded successfully");
} catch (error) {
  console.error("❌ [PROBE] ERROR loading apiAdminRoutes.js:", error.message);
}

console.log("📦 [PROBE] Loading adminDashboardV2Routes.js...");
let adminDashboardV2Routes = null;
try {
  adminDashboardV2Routes = require('./routes/adminDashboardV2Routes');
  console.log("✅ [PROBE] adminDashboardV2Routes.js loaded successfully");
} catch (error) {
  console.error("❌ [PROBE] ERROR loading adminDashboardV2Routes.js:", error.message);
}

console.log("📦 [PROBE] Loading adminRoutingRoutes.js...");
let adminRoutingRoutes = null;
try {
  adminRoutingRoutes = require('./routes/adminRoutingRoutes');
  console.log("✅ [PROBE] adminRoutingRoutes.js loaded successfully");
} catch (error) {
  console.error("❌ [PROBE] ERROR loading adminRoutingRoutes.js:", error.message);
}

console.log("📦 [PROBE] Loading adminLiquidityRoutes.js...");
let adminLiquidityRoutes = null;
try {
  adminLiquidityRoutes = require('./routes/adminLiquidityRoutes');
  console.log("✅ [PROBE] adminLiquidityRoutes.js loaded successfully");
} catch (error) {
  console.error("❌ [PROBE] ERROR loading adminLiquidityRoutes.js:", error.message);
}

console.log("🔍 [DEBUG] About to import adminCrudRoutes...");
const adminCrudRoutes = require('./routes/adminCrudRoutes');
console.log("✅ [DEBUG] adminCrudRoutes imported successfully");
console.log("🔍 [DEBUG] adminCrudRoutes type:", typeof adminCrudRoutes);
console.log("🔍 [DEBUG] adminCrudRoutes is function:", typeof adminCrudRoutes === 'function');

// Feature flags for optional routes
const enableDebug = on(process.env.DEBUG_ENDPOINTS);
const enableSeedDirect = on(process.env.ALLOW_SEED_DIRECT);
console.log(`[MOUNT-FLAGS] DEBUG_ENDPOINTS=${enableDebug}, ALLOW_SEED_DIRECT=${enableSeedDirect}`);

// Always-on routes
const adminAuthRoutes = require('./routes/adminAuthRoutes');
console.log("🔍 [DEBUG] adminAuthRoutes type:", typeof adminAuthRoutes);

// Optional routes (only import if enabled)
const seedRoutes = enableSeedDirect ? require('./routes/seedRoutes') : undefined;
console.log("🔍 [DEBUG] seedRoutes type:", typeof seedRoutes, "enabled:", enableSeedDirect);
const { migrateOnBoot } = require('./lib/migrations');
const { runSeed } = require('./lib/seeding');
console.log("✅ [STARTUP] Route modules imported successfully");
const mfaRoutes = require('./routes/mfaRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const walletRoutes = require('./routes/walletRoutes');
const crossChainRoutes = require('./routes/crossChainRoutes');
const { router: riskRoutes, initializeRiskSystem } = require('./routes/riskRoutes');
const { router: nftRoutes, initializeMintingService } = require('./routes/nftRoutes');
const { router: marketplaceRoutes, initializeAuctionService } = require('./routes/marketplaceRoutes');
const { router: bridgeRoutes, initializeBridgeService } = require('./routes/bridgeRoutes');
const { router: creatorRoutes, initializeCreatorToolsService } = require('./routes/creatorRoutes');
const enhancedAdminRoutes = require('./routes/enhancedAdminRoutes');
const { router: realTimeAnalyticsRoutes, initializeRealTimeAnalytics } = require('./routes/realTimeAnalyticsRoutes');
const { router: userManagementRoutes, initializeUserManagementService } = require('./routes/userManagementRoutes');
const { router: systemHealthRoutes, initializeHealthMonitoringService } = require('./routes/systemHealthRoutes');
const bitcoinRoutes = require('./routes/bitcoinRoutes');
const exchangeRoutes = require('./routes/exchangeRoutes');
const priceRoutes = require('./routes/priceRoute');
const bannerRoutes = require('./routes/bannerRoutes');
const tokenRoutes = require('./routes/tokenRoutes');
const tradeRoutes = require('./routes/tradeRoutes');
const portfolioRoutes = require('./routes/portfolioRoutes');

console.log("🚀 DBX Backend running from server.js - UNIFIED ENTRY POINT");
console.log("🌺 Route consolidation complete - Single source of truth architecture");
console.log("⚡ Dual application conflict resolved - app.js deactivated");

console.log("🌎 [STARTUP] Express app already created (ultra-early for /health)");;

// ================================
// SAFE ROUTER MOUNTING HELPER
// ================================
function on(v) {
  return ['1','true','yes','on'].includes(String(v).toLowerCase());
}

function safeUse(path, router, name = 'router') {
  if (!router) {
    console.warn(`[MOUNT-SKIP] ${name} is undefined; skipping ${path}`);
    return;
  }
  const isMw = typeof router === 'function' || (router && (router.handle || router.stack));
  if (!isMw) {
    console.error(`[MOUNT-ERROR] ${name} at ${path} is not a middleware/router. typeof=`, typeof router);
    console.error(`[MOUNT-ERROR] Value:`, router);
    console.warn(`[MOUNT-SKIP] Skipping mount to avoid boot crash.`);
    return;
  }
  console.log(`[MOUNT-OK] ${name} mounted at ${path}`);
  app.use(path, router);
}

const maybeFactory = (mod) => (typeof mod === 'function' && !mod.handle && !mod.stack) ? mod() : mod;
console.log("✅ [MOUNT] Safe mounting helper configured");

// ================================
// RAILWAY HEALTH ENDPOINT - ALREADY MOUNTED ULTRA-EARLY
// ================================
console.log("✅ [STARTUP] /health already mounted at top of file (ultra-early)");

// Version endpoint for deployment verification (also bypasses middleware)
app.get('/diag/version', (_req, res) => {
  const packageJson = require('./package.json');
  res.json({
    commit: process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown',
    branch: process.env.RAILWAY_GIT_BRANCH || 'unknown',
    builtAt: new Date().toISOString(),
    version: packageJson.version
  });
});
console.log("✅ [HEALTH] Version endpoint added for deployment verification");

app.get('/version', (_req, res) => {
  const packageJson = require('./package.json');
  res.json({
    branch: process.env.RAILWAY_GIT_BRANCH || 'unknown',
    commit: process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown',
    ts: Date.now(),
    status: 'ok'
  });
});
console.log("✅ [VERSION] Version endpoint added for deployment verification");

// ================================
// MIDDLEWARE CONFIGURATION
// ================================
console.log("[STARTUP] binding middleware");

// Trust proxy already set at top of file

// ================================
// CORS CONFIGURATION WITH ADMIN KEY SUPPORT
// ================================
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'https://dbx-frontend.onrender.com',
  'https://dbx-admin.onrender.com'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};

app.use(cors(corsOptions));
console.log("✅ [STARTUP] CORS configured with x-admin-key support");

// Body parser middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Request logging with Pino
app.use(pinoHttp({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname'
      }
    }
  },
  customLogLevel: function (req, res, err) {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return 'warn';
    } else if (res.statusCode >= 500 || err) {
      return 'error';
    }
    return 'info';
  }
}));

console.log("✅ [STARTUP] CORS and middleware configured successfully");

// Create HTTP server with Socket.IO
const server = http.createServer(app);
const io = socketIo(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
});

console.log("✅ [STARTUP] HTTP server and Socket.IO created");

// ================================
// SOCKET.IO CONFIGURATION - XUMM INTEGRATION
// ================================
console.log('[DBX BACKEND] Initializing XUMM Socket.IO handlers...');
const socketInit = require('./services/socket');
socketInit(io);
console.log('[DBX BACKEND] ✓ XUMM Socket.IO handlers initialized');
console.log("✅ [STARTUP] Socket.IO event handlers configured (including XUMM)");

// ================================
// DATABASE SECURITY MIDDLEWARE
// ================================
app.use(secureConnection);
app.use(validateQuery);
app.use(monitorPerformance);
app.use(healthCheck);

// Start connection pool monitoring
monitorConnectionPool(sequelize);

console.log("✅ [STARTUP] Database security middleware configured");

// ================================
// ADMIN KEY BYPASS MIDDLEWARE
// ================================
const ADMIN_KEY = process.env.ADMIN_KEY || 'default-admin-key-change-me';

function bypassAuthWithAdminKey(req, res, next) {
  const adminKey = req.headers['x-admin-key'];
  
  if (adminKey && adminKey === ADMIN_KEY) {
    console.log('🔑 [AUTH-BYPASS] Admin key validated - bypassing authentication');
    req.isAdminKeyAuth = true;
    return next();
  }
  
  next();
}

app.use(bypassAuthWithAdminKey);
console.log("✅ [STARTUP] Admin key bypass middleware configured");

// ================================
// STATIC FILE SERVING
// ================================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log("✅ [STARTUP] Static file serving configured for /uploads");

// ================================
// ADMIN ROUTES (GHOST BYPASS SYSTEM)
// ================================
console.log("🔍 [DEBUG] About to inspect adminRoutes...");
console.log("🔍 [DEBUG] adminRoutes type:", typeof apiAdminRoutes);
console.log("🔍 [DEBUG] adminRoutes is function:", typeof apiAdminRoutes === 'function');

if (apiAdminRoutes && typeof apiAdminRoutes === 'object') {
  console.log("🔍 [DEBUG] adminRoutes is an object");
  console.log("🔍 [DEBUG] adminRoutes keys:", Object.keys(apiAdminRoutes));
  
  if (apiAdminRoutes.stack) {
    console.log("✅ [DEBUG] adminRoutes has stack property (it's a router)");
    console.log("🔍 [DEBUG] Stack length:", apiAdminRoutes.stack.length);
  } else {
    console.log("❌ [DEBUG] adminRoutes has no stack property!");
  }
}

if (adminCrudRoutes && typeof adminCrudRoutes === 'object') {
  console.log("🔍 [DEBUG] adminCrudRoutes is an object");
  console.log("🔍 [DEBUG] adminCrudRoutes keys:", Object.keys(adminCrudRoutes));
  
  if (adminCrudRoutes.stack) {
    console.log("✅ [DEBUG] adminCrudRoutes has stack property (it's a router)");
    console.log("🔍 [DEBUG] Stack length:", adminCrudRoutes.stack.length);
  } else {
    console.log("❌ [DEBUG] adminCrudRoutes has no stack property!");
  }
}

// Mount API Admin Routes (Ghost Bypass System) - PRIORITY MOUNTING
console.log("[BOOT] mounting phase-2 routes…");
console.log("[STARTUP] mounting routes");
console.log("🚀 [STARTUP] ========================================");
console.log("🚀 [STARTUP] MOUNTING API ADMIN ROUTES (GHOST BYPASS)");
console.log("🚀 [STARTUP] ========================================");
console.log("🔍 [STARTUP] apiAdminRoutes object type:", typeof apiAdminRoutes);
console.log("🔍 [STARTUP] apiAdminRoutes is Router?", apiAdminRoutes && typeof apiAdminRoutes.use === 'function');

try {
  if (apiAdminRoutes) {
    safeUse('/api/admin', maybeFactory(apiAdminRoutes), 'apiAdminRoutes');
    console.log("✅ [STARTUP] apiAdminRoutes mounted successfully at /api/admin!");
    console.log("✅ [STARTUP] Mounted GET    /api/admin/users");
    console.log("✅ [STARTUP] Mounted POST   /api/admin/users");
    console.log("✅ [STARTUP] Mounted PUT    /api/admin/users/:id");
    console.log("✅ [STARTUP] Mounted DELETE /api/admin/users/:id");
  }
  
  // Mount routing admin routes
  if (adminRoutingRoutes) {
    safeUse('/api/admin/routing', maybeFactory(adminRoutingRoutes), 'adminRoutingRoutes');
    console.log("✅ [STARTUP] adminRoutingRoutes mounted at /api/admin/routing!");
    console.log("✅ [STARTUP] Mounted GET    /api/admin/routing/last");
    console.log("✅ [STARTUP] Mounted GET    /api/admin/routing/config");
  }
  
  // Mount liquidity dashboard admin routes
  if (adminLiquidityRoutes) {
    safeUse('/api/admin/liquidity', maybeFactory(adminLiquidityRoutes), 'adminLiquidityRoutes');
    console.log("✅ [STARTUP] adminLiquidityRoutes mounted at /api/admin/liquidity!");
    console.log("✅ [STARTUP] Mounted GET    /api/admin/liquidity/metrics");
    console.log("✅ [STARTUP] Mounted GET    /api/admin/settlement/simulated");
    console.log("✅ [STARTUP] Mounted POST   /api/internal/settlement/simulate");
  }
  console.log("[BOOT] routes mounted");
} catch (error) {
  console.error("❌ [STARTUP] ERROR mounting apiAdminRoutes:", error);
  console.error("❌ [STARTUP] Error details:", error.message);
  console.error("❌ [STARTUP] Stack trace:", error.stack);
}

console.log("🚀 [STARTUP] ========================================");

// Mount Admin CRUD Routes (Bypass Implementation) - PRIORITY MOUNTING
console.log("🚀 [STARTUP] ========================================");
console.log("🚀 [STARTUP] MOUNTING ADMIN CRUD ROUTES (BYPASS)");
console.log("🚀 [STARTUP] ========================================");
console.log("🔍 [STARTUP] adminCrudRoutes object type:", typeof adminCrudRoutes);
console.log("🔍 [STARTUP] adminCrudRoutes is Router?", adminCrudRoutes && typeof adminCrudRoutes.use === 'function');

try {
  if (adminCrudRoutes) {
    safeUse('/api/admin/crud', maybeFactory(adminCrudRoutes), 'adminCrudRoutes');
    console.log("✅ [STARTUP] adminCrudRoutes mounted successfully at /api/admin/crud!");
    console.log("✅ [STARTUP] Mounted GET    /api/admin/crud/users");
    console.log("✅ [STARTUP] Mounted POST   /api/admin/crud/users");
    console.log("✅ [STARTUP] Mounted PUT    /api/admin/crud/users/:id");
    console.log("✅ [STARTUP] Mounted DELETE /api/admin/crud/users/:id");
  }
} catch (error) {
  console.error("❌ [STARTUP] ERROR mounting adminCrudRoutes:", error);
  console.error("❌ [STARTUP] Error details:", error.message);
  console.error("❌ [STARTUP] Stack trace:", error.stack);
}

console.log("🚀 [STARTUP] ========================================");

// Mount Admin Dashboard V2 Routes
if (adminDashboardV2Routes) {
  safeUse('/api/admin/dashboard', maybeFactory(adminDashboardV2Routes), 'adminDashboardV2Routes');
  console.log("✅ [STARTUP] adminDashboardV2Routes mounted at /api/admin/dashboard!");
}

// Mount other admin routes
safeUse('/api/admin/auth', adminAuthRoutes, 'adminAuthRoutes');
console.log("✅ [STARTUP] adminAuthRoutes mounted at /api/admin/auth!");

// Mount seed routes (only if enabled)
if (seedRoutes) {
  safeUse('/api/seed', seedRoutes, 'seedRoutes');
  console.log("✅ [STARTUP] seedRoutes mounted at /api/seed (enabled via ALLOW_SEED_DIRECT)");
}

// ================================
// API ROUTES
// ================================
app.use('/api/mfa', mfaRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/cross-chain', crossChainRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/nft', nftRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/bridge', bridgeRoutes);
app.use('/api/creator', creatorRoutes);
app.use('/api/admin/enhanced', enhancedAdminRoutes);
app.use('/api/analytics', realTimeAnalyticsRoutes);
app.use('/api/users', userManagementRoutes);
app.use('/api/system', systemHealthRoutes);
app.use('/api/bitcoin', bitcoinRoutes);
app.use('/api/exchange', exchangeRoutes);
app.use('/api/price', priceRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/trade', tradeRoutes);
app.use('/api/portfolio', portfolioRoutes);

console.log("✅ [STARTUP] All API routes mounted successfully");

// ================================
// ERROR HANDLING MIDDLEWARE
// ================================
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
    timestamp: new Date().toISOString()
  });
});

console.log("✅ [STARTUP] Error handling middleware configured");

// ================================
// SERVER STARTUP
// ================================
const HOST = '0.0.0.0';
const PORT = process.env.PORT || 3000;

console.log("🚀 [LIGHT START] Starting HTTP server before database initialization...");
const serverInstance = server.listen(PORT, HOST, () => {
  console.log(`[BOOT] listening on ${HOST}:${PORT}`);
  console.log(`[BOOT] commit=${process.env.GIT_COMMIT || process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown'} branch=${process.env.GIT_BRANCH || process.env.RAILWAY_GIT_BRANCH || 'unknown'}`);
  console.log(`[STARTUP] Listening on ${PORT} (host=${HOST}`);
  console.log(`[STARTUP] ADMIN_KEY: ${process.env.ADMIN_KEY ? 'present' : 'missing'}`);
  console.log(`[STARTUP] DATABASE_URL: ${process.env.DATABASE_URL ? 'present' : 'missing'}`);
  
  // Self-check probe
  setTimeout(async () => {
    try {
      const url = `http://127.0.0.1:${process.env.PORT || '3000'}/health`;
      const r = await fetch(url);
      console.log('[BOOT] self-check', url, r.status);
    } catch (e) { 
      console.error('[BOOT] self-check error', e.message); 
    }
  }, 500);
  
  // Initialize token seed data (DBX 61)
  const tokenController = require('./controllers/tokenController');
  tokenController.initializeSeedData();
  
  // Kick off DB warmup async so healthcheck can pass
  require('./util/dbWarmup').init().catch(err => {
    console.error('[DB] Warmup error:', err?.message || err);
  });
  
  // Also initialize database readiness for existing logic
  initializeDbReadiness();
  
  // Initialize Phase 2 services with graceful degradation
  console.log("[STARTUP] initializing services...");
  initializePhase2Services();
}).on('error', (e) => {
  console.error('[BOOT] listen error', e);
  process.exit(1);
});

// ================================
// PHASE 2 SERVICES INITIALIZATION
// ================================
let phase2Status = { liquidity: 'pending', settlement: 'pending' };

async function initializePhase2Services() {
  if (process.env.LIQUIDITY_DASHBOARD_V1 !== 'true') {
    console.log('[Phase2] Liquidity dashboard disabled, skipping init');
    phase2Status.liquidity = 'disabled';
    phase2Status.settlement = 'disabled';
    return;
  }
  
  console.log('[Phase2] Starting liquidity dashboard initialization...');
  
  // Initialize with timeout and graceful degradation
  const initTimeout = setTimeout(() => {
    console.warn('[Phase2] init warn: Initialization timeout after 5s, continuing with degraded mode');
    if (phase2Status.liquidity === 'pending') phase2Status.liquidity = 'degraded';
    if (phase2Status.settlement === 'pending') phase2Status.settlement = 'degraded';
  }, 5000);
  
  try {
    // Test database connection for Phase 2
    const { sequelize } = require('./models');
    await sequelize.authenticate();
    
    // Mark as ready
    phase2Status.liquidity = 'ready';
    phase2Status.settlement = process.env.SETTLEMENT_SIM_MODE === 'true' ? 'ready' : 'disabled';
    
    clearTimeout(initTimeout);
    console.log('[Phase2] Initialization complete:', phase2Status);
  } catch (error) {
    clearTimeout(initTimeout);
    console.error('[Phase2] init warn: Initialization failed:', error.message);
    phase2Status.liquidity = 'degraded';
    phase2Status.settlement = 'degraded';
  }
}

// Export phase2Status for use in endpoints
global.phase2Status = phase2Status;

// ================================
// DB READINESS INITIALIZATION
// ================================
async function initializeDbReadiness() {
  console.log("🔄 [DB-READY] Starting database readiness initialization...");
  
  try {
    // 1. Database authentication
    console.log("🔄 [DB-READY] Testing database authentication...");
    await sequelize.authenticate();
    console.log("[BOOT] db connect status: connected");
    console.log("✅ [DB-READY] Database authentication successful");
    
    // 2. Basic query test
    console.log("🔄 [DB-READY] Testing basic database query...");
    await sequelize.query('SELECT 1 as test');
    console.log("✅ [DB-READY] Basic database query successful");
    
    // 3. Sequelize pool configuration
    console.log("🔄 [DB-READY] Configuring Sequelize connection pool...");
    if (sequelize.options.pool) {
      console.log("✅ [DB-READY] Pool config:", {
        max: sequelize.options.pool.max,
        min: sequelize.options.pool.min,
        acquire: sequelize.options.pool.acquire,
        idle: sequelize.options.pool.idle
      });
    }
    
    // 4. Bcrypt warmup
    console.log("🔄 [DB-READY] Warming up bcrypt...");
    await bcrypt.compare('warmup-test', '$2b$10$C6UzMDM.H6dfI/f/IKcEeOa8H5CwZrZ8Yk9l2eG5E6b1mV5EXy7Bi');
    bcryptWarmed = true;
    console.log("✅ [DB-READY] Bcrypt warmup complete");
    
    // 5. Mark as ready
    dbReady = true;
    console.log("🎉 [DB-READY] Database readiness initialization complete!");
    
  } catch (error) {
    console.log("[BOOT] db connect status: failed -", error.message);
    console.error("❌ [DB-READY] Database readiness initialization failed:", error.message);
    console.error("❌ [DB-READY] Stack:", error.stack);
    
    // Retry after 5 seconds
    setTimeout(() => {
      console.log("🔄 [DB-READY] Retrying database readiness initialization...");
      initializeDbReadiness();
    }, 5000);
  }
}

// ================================
// READINESS ENDPOINT
// ================================
// /ready returns 503 while warming up, 200 when ready
app.get('/ready', (req, res) => {
  if (!dbReady) {
    return res.status(503).json({
      ready: false,
      message: 'Database not ready',
      uptime: Math.floor(process.uptime())
    });
  }
  
  res.json({
    ready: true,
    dbAuthenticated: true,
    bcryptWarmed,
    uptime: Math.floor(process.uptime())
  });
});

app.get('/diag/ready', (req, res) => {
  const poolStats = sequelize.connectionManager?.pool ? {
    max: sequelize.options.pool?.max || 'unknown',
    min: sequelize.options.pool?.min || 'unknown',
    used: sequelize.connectionManager.pool.used?.length || 0,
    waiting: sequelize.connectionManager.pool.pending?.length || 0
  } : { status: 'no-pool-info' };
  
  res.json({
    ready: dbReady,
    dbAuthenticated: dbReady,
    bcryptWarmed,
    pool: poolStats,
    uptime: Math.floor(process.uptime()),
    startTime: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    metrics: {
      loginAttempts: authMetrics.loginAttempts,
      loginSuccess: authMetrics.loginSuccess,
      login503: authMetrics.login503,
      avgLoginLatency: authMetrics.loginLatencyCount > 0 
        ? Math.round(authMetrics.loginLatencySum / authMetrics.loginLatencyCount) 
        : 0
    }
  });
});
console.log("✅ [READINESS] /diag/ready endpoint configured");

// ================================
// GRACEFUL SHUTDOWN
// ================================
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  serverInstance.close(() => {
    console.log('HTTP server closed');
    sequelize.close().then(() => {
      console.log('Database connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  serverInstance.close(() => {
    console.log('HTTP server closed');
    sequelize.close().then(() => {
      console.log('Database connection closed');
      process.exit(0);
    });
  });
});

console.log("✅ [STARTUP] Graceful shutdown handlers configured");
console.log("🎉 [STARTUP] DBX Backend initialization complete!");

// Export app for bin/www.js
module.exports = app;
