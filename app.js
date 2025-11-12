console.log('============================================================');
console.log('📱 DIAGNOSTIC: app.js module execution START', new Date().toISOString());
console.log('============================================================');

const express = require('express');
const app = express();

// Ultra-early health
app.set('trust proxy', true);
app.get('/health', (req, res) => {
  res.set('X-Boot-Commit', process.env.GIT_COMMIT || 'unknown');
  res.set('X-Boot-Branch', process.env.GIT_BRANCH || 'unknown');
  res.status(200).send('OK');
});

console.log('✅ /health route mounted');

console.log('📦 Loading imports...');
const http = require('http');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const path = require('path');
const bcrypt = require('bcrypt');

console.log("✅ [STARTUP] Core modules imported");

// ================================
// MIDDLEWARE CONFIGURATION
// ================================
console.log("[STARTUP] binding middleware");

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'https://dbx-frontend.onrender.com',
  'https://dbx-admin.onrender.com'
];

const corsOptions = {
  origin: function (origin, callback) {
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
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Request logging
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
  }
}));

console.log("✅ [STARTUP] Middleware configured");

// ================================
// ADMIN KEY BYPASS
// ================================
const ADMIN_KEY = process.env.ADMIN_KEY || 'default-admin-key-change-me';

function bypassAuthWithAdminKey(req, res, next) {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey && adminKey === ADMIN_KEY) {
    console.log('🔑 [AUTH-BYPASS] Admin key validated');
    req.isAdminKeyAuth = true;
    return next();
  }
  next();
}

app.use(bypassAuthWithAdminKey);

// ================================
// STATIC FILES
// ================================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ================================
// VERSION ENDPOINT
// ================================
app.get('/version', (_req, res) => {
  const commit = process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown';
  res.json({
    branch: process.env.RAILWAY_GIT_BRANCH || 'unknown',
    commit: commit,
    commitShort: commit.substring(0, 7),
    ts: Date.now(),
    status: 'ok'
  });
});

// ================================
// ROUTES
// ================================
console.log("[BOOT] mounting routes");

// Import routes
const adminAuthRoutes = require('./routes/adminAuthRoutes');
const mfaRoutes = require('./routes/mfaRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const walletRoutes = require('./routes/walletRoutes');
const crossChainRoutes = require('./routes/crossChainRoutes');
const { router: riskRoutes } = require('./routes/riskRoutes');
const { router: nftRoutes } = require('./routes/nftRoutes');
const { router: marketplaceRoutes } = require('./routes/marketplaceRoutes');
const { router: bridgeRoutes } = require('./routes/bridgeRoutes');
const { router: creatorRoutes } = require('./routes/creatorRoutes');
const enhancedAdminRoutes = require('./routes/enhancedAdminRoutes');
const { router: realTimeAnalyticsRoutes } = require('./routes/realTimeAnalyticsRoutes');
const { router: userManagementRoutes } = require('./routes/userManagementRoutes');
const { router: systemHealthRoutes } = require('./routes/systemHealthRoutes');
const bitcoinRoutes = require('./routes/bitcoinRoutes');
const exchangeRoutes = require('./routes/exchangeRoutes');
const priceRoutes = require('./routes/priceRoute');
const bannerRoutes = require('./routes/bannerRoutes');
const tokenRoutes = require('./routes/tokenRoutes');
const tradeRoutes = require('./routes/tradeRoutes');
const portfolioRoutes = require('./routes/portfolioRoutes');

// Mount routes
app.use('/api/admin/auth', adminAuthRoutes);
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

console.log("[BOOT] routes mounted");
console.log("✅ [STARTUP] All routes configured");

// ================================
// ERROR HANDLING
// ================================
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
    timestamp: new Date().toISOString()
  });
});

console.log("✅ [STARTUP] Error handlers configured");
console.log("✅ [STARTUP] Express app ready for export");

// Export app for bin/www.js
module.exports = app;
