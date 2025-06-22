/**
 * Universal Wallet Interface - Task 3.3 Phase 1
 * 
 * Standardized wallet interface that provides unified connection and management
 * across all supported blockchain networks and wallet types.
 */

const { BlockchainError, ErrorCodes } = require('./enhanced-blockchain-adapter');

/**
 * Wallet Types Enumeration
 */
const WalletTypes = {
  METAMASK: 'metamask',
  XUMM: 'xumm',
  PHANTOM: 'phantom',
  FREIGHTER: 'freighter',
  WALLETCONNECT: 'walletconnect',
  BROWSER_EXTENSION: 'browser_extension',
  HARDWARE: 'hardware',
  MOBILE: 'mobile'
};

/**
 * Wallet Status Enumeration
 */
const WalletStatus = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error',
  LOCKED: 'locked',
  UNAVAILABLE: 'unavailable'
};

/**
 * Network Support Matrix
 */
const NetworkSupport = {
  [WalletTypes.METAMASK]: ['ethereum', 'xdc', 'avalanche', 'polygon', 'bsc'],
  [WalletTypes.XUMM]: ['xrp'],
  [WalletTypes.PHANTOM]: ['solana'],
  [WalletTypes.FREIGHTER]: ['stellar'],
  [WalletTypes.WALLETCONNECT]: ['ethereum', 'xdc', 'avalanche', 'polygon', 'bsc', 'solana'],
  [WalletTypes.BROWSER_EXTENSION]: ['ethereum', 'xdc', 'avalanche', 'polygon', 'bsc'],
  [WalletTypes.HARDWARE]: ['ethereum', 'xdc', 'avalanche', 'polygon', 'bsc', 'bitcoin'],
  [WalletTypes.MOBILE]: ['ethereum', 'xdc', 'avalanche', 'polygon', 'bsc', 'xrp', 'solana', 'stellar']
};

/**
 * Universal Wallet Interface
 * Provides standardized methods for wallet connection and management
 */
class UniversalWalletInterface {
  constructor(config = {}) {
    this.config = {
      autoDetect: true,
      enableMultiWallet: true,
      sessionTimeout: 3600000, // 1 hour
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };

    // Wallet registry
    this.wallets = new Map();
    this.connectedWallets = new Map();
    this.walletSessions = new Map();
    
    // Event handlers
    this.eventHandlers = new Map();
    
    // Detection status
    this.detectionComplete = false;
    this.availableWallets = [];
    
    console.log('🔧 Universal Wallet Interface initialized');
  }

  /**
   * Initialize wallet interface and detect available wallets
   */
  async initialize() {
    try {
      console.log('🔍 Initializing wallet detection...');
      
      if (this.config.autoDetect) {
        await this.detectAvailableWallets();
      }
      
      // Set up event listeners
      this.setupEventListeners();
      
      console.log(`✅ Wallet interface initialized with ${this.availableWallets.length} available wallets`);
      
      return {
        success: true,
        availableWallets: this.availableWallets,
        supportedNetworks: this.getSupportedNetworks()
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to initialize wallet interface: ${error.message}`,
        ErrorCodes.WALLET_ERROR,
        'universal',
        error
      );
    }
  }

  /**
   * Detect available wallets in the environment
   */
  async detectAvailableWallets() {
    const detectedWallets = [];
    
    try {
      // Detect MetaMask
      if (this.detectMetaMask()) {
        detectedWallets.push({
          type: WalletTypes.METAMASK,
          name: 'MetaMask',
          icon: '🦊',
          networks: NetworkSupport[WalletTypes.METAMASK],
          status: WalletStatus.DISCONNECTED,
          features: ['evm', 'signing', 'network-switching']
        });
      }

      // Detect Phantom
      if (this.detectPhantom()) {
        detectedWallets.push({
          type: WalletTypes.PHANTOM,
          name: 'Phantom',
          icon: '👻',
          networks: NetworkSupport[WalletTypes.PHANTOM],
          status: WalletStatus.DISCONNECTED,
          features: ['solana', 'spl-tokens', 'signing']
        });
      }

      // Detect Freighter
      if (this.detectFreighter()) {
        detectedWallets.push({
          type: WalletTypes.FREIGHTER,
          name: 'Freighter',
          icon: '🌟',
          networks: NetworkSupport[WalletTypes.FREIGHTER],
          status: WalletStatus.DISCONNECTED,
          features: ['stellar', 'assets', 'signing']
        });
      }

      // XUMM is always available (mobile/QR)
      detectedWallets.push({
        type: WalletTypes.XUMM,
        name: 'XUMM',
        icon: '🔴',
        networks: NetworkSupport[WalletTypes.XUMM],
        status: WalletStatus.DISCONNECTED,
        features: ['xrp', 'qr-signing', 'mobile']
      });

      // WalletConnect is always available
      detectedWallets.push({
        type: WalletTypes.WALLETCONNECT,
        name: 'WalletConnect',
        icon: '🔗',
        networks: NetworkSupport[WalletTypes.WALLETCONNECT],
        status: WalletStatus.DISCONNECTED,
        features: ['multi-chain', 'qr-connection', 'mobile']
      });

      this.availableWallets = detectedWallets;
      this.detectionComplete = true;
      
      console.log(`🔍 Detected ${detectedWallets.length} available wallets`);
      
      return detectedWallets;
    } catch (error) {
      console.error('❌ Wallet detection failed:', error.message);
      return [];
    }
  }

  /**
   * Detect MetaMask wallet
   */
  detectMetaMask() {
    try {
      // Browser environment check
      if (typeof window !== 'undefined' && window.ethereum) {
        return window.ethereum.isMetaMask || 
               (window.ethereum.providers && window.ethereum.providers.some(p => p.isMetaMask));
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Detect Phantom wallet
   */
  detectPhantom() {
    try {
      if (typeof window !== 'undefined' && window.solana) {
        return window.solana.isPhantom;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Detect Freighter wallet
   */
  detectFreighter() {
    try {
      if (typeof window !== 'undefined' && window.freighter) {
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Connect to a specific wallet
   */
  async connectWallet(walletType, options = {}) {
    try {
      console.log(`🔗 Connecting to ${walletType} wallet...`);
      
      // Check if wallet is available
      const wallet = this.availableWallets.find(w => w.type === walletType);
      if (!wallet) {
        throw new BlockchainError(
          `Wallet ${walletType} is not available`,
          ErrorCodes.WALLET_NOT_FOUND,
          walletType
        );
      }

      // Update wallet status
      wallet.status = WalletStatus.CONNECTING;
      this.emitEvent('walletStatusChanged', { walletType, status: WalletStatus.CONNECTING });

      // Connect based on wallet type
      let connection;
      switch (walletType) {
        case WalletTypes.METAMASK:
          connection = await this.connectMetaMask(options);
          break;
        case WalletTypes.PHANTOM:
          connection = await this.connectPhantom(options);
          break;
        case WalletTypes.FREIGHTER:
          connection = await this.connectFreighter(options);
          break;
        case WalletTypes.XUMM:
          connection = await this.connectXUMM(options);
          break;
        case WalletTypes.WALLETCONNECT:
          connection = await this.connectWalletConnect(options);
          break;
        default:
          throw new BlockchainError(
            `Unsupported wallet type: ${walletType}`,
            ErrorCodes.WALLET_NOT_SUPPORTED,
            walletType
          );
      }

      // Store connection
      this.connectedWallets.set(walletType, connection);
      
      // Create session
      const session = this.createWalletSession(walletType, connection);
      this.walletSessions.set(walletType, session);

      // Update wallet status
      wallet.status = WalletStatus.CONNECTED;
      this.emitEvent('walletConnected', { walletType, connection, session });

      console.log(`✅ Successfully connected to ${walletType} wallet`);
      
      return {
        success: true,
        walletType,
        connection,
        session
      };
    } catch (error) {
      // Update wallet status on error
      const wallet = this.availableWallets.find(w => w.type === walletType);
      if (wallet) {
        wallet.status = WalletStatus.ERROR;
      }
      
      this.emitEvent('walletError', { walletType, error: error.message });
      
      throw new BlockchainError(
        `Failed to connect ${walletType} wallet: ${error.message}`,
        ErrorCodes.WALLET_CONNECTION_FAILED,
        walletType,
        error
      );
    }
  }

  /**
   * Connect MetaMask wallet
   */
  async connectMetaMask(options = {}) {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask not detected');
      }

      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts available');
      }

      // Get network information
      const chainId = await window.ethereum.request({
        method: 'eth_chainId'
      });

      return {
        type: WalletTypes.METAMASK,
        address: accounts[0],
        accounts,
        chainId: parseInt(chainId, 16),
        provider: window.ethereum,
        features: ['evm', 'signing', 'network-switching'],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`MetaMask connection failed: ${error.message}`);
    }
  }

  /**
   * Connect Phantom wallet
   */
  async connectPhantom(options = {}) {
    try {
      if (!window.solana || !window.solana.isPhantom) {
        throw new Error('Phantom wallet not detected');
      }

      // Connect to Phantom
      const response = await window.solana.connect();
      
      return {
        type: WalletTypes.PHANTOM,
        address: response.publicKey.toString(),
        publicKey: response.publicKey,
        provider: window.solana,
        features: ['solana', 'spl-tokens', 'signing'],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Phantom connection failed: ${error.message}`);
    }
  }

  /**
   * Connect Freighter wallet
   */
  async connectFreighter(options = {}) {
    try {
      if (!window.freighter) {
        throw new Error('Freighter wallet not detected');
      }

      // Check if Freighter is available
      const isAvailable = await window.freighter.isConnected();
      if (!isAvailable) {
        throw new Error('Freighter wallet not available');
      }

      // Get public key
      const publicKey = await window.freighter.getPublicKey();
      
      return {
        type: WalletTypes.FREIGHTER,
        address: publicKey,
        publicKey,
        provider: window.freighter,
        features: ['stellar', 'assets', 'signing'],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Freighter connection failed: ${error.message}`);
    }
  }

  /**
   * Connect XUMM wallet (QR-based)
   */
  async connectXUMM(options = {}) {
    try {
      // XUMM connection would typically involve QR code generation
      // For now, return a placeholder connection
      return {
        type: WalletTypes.XUMM,
        address: null, // Will be set after QR scan
        connectionMethod: 'qr',
        qrCode: 'placeholder-qr-code-data',
        provider: 'xumm',
        features: ['xrp', 'qr-signing', 'mobile'],
        timestamp: new Date().toISOString(),
        status: 'awaiting_scan'
      };
    } catch (error) {
      throw new Error(`XUMM connection failed: ${error.message}`);
    }
  }

  /**
   * Connect WalletConnect
   */
  async connectWalletConnect(options = {}) {
    try {
      // WalletConnect connection would involve QR code or deep linking
      // For now, return a placeholder connection
      return {
        type: WalletTypes.WALLETCONNECT,
        address: null, // Will be set after connection
        connectionMethod: 'qr',
        qrCode: 'placeholder-walletconnect-qr',
        provider: 'walletconnect',
        features: ['multi-chain', 'qr-connection', 'mobile'],
        timestamp: new Date().toISOString(),
        status: 'awaiting_connection'
      };
    } catch (error) {
      throw new Error(`WalletConnect connection failed: ${error.message}`);
    }
  }

  /**
   * Disconnect wallet
   */
  async disconnectWallet(walletType) {
    try {
      console.log(`🔌 Disconnecting ${walletType} wallet...`);
      
      const connection = this.connectedWallets.get(walletType);
      if (!connection) {
        throw new Error(`Wallet ${walletType} is not connected`);
      }

      // Perform wallet-specific disconnection
      switch (walletType) {
        case WalletTypes.PHANTOM:
          if (connection.provider && connection.provider.disconnect) {
            await connection.provider.disconnect();
          }
          break;
        // Other wallets may have specific disconnection methods
      }

      // Remove from connected wallets
      this.connectedWallets.delete(walletType);
      this.walletSessions.delete(walletType);

      // Update wallet status
      const wallet = this.availableWallets.find(w => w.type === walletType);
      if (wallet) {
        wallet.status = WalletStatus.DISCONNECTED;
      }

      this.emitEvent('walletDisconnected', { walletType });
      
      console.log(`✅ Successfully disconnected ${walletType} wallet`);
      
      return { success: true, walletType };
    } catch (error) {
      throw new BlockchainError(
        `Failed to disconnect ${walletType} wallet: ${error.message}`,
        ErrorCodes.WALLET_ERROR,
        walletType,
        error
      );
    }
  }

  /**
   * Create wallet session
   */
  createWalletSession(walletType, connection) {
    const session = {
      id: this.generateSessionId(),
      walletType,
      address: connection.address,
      chainId: connection.chainId,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.config.sessionTimeout).toISOString(),
      features: connection.features || [],
      metadata: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        timestamp: Date.now()
      }
    };

    return session;
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get connected wallets
   */
  getConnectedWallets() {
    return Array.from(this.connectedWallets.entries()).map(([type, connection]) => ({
      type,
      connection,
      session: this.walletSessions.get(type)
    }));
  }

  /**
   * Get wallet by type
   */
  getWallet(walletType) {
    return this.connectedWallets.get(walletType);
  }

  /**
   * Check if wallet is connected
   */
  isWalletConnected(walletType) {
    return this.connectedWallets.has(walletType);
  }

  /**
   * Get supported networks for all wallets
   */
  getSupportedNetworks() {
    const networks = new Set();
    
    for (const wallet of this.availableWallets) {
      wallet.networks.forEach(network => networks.add(network));
    }
    
    return Array.from(networks);
  }

  /**
   * Get wallets supporting a specific network
   */
  getWalletsForNetwork(network) {
    return this.availableWallets.filter(wallet => 
      wallet.networks.includes(network)
    );
  }

  /**
   * Switch network for EVM wallets
   */
  async switchNetwork(walletType, chainId) {
    try {
      const connection = this.connectedWallets.get(walletType);
      if (!connection) {
        throw new Error(`Wallet ${walletType} is not connected`);
      }

      if (walletType === WalletTypes.METAMASK && connection.provider) {
        await connection.provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${chainId.toString(16)}` }]
        });

        // Update connection
        connection.chainId = chainId;
        this.emitEvent('networkSwitched', { walletType, chainId });
        
        return { success: true, chainId };
      }

      throw new Error(`Network switching not supported for ${walletType}`);
    } catch (error) {
      throw new BlockchainError(
        `Failed to switch network: ${error.message}`,
        ErrorCodes.WALLET_ERROR,
        walletType,
        error
      );
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // MetaMask events
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        this.handleAccountsChanged(WalletTypes.METAMASK, accounts);
      });

      window.ethereum.on('chainChanged', (chainId) => {
        this.handleChainChanged(WalletTypes.METAMASK, parseInt(chainId, 16));
      });

      window.ethereum.on('disconnect', () => {
        this.handleWalletDisconnected(WalletTypes.METAMASK);
      });
    }

    // Phantom events
    if (typeof window !== 'undefined' && window.solana) {
      window.solana.on('disconnect', () => {
        this.handleWalletDisconnected(WalletTypes.PHANTOM);
      });
    }
  }

  /**
   * Handle accounts changed event
   */
  handleAccountsChanged(walletType, accounts) {
    const connection = this.connectedWallets.get(walletType);
    if (connection && accounts.length > 0) {
      connection.address = accounts[0];
      connection.accounts = accounts;
      this.emitEvent('accountsChanged', { walletType, accounts });
    } else if (connection && accounts.length === 0) {
      this.handleWalletDisconnected(walletType);
    }
  }

  /**
   * Handle chain changed event
   */
  handleChainChanged(walletType, chainId) {
    const connection = this.connectedWallets.get(walletType);
    if (connection) {
      connection.chainId = chainId;
      this.emitEvent('chainChanged', { walletType, chainId });
    }
  }

  /**
   * Handle wallet disconnected event
   */
  handleWalletDisconnected(walletType) {
    this.connectedWallets.delete(walletType);
    this.walletSessions.delete(walletType);
    
    const wallet = this.availableWallets.find(w => w.type === walletType);
    if (wallet) {
      wallet.status = WalletStatus.DISCONNECTED;
    }
    
    this.emitEvent('walletDisconnected', { walletType });
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
  }

  /**
   * Get wallet interface status
   */
  getStatus() {
    return {
      initialized: this.detectionComplete,
      availableWallets: this.availableWallets.length,
      connectedWallets: this.connectedWallets.size,
      supportedNetworks: this.getSupportedNetworks().length,
      sessions: this.walletSessions.size,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    // Disconnect all wallets
    for (const walletType of this.connectedWallets.keys()) {
      try {
        this.disconnectWallet(walletType);
      } catch (error) {
        console.error(`Error disconnecting ${walletType}:`, error);
      }
    }

    // Clear all data
    this.connectedWallets.clear();
    this.walletSessions.clear();
    this.eventHandlers.clear();
    
    console.log('🧹 Universal Wallet Interface cleaned up');
  }
}

module.exports = {
  UniversalWalletInterface,
  WalletTypes,
  WalletStatus,
  NetworkSupport
};

