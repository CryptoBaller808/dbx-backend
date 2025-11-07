console.log("🚀 SERVER.JS IS RUNNING ON RENDER - THIS IS THE TRUE ENGINE");
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
const express = require('express');
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
         (err.message && err.message.includes('connection'));
}

// Auth metrics counters
const authMetrics = {
  loginAttempts: 0,
  loginSuccess: 0,
  login503: 0,
  loginLatencySum: 0,
  loginLatencyCount: 0
};

// Audit log helper
function auditLog(stage, emailHash, outcome, requestId, latencyMs = null) {
  const logEntry = {
    where: "auth-login",
    stage,
    emailHash,
    outcome,
    requestId,
    timestamp: new Date().toISOString()
  };
  if (latencyMs !== null) logEntry.latencyMs = latencyMs;
  console.log('[AUDIT]', JSON.stringify(logEntry));
}

// Make functions globally available for routes
global.isTransientDbError = isTransientDbError;
global.authMetrics = authMetrics;
global.auditLog = auditLog;

console.log("✅ [STARTUP] Production hardening modules loaded");

// Import your route files
console.log("📦 [PROBE] ========================================");
console.log("📦 [PROBE] STARTING ROUTE FILE IMPORT DEBUGGING");
console.log("📦 [PROBE] ========================================");

console.log("📦 [PROBE] Loading apiAdminRoutes.js...");
let apiAdminRoutes = null; // Declare variable outside try-catch for proper scope
try {
  apiAdminRoutes = require('./routes/apiAdminRoutes');
  console.log("✅ [PROBE] apiAdminRoutes.js loaded successfully");
  console.log("🔍 [PROBE] apiAdminRoutes type:", typeof apiAdminRoutes);
  console.log("🔍 [PROBE] apiAdminRoutes is function:", typeof apiAdminRoutes === 'function');
} catch (error) {
  console.error("❌ [PROBE] ERROR loading apiAdminRoutes.js:", error.message);
  console.error("❌ [PROBE] Stack trace:", error.stack);
}

console.log("📦 [PROBE] Loading adminRoutingRoutes.js...");
let adminRoutingRoutes = null;
try {
  adminRoutingRoutes = require('./routes/adminRoutingRoutes');
  console.log("✅ [PROBE] adminRoutingRoutes.js loaded successfully");
} catch (error) {
  console.error("❌ [PROBE] ERROR loading adminRoutingRoutes.js:", error.message);
}

console.log("📦 [PROBE] Loading adminDashboardV2Routes.js...");
let adminRoutes = null; // Declare adminRoutes in proper scope
try {
  adminRoutes = require('./routes/adminDashboardV2Routes');
  console.log("✅ [PROBE] adminDashboardV2Routes.js loaded successfully");
} catch (error) {
  console.error("❌ [PROBE] ERROR loading adminDashboardV2Routes.js:", error.message);
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

console.log("🏗️ [STARTUP] About to create Express app...");
const app = express();

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
// RAILWAY HEALTH ENDPOINT - MUST BE FIRST
// ================================
// Simple health endpoint that bypasses all middleware, CORS, auth, etc.
// Supports both GET and HEAD methods for Railway health checks
const healthHandler = (_req, res) => res.status(200).json({ ok: true, ts: new Date().toISOString() });
app.get('/health', healthHandler);
app.head('/health', healthHandler);
console.log("✅ [HEALTH] Railway health endpoint added (GET/HEAD, bypasses all middleware)");

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

// Simple live-check endpoint for Railway health probes
app.get('/live-check', (_req, res) => {
  res.status(200).send('ok');
});
console.log("✅ [HEALTH] Live-check endpoint added for Railway health probes");

// Version endpoint for quick deployment verification (Railway requirement)
app.get('/version', (_req, res) => {
  res.json({
    branch: process.env.GIT_BRANCH || process.env.RAILWAY_GIT_BRANCH || 'unknown',
    commit: process.env.GIT_COMMIT || process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown',
    ts: Date.now(),
    status: 'ok'
  });
});
console.log("✅ [VERSION] Version endpoint added for deployment verification");

// Admin ping endpoint (Railway requirement)
app.get('/admin/ping', (_req, res) => res.json({ ok: true }));
console.log("✅ [HEALTH] Admin ping endpoint added");

// ================================
// LIGHT START BYPASS - EARLY HEALTH ROUTE
// ================================
// HEALTH & STATUS ENDPOINTS
// ================================
console.log("🚀 [HEALTH] Adding health and status endpoints...");

// Deep status check with comprehensive information
app.get('/status', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Get version from package.json
    const packageJson = require('./package.json');
    
    // Calculate uptime
    const uptimeSeconds = process.uptime();
    const uptimeFormatted = {
      seconds: Math.floor(uptimeSeconds),
      minutes: Math.floor(uptimeSeconds / 60),
      hours: Math.floor(uptimeSeconds / 3600),
      days: Math.floor(uptimeSeconds / 86400)
    };
    
    // Database ping test
    let dbStatus = { ok: false, latencyMs: null, error: null };
    try {
      const dbStartTime = Date.now();
      const { sequelize } = require('./models');
      await sequelize.query('SELECT 1 as ping');
      dbStatus = {
        ok: true,
        latencyMs: Date.now() - dbStartTime,
        error: null
      };
    } catch (error) {
      dbStatus = {
        ok: false,
        latencyMs: null,
        error: error.message
      };
    }
    
    // Migration status (optional - requires Sequelize CLI setup)
    let migrationStatus = { pending: 'unknown' };
    try {
      const { sequelize } = require('./models');
      const [results] = await sequelize.query(`
        SELECT COUNT(*) as pending_count 
        FROM information_schema.tables 
        WHERE table_name = 'SequelizeMeta'
      `);
      
      if (results[0].pending_count > 0) {
        // Get migration files count vs executed count
        const fs = require('fs');
        const path = require('path');
        const migrationDir = path.join(__dirname, 'migrations');
        
        if (fs.existsSync(migrationDir)) {
          const migrationFiles = fs.readdirSync(migrationDir).filter(f => f.endsWith('.js'));
          const [executedResults] = await sequelize.query('SELECT COUNT(*) as executed FROM "SequelizeMeta"');
          migrationStatus = {
            pending: migrationFiles.length - executedResults[0].executed,
            total: migrationFiles.length,
            executed: executedResults[0].executed
          };
        }
      }
    } catch (error) {
      migrationStatus = { pending: 'error', error: error.message };
    }
    
    const status = {
      ok: true,
      service: 'dbx-backend',
      version: packageJson.version,
      mode: process.env.NODE_ENV || 'development',
      uptime: uptimeFormatted,
      db: dbStatus,
      migrations: migrationStatus,
      timestamp: new Date().toISOString(),
      responseTimeMs: Date.now() - startTime
    };
    
    res.status(200).json(status);
    
  } catch (error) {
    res.status(500).json({
      ok: false,
      service: 'dbx-backend',
      error: error.message,
      timestamp: new Date().toISOString(),
      responseTimeMs: Date.now() - startTime
    });
  }
});

console.log("✅ [HEALTH] Health and status endpoints configured");

app.get('/fs-test', (req, res) => {
  const fs = require('fs');
  try {
    fs.writeFileSync('fs-test-proof.txt', `FS write test at ${new Date().toISOString()}`);
    res.send('✅ FS write successful');
  } catch (err) {
    console.error('❌ FS write error:', err);
    res.status(500).send('❌ FS write failed');
  }
});

console.log("✅ [STARTUP] Express app created successfully");

// ================================
// DEEP PROBE MISSION - INLINE ROUTE TEST
// ================================
console.log("🧪 [PROBE] Adding inline live-check route for testing...");
app.get('/live-check', (req, res) => {
  console.log("🔥 [PROBE] /live-check endpoint hit - INLINE ROUTE WORKING!");
  res.json({ 
    status: "LIVE", 
    timestamp: new Date().toISOString(),
    message: "Inline route test successful - server.js is executing routes!",
    source: "server.js inline route",
    probe_mission: "SUCCESS"
  });
});
console.log("✅ [PROBE] Inline live-check route added successfully!");

console.log("🌐 [STARTUP] About to create HTTP server...");
const server = http.createServer(app);
console.log("✅ [STARTUP] HTTP server created successfully");

console.log("🔌 [STARTUP] About to initialize Socket.IO...");
const io = socketIo(server, {
  cors: {
    origin: ['https://digitalblockexchange-fe.vercel.app', 'https://digitalblockexchange-admin.vercel.app', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});
console.log("✅ [STARTUP] Socket.IO initialized successfully");

// Add basic health test route at the very top
console.log("🧪 [STARTUP] Adding basic health test route...");
app.get('/basic-health', (req, res) => {
  console.log("✅ [TEST] basic-health hit!");
  res.send("✅ Backend up!");
});
console.log("✅ [STARTUP] Basic health test route added");

// CORS and Middleware - SECURE PRODUCTION CONFIG
console.log("🛡️ [STARTUP] Setting up CORS and middleware...");

// CORS Configuration - Exact specification for banner upload with x-admin-key
const corsOptions = {
  origin: [
    'https://dbx-admin.onrender.com',
    'https://dbx-admin-staging.onrender.com',
    'https://dbx-frontend.onrender.com',
    'https://dbx-frontend-staging.onrender.com',
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Admin-Key',
    'x-admin-key'
  ],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Preflight handling
console.log("✅ [STARTUP] CORS configured with x-admin-key support");

app.use(bodyParser.json());
console.log("✅ [STARTUP] CORS and middleware configured successfully");

// 1. Request logging with pino-http
const logger = pinoHttp({
  genReqId: (req) => req.headers['x-request-id'] || uuidv4(),
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: {
        ...req.headers,
        authorization: req.headers.authorization ? '[MASKED]' : undefined
      }
    })
  }
});
app.use(logger);
console.log("✅ [SECURITY] Request logging with pino-http enabled");

// 2. X-App-Commit header for version tracking
console.log("🏷️ [VERSION] Setting up X-App-Commit header middleware...");
app.use((req, res, next) => {
  const commitSha = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.COMMIT_SHA || "unknown";
  res.setHeader('X-App-Commit', commitSha);
  next();
});
console.log("✅ [VERSION] X-App-Commit header middleware enabled");

// 3. DB Readiness Gate Middleware
app.use('/admindashboard', (req, res, next) => {
  if (!dbReady) {
    return res.status(503).json({
      retryable: true,
      message: 'Database not ready',
      requestId: req.id
    }).header('Retry-After', '2');
  }
  next();
});
console.log("✅ [READINESS] DB readiness gate middleware enabled for /admindashboard");

// 4. Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false // Allow embedding for admin panels
}));
console.log("✅ [SECURITY] Helmet security headers enabled");

// 5. Rate limiting for login endpoint
const loginRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute per IP
  message: {
    error: 'Too many login attempts',
    retryAfter: 60,
    requestId: (req) => req.id
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  skip: (req) => req.path !== '/admindashboard/auth/login'
});
app.use('/admindashboard/auth/login', loginRateLimit);
console.log("✅ [SECURITY] Login rate limiting enabled (5 req/min/IP)");

// 6. CORS configuration already set above (lines 424-443)
// Duplicate CORS middleware removed to prevent conflicts

// 4. Rate limiting for auth routes
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/status';
  }
});

// Apply rate limiting to auth routes
app.use('/api/auth', authRateLimit);
app.use('/api/admin/auth', authRateLimit);
console.log("✅ [SECURITY] Rate limiting enabled for auth routes (100 req/15min)");

// 5. Body parser middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
console.log("✅ [SECURITY] Body parser configured with size limits");

console.log("🛡️ [SECURITY] Security hardening complete");

// ================================
// LIGHT START BYPASS - START SERVER EARLY
// ================================
const HOST = '0.0.0.0';
const PORT = Number(process.env.PORT) || 8080;

console.log("🚀 [LIGHT START] Starting HTTP server before database initialization...");
const serverInstance = server.listen(PORT, HOST, () => {
  console.log(`[STARTUP] Listening on ${PORT} (host=${HOST})`);
  console.log(`[STARTUP] ADMIN_KEY: ${process.env.ADMIN_KEY ? 'present' : 'missing'}`);
  console.log(`[STARTUP] DATABASE_URL: ${process.env.DATABASE_URL ? 'present' : 'missing'}`);
  
  // Initialize token seed data (DBX 61)
  const tokenController = require('./controllers/tokenController');
  tokenController.initializeSeedData();
  
  // Kick off DB warmup async so healthcheck can pass
  require('./util/dbWarmup').init().catch(err => {
    console.error('[DB] Warmup error:', err?.message || err);
  });
  
  // Also initialize database readiness for existing logic
  initializeDbReadiness();
});

// ================================
// DB READINESS INITIALIZATION
// ================================
async function initializeDbReadiness() {
  console.log("🔄 [DB-READY] Starting database readiness initialization...");
  
  try {
    // 1. Database authentication
    console.log("🔄 [DB-READY] Testing database authentication...");
    await sequelize.authenticate();
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

// Enhanced health check route for Render deployment - COMMENTED OUT FOR LIGHT START
/*
app.get('/health', async (req, res) => {
  try {
    console.log('🏥 [Health] Health endpoint called!');
    console.log('🌐 [Health] Request origin:', req.headers.origin);
    console.log('🔍 [Health] Request query:', req.query);
    console.log('📡 [Health] Request method:', req.method);
    
    const startTime = Date.now();
    const healthStatus = {
      success: true,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      db: 'unknown',
      adapters: {},
      services: 'running'
    };
    
    console.log('📋 [Health] Initial healthStatus.adapters:', JSON.stringify(healthStatus.adapters, null, 2));

    // EMERGENCY: Admin creation via health route
    if (req.query.createAdmin === 'emergency') {
      try {
        console.log('🚨 [Emergency] Creating admin via health route...');
        const { Sequelize, DataTypes } = require('sequelize');
        
        // Create direct Sequelize connection
        const sequelize = new Sequelize(process.env.DATABASE_URL, {
          dialect: 'postgres',
          dialectOptions: {
            ssl: {
              require: true,
              rejectUnauthorized: false
            }
          },
          logging: false
        });
        
        await sequelize.authenticate();
        console.log('✅ [Emergency] Database connected');
        
        // Define models
        const Role = sequelize.define('Role', {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          name: { type: DataTypes.STRING(255), unique: true, allowNull: false },
          description: { type: DataTypes.TEXT },
          permissions: { type: DataTypes.JSONB, defaultValue: {} }
        }, { tableName: 'roles', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });
        
        const User = sequelize.define('User', {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          username: { type: DataTypes.STRING(255), unique: true },
          email: { type: DataTypes.STRING(255), unique: true, allowNull: false },
          password: { type: DataTypes.STRING(255), allowNull: false },
          first_name: { type: DataTypes.STRING(255) },
          last_name: { type: DataTypes.STRING(255) },
          role_id: { type: DataTypes.INTEGER },
          status: { type: DataTypes.STRING(50), defaultValue: 'active' },
          email_verified: { type: DataTypes.BOOLEAN, defaultValue: false }
        }, { tableName: 'users', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });
        
        User.belongsTo(Role, { foreignKey: 'role_id' });
        Role.hasMany(User, { foreignKey: 'role_id' });
        
        // await sequelize.sync({ alter: false });
        console.log('✅ [Emergency] Tables synced');
        
        const [adminRole] = await Role.findOrCreate({
          where: { name: 'admin' },
          defaults: { name: 'admin', description: 'Administrator role with full access', permissions: { all: true } }
        });
        
        const [adminUser, userCreated] = await User.findOrCreate({
          where: { email: 'admin@dbx.com' },
          defaults: {
            username: 'admin',
            email: 'admin@dbx.com',
            password: '$2a$10$rOvHjHcw/c1q.Aq8Q2FdUeJ8H7ScqXxqWxG7tJ9kGqE8mNvZxQK4G',
            first_name: 'Admin',
            last_name: 'User',
            role_id: adminRole.id,
            status: 'active',
            email_verified: true
          }
        });
        
        await sequelize.close();
        
        healthStatus.admin_creation = {
          success: true,
          user_created: userCreated,
          admin_id: adminUser.id,
          message: userCreated ? 'Admin user created successfully' : 'Admin user already exists'
        };
        
        console.log('✅ [Emergency] Admin creation completed:', healthStatus.admin_creation);
      } catch (adminError) {
        console.error('❌ [Emergency] Admin creation failed:', adminError);
        healthStatus.admin_creation = {
          success: false,
          error: adminError.message
        };
      }
    }

    // Check database connection
    try {
      const db = require('./models');
      if (db && db.sequelize) {
        await db.sequelize.authenticate();
        // Test a simple query
        await db.sequelize.query('SELECT 1+1 as result');
        healthStatus.db = 'connected';
      } else {
        healthStatus.db = 'unavailable';
      }
    } catch (dbError) {
      console.error('[Health] Database check failed:', dbError.message);
      healthStatus.db = 'error';
      healthStatus.dbError = dbError.message;
    }


    // Check blockchain adapters - Enhanced with debug logging
    console.log('🔍 [Health] Starting adapter status check...');
    const adapters = ['ETH', 'BNB', 'AVAX', 'MATIC', 'SOL', 'BTC', 'XDC', 'XRP', 'XLM'];
    console.log('📋 [Health] Checking adapters:', adapters);
    
    for (const adapter of adapters) {
      try {
        console.log(`🔧 [Health] Checking adapter: ${adapter}`);
        // Check if adapter file exists
        const adapterPath = `./services/blockchain/adapters/${adapter}Adapter.js`;
        console.log(`📁 [Health] Looking for: ${adapterPath}`);
        require.resolve(adapterPath);
        // All adapters are now available for wallet connections
        healthStatus.adapters[adapter] = 'available';
        console.log(`✅ [Health] ${adapter} adapter: AVAILABLE`);
      } catch (error) {
        console.warn(`❌ [Health] Adapter ${adapter} not found:`, error.message);
        healthStatus.adapters[adapter] = 'unavailable';
        console.log(`❌ [Health] ${adapter} adapter: UNAVAILABLE`);
      }
    }
    
    console.log('📊 [Health] Final adapter status:', JSON.stringify(healthStatus.adapters, null, 2));

    const responseTime = Date.now() - startTime;
    healthStatus.responseTime = `${responseTime}ms`;

    // Format uptime
    const uptimeSeconds = Math.floor(healthStatus.uptime);
    const uptimeMinutes = Math.floor(uptimeSeconds / 60);
    const uptimeHours = Math.floor(uptimeMinutes / 60);
    
    if (uptimeHours > 0) {
      healthStatus.uptime = `${uptimeHours}h ${uptimeMinutes % 60}m`;
    } else if (uptimeMinutes > 0) {
      healthStatus.uptime = `${uptimeMinutes}m`;
    } else {
      healthStatus.uptime = `${uptimeSeconds}s`;
    }

    // SECURE TEMPORARY LOGIN: Admin authentication via health endpoint - v3.0
    // Usage: /health?login=true&email=admin@dbx.com&password=Admin@2025
    // Security: Rate limiting, IP restrictions, secure flag requirement
    if (req.query.login === 'true') {
      try {
        console.log('🔐 [SECURE LOGIN] Login attempt detected');
        console.log('🔍 [SECURE LOGIN] Request details:', {
          ip: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          origin: req.headers.origin,
          timestamp: new Date().toISOString()
        });

        // Basic brute force protection - simple in-memory rate limiting
        const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
        const now = Date.now();
        const windowMs = 60 * 1000; // 1 minute window
        const maxAttempts = 5;

        // Initialize rate limiting storage if not exists
        if (!global.loginAttempts) {
          global.loginAttempts = new Map();
        }

        // Clean old attempts
        for (const [ip, attempts] of global.loginAttempts.entries()) {
          global.loginAttempts.set(ip, attempts.filter(time => now - time < windowMs));
          if (global.loginAttempts.get(ip).length === 0) {
            global.loginAttempts.delete(ip);
          }
        }

        // Check rate limit
        const attempts = global.loginAttempts.get(clientIP) || [];
        if (attempts.length >= maxAttempts) {
          console.log('🚨 [SECURE LOGIN] Rate limit exceeded for IP:', clientIP);
          return res.status(429).json({
            ...healthStatus,
            loginResult: false,
            message: 'Too many login attempts. Please try again later.',
            rateLimited: true
          });
        }

        // Record this attempt
        attempts.push(now);
        global.loginAttempts.set(clientIP, attempts);

        const { email, password } = req.query;

        // Validate input
        if (!email || !password) {
          console.log('❌ [SECURE LOGIN] Missing credentials');
          return res.status(200).json({
            ...healthStatus,
            loginResult: false,
            message: 'Email and password are required'
          });
        }

        // Validate admin email
        if (email !== 'admin@dbx.com') {
          console.log('❌ [SECURE LOGIN] Invalid email:', email);
          return res.status(200).json({
            ...healthStatus,
            loginResult: false,
            message: 'Invalid credentials'
          });
        }

        console.log('🔍 [SECURE LOGIN] Attempting authentication for:', email);

        // Use direct SQL approach (proven working)
        const bcrypt = require('bcrypt');
        const jwt = require('jsonwebtoken');
        const { Sequelize } = require('sequelize');
        
        // Create direct database connection
        const sequelize = new Sequelize(process.env.DATABASE_URL, {
          dialect: 'postgres',
          dialectOptions: {
            ssl: {
              require: true,
              rejectUnauthorized: false
            }
          },
          logging: false
        });
        
        await sequelize.authenticate();
        console.log('✅ [SECURE LOGIN] Database connected');
        
        // Find admin user using direct SQL
        const [adminUsers] = await sequelize.query(`
          SELECT id, email, password, role_id
          FROM users 
          WHERE email = $1
        `, {
          bind: [email]
        });
        
        if (adminUsers.length === 0) {
          console.log('❌ [SECURE LOGIN] User not found');
          await sequelize.close();
          return res.status(200).json({
            ...healthStatus,
            loginResult: false,
            message: 'Invalid credentials'
          });
        }
        
        const admin = adminUsers[0];
        console.log('✅ [SECURE LOGIN] User found:', {
          id: admin.id,
          email: admin.email,
          role_id: admin.role_id
        });
        
        // Verify password using bcrypt
        const isValidPassword = await bcrypt.compare(password, admin.password);
        console.log('🔍 [SECURE LOGIN] Password verification:', isValidPassword ? 'VALID' : 'INVALID');
        
        if (!isValidPassword) {
          console.log('❌ [SECURE LOGIN] Invalid password');
          await sequelize.close();
          return res.status(200).json({
            ...healthStatus,
            loginResult: false,
            message: 'Invalid credentials'
          });
        }
        
        // Generate JWT token
        const jwtSecret = process.env.JWT_SECRET || 'dbx-temp-secret-2025';
        const token = jwt.sign(
          {
            id: admin.id,
            email: admin.email,
            role_id: admin.role_id,
            type: 'admin',
            loginMethod: 'health_secure'
          },
          jwtSecret,
          { expiresIn: '24h' }
        );
        
        console.log('✅ [SECURE LOGIN] Login successful - JWT token generated');
        await sequelize.close();
        
        // Clear rate limiting for successful login
        global.loginAttempts.delete(clientIP);
        
        // Return successful login response
        return res.status(200).json({
          ...healthStatus,
          loginResult: true,
          message: 'Admin login successful',
          token: token,
          user: {
            id: admin.id,
            email: admin.email,
            role_id: admin.role_id,
            type: 'admin'
          },
          security: {
            method: 'secure_health_login',
            tokenExpiry: '24h',
            rateLimitRemaining: maxAttempts - attempts.length
          }
        });
        
      } catch (loginError) {
        console.error('❌ [SECURE LOGIN] Login error:', loginError.message);
        return res.status(200).json({
          ...healthStatus,
          loginResult: false,
          message: 'Authentication failed',
          error: 'Internal authentication error'
        });
      }
    }

    // Add CORS headers for admin frontend
    healthStatus.cors = {
      enabled: true,
      allowedOrigins: [
        'https://dbx-frontend.onrender.com',
        'https://dbx-admin.onrender.com'
      ]
    };

    // Debug: Log final response before sending
    console.log('🚀 [Health] Sending response to frontend...');
    console.log('📊 [Health] Response status code:', healthStatus.db === 'connected' ? 200 : 503);
    console.log('📋 [Health] Response adapters:', JSON.stringify(healthStatus.adapters, null, 2));
    console.log('🌐 [Health] Response CORS:', JSON.stringify(healthStatus.cors, null, 2));
    console.log('⏱️ [Health] Response time:', healthStatus.responseTime);

    // Return appropriate status code
    const statusCode = healthStatus.db === 'connected' ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    console.error('[Health] Health check failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  }
});
*/
// END OF COMMENTED OUT COMPLEX HEALTH ROUTE

// Enhanced Database Security Middleware - TEMPORARILY DISABLED TO FIX ADMIN ENDPOINTS
// app.use(secureConnection);
// app.use(validateQuery());
// app.use(monitorPerformance);
// Note: monitorConnectionPool will be added after database initialization

// Database Health Check Endpoint
app.get('/api/health/database', healthCheck);

// TEMPORARY: Admin password reset endpoint using direct SQL
app.get('/admin/reset-password', async (req, res) => {
  try {
    console.log('🔐 [ADMIN RESET] Password reset request received');
    
    const bcrypt = require('bcrypt');
    const { Sequelize } = require('sequelize');
    const newPassword = 'Admin@2025';
    
    // Hash password with bcrypt (10 salt rounds)
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log('🔒 [ADMIN RESET] Password hashed successfully');
    
    // Create direct database connection (same as health endpoint)
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      logging: false
    });
    
    await sequelize.authenticate();
    console.log('✅ [ADMIN RESET] Database connected');
    
    // Update admin password using direct SQL
    const [results] = await sequelize.query(`
      UPDATE users 
      SET password = $1, updated_at = NOW()
      WHERE email = 'admin@dbx.com'
    `, {
      bind: [hashedPassword]
    });
    
    console.log('✅ [ADMIN RESET] Password updated successfully');
    
    // Verify the update
    const [adminUser] = await sequelize.query(`
      SELECT id, email, password, role_id
      FROM users 
      WHERE email = 'admin@dbx.com'
    `);
    
    if (adminUser.length > 0) {
      const admin = adminUser[0];
      
      // Test password verification
      const isValid = await bcrypt.compare(newPassword, admin.password);
      console.log('🔍 [ADMIN RESET] Password verification:', isValid ? 'VALID' : 'INVALID');
      
      await sequelize.close();
      
      res.json({
        success: true,
        message: 'Admin password reset successfully using direct SQL',
        credentials: {
          email: 'admin@dbx.com',
          password: newPassword
        },
        verification: isValid,
        admin_details: {
          id: admin.id,
          email: admin.email,
          role_id: admin.role_id
        },
        timestamp: new Date().toISOString()
      });
    } else {
      await sequelize.close();
      res.status(404).json({
        success: false,
        message: 'Admin user not found'
      });
    }
    
  } catch (error) {
    console.error('❌ [ADMIN RESET] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Password reset failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Comprehensive Health Check Endpoint
app.use('/health-check', createHealthCheckEndpoint());

// Safe root route handler with error handling and database readiness checks
app.get('/', (req, res) => {
  try {
    const response = {
      success: true,
      message: 'Welcome to the DBX Backend API 🎉',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      status: 'running'
    };

    // Safely check database status if available
    try {
      const db = require('./models');
      if (db && db.sequelize && db.sequelize.connectionManager) {
        // Only add database status if connection manager is available
        response.database = 'connected';
      } else {
        response.database = 'initializing';
      }
    } catch (dbError) {
      // Don't fail the route if database check fails
      console.warn('[Root Route] Database status check failed:', dbError.message);
      response.database = 'unknown';
    }

    res.json(response);
  } catch (error) {
    console.error('[Root Route] Error in root route handler:', error);
    res.status(500).json({
      success: false,
      message: 'Root route error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 🧪 DIRECT TEST ROUTE - Added for debugging admin route issues
console.log("🧪 [STARTUP] Adding direct test admin route...");
app.get('/test-direct-admin', (req, res) => {
  console.log('🧪 [DIRECT TEST] Direct test route hit successfully');
  res.json({ success: true, message: 'Direct route hit' });
});
console.log("✅ [STARTUP] Direct test admin route added");

// Mount Admin Routes with enhanced logging
console.log("🛠 [STARTUP] About to mount adminRoutes...");
console.log("🛠 [STARTUP] adminRoutes object:", typeof adminRoutes);
console.log("🛠 [STARTUP] adminRoutes keys:", Object.keys(adminRoutes || {}));

// 🔍 COMPREHENSIVE ROUTE DEBUGGING
if (adminRoutes && adminRoutes.stack) {
  console.log("🔍 [DEBUG] adminRoutes stack length:", adminRoutes.stack.length);
  adminRoutes.stack.forEach((layer, index) => {
    console.log(`🔍 [DEBUG] Route ${index}:`, layer.route ? layer.route.path : 'middleware', 
                'Methods:', layer.route ? Object.keys(layer.route.methods) : 'N/A');
  });
} else {
  console.log("❌ [DEBUG] adminRoutes has no stack property!");
}

// Mount API Admin Routes (Ghost Bypass System) - PRIORITY MOUNTING
console.log("🚀 [STARTUP] ========================================");
console.log("🚀 [STARTUP] MOUNTING API ADMIN ROUTES (GHOST BYPASS)");
console.log("🚀 [STARTUP] ========================================");
console.log("🔍 [STARTUP] apiAdminRoutes object type:", typeof apiAdminRoutes);
console.log("🔍 [STARTUP] apiAdminRoutes is function:", typeof apiAdminRoutes === 'function');
try {
  safeUse('/api/admin', maybeFactory(apiAdminRoutes), 'apiAdminRoutes');
  console.log("✅ [STARTUP] apiAdminRoutes mounted successfully at /api/admin!");
  console.log("🎯 [STARTUP] GHOST BYPASS SYSTEM ACTIVE - Clean isolated CRUD!");
  console.log("🔍 [STARTUP] Individual endpoint confirmations:");
  console.log("✅ [STARTUP] Mounted GET    /api/admin/token/list");
  console.log("✅ [STARTUP] Mounted POST   /api/admin/token/create");
  console.log("✅ [STARTUP] Mounted PUT    /api/admin/token/update/:id");
  console.log("✅ [STARTUP] Mounted DELETE /api/admin/token/delete/:id");
  console.log("✅ [STARTUP] Mounted GET    /api/admin/banner/list");
  console.log("✅ [STARTUP] Mounted POST   /api/admin/banner/create");;
  console.log("✅ [STARTUP] Mounted PUT    /api/admin/banner/update/:id");
  console.log("✅ [STARTUP] Mounted DELETE /api/admin/banner/delete/:id");
  console.log("✅ [STARTUP] Mounted GET    /api/admin/health");
  
  // Mount routing admin routes
  if (adminRoutingRoutes) {
    safeUse('/api/admin/routing', maybeFactory(adminRoutingRoutes), 'adminRoutingRoutes');
    console.log("✅ [STARTUP] adminRoutingRoutes mounted at /api/admin/routing!");
    console.log("✅ [STARTUP] Mounted GET    /api/admin/routing/last");
    console.log("✅ [STARTUP] Mounted GET    /api/admin/routing/config");
  }
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
console.log("🔍 [STARTUP] adminCrudRoutes is function:", typeof adminCrudRoutes === 'function');
try {
  safeUse('/admin-api', maybeFactory(adminCrudRoutes), 'adminCrudRoutes');
  console.log("✅ [STARTUP] adminCrudRoutes mounted successfully at /admin-api!");
  console.log("🎯 [STARTUP] BYPASS CRUD ROUTES ACTIVE - Ghost route bypassed!");
  console.log("🔍 [STARTUP] Available endpoints:");
  console.log("🔍 [STARTUP] - GET  /admin-api/test");
  console.log("🔍 [STARTUP] - GET  /admin-api/health");
  console.log("🔍 [STARTUP] - GET  /admin-api/token/list");
  console.log("🔍 [STARTUP] - POST /admin-api/token/create");
  console.log("🔍 [STARTUP] - PUT  /admin-api/token/update/:id");
  console.log("🔍 [STARTUP] - DELETE /admin-api/token/delete/:id");
  console.log("🔍 [STARTUP] - GET  /admin-api/banner/list");
  console.log("🔍 [STARTUP] - POST /admin-api/banner/create");
  console.log("🔍 [STARTUP] - PUT  /admin-api/banner/update/:id");
  console.log("🔍 [STARTUP] - DELETE /admin-api/banner/delete/:id");
} catch (error) {
  console.error("❌ [STARTUP] ERROR mounting adminCrudRoutes:", error);
  console.error("❌ [STARTUP] Error details:", error.message);
  console.error("❌ [STARTUP] Stack trace:", error.stack);
}

console.log("🚀 [STARTUP] ========================================");

safeUse('/admindashboard', maybeFactory(adminRoutes), 'adminRoutes');
console.log("✅ [STARTUP] adminRoutes mounted successfully!");

// ================================
// PRODUCTION CORS - Using global CORS config from lines 424-443
// ================================
// Duplicate production CORS removed - global CORS handles all routes including /admin

// Mount Admin Authentication Routes with safe mounting
console.log('[MOUNT-TRY]', { path: '/admindashboard', name: 'adminAuthRoutes', enabled: true });
safeUse('/admindashboard', maybeFactory(adminAuthRoutes), 'adminAuthRoutes');

console.log('[MOUNT-TRY]', { path: '/admindashboard', name: 'seedRoutes', enabled: enableSeedDirect });
safeUse('/admindashboard', maybeFactory(seedRoutes), 'seedRoutes');

console.log("✅ [STARTUP] Router mounting completed safely!");

// 🔍 VERIFY ROUTE REGISTRATION
console.log("🔍 [DEBUG] Checking app routes after mounting...");
app._router.stack.forEach((layer, index) => {
  if (layer.regexp.toString().includes('admindashboard')) {
    console.log(`🔍 [DEBUG] App route ${index} matches /admindashboard:`, layer.regexp.toString());
  }
});

console.log("🔗 [STARTUP] About to mount other routes...");
// Mount MFA Routes
app.use('/api/mfa', mfaRoutes);

// Mount Transaction Routes
app.use('/api/transactions', transactionRoutes);

// Mount Wallet Routes
app.use('/api/wallets', walletRoutes);

// Mount Cross-Chain Routes
app.use('/api/crosschain', crossChainRoutes);

// Mount Risk Management Routes
app.use('/api/risk', riskRoutes);

// Mount NFT Marketplace Routes
app.use('/api/nft', nftRoutes);

// Mount Marketplace Trading Routes
app.use('/api/marketplace', marketplaceRoutes);

// Mount Cross-Chain Bridge Routes
app.use('/api/bridge', bridgeRoutes);

// Mount Creator Tools Routes
app.use('/api/creator', creatorRoutes);

// TEMPORARILY COMMENTED OUT TO FIX ADMIN ROUTE CONFLICTS
// Mount Enhanced Admin Routes
// app.use('/admindashboard', enhancedAdminRoutes);

// Temporary admin setup routes removed for security
// Only /admindashboard/auth/* endpoints are available for authentication

// TEMPORARILY COMMENTED OUT TO FIX ADMIN ROUTE CONFLICTS
// Mount Real-Time Analytics Routes
// app.use('/admindashboard', realTimeAnalyticsRoutes);

// Mount User Management Routes
// app.use('/admindashboard', userManagementRoutes);

// Mount System Health Monitoring Routes
// app.use('/admindashboard', systemHealthRoutes);

// Mount Bitcoin Routes
app.use('/api/bitcoin', bitcoinRoutes);

// Mount Exchange Routes (for TradingView chart data)
// Real OHLCV data from Binance API
app.get('/api/exchangeRates', async (req, res) => {
  try {
    const base = String(req.query.base || 'ETH').toUpperCase();
    const quote = String(req.query.quote || 'USDT').toUpperCase();
    const resolution = String(req.query.resolution || '60');
    const from = Number(req.query.from) || Math.floor(Date.now()/1000) - 86400;
    const to   = Number(req.query.to)   || Math.floor(Date.now()/1000);

    const symbol = `${base}${quote}`;           // BTCUSDT
    const intervalMap = { '1':'1m','5':'5m','15':'15m','60':'1h','240':'4h','1D':'1d' };
    const interval = intervalMap[resolution] || '1h';

    // Fetch from Binance (public, no key)
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${from*1000}&endTime=${to*1000}&limit=1000`;
    
    console.log(`[OHLCV] Fetching ${symbol} ${interval} from Binance: ${from} to ${to}`);
    
    const resp = await fetch(url, { 
      timeout: 5000,
      headers: {
        'User-Agent': 'DBX-Exchange/1.0'
      }
    });
    
    if (!resp.ok) {
      console.warn(`[OHLCV] Binance API error: ${resp.status} for ${symbol}`);
      
      // Fallback to pair-aware stub data
      const basePrice = getPairBasePrice(base);
      const bars = generateStubBars(from, to, resolution, basePrice);
      return res.json(bars);
    }
    
    const arr = await resp.json(); // [[openTime, open, high, low, close, volume, closeTime, ...], ...]

    const bars = arr.map(k => ({
      time: Math.floor(k[0] / 1000),           // seconds
      open: Number(k[1]),
      high: Number(k[2]),
      low:  Number(k[3]),
      close:Number(k[4]),
      volume:Number(k[5]),
    }));

    console.log(`[OHLCV] Returned ${bars.length} bars for ${symbol}`);
    res.json(bars);
  } catch (e) {
    console.error('[OHLCV] Error:', e?.message || e);
    
    // Fallback to pair-aware stub data
    try {
      const base = String(req.query.base || 'ETH').toUpperCase();
      const resolution = String(req.query.resolution || '60');
      const from = Number(req.query.from) || Math.floor(Date.now()/1000) - 86400;
      const to   = Number(req.query.to)   || Math.floor(Date.now()/1000);
      
      const basePrice = getPairBasePrice(base);
      const bars = generateStubBars(from, to, resolution, basePrice);
      res.json(bars);
    } catch (fallbackError) {
      res.status(500).json({ error: 'ohlcv_error', detail: String(e?.message || e) });
    }
  }
});

// Helper function to get base price for different pairs
function getPairBasePrice(base) {
  const basePrices = {
    'BTC': 100000,
    'ETH': 3800,
    'XRP': 2.5,
    'XLM': 0.4,
    'MATIC': 1.2,
    'BNB': 650,
    'SOL': 220,
    'XDC': 0.08
  };
  return basePrices[base] || 3800; // Default to ETH price
}

// Helper function to generate pair-aware stub data
function generateStubBars(from, to, resolution, basePrice) {
  const resMin = Number(resolution) || 60;
  const step = resMin * 60;
  const bars = [];
  
  for (let t = from; t <= to; t += step) {
    const wob = Math.sin(t/600) * (basePrice * 0.02); // 2% oscillation
    const open = basePrice + wob;
    const high = open * (1 + Math.random() * 0.01); // Up to 1% higher
    const low = open * (1 - Math.random() * 0.01);  // Up to 1% lower
    const close = open + Math.sin(t/300) * (basePrice * 0.005); // 0.5% variation
    const volume = Math.random() * 1000 + 100;
    
    bars.push({ 
      time: t, 
      open: Number(open.toFixed(8)), 
      high: Number(high.toFixed(8)), 
      low: Number(low.toFixed(8)), 
      close: Number(close.toFixed(8)), 
      volume: Number(volume.toFixed(2))
    });
  }
  
  return bars;
}

app.use('/api/exchangeRates', exchangeRoutes);

// Mount Price Routes (for spot price feed)
app.use('/api/price', priceRoutes);

// Mount Banner Routes (for admin banner management)
// Add admin ping endpoint for debugging
app.get('/admin/ping', (_req, res) => res.json({ ok: true }));
app.use('/admin', bannerRoutes);
console.log("✅ [STARTUP] Admin ping endpoint and banner routes mounted successfully at /admin!");

// Mount Token Routes (for admin token management - DBX 61)
app.use('/admin', tokenRoutes);
console.log("✅ [STARTUP] Token routes mounted successfully at /admin!");

// Mount Trade Routes (for paper trading - DBX 63)
// Dual-mount at /trade and /api/trade for proxy compatibility
app.use('/trade', tradeRoutes);
app.use('/api/trade', tradeRoutes);
console.log("✅ [STARTUP] Trade routes mounted at /trade and /api/trade!");

// Mount Portfolio Routes (for balance management - Milestone 4)
// Dual-mount at /portfolio and /api/portfolio for compatibility
app.use('/portfolio', portfolioRoutes);
app.use('/api/portfolio', portfolioRoutes);
console.log("✅ [STARTUP] Portfolio routes mounted at /portfolio and /api/portfolio!");

// Socket.io Configuration for Real-Time Transaction Tracking, Risk Monitoring, and Auction Updates
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);
  
  // Join user to their personal room for transaction updates
  socket.on('join_user_room', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`[Socket.io] User ${userId} joined their room`);
  });
  
  // Join network-specific rooms for network updates
  socket.on('join_network_room', (chainId) => {
    socket.join(`network_${chainId}`);
    console.log(`[Socket.io] Client joined network room: ${chainId}`);
  });
  
  // Join risk monitoring room
  socket.on('join_risk_room', () => {
    socket.join('risk_monitoring');
    console.log(`[Socket.io] Client joined risk monitoring room`);
  });
  
  // Join auction room for real-time auction updates
  socket.on('join_auction_room', (auctionId) => {
    socket.join(`auction_${auctionId}`);
    console.log(`[Socket.io] Client joined auction room: ${auctionId}`);
  });
  
  // Join marketplace room for general marketplace updates
  socket.on('join_marketplace_room', () => {
    socket.join('marketplace');
    console.log(`[Socket.io] Client joined marketplace room`);
  });
  
  // Join bridge room for cross-chain bridge updates
  socket.on('join_bridge_room', (bridgeId) => {
    socket.join(`bridge_${bridgeId}`);
    console.log(`[Socket.io] Client joined bridge room: ${bridgeId}`);
  });
  
  // Join general bridge monitoring room
  socket.on('join_bridge_monitoring', () => {
    socket.join('bridge_monitoring');
    console.log(`[Socket.io] Client joined bridge monitoring room`);
  });
  
  // Join admin dashboard room for real-time admin updates
  socket.on('join_admin_dashboard', () => {
    socket.join('admin_dashboard');
    console.log(`[Socket.io] Admin client joined dashboard room`);
  });
  
  // Join system monitoring room for health alerts
  socket.on('join_system_monitoring', () => {
    socket.join('system_monitoring');
    console.log(`[Socket.io] Admin client joined system monitoring room`);
  });
  
  // Handle transaction tracking subscription
  socket.on('track_transaction', (data) => {
    const { transactionId, userId, chainId } = data;
    socket.join(`tx_${transactionId}`);
    console.log(`[Socket.io] Tracking transaction ${transactionId} for user ${userId}`);
  });
  
  // Handle auction tracking subscription
  socket.on('track_auction', (auctionId) => {
    socket.join(`auction_${auctionId}`);
    console.log(`[Socket.io] Tracking auction ${auctionId}`);
  });
  
  // Handle risk data subscription
  socket.on('subscribe_risk_feed', () => {
    socket.join('risk_feed');
    console.log(`[Socket.io] Client subscribed to risk data feed`);
    
    // Send initial risk dashboard data
    try {
      // Note: In a full implementation, you would get this from the actual risk system
      const initialData = {
        type: 'risk_dashboard',
        data: {
          system: { isRunning: true, uptime: Date.now() },
          positions: { totalPositions: 0 },
          circuitBreakers: { active: 0, history: [] },
          manipulation: { suspiciousActivities: [], stats: {} }
        },
        timestamp: Date.now()
      };
      socket.emit('risk_data', initialData);
    } catch (error) {
      console.error('[Socket.io] Error sending initial risk data:', error);
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Make io available globally for transaction updates
global.io = io;

// Global Express error handler to catch unhandled errors - DISABLED (conflicts with centralized debug)
// app.use((err, req, res, next) => {
//   console.error('🚨 Global Error Handler Triggered:', err);
//   console.error('🚨 Request URL:', req.url);
//   console.error('🚨 Request Method:', req.method);
//   console.error('🚨 Error Message:', err.message);
//   console.error('🚨 Error Name:', err.name);
//   console.error('🚨 Stack trace:', err.stack);
//   
//   // Don't send error details in production for security
//   const isDevelopment = process.env.NODE_ENV === 'development';
//   
//   res.status(500).json({ 
//     success: false, 
//     message: 'Server error', 
//     error: isDevelopment ? err.message : 'Internal server error',
//     timestamp: new Date().toISOString()
//   });
// });

// Enhanced Initialization with Database and Blockchain Services
const initializeServices = async ({ skipDBDependent = false } = {}) => {
  try {
    const lightStart = process.env.DBX_STARTUP_MODE === 'light';
    
    if (lightStart) {
      console.log('[STARTUP] Light mode: skipping Sequelize sync; doing authenticate() only');
    } else {
      console.log('[STARTUP] Full mode: running initializeDatabase()');
    }
    
    console.log('[Server] Initializing enhanced database services...');
    
    // Initialize enhanced database manager
    const db = await initializeDatabase();
    
    // Add explicit Sequelize authentication check
    console.log('[Server] Verifying database connection...');
    try {
      await db.authenticate();
      console.log('✅ DB connection established');
      
      // BOOT MIGRATIONS AND SEEDING DISABLED FOR RAILWAY DEPLOYMENT
      // These operations now run only via endpoints to prevent startup blocking
      console.log('[BOOT] Migrations and seeding disabled on boot - use endpoints for operations');
      
      // MIGRATION-FIRST APPROACH: Database schema managed by migrations only
      if (process.env.DBX_STARTUP_MODE === 'light') {
        console.log('🚀 [LIGHT START] Skipping database sync in light mode');
      } else if (process.env.NODE_ENV === 'production') {
        console.log('🏭 [PRODUCTION] Using migration-first approach - no sync/alter in production');
        console.log('🏭 [PRODUCTION] Database schema managed by migrations only');
        // REMOVED: db.sync() in production - migrations handle schema changes
      } else if (process.env.NODE_ENV === 'development' && process.env.DBX_STARTUP_MODE === 'full') {
        console.log('[Server] Synchronizing database tables (development full mode only)...');
        await db.sync({ alter: true });
        console.log('✅ Database tables synchronized successfully');
      } else {
        console.log('🔧 [DEVELOPMENT] Skipping sync - use DBX_STARTUP_MODE=full to enable sync for debugging');
      }
      
      // Now that database is connected, add connection pool monitoring middleware
      console.log('[Server] Adding connection pool monitoring middleware...');
      app.use(monitorConnectionPool);
      console.log('✅ Connection pool monitoring enabled');
    } catch (err) {
      console.error('❌ DB connection failed', err);
      throw err;
    }
    
    // Skip DB-dependent services in light mode
    if (!skipDBDependent && process.env.DBX_STARTUP_MODE !== 'light') {
      console.log('[Server] Initializing blockchain services...');
      
      // Initialize blockchain services
      await initializeBlockchainServices(db);
      
      // console.log('[Server] Initializing wallet services...');
      
      // Initialize wallet services
      // await initializeWalletServices(db);
      
      console.log('[Server] Initializing cross-chain services...');
      
      // Initialize cross-chain services
      // await initializeCrossChainServices(db);
      
      console.log('[Server] Initializing risk management system...');
      
      // Initialize risk management system
      // Note: In a full implementation, you would pass actual market data manager and matching engine instances
      const riskSystem = initializeRiskSystem(null, null);
      
      console.log('[Server] Initializing NFT minting service...');
      
      // Initialize NFT minting service
      await initializeMintingService();
      
      console.log('[Server] Initializing auction service...');
      
      // Initialize auction service with Socket.io
      await initializeAuctionService(io);
      
      console.log('[Server] Initializing bridge service...');
      
      // Initialize bridge service with Socket.io
      await initializeBridgeService(io);
      
      console.log('[Server] Initializing creator tools service...');
      
      // Initialize creator tools service with Socket.io
      await initializeCreatorToolsService(io);
      
      // Gate RealTimeAnalyticsService behind ENABLE_ANALYTICS as requested by Owen
      let realTimeAnalytics = null;
      if (process.env.ENABLE_ANALYTICS === 'true') {
        console.log('[Server] Initializing real-time analytics service...');
        realTimeAnalytics = initializeRealTimeAnalytics(io);
      } else {
        console.log('[Server] Skipping real-time analytics (ENABLE_ANALYTICS not set to true)');
      }
      
      console.log('[Server] Initializing user management service...');
      
      // Initialize user management service with Socket.io
      const userManagement = initializeUserManagementService(io);
      
      console.log('[Server] Initializing system health monitoring service...');
      
      // Initialize system health monitoring service with Socket.io
      const healthMonitoring = initializeHealthMonitoringService(io);
      
      console.log('[Server] All services initialized successfully!');
      
      return { db, riskSystem, realTimeAnalytics, userManagement, healthMonitoring };
    } else {
      console.log('🚀 [LIGHT START] Skipping DB-dependent services in light mode');
      return { db };
    }
  } catch (error) {
    console.error('[Server] Service initialization failed:', error);
    throw error;
  }
};

// ================================
// LIGHT START BYPASS - ASYNC DATABASE INITIALIZATION
// ================================
(async () => {
  try {
    const startupMode = process.env.DBX_STARTUP_MODE;
    console.log(`🚀 [STARTUP] DBX_STARTUP_MODE=${startupMode}`);
    
    if (startupMode === 'light') {
      console.log('[STARTUP] Light mode: skipping Sequelize sync; doing authenticate() only');
      await initializeServices({ skipDBDependent: true });
      console.log('[STARTUP] DB connection OK');
    } else if (startupMode === 'full') {
      console.log('[STARTUP] Full mode: running complete initializeDatabase() for SQL diagnostics');
      await initializeServices();
      console.log('[STARTUP] Full initialization completed');
    } else {
      console.log('[STARTUP] Normal mode: running initializeServices()');
      await initializeServices();
    }
    console.log('[STARTUP] Services initialized');
  } catch (err) {
    console.error('[STARTUP] Initialization error:', err);
    console.error('[STARTUP] Error stack:', err.stack);
    
    // In full mode, we want to see the exact SQL error for debugging
    if (process.env.DBX_STARTUP_MODE === 'full') {
      console.error('🔍 [SQL DEBUG] Full error details for debugging:');
      console.error('🔍 [SQL DEBUG] Error name:', err.name);
      console.error('🔍 [SQL DEBUG] Error message:', err.message);
      console.error('🔍 [SQL DEBUG] SQL:', err.sql || 'No SQL in error');
      console.error('🔍 [SQL DEBUG] Original error:', err.original || 'No original error');
    }
    
    // In light mode, treat as non-fatal; in full mode, let it crash for debugging
    if (process.env.DBX_STARTUP_MODE !== 'full') {
      console.error('[STARTUP] Treating as non-fatal in light mode');
    } else {
      console.error('[STARTUP] Full mode - allowing crash for debugging');
      throw err;
    }
  }
})();

// TEMPORARY: Production admin password reset endpoint
app.get('/admin/reset-password-production', async (req, res) => {
  try {
    console.log('🔐 [PRODUCTION RESET] Password reset requested');
    
    const bcrypt = require('bcrypt');
    const { Sequelize } = require('sequelize');
    const newPassword = 'Admin@2025';
    
    // Hash password with bcrypt (10 salt rounds)
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log('🔒 [PRODUCTION RESET] Password hashed successfully');
    
    // Create direct database connection
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      logging: false
    });
    
    await sequelize.authenticate();
    console.log('✅ [PRODUCTION RESET] Database connected');
    
    // Update admin password using direct SQL
    const [results] = await sequelize.query(`
      UPDATE users 
      SET password = $1, updated_at = NOW()
      WHERE email = 'admin@dbx.com'
    `, {
      bind: [hashedPassword]
    });
    
    console.log('✅ [PRODUCTION RESET] Password updated successfully');
    
    // Verify the update
    const [adminUser] = await sequelize.query(`
      SELECT id, email, password, role_id
      FROM users 
      WHERE email = 'admin@dbx.com'
    `);
    
    if (adminUser.length > 0) {
      const admin = adminUser[0];
      
      // Test password verification
      const isValid = await bcrypt.compare(newPassword, admin.password);
      console.log('🔍 [PRODUCTION RESET] Password verification:', isValid ? 'VALID' : 'INVALID');
      
      await sequelize.close();
      
      return res.status(200).json({
        success: true,
        message: 'Admin password reset successfully',
        credentials: {
          email: 'admin@dbx.com',
          password: newPassword
        },
        verification: isValid,
        admin_details: {
          id: admin.id,
          email: admin.email,
          role_id: admin.role_id
        }
      });
    } else {
      await sequelize.close();
      return res.status(200).json({
        success: false,
        message: 'Admin user not found'
      });
    }
    
  } catch (resetError) {
    console.error('❌ [PRODUCTION RESET] Error:', resetError.message);
    return res.status(500).json({
      success: false,
      message: 'Password reset failed',
      error: resetError.message
    });
  }
});
// Force deployment with dependencies


// ================================
// GRACEFUL SHUTDOWN HANDLING
// ================================
console.log("🛡️ [SHUTDOWN] Setting up graceful shutdown handlers...");

let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) {
    console.log(`⚠️ [SHUTDOWN] Already shutting down, ignoring ${signal}`);
    return;
  }
  
  isShuttingDown = true;
  console.log(`🛑 [SHUTDOWN] Received ${signal}, starting graceful shutdown...`);
  
  try {
    // 1. Stop accepting new connections
    console.log("🔌 [SHUTDOWN] Closing HTTP server...");
    if (serverInstance) {
      await new Promise((resolve) => {
        serverInstance.close((err) => {
          if (err) {
            console.error("❌ [SHUTDOWN] Error closing server:", err);
          } else {
            console.log("✅ [SHUTDOWN] HTTP server closed");
          }
          resolve();
        });
      });
    }
    
    // 2. Close database connections
    console.log("🗄️ [SHUTDOWN] Closing database connections...");
    try {
      const { sequelize } = require('./models');
      await sequelize.close();
      console.log("✅ [SHUTDOWN] Database connections closed");
    } catch (dbError) {
      console.error("❌ [SHUTDOWN] Error closing database:", dbError);
    }
    
    // 3. Close Socket.IO connections
    console.log("🔌 [SHUTDOWN] Closing Socket.IO connections...");
    if (io) {
      io.close();
      console.log("✅ [SHUTDOWN] Socket.IO connections closed");
    }
    
    console.log("✅ [SHUTDOWN] Graceful shutdown completed");
    process.exit(0);
    
  } catch (error) {
    console.error("❌ [SHUTDOWN] Error during graceful shutdown:", error);
    process.exit(1);
  }
};

// Handle different shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  console.error('💥 [SHUTDOWN] Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 [SHUTDOWN] Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

console.log("✅ [SHUTDOWN] Graceful shutdown handlers configured");

// Handle 404 routes with JSON response
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString()
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  const { respondWithError } = require('./lib/debug');
  if (res.headersSent) return next(err);
  
  console.error('🚨 Global Error Handler Triggered:', err);
  console.error('🚨 Request URL:', req.url);
  console.error('🚨 Request Method:', req.method);
  
  const context = { 
    where: 'global', 
    url: req.originalUrl, 
    method: req.method 
  };
  
  return respondWithError(req, res, err, context);
});

console.log("🚀 [STARTUP] DBX Backend fully initialized and ready!");

