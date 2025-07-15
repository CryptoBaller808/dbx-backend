const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const socketIo = require('socket.io');
const { initializeBlockchainServices } = require('./services/blockchain');
const { initializeDatabase } = require('./models');
const { 
  secureConnection, 
  validateQuery, 
  monitorPerformance, 
  healthCheck,
  monitorConnectionPool 
} = require('./middleware/databaseSecurity');

const { createHealthCheckEndpoint } = require('./health-check');

// Import your route files
const adminRoutes = require('./routes/adminRoute');
const tempAdminSetup = require('./routes/tempAdminSetup');
const mfaRoutes = require('./routes/mfaRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const { router: walletRoutes, initializeServices: initializeWalletServices } = require('./routes/walletRoutes');
const { router: crossChainRoutes, initializeServices: initializeCrossChainServices } = require('./routes/crossChainRoutes');
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

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ['https://digitalblockexchange-fe.vercel.app', 'https://digitalblockexchange-admin.vercel.app', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});
const PORT = process.env.PORT || 3000;

// CORS and Middleware - SECURE PRODUCTION CONFIG
app.use(cors({
  origin: "https://dbx-admin.onrender.com",  // SECURE: Specific admin domain only
  credentials: true
}));
app.use(bodyParser.json());

// Enhanced health check route for Render deployment
app.get('/health', async (req, res) => {
  try {
    const startTime = Date.now();
    const healthStatus = {
      success: true,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      db: 'unknown',
      adapters: {},
      services: 'running'
    };

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
        
        await sequelize.sync({ alter: false });
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


    // Check blockchain adapters status
    const adapters = ['AVAX', 'BNB', 'XRP', 'XLM', 'ETH'];
    for (const adapter of adapters) {
      try {
        // Check if adapter file exists
        require.resolve(`./services/blockchain/adapters/${adapter}Adapter.js`);
        // For now, mark AVAX and BNB as offline (disabled), others as available
        if (adapter === 'AVAX' || adapter === 'BNB') {
          healthStatus.adapters[adapter] = 'offline';
        } else {
          healthStatus.adapters[adapter] = 'available';
        }
      } catch (error) {
        healthStatus.adapters[adapter] = 'unavailable';
      }
    }

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

    // Add CORS headers for admin frontend
    healthStatus.cors = {
      enabled: true,
      allowedOrigins: [
        'https://dbx-frontend.onrender.com',
        'https://dbx-admin.onrender.com'
      ]
    };

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

// Enhanced Database Security Middleware
app.use(secureConnection);
app.use(validateQuery());
app.use(monitorPerformance);
// Note: monitorConnectionPool will be added after database initialization

// Database Health Check Endpoint
app.get('/api/health/database', healthCheck);

// TEMPORARY: Admin password reset endpoint
app.get('/admin/reset-password', async (req, res) => {
  try {
    console.log('🔐 [ADMIN RESET] Password reset request received');
    
    const bcrypt = require('bcrypt');
    const newPassword = 'Admin@2025';
    
    // Hash password with bcrypt (10 salt rounds)
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log('🔒 [ADMIN RESET] Password hashed successfully');
    
    // Initialize database if needed
    if (!db || !db.users) {
      const dbModels = require('./models');
      await dbModels.sequelize.authenticate();
      console.log('✅ [ADMIN RESET] Database connected');
    }
    
    // Find and update admin user
    const adminUser = await db.users.findOne({
      where: { email: 'admin@dbx.com' }
    });
    
    if (!adminUser) {
      console.log('❌ [ADMIN RESET] Admin user not found');
      return res.status(404).json({
        success: false,
        message: 'Admin user not found'
      });
    }
    
    console.log('👤 [ADMIN RESET] Admin user found, updating password...');
    
    // Update password
    adminUser.password = hashedPassword;
    await adminUser.save();
    
    console.log('✅ [ADMIN RESET] Password updated successfully');
    
    // Verify the update
    const isValid = await bcrypt.compare(newPassword, adminUser.password);
    console.log('🔍 [ADMIN RESET] Password verification:', isValid ? 'VALID' : 'INVALID');
    
    res.json({
      success: true,
      message: 'Admin password reset successfully',
      credentials: {
        email: 'admin@dbx.com',
        password: newPassword
      },
      verification: isValid,
      timestamp: new Date().toISOString()
    });
    
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

// Mount Admin Routes
app.use('/admindashboard', adminRoutes);

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

// Mount Enhanced Admin Routes
app.use('/admindashboard', enhancedAdminRoutes);

// Mount Temporary Admin Setup Route (bypass problematic admin routes)
app.use('/temp-admin', tempAdminSetup);

// Mount Real-Time Analytics Routes
app.use('/admindashboard', realTimeAnalyticsRoutes);

// Mount User Management Routes
app.use('/admindashboard', userManagementRoutes);

// Mount System Health Monitoring Routes
app.use('/admindashboard', systemHealthRoutes);

// Mount Bitcoin Routes
app.use('/api/bitcoin', bitcoinRoutes);

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

// Global Express error handler to catch unhandled errors
app.use((err, req, res, next) => {
  console.error('Global Error:', err);
  console.error('Request URL:', req.url);
  console.error('Request Method:', req.method);
  console.error('Stack trace:', err.stack);
  
  // Don't send error details in production for security
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({ 
    success: false, 
    message: 'Server error', 
    error: isDevelopment ? err.message : 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Enhanced Initialization with Database and Blockchain Services
const initializeServices = async () => {
  try {
    console.log('[Server] Initializing enhanced database services...');
    
    // Initialize enhanced database manager
    const db = await initializeDatabase();
    
    // Add explicit Sequelize authentication check
    console.log('[Server] Verifying database connection...');
    try {
      await db.authenticate();
      console.log('✅ DB connection established');
      
      // Sync database tables - create if they don't exist
      console.log('[Server] Synchronizing database tables...');
      await db.sync({ alter: false });
      console.log('✅ Database tables synchronized successfully');
      
      // Now that database is connected, add connection pool monitoring middleware
      console.log('[Server] Adding connection pool monitoring middleware...');
      app.use(monitorConnectionPool);
      console.log('✅ Connection pool monitoring enabled');
    } catch (err) {
      console.error('❌ DB connection failed', err);
      throw err;
    }
    
    console.log('[Server] Initializing blockchain services...');
    
    // Initialize blockchain services
    await initializeBlockchainServices(db);
    
    console.log('[Server] Initializing wallet services...');
    
    // Initialize wallet services
    await initializeWalletServices(db);
    
    console.log('[Server] Initializing cross-chain services...');
    
    // Initialize cross-chain services
    await initializeCrossChainServices(db);
    
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
    
    console.log('[Server] Initializing real-time analytics service...');
    
    // Initialize real-time analytics service with Socket.io
    const realTimeAnalytics = initializeRealTimeAnalytics(io);
    
    console.log('[Server] Initializing user management service...');
    
    // Initialize user management service with Socket.io
    const userManagement = initializeUserManagementService(io);
    
    console.log('[Server] Initializing system health monitoring service...');
    
    // Initialize system health monitoring service with Socket.io
    const healthMonitoring = initializeHealthMonitoringService(io);
    
    console.log('[Server] All services initialized successfully!');
    
    return { db, riskSystem, realTimeAnalytics, userManagement, healthMonitoring };
  } catch (error) {
    console.error('[Server] Service initialization failed:', error);
    throw error;
  }
};

// Start server with enhanced initialization and Socket.io
initializeServices().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] DBX Backend running on port ${PORT} with enhanced database security and real-time Socket.io`);
    console.log(`[Server] Database health check available at: http://localhost:${PORT}/api/health/database`);
    console.log(`[Socket.io] Real-time transaction tracking enabled`);
  });
}).catch((err) => {
  console.error('[Server] Failed to initialize services:', err);
  process.exit(1);
});
