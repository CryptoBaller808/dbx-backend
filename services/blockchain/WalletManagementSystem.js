/**
 * Wallet Management System - Task 3.3 Phase 3
 * 
 * Comprehensive wallet management system that integrates all wallet connectors
 * and provides unified session management, account synchronization, and advanced features.
 */

const { UniversalWalletInterface, WalletTypes, WalletStatus } = require('./UniversalWalletInterface');
const { MultiChainWalletConnectorManager } = require('./MultiChainWalletConnectors');
const { BlockchainError, ErrorCodes } = require('./enhanced-blockchain-adapter');

/**
 * Wallet Session Manager
 * Manages wallet sessions, authentication, and persistence
 */
class WalletSessionManager {
  constructor(config = {}) {
    this.config = {
      sessionTimeout: 3600000, // 1 hour
      maxSessions: 10,
      persistSessions: true,
      encryptSessions: true,
      ...config
    };

    this.sessions = new Map();
    this.userSessions = new Map(); // userId -> sessionIds
    this.sessionTimers = new Map();
    
    console.log('🔧 Wallet Session Manager initialized');
  }

  /**
   * Create new wallet session
   */
  createSession(userId, walletType, connection) {
    try {
      const sessionId = this.generateSessionId();
      const session = {
        id: sessionId,
        userId,
        walletType,
        address: connection.address,
        chainId: connection.chainId,
        features: connection.features || [],
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        expiresAt: new Date(Date.now() + this.config.sessionTimeout).toISOString(),
        status: 'active',
        metadata: {
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          ip: 'unknown', // Would be set by server
          connectionMethod: connection.connectionMethod || 'direct'
        }
      };

      // Store session
      this.sessions.set(sessionId, session);
      
      // Associate with user
      if (!this.userSessions.has(userId)) {
        this.userSessions.set(userId, new Set());
      }
      this.userSessions.get(userId).add(sessionId);

      // Set expiration timer
      this.setSessionTimer(sessionId);

      console.log(`✅ Session created: ${sessionId} for user ${userId} (${walletType})`);
      
      return session;
    } catch (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }
  }

  /**
   * Get session by ID
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Check if session is expired
    if (new Date() > new Date(session.expiresAt)) {
      this.destroySession(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Update session activity
   */
  updateSessionActivity(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date().toISOString();
      session.expiresAt = new Date(Date.now() + this.config.sessionTimeout).toISOString();
      
      // Reset timer
      this.setSessionTimer(sessionId);
      
      return session;
    }
    return null;
  }

  /**
   * Destroy session
   */
  destroySession(sessionId) {
    try {
      const session = this.sessions.get(sessionId);
      if (session) {
        // Remove from user sessions
        const userSessionIds = this.userSessions.get(session.userId);
        if (userSessionIds) {
          userSessionIds.delete(sessionId);
          if (userSessionIds.size === 0) {
            this.userSessions.delete(session.userId);
          }
        }

        // Clear timer
        if (this.sessionTimers.has(sessionId)) {
          clearTimeout(this.sessionTimers.get(sessionId));
          this.sessionTimers.delete(sessionId);
        }

        // Remove session
        this.sessions.delete(sessionId);
        
        console.log(`🗑️ Session destroyed: ${sessionId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Error destroying session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Get user sessions
   */
  getUserSessions(userId) {
    const sessionIds = this.userSessions.get(userId);
    if (!sessionIds) {
      return [];
    }

    const sessions = [];
    for (const sessionId of sessionIds) {
      const session = this.getSession(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Set session expiration timer
   */
  setSessionTimer(sessionId) {
    // Clear existing timer
    if (this.sessionTimers.has(sessionId)) {
      clearTimeout(this.sessionTimers.get(sessionId));
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.destroySession(sessionId);
    }, this.config.sessionTimeout);

    this.sessionTimers.set(sessionId, timer);
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return 'ws_' + Date.now() + '_' + Math.random().toString(36).substr(2, 12);
  }

  /**
   * Cleanup expired sessions
   */
  cleanupExpiredSessions() {
    const now = new Date();
    const expiredSessions = [];

    for (const [sessionId, session] of this.sessions) {
      if (now > new Date(session.expiresAt)) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.destroySession(sessionId);
    }

    return expiredSessions.length;
  }

  /**
   * Get session statistics
   */
  getStatistics() {
    return {
      totalSessions: this.sessions.size,
      activeUsers: this.userSessions.size,
      sessionsByWallet: this.getSessionsByWallet(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get sessions grouped by wallet type
   */
  getSessionsByWallet() {
    const walletStats = {};
    
    for (const session of this.sessions.values()) {
      if (!walletStats[session.walletType]) {
        walletStats[session.walletType] = 0;
      }
      walletStats[session.walletType]++;
    }

    return walletStats;
  }
}

/**
 * Account Synchronization Manager
 * Manages cross-chain account synchronization and balance tracking
 */
class AccountSynchronizationManager {
  constructor(config = {}) {
    this.config = {
      syncInterval: 30000, // 30 seconds
      enableRealTimeSync: true,
      cacheTimeout: 60000, // 1 minute
      ...config
    };

    this.userAccounts = new Map(); // userId -> accounts
    this.balanceCache = new Map();
    this.syncTimers = new Map();
    
    console.log('🔧 Account Synchronization Manager initialized');
  }

  /**
   * Add account for user
   */
  addAccount(userId, walletType, address, chainId = null) {
    try {
      if (!this.userAccounts.has(userId)) {
        this.userAccounts.set(userId, new Map());
      }

      const userAccounts = this.userAccounts.get(userId);
      const accountKey = `${walletType}:${address}`;
      
      const account = {
        walletType,
        address,
        chainId,
        addedAt: new Date().toISOString(),
        lastSync: null,
        balance: null,
        tokens: [],
        status: 'active'
      };

      userAccounts.set(accountKey, account);
      
      // Start sync for this account
      if (this.config.enableRealTimeSync) {
        this.startAccountSync(userId, accountKey);
      }

      console.log(`✅ Account added: ${address} (${walletType}) for user ${userId}`);
      
      return account;
    } catch (error) {
      throw new Error(`Failed to add account: ${error.message}`);
    }
  }

  /**
   * Remove account for user
   */
  removeAccount(userId, walletType, address) {
    try {
      const userAccounts = this.userAccounts.get(userId);
      if (!userAccounts) {
        return false;
      }

      const accountKey = `${walletType}:${address}`;
      const removed = userAccounts.delete(accountKey);
      
      if (removed) {
        // Stop sync
        this.stopAccountSync(userId, accountKey);
        
        // Remove from cache
        this.balanceCache.delete(`${userId}:${accountKey}`);
        
        console.log(`🗑️ Account removed: ${address} (${walletType}) for user ${userId}`);
      }

      return removed;
    } catch (error) {
      console.error(`Error removing account:`, error);
      return false;
    }
  }

  /**
   * Get user accounts
   */
  getUserAccounts(userId) {
    const userAccounts = this.userAccounts.get(userId);
    if (!userAccounts) {
      return [];
    }

    return Array.from(userAccounts.values());
  }

  /**
   * Sync account balances
   */
  async syncAccountBalances(userId, accountKey = null) {
    try {
      const userAccounts = this.userAccounts.get(userId);
      if (!userAccounts) {
        return { success: false, error: 'No accounts found for user' };
      }

      const accountsToSync = accountKey ? 
        [userAccounts.get(accountKey)].filter(Boolean) : 
        Array.from(userAccounts.values());

      const syncResults = [];

      for (const account of accountsToSync) {
        try {
          // This would integrate with the blockchain adapters to get real balances
          // For now, we'll simulate balance fetching
          const balance = await this.fetchAccountBalance(account);
          
          account.balance = balance;
          account.lastSync = new Date().toISOString();
          
          // Cache the balance
          const cacheKey = `${userId}:${account.walletType}:${account.address}`;
          this.balanceCache.set(cacheKey, {
            balance,
            timestamp: Date.now(),
            expiresAt: Date.now() + this.config.cacheTimeout
          });

          syncResults.push({
            account: account.address,
            walletType: account.walletType,
            balance,
            success: true
          });
        } catch (error) {
          syncResults.push({
            account: account.address,
            walletType: account.walletType,
            success: false,
            error: error.message
          });
        }
      }

      return {
        success: true,
        results: syncResults,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to sync account balances: ${error.message}`);
    }
  }

  /**
   * Fetch account balance (placeholder implementation)
   */
  async fetchAccountBalance(account) {
    // This would integrate with the actual blockchain adapters
    // For now, return a mock balance
    const mockBalances = {
      'metamask': Math.random() * 10,
      'phantom': Math.random() * 100,
      'freighter': Math.random() * 1000,
      'xumm': Math.random() * 500,
      'walletconnect': Math.random() * 5
    };

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      native: mockBalances[account.walletType] || 0,
      tokens: [],
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get cached balance
   */
  getCachedBalance(userId, walletType, address) {
    const cacheKey = `${userId}:${walletType}:${address}`;
    const cached = this.balanceCache.get(cacheKey);
    
    if (cached && Date.now() < cached.expiresAt) {
      return cached.balance;
    }
    
    return null;
  }

  /**
   * Start account synchronization
   */
  startAccountSync(userId, accountKey) {
    const timerKey = `${userId}:${accountKey}`;
    
    // Clear existing timer
    if (this.syncTimers.has(timerKey)) {
      clearInterval(this.syncTimers.get(timerKey));
    }

    // Set new timer
    const timer = setInterval(async () => {
      try {
        await this.syncAccountBalances(userId, accountKey);
      } catch (error) {
        console.error(`Error syncing account ${accountKey}:`, error);
      }
    }, this.config.syncInterval);

    this.syncTimers.set(timerKey, timer);
  }

  /**
   * Stop account synchronization
   */
  stopAccountSync(userId, accountKey) {
    const timerKey = `${userId}:${accountKey}`;
    
    if (this.syncTimers.has(timerKey)) {
      clearInterval(this.syncTimers.get(timerKey));
      this.syncTimers.delete(timerKey);
    }
  }

  /**
   * Get synchronization statistics
   */
  getSyncStatistics() {
    const stats = {
      totalUsers: this.userAccounts.size,
      totalAccounts: 0,
      accountsByWallet: {},
      activeSyncTimers: this.syncTimers.size,
      cacheSize: this.balanceCache.size
    };

    for (const userAccounts of this.userAccounts.values()) {
      stats.totalAccounts += userAccounts.size;
      
      for (const account of userAccounts.values()) {
        if (!stats.accountsByWallet[account.walletType]) {
          stats.accountsByWallet[account.walletType] = 0;
        }
        stats.accountsByWallet[account.walletType]++;
      }
    }

    return stats;
  }

  /**
   * Cleanup expired cache entries
   */
  cleanupCache() {
    const now = Date.now();
    const expiredKeys = [];

    for (const [key, cached] of this.balanceCache) {
      if (now >= cached.expiresAt) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.balanceCache.delete(key);
    }

    return expiredKeys.length;
  }
}

/**
 * Comprehensive Wallet Management System
 * Main class that integrates all wallet management components
 */
class WalletManagementSystem {
  constructor(config = {}) {
    this.config = {
      enableSessionManagement: true,
      enableAccountSync: true,
      enableEventLogging: true,
      maxWalletsPerUser: 5,
      ...config
    };

    // Initialize components
    this.walletInterface = new UniversalWalletInterface(config);
    this.connectorManager = new MultiChainWalletConnectorManager(config);
    this.sessionManager = new WalletSessionManager(config);
    this.accountSync = new AccountSynchronizationManager(config);
    
    // Event handlers
    this.eventHandlers = new Map();
    
    // User wallet mappings
    this.userWallets = new Map(); // userId -> walletTypes[]
    
    console.log('🚀 Wallet Management System initialized');
  }

  /**
   * Initialize the wallet management system
   */
  async initialize() {
    try {
      console.log('🔧 Initializing Wallet Management System...');
      
      // Initialize wallet interface
      const interfaceResult = await this.walletInterface.initialize();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Start cleanup intervals
      this.startCleanupIntervals();
      
      console.log('✅ Wallet Management System initialized successfully');
      
      return {
        success: true,
        availableWallets: interfaceResult.availableWallets,
        supportedNetworks: interfaceResult.supportedNetworks,
        connectors: this.connectorManager.getAvailableConnectors().length
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to initialize Wallet Management System: ${error.message}`,
        ErrorCodes.INITIALIZATION_ERROR,
        'system',
        error
      );
    }
  }

  /**
   * Connect user to a wallet
   */
  async connectUserWallet(userId, walletType, options = {}) {
    try {
      console.log(`🔗 Connecting user ${userId} to ${walletType} wallet...`);
      
      // Check wallet limit
      const userWalletTypes = this.userWallets.get(userId) || [];
      if (userWalletTypes.length >= this.config.maxWalletsPerUser) {
        throw new Error(`Maximum wallet limit (${this.config.maxWalletsPerUser}) reached for user`);
      }

      // Connect wallet
      const connection = await this.connectorManager.connectWallet(walletType, options);
      
      // Create session
      let session = null;
      if (this.config.enableSessionManagement) {
        session = this.sessionManager.createSession(userId, walletType, connection);
      }

      // Add account for synchronization
      if (this.config.enableAccountSync && connection.address) {
        this.accountSync.addAccount(userId, walletType, connection.address, connection.chainId);
      }

      // Update user wallet mapping
      if (!this.userWallets.has(userId)) {
        this.userWallets.set(userId, []);
      }
      const userWallets = this.userWallets.get(userId);
      if (!userWallets.includes(walletType)) {
        userWallets.push(walletType);
      }

      // Emit event
      this.emitEvent('walletConnected', {
        userId,
        walletType,
        connection,
        session
      });

      console.log(`✅ User ${userId} connected to ${walletType} wallet: ${connection.address}`);
      
      return {
        success: true,
        walletType,
        connection,
        session
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to connect user wallet: ${error.message}`,
        ErrorCodes.WALLET_CONNECTION_FAILED,
        walletType,
        error
      );
    }
  }

  /**
   * Disconnect user from a wallet
   */
  async disconnectUserWallet(userId, walletType) {
    try {
      console.log(`🔌 Disconnecting user ${userId} from ${walletType} wallet...`);
      
      // Get connection info before disconnecting
      const connector = this.connectorManager.getConnector(walletType);
      const connection = connector ? connector.connection : null;

      // Disconnect wallet
      await this.connectorManager.disconnectWallet(walletType);
      
      // Destroy sessions
      if (this.config.enableSessionManagement) {
        const userSessions = this.sessionManager.getUserSessions(userId);
        for (const session of userSessions) {
          if (session.walletType === walletType) {
            this.sessionManager.destroySession(session.id);
          }
        }
      }

      // Remove account from sync
      if (this.config.enableAccountSync && connection && connection.address) {
        this.accountSync.removeAccount(userId, walletType, connection.address);
      }

      // Update user wallet mapping
      const userWallets = this.userWallets.get(userId);
      if (userWallets) {
        const index = userWallets.indexOf(walletType);
        if (index > -1) {
          userWallets.splice(index, 1);
        }
        if (userWallets.length === 0) {
          this.userWallets.delete(userId);
        }
      }

      // Emit event
      this.emitEvent('walletDisconnected', {
        userId,
        walletType
      });

      console.log(`✅ User ${userId} disconnected from ${walletType} wallet`);
      
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to disconnect user wallet: ${error.message}`);
    }
  }

  /**
   * Get user wallet status
   */
  getUserWalletStatus(userId) {
    try {
      const userWalletTypes = this.userWallets.get(userId) || [];
      const walletStatus = [];

      for (const walletType of userWalletTypes) {
        const connector = this.connectorManager.getConnector(walletType);
        const isConnected = this.connectorManager.isWalletConnected(walletType);
        
        walletStatus.push({
          walletType,
          isConnected,
          connection: isConnected ? connector.connection : null,
          session: this.config.enableSessionManagement ? 
            this.sessionManager.getUserSessions(userId).find(s => s.walletType === walletType) : null
        });
      }

      return {
        userId,
        connectedWallets: userWalletTypes.length,
        wallets: walletStatus,
        accounts: this.config.enableAccountSync ? this.accountSync.getUserAccounts(userId) : [],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to get user wallet status: ${error.message}`);
    }
  }

  /**
   * Sync user account balances
   */
  async syncUserBalances(userId) {
    try {
      if (!this.config.enableAccountSync) {
        throw new Error('Account synchronization is disabled');
      }

      const result = await this.accountSync.syncAccountBalances(userId);
      
      this.emitEvent('balancesSynced', {
        userId,
        result
      });

      return result;
    } catch (error) {
      throw new Error(`Failed to sync user balances: ${error.message}`);
    }
  }

  /**
   * Get available wallets for user
   */
  getAvailableWallets() {
    return this.walletInterface.availableWallets;
  }

  /**
   * Get wallets supporting a specific network
   */
  getWalletsForNetwork(network) {
    return this.walletInterface.getWalletsForNetwork(network);
  }

  /**
   * Switch network for user wallet
   */
  async switchUserWalletNetwork(userId, walletType, chainId) {
    try {
      const connector = this.connectorManager.getConnector(walletType);
      if (!connector || !connector.isConnected) {
        throw new Error(`Wallet ${walletType} is not connected for user ${userId}`);
      }

      // Switch network (for EVM wallets)
      if (connector.switchNetwork) {
        const result = await connector.switchNetwork(chainId);
        
        this.emitEvent('networkSwitched', {
          userId,
          walletType,
          chainId
        });

        return result;
      } else {
        throw new Error(`Network switching not supported for ${walletType}`);
      }
    } catch (error) {
      throw new Error(`Failed to switch network: ${error.message}`);
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Wallet interface events
    this.walletInterface.on('walletConnected', (data) => {
      this.emitEvent('walletInterfaceConnected', data);
    });

    this.walletInterface.on('walletDisconnected', (data) => {
      this.emitEvent('walletInterfaceDisconnected', data);
    });

    // Connector events
    for (const [walletType, connector] of this.connectorManager.connectors) {
      connector.on('connected', (data) => {
        this.emitEvent('connectorConnected', { walletType, ...data });
      });

      connector.on('disconnected', (data) => {
        this.emitEvent('connectorDisconnected', { walletType, ...data });
      });

      connector.on('accountsChanged', (data) => {
        this.emitEvent('connectorAccountsChanged', { walletType, ...data });
      });

      connector.on('chainChanged', (data) => {
        this.emitEvent('connectorChainChanged', { walletType, ...data });
      });
    }
  }

  /**
   * Start cleanup intervals
   */
  startCleanupIntervals() {
    // Session cleanup
    if (this.config.enableSessionManagement) {
      setInterval(() => {
        const cleaned = this.sessionManager.cleanupExpiredSessions();
        if (cleaned > 0) {
          console.log(`🧹 Cleaned up ${cleaned} expired sessions`);
        }
      }, 300000); // 5 minutes
    }

    // Cache cleanup
    if (this.config.enableAccountSync) {
      setInterval(() => {
        const cleaned = this.accountSync.cleanupCache();
        if (cleaned > 0) {
          console.log(`🧹 Cleaned up ${cleaned} expired cache entries`);
        }
      }, 600000); // 10 minutes
    }
  }

  /**
   * Event system
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  off(event, handler) {
    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emitEvent(event, data) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }

    // Log event if enabled
    if (this.config.enableEventLogging) {
      console.log(`📡 Event: ${event}`, data);
    }
  }

  /**
   * Get system statistics
   */
  getSystemStatistics() {
    return {
      walletInterface: this.walletInterface.getStatus(),
      sessions: this.config.enableSessionManagement ? this.sessionManager.getStatistics() : null,
      accountSync: this.config.enableAccountSync ? this.accountSync.getSyncStatistics() : null,
      connectors: this.connectorManager.getAvailableConnectors().length,
      activeConnections: this.connectorManager.getActiveConnections().length,
      totalUsers: this.userWallets.size,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Cleanup system resources
   */
  async cleanup() {
    try {
      console.log('🧹 Cleaning up Wallet Management System...');
      
      // Cleanup connectors
      await this.connectorManager.cleanup();
      
      // Cleanup wallet interface
      this.walletInterface.cleanup();
      
      // Clear all data
      this.userWallets.clear();
      this.eventHandlers.clear();
      
      console.log('✅ Wallet Management System cleaned up');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

module.exports = {
  WalletSessionManager,
  AccountSynchronizationManager,
  WalletManagementSystem
};

