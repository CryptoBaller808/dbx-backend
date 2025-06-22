const WalletIntegrationFramework = require('./WalletIntegrationFramework');
const { BlockchainError, ErrorCodes } = require('./blockchain-abstraction-layer');

/**
 * Wallet Service
 * High-level service for wallet operations across all blockchain networks
 */
class WalletService {
  constructor(adapterRegistry, db = null) {
    this.adapterRegistry = adapterRegistry;
    this.db = db;
    this.walletFramework = new WalletIntegrationFramework(adapterRegistry);
    this.userSessions = new Map(); // userId -> session data
    this.walletCache = new Map(); // cache for frequently accessed data
    
    // Initialize wallet monitoring
    this.walletFramework.startWalletMonitoring();
    
    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for wallet framework
   */
  setupEventListeners() {
    this.walletFramework.addEventListener('wallet_connected', (data) => {
      this.handleWalletConnected(data);
    });

    this.walletFramework.addEventListener('wallet_disconnected', (data) => {
      this.handleWalletDisconnected(data);
    });

    this.walletFramework.addEventListener('accounts_changed', (data) => {
      this.handleAccountsChanged(data);
    });

    this.walletFramework.addEventListener('transaction_signed', (data) => {
      this.handleTransactionSigned(data);
    });
  }

  /**
   * Get available wallets for the current environment
   */
  async getAvailableWallets() {
    try {
      const wallets = await this.walletFramework.detectAvailableWallets();
      
      // Add additional metadata
      return wallets.map(wallet => ({
        ...wallet,
        isRecommended: this.isRecommendedWallet(wallet.id),
        securityLevel: this.getWalletSecurityLevel(wallet.id),
        userFriendliness: this.getWalletUserFriendliness(wallet.id)
      }));
    } catch (error) {
      throw new BlockchainError(
        `Failed to get available wallets: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        'SYSTEM',
        error
      );
    }
  }

  /**
   * Connect to a wallet for a specific user and blockchain
   */
  async connectWallet(userId, chainId, walletType, options = {}) {
    try {
      // Validate inputs
      if (!userId || !chainId || !walletType) {
        throw new BlockchainError(
          'Missing required parameters: userId, chainId, walletType',
          ErrorCodes.INVALID_PARAMS,
          chainId
        );
      }

      // Check if user already has a wallet connected for this chain
      const existingConnection = this.getUserWalletConnection(userId, chainId);
      if (existingConnection && options.forceReconnect !== true) {
        return {
          success: true,
          alreadyConnected: true,
          walletInfo: existingConnection
        };
      }

      // Connect using the wallet framework
      const walletInfo = await this.walletFramework.connectWallet(chainId, walletType, options);

      // Store user session data
      this.storeUserSession(userId, chainId, walletInfo);

      // Save to database if available
      if (this.db) {
        await this.saveWalletConnection(userId, walletInfo);
      }

      // Clear relevant cache
      this.clearUserCache(userId);

      return {
        success: true,
        walletInfo,
        sessionId: walletInfo.sessionId
      };
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to connect wallet: ${error.message}`,
        ErrorCodes.WALLET_ERROR,
        chainId,
        error
      );
    }
  }

  /**
   * Disconnect wallet for a user and blockchain
   */
  async disconnectWallet(userId, chainId) {
    try {
      // Disconnect using the wallet framework
      const result = await this.walletFramework.disconnectWallet(chainId);

      // Remove user session data
      this.removeUserSession(userId, chainId);

      // Update database if available
      if (this.db) {
        await this.removeWalletConnection(userId, chainId);
      }

      // Clear relevant cache
      this.clearUserCache(userId);

      return result;
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to disconnect wallet: ${error.message}`,
        ErrorCodes.WALLET_ERROR,
        chainId,
        error
      );
    }
  }

  /**
   * Disconnect all wallets for a user
   */
  async disconnectAllWallets(userId) {
    try {
      const results = await this.walletFramework.disconnectAllWallets();

      // Remove all user session data
      this.userSessions.delete(userId);

      // Update database if available
      if (this.db) {
        await this.removeAllWalletConnections(userId);
      }

      // Clear user cache
      this.clearUserCache(userId);

      return results;
    } catch (error) {
      throw new BlockchainError(
        `Failed to disconnect all wallets: ${error.message}`,
        ErrorCodes.WALLET_ERROR,
        'SYSTEM',
        error
      );
    }
  }

  /**
   * Get wallet connection status for a user
   */
  getUserWalletStatus(userId) {
    const userSession = this.userSessions.get(userId);
    const globalStatus = this.walletFramework.getConnectionStatus();

    return {
      userId,
      ...globalStatus,
      userConnections: userSession?.connections || {},
      lastActivity: userSession?.lastActivity || null
    };
  }

  /**
   * Get specific wallet connection for user and chain
   */
  getUserWalletConnection(userId, chainId) {
    const userSession = this.userSessions.get(userId);
    return userSession?.connections?.[chainId] || null;
  }

  /**
   * Get multi-chain balance for a user
   */
  async getUserMultiChainBalance(userId, includeTokens = false) {
    try {
      const cacheKey = `balance_${userId}_${includeTokens}`;
      
      // Check cache first
      if (this.walletCache.has(cacheKey)) {
        const cached = this.walletCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 30000) { // 30 second cache
          return cached.data;
        }
      }

      const balances = await this.walletFramework.getMultiChainBalance();
      
      // Add token balances if requested
      if (includeTokens) {
        for (const balance of balances) {
          if (balance.chainId && !balance.error) {
            try {
              balance.tokens = await this.getUserTokenBalances(userId, balance.chainId, balance.address);
            } catch (error) {
              console.warn(`Failed to get token balances for ${balance.chainId}:`, error.message);
              balance.tokens = [];
            }
          }
        }
      }

      // Cache the result
      this.walletCache.set(cacheKey, {
        data: balances,
        timestamp: Date.now()
      });

      return balances;
    } catch (error) {
      throw new BlockchainError(
        `Failed to get multi-chain balance: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        'SYSTEM',
        error
      );
    }
  }

  /**
   * Get token balances for a specific chain
   */
  async getUserTokenBalances(userId, chainId, address) {
    try {
      const adapter = this.adapterRegistry.getAdapter(chainId);
      const tokenBalances = [];

      // Get popular tokens for this chain
      let popularTokens = {};
      
      if (adapter.getPopularTokens) {
        popularTokens = adapter.getPopularTokens();
      } else if (adapter.getPopularAssets) {
        popularTokens = adapter.getPopularAssets();
      }

      // Query balance for each popular token
      for (const [symbol, tokenInfo] of Object.entries(popularTokens)) {
        try {
          let balance;
          
          if (chainId === 'XRP') {
            balance = await adapter.getBalance(address, tokenInfo.currency, tokenInfo.issuer);
          } else if (chainId === 'STELLAR') {
            balance = await adapter.getBalance(address, tokenInfo.code, tokenInfo.issuer);
          } else if (chainId === 'SOLANA') {
            balance = await adapter.getBalance(address, tokenInfo); // Token mint address
          } else {
            // EVM chains
            balance = await adapter.getBalance(address, tokenInfo);
          }

          if (parseFloat(balance.balance) > 0) {
            tokenBalances.push({
              symbol,
              ...balance,
              tokenInfo
            });
          }
        } catch (error) {
          console.warn(`Failed to get ${symbol} balance on ${chainId}:`, error.message);
        }
      }

      return tokenBalances;
    } catch (error) {
      throw new BlockchainError(
        `Failed to get token balances: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        chainId,
        error
      );
    }
  }

  /**
   * Switch network for EVM wallets
   */
  async switchNetwork(userId, chainId) {
    try {
      const userConnection = this.getUserWalletConnection(userId, chainId);
      
      if (!userConnection) {
        throw new BlockchainError(
          `No wallet connected for ${chainId}`,
          ErrorCodes.INVALID_PARAMS,
          chainId
        );
      }

      const result = await this.walletFramework.switchNetwork(chainId);

      // Update user session
      this.updateUserSession(userId, chainId, { lastNetworkSwitch: new Date().toISOString() });

      return result;
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to switch network: ${error.message}`,
        ErrorCodes.WALLET_ERROR,
        chainId,
        error
      );
    }
  }

  /**
   * Sign transaction for a user
   */
  async signTransaction(userId, chainId, transaction, options = {}) {
    try {
      const userConnection = this.getUserWalletConnection(userId, chainId);
      
      if (!userConnection) {
        throw new BlockchainError(
          `No wallet connected for ${chainId}`,
          ErrorCodes.INVALID_PARAMS,
          chainId
        );
      }

      const signedTx = await this.walletFramework.signTransaction(chainId, transaction, options);

      // Update user session with signing activity
      this.updateUserSession(userId, chainId, { 
        lastTransactionSigned: new Date().toISOString(),
        transactionCount: (userConnection.transactionCount || 0) + 1
      });

      // Log transaction if database available
      if (this.db) {
        await this.logUserTransaction(userId, chainId, signedTx);
      }

      return signedTx;
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to sign transaction: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        chainId,
        error
      );
    }
  }

  /**
   * Get wallet recommendations for a user
   */
  getWalletRecommendations(userId, userPreferences = {}) {
    try {
      const recommendations = this.walletFramework.getWalletRecommendations(userPreferences);
      
      // Add user-specific context
      const userSession = this.userSessions.get(userId);
      const connectedWallets = userSession?.connections || {};

      return recommendations.map(rec => ({
        ...rec,
        isAlreadyConnected: Object.values(connectedWallets).some(
          conn => conn.walletType === rec.walletId
        ),
        userSpecificReason: this.getUserSpecificReason(rec.walletId, userPreferences)
      }));
    } catch (error) {
      throw new BlockchainError(
        `Failed to get wallet recommendations: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        'SYSTEM',
        error
      );
    }
  }

  /**
   * Store user session data
   */
  storeUserSession(userId, chainId, walletInfo) {
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, {
        connections: {},
        lastActivity: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
    }

    const userSession = this.userSessions.get(userId);
    userSession.connections[chainId] = {
      ...walletInfo,
      connectedAt: new Date().toISOString(),
      transactionCount: 0
    };
    userSession.lastActivity = new Date().toISOString();
  }

  /**
   * Remove user session data
   */
  removeUserSession(userId, chainId) {
    const userSession = this.userSessions.get(userId);
    if (userSession && userSession.connections) {
      delete userSession.connections[chainId];
      userSession.lastActivity = new Date().toISOString();
    }
  }

  /**
   * Update user session data
   */
  updateUserSession(userId, chainId, updates) {
    const userSession = this.userSessions.get(userId);
    if (userSession && userSession.connections && userSession.connections[chainId]) {
      Object.assign(userSession.connections[chainId], updates);
      userSession.lastActivity = new Date().toISOString();
    }
  }

  /**
   * Clear user cache
   */
  clearUserCache(userId) {
    for (const [key] of this.walletCache) {
      if (key.includes(userId)) {
        this.walletCache.delete(key);
      }
    }
  }

  /**
   * Event handlers
   */
  handleWalletConnected(data) {
    console.log(`[Wallet Service] Wallet connected: ${data.walletType} for ${data.chainId}`);
    // Additional logging or notifications can be added here
  }

  handleWalletDisconnected(data) {
    console.log(`[Wallet Service] Wallet disconnected: ${data.walletType} for ${data.chainId}`);
    // Clean up any user sessions that might be affected
  }

  handleAccountsChanged(data) {
    console.log(`[Wallet Service] Accounts changed for ${data.walletType}:`, data.accounts);
    // Update user sessions with new account information
  }

  handleTransactionSigned(data) {
    console.log(`[Wallet Service] Transaction signed on ${data.chainId}: ${data.hash}`);
    // Additional transaction logging or notifications
  }

  /**
   * Helper methods
   */
  isRecommendedWallet(walletId) {
    const recommended = ['metamask', 'phantom', 'xumm', 'freighter'];
    return recommended.includes(walletId);
  }

  getWalletSecurityLevel(walletId) {
    const securityLevels = {
      metamask: 'high',
      phantom: 'high',
      xumm: 'very_high',
      freighter: 'high',
      solflare: 'medium',
      walletconnect: 'medium'
    };
    return securityLevels[walletId] || 'medium';
  }

  getWalletUserFriendliness(walletId) {
    const friendliness = {
      metamask: 'high',
      phantom: 'very_high',
      xumm: 'medium',
      freighter: 'high',
      solflare: 'medium',
      walletconnect: 'medium'
    };
    return friendliness[walletId] || 'medium';
  }

  getUserSpecificReason(walletId, userPreferences) {
    // Add user-specific reasoning based on preferences
    if (userPreferences.experienceLevel === 'beginner' && walletId === 'phantom') {
      return 'Great for beginners with intuitive interface';
    }
    if (userPreferences.securityFocused && walletId === 'xumm') {
      return 'Highest security with biometric authentication';
    }
    return null;
  }

  /**
   * Database operations (if database is available)
   */
  async saveWalletConnection(userId, walletInfo) {
    if (!this.db) return;
    
    try {
      // Implementation depends on database schema
      console.log(`[Wallet Service] Saving wallet connection for user ${userId}`);
    } catch (error) {
      console.error('[Wallet Service] Failed to save wallet connection:', error);
    }
  }

  async removeWalletConnection(userId, chainId) {
    if (!this.db) return;
    
    try {
      console.log(`[Wallet Service] Removing wallet connection for user ${userId}, chain ${chainId}`);
    } catch (error) {
      console.error('[Wallet Service] Failed to remove wallet connection:', error);
    }
  }

  async removeAllWalletConnections(userId) {
    if (!this.db) return;
    
    try {
      console.log(`[Wallet Service] Removing all wallet connections for user ${userId}`);
    } catch (error) {
      console.error('[Wallet Service] Failed to remove all wallet connections:', error);
    }
  }

  async logUserTransaction(userId, chainId, signedTx) {
    if (!this.db) return;
    
    try {
      console.log(`[Wallet Service] Logging transaction for user ${userId}: ${signedTx.hash}`);
    } catch (error) {
      console.error('[Wallet Service] Failed to log transaction:', error);
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.walletFramework.cleanup();
    this.userSessions.clear();
    this.walletCache.clear();
  }
}

module.exports = WalletService;

