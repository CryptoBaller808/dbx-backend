const { BlockchainError, ErrorCodes } = require('./blockchain-abstraction-layer');

/**
 * Unified Wallet Integration Framework
 * Manages wallet connections across all supported blockchain networks
 */
class WalletIntegrationFramework {
  constructor(adapterRegistry) {
    this.adapterRegistry = adapterRegistry;
    this.connectedWallets = new Map(); // chainId -> wallet info
    this.walletSessions = new Map(); // sessionId -> session data
    this.eventListeners = new Map(); // event -> callbacks
    this.supportedWallets = this.initializeSupportedWallets();
  }

  /**
   * Initialize supported wallet configurations
   */
  initializeSupportedWallets() {
    return {
      // EVM-compatible wallets
      metamask: {
        name: 'MetaMask',
        type: 'browser_extension',
        icon: '/assets/wallets/metamask.svg',
        downloadUrl: 'https://metamask.io/download/',
        supportedChains: ['XDC', 'AVALANCHE', 'POLYGON', 'BSC'],
        features: ['network_switching', 'account_switching', 'transaction_signing'],
        detectionMethod: 'window.ethereum && window.ethereum.isMetaMask'
      },
      
      // XRP Ledger wallets
      xumm: {
        name: 'XUMM',
        type: 'mobile_app',
        icon: '/assets/wallets/xumm.svg',
        downloadUrl: 'https://xumm.app/',
        supportedChains: ['XRP'],
        features: ['qr_code_signing', 'push_notifications', 'biometric_auth'],
        detectionMethod: 'api_key_required'
      },
      
      // Stellar wallets
      freighter: {
        name: 'Freighter',
        type: 'browser_extension',
        icon: '/assets/wallets/freighter.svg',
        downloadUrl: 'https://freighter.app/',
        supportedChains: ['STELLAR'],
        features: ['account_management', 'transaction_signing', 'asset_management'],
        detectionMethod: 'window.freighter'
      },
      
      // Solana wallets
      phantom: {
        name: 'Phantom',
        type: 'browser_extension',
        icon: '/assets/wallets/phantom.svg',
        downloadUrl: 'https://phantom.app/',
        supportedChains: ['SOLANA'],
        features: ['account_switching', 'transaction_signing', 'token_management'],
        detectionMethod: 'window.solana && window.solana.isPhantom'
      },
      
      solflare: {
        name: 'Solflare',
        type: 'browser_extension',
        icon: '/assets/wallets/solflare.svg',
        downloadUrl: 'https://solflare.com/',
        supportedChains: ['SOLANA'],
        features: ['account_switching', 'transaction_signing', 'staking'],
        detectionMethod: 'window.solflare && window.solflare.isSolflare'
      },
      
      // Multi-chain wallets
      walletconnect: {
        name: 'WalletConnect',
        type: 'protocol',
        icon: '/assets/wallets/walletconnect.svg',
        downloadUrl: 'https://walletconnect.com/',
        supportedChains: ['XDC', 'AVALANCHE', 'POLYGON', 'BSC', 'STELLAR', 'SOLANA'],
        features: ['qr_code_pairing', 'mobile_wallets', 'cross_platform'],
        detectionMethod: 'protocol_based'
      }
    };
  }

  /**
   * Detect available wallets in the current environment
   */
  async detectAvailableWallets() {
    const availableWallets = [];
    
    for (const [walletId, walletConfig] of Object.entries(this.supportedWallets)) {
      try {
        const isAvailable = await this.checkWalletAvailability(walletId, walletConfig);
        
        if (isAvailable) {
          availableWallets.push({
            id: walletId,
            name: walletConfig.name,
            type: walletConfig.type,
            icon: walletConfig.icon,
            supportedChains: walletConfig.supportedChains,
            features: walletConfig.features,
            status: 'available'
          });
        } else {
          availableWallets.push({
            id: walletId,
            name: walletConfig.name,
            type: walletConfig.type,
            icon: walletConfig.icon,
            supportedChains: walletConfig.supportedChains,
            features: walletConfig.features,
            status: 'not_installed',
            downloadUrl: walletConfig.downloadUrl
          });
        }
      } catch (error) {
        console.warn(`[Wallet Framework] Failed to detect ${walletId}:`, error.message);
      }
    }
    
    return availableWallets;
  }

  /**
   * Check if a specific wallet is available
   */
  async checkWalletAvailability(walletId, walletConfig) {
    if (typeof window === 'undefined') {
      // Server-side environment
      return walletId === 'xumm' || walletId === 'walletconnect';
    }

    switch (walletId) {
      case 'metamask':
        return window.ethereum && window.ethereum.isMetaMask;
      
      case 'freighter':
        return !!window.freighter;
      
      case 'phantom':
        return window.solana && window.solana.isPhantom;
      
      case 'solflare':
        return window.solflare && window.solflare.isSolflare;
      
      case 'xumm':
        // XUMM requires API keys and works via QR codes
        return true;
      
      case 'walletconnect':
        // WalletConnect is protocol-based
        return true;
      
      default:
        return false;
    }
  }

  /**
   * Connect to a wallet for a specific blockchain
   */
  async connectWallet(chainId, walletType, options = {}) {
    try {
      const adapter = this.adapterRegistry.getAdapter(chainId);
      
      if (!adapter) {
        throw new BlockchainError(
          `Unsupported blockchain: ${chainId}`,
          ErrorCodes.INVALID_PARAMS,
          chainId
        );
      }

      // Check if wallet supports this chain
      const walletConfig = this.supportedWallets[walletType];
      if (!walletConfig || !walletConfig.supportedChains.includes(chainId)) {
        throw new BlockchainError(
          `Wallet ${walletType} does not support ${chainId}`,
          ErrorCodes.INVALID_PARAMS,
          chainId
        );
      }

      // Connect using the adapter
      const connectionResult = await adapter.connectWallet({
        walletType,
        ...options
      });

      // Store connection info
      const walletInfo = {
        chainId,
        walletType,
        ...connectionResult,
        connectedAt: new Date().toISOString(),
        sessionId: this.generateSessionId()
      };

      this.connectedWallets.set(chainId, walletInfo);
      this.walletSessions.set(walletInfo.sessionId, walletInfo);

      // Emit connection event
      this.emitEvent('wallet_connected', {
        chainId,
        walletType,
        walletInfo
      });

      return walletInfo;
    } catch (error) {
      this.emitEvent('wallet_connection_failed', {
        chainId,
        walletType,
        error: error.message
      });
      
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
   * Disconnect from a wallet
   */
  async disconnectWallet(chainId) {
    try {
      const walletInfo = this.connectedWallets.get(chainId);
      
      if (!walletInfo) {
        throw new BlockchainError(
          `No wallet connected for ${chainId}`,
          ErrorCodes.INVALID_PARAMS,
          chainId
        );
      }

      const adapter = this.adapterRegistry.getAdapter(chainId);
      await adapter.disconnectWallet();

      // Remove from storage
      this.connectedWallets.delete(chainId);
      this.walletSessions.delete(walletInfo.sessionId);

      // Emit disconnection event
      this.emitEvent('wallet_disconnected', {
        chainId,
        walletType: walletInfo.walletType
      });

      return {
        success: true,
        chainId,
        walletType: walletInfo.walletType
      };
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
   * Disconnect from all wallets
   */
  async disconnectAllWallets() {
    const results = [];
    
    for (const chainId of this.connectedWallets.keys()) {
      try {
        const result = await this.disconnectWallet(chainId);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          chainId,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Get connected wallet info for a chain
   */
  getConnectedWallet(chainId) {
    return this.connectedWallets.get(chainId) || null;
  }

  /**
   * Get all connected wallets
   */
  getAllConnectedWallets() {
    return Array.from(this.connectedWallets.values());
  }

  /**
   * Check if a wallet is connected for a chain
   */
  isWalletConnected(chainId) {
    return this.connectedWallets.has(chainId);
  }

  /**
   * Get wallet balance across all connected wallets
   */
  async getMultiChainBalance(address = null) {
    const balances = [];
    
    for (const [chainId, walletInfo] of this.connectedWallets) {
      try {
        const adapter = this.adapterRegistry.getAdapter(chainId);
        const targetAddress = address || walletInfo.publicKey || walletInfo.accounts?.[0];
        
        if (targetAddress) {
          const balance = await adapter.getBalance(targetAddress);
          balances.push({
            chainId,
            walletType: walletInfo.walletType,
            ...balance
          });
        }
      } catch (error) {
        console.warn(`[Wallet Framework] Failed to get balance for ${chainId}:`, error.message);
        balances.push({
          chainId,
          walletType: walletInfo.walletType,
          error: error.message
        });
      }
    }
    
    return balances;
  }

  /**
   * Switch network for EVM-compatible wallets
   */
  async switchNetwork(chainId) {
    try {
      const walletInfo = this.connectedWallets.get(chainId);
      
      if (!walletInfo) {
        throw new BlockchainError(
          `No wallet connected for ${chainId}`,
          ErrorCodes.INVALID_PARAMS,
          chainId
        );
      }

      // Only EVM wallets support network switching
      const evmChains = ['XDC', 'AVALANCHE', 'POLYGON', 'BSC'];
      if (!evmChains.includes(chainId)) {
        throw new BlockchainError(
          `Network switching not supported for ${chainId}`,
          ErrorCodes.NOT_SUPPORTED,
          chainId
        );
      }

      const adapter = this.adapterRegistry.getAdapter(chainId);
      
      // Call the adapter's network switching method
      if (chainId === 'XDC') {
        await adapter.switchToXDCNetwork();
      } else if (chainId === 'AVALANCHE') {
        await adapter.switchToAvalancheNetwork();
      } else if (chainId === 'POLYGON') {
        await adapter.switchToPolygonNetwork();
      } else if (chainId === 'BSC') {
        await adapter.switchToBSCNetwork();
      }

      this.emitEvent('network_switched', {
        chainId,
        walletType: walletInfo.walletType
      });

      return {
        success: true,
        chainId,
        walletType: walletInfo.walletType
      };
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
   * Sign a transaction using connected wallet
   */
  async signTransaction(chainId, transaction, signingParams = {}) {
    try {
      const walletInfo = this.connectedWallets.get(chainId);
      
      if (!walletInfo) {
        throw new BlockchainError(
          `No wallet connected for ${chainId}`,
          ErrorCodes.INVALID_PARAMS,
          chainId
        );
      }

      const adapter = this.adapterRegistry.getAdapter(chainId);
      
      // Prepare signing parameters based on wallet type
      const finalSigningParams = {
        wallet: walletInfo,
        ...signingParams
      };

      const signedTx = await adapter.signTransaction(transaction, finalSigningParams);

      this.emitEvent('transaction_signed', {
        chainId,
        walletType: walletInfo.walletType,
        hash: signedTx.hash
      });

      return signedTx;
    } catch (error) {
      this.emitEvent('transaction_signing_failed', {
        chainId,
        error: error.message
      });
      
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
   * Get wallet connection status across all chains
   */
  getConnectionStatus() {
    const status = {
      totalConnected: this.connectedWallets.size,
      connections: {},
      supportedChains: this.adapterRegistry.getSupportedChains(),
      availableWallets: Object.keys(this.supportedWallets)
    };

    for (const chainId of status.supportedChains) {
      const walletInfo = this.connectedWallets.get(chainId);
      status.connections[chainId] = {
        connected: !!walletInfo,
        walletType: walletInfo?.walletType || null,
        connectedAt: walletInfo?.connectedAt || null,
        accounts: walletInfo?.accounts || walletInfo?.publicKey ? [walletInfo.publicKey] : []
      };
    }

    return status;
  }

  /**
   * Monitor wallet events (account changes, disconnections)
   */
  startWalletMonitoring() {
    if (typeof window === 'undefined') {
      return; // Server-side
    }

    // MetaMask account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        this.handleAccountsChanged('metamask', accounts);
      });

      window.ethereum.on('chainChanged', (chainId) => {
        this.handleChainChanged('metamask', chainId);
      });

      window.ethereum.on('disconnect', () => {
        this.handleWalletDisconnected('metamask');
      });
    }

    // Phantom account changes
    if (window.solana) {
      window.solana.on('accountChanged', (publicKey) => {
        this.handleAccountsChanged('phantom', publicKey ? [publicKey.toString()] : []);
      });

      window.solana.on('disconnect', () => {
        this.handleWalletDisconnected('phantom');
      });
    }

    console.log('[Wallet Framework] Wallet monitoring started');
  }

  /**
   * Handle account changes from wallet
   */
  handleAccountsChanged(walletType, accounts) {
    this.emitEvent('accounts_changed', {
      walletType,
      accounts
    });

    // Update connected wallet info
    for (const [chainId, walletInfo] of this.connectedWallets) {
      if (walletInfo.walletType === walletType) {
        walletInfo.accounts = accounts;
        walletInfo.publicKey = accounts[0] || null;
      }
    }
  }

  /**
   * Handle chain changes from wallet
   */
  handleChainChanged(walletType, chainId) {
    this.emitEvent('chain_changed', {
      walletType,
      chainId
    });
  }

  /**
   * Handle wallet disconnection
   */
  handleWalletDisconnected(walletType) {
    // Find and remove disconnected wallets
    const disconnectedChains = [];
    
    for (const [chainId, walletInfo] of this.connectedWallets) {
      if (walletInfo.walletType === walletType) {
        this.connectedWallets.delete(chainId);
        this.walletSessions.delete(walletInfo.sessionId);
        disconnectedChains.push(chainId);
      }
    }

    this.emitEvent('wallet_disconnected_external', {
      walletType,
      disconnectedChains
    });
  }

  /**
   * Event system for wallet framework
   */
  addEventListener(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  removeEventListener(event, callback) {
    if (this.eventListeners.has(event)) {
      const callbacks = this.eventListeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emitEvent(event, data) {
    if (this.eventListeners.has(event)) {
      const callbacks = this.eventListeners.get(event);
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[Wallet Framework] Event callback error for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `wallet_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get wallet recommendations for a user
   */
  getWalletRecommendations(userPreferences = {}) {
    const { 
      preferredChains = [], 
      deviceType = 'desktop', 
      experienceLevel = 'beginner' 
    } = userPreferences;

    const recommendations = [];

    // Recommend based on preferred chains
    if (preferredChains.includes('XRP')) {
      recommendations.push({
        walletId: 'xumm',
        reason: 'Best XRP Ledger wallet with mobile app and biometric security',
        priority: 'high'
      });
    }

    if (preferredChains.some(chain => ['XDC', 'AVALANCHE', 'POLYGON', 'BSC'].includes(chain))) {
      recommendations.push({
        walletId: 'metamask',
        reason: 'Most popular EVM wallet with broad DeFi support',
        priority: 'high'
      });
    }

    if (preferredChains.includes('STELLAR')) {
      recommendations.push({
        walletId: 'freighter',
        reason: 'Official Stellar wallet with excellent asset management',
        priority: 'high'
      });
    }

    if (preferredChains.includes('SOLANA')) {
      recommendations.push({
        walletId: 'phantom',
        reason: 'Leading Solana wallet with great user experience',
        priority: 'high'
      });
    }

    // Universal recommendation
    recommendations.push({
      walletId: 'walletconnect',
      reason: 'Universal protocol supporting multiple wallets and chains',
      priority: 'medium'
    });

    return recommendations;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.connectedWallets.clear();
    this.walletSessions.clear();
    this.eventListeners.clear();
    
    // Remove browser event listeners
    if (typeof window !== 'undefined') {
      if (window.ethereum) {
        window.ethereum.removeAllListeners();
      }
      if (window.solana) {
        window.solana.removeAllListeners();
      }
    }
  }
}

module.exports = WalletIntegrationFramework;

