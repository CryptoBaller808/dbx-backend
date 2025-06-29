/**
 * Blockchain Services Index
 * 
 * This file exports all blockchain-related services and adapters
 * for use throughout the application.
 */

const {
  BlockchainError,
  ErrorCodes,
  BlockchainAdapter,
  AdapterRegistry,
  ConfigurationManager,
  BlockchainService,
  WalletOperations,
  TransactionService,
  SwapOperations
} = require('./blockchain-abstraction-layer');

// Import blockchain-specific adapters
const XRPAdapter = require('./adapters/XRPAdapter');
const XLMAdapter = require('./adapters/XLMAdapter');
const XDCAdapter = require('./adapters/XDCAdapter');
const SolanaAdapter = require('./adapters/SolanaAdapter');
const AVAXAdapter = require('./adapters/AVAXAdapter');
const MATICAdapter = require('./adapters/MATICAdapter');
const BNBAdapter = require('./adapters/BNBAdapter');

// Import service implementations
const WalletService = require('./wallet-service');
const SwapService = require('./swap-service');
const NFTService = require('./nft-service');

// Default configurations for each blockchain
const getDefaultConfigurations = () => {
  return {
    xrp: {
      chainId: 'XRP',
      network: 'mainnet',
      rpcUrl: 'wss://xrplcluster.com',
      isActive: true
    },
    xlm: {
      chainId: 'STELLAR',
      network: 'mainnet',
      rpcUrl: 'https://horizon.stellar.org',
      isActive: true
    },
    xdc: {
      chainId: 'XDC',
      network: 'mainnet',
      rpcUrl: 'https://rpc.xinfin.network',
      isActive: true
    },
    solana: {
      chainId: 'SOLANA',
      network: 'mainnet',
      rpcUrl: 'https://api.mainnet-beta.solana.com',
      isActive: true
    },
    avalanche: {
      chainId: 'AVALANCHE',
      network: 'mainnet',
      rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
      isActive: true
    },
    polygon: {
      chainId: 'POLYGON',
      network: 'mainnet',
      rpcUrl: 'https://polygon-rpc.com',
      isActive: true
    },
    bsc: {
      chainId: 'BSC',
      network: 'mainnet',
      rpcUrl: 'https://bsc-dataseed1.binance.org',
      isActive: true
    }
  };
};

// Create and configure adapter registry
const createAdapterRegistry = async (configManager) => {
  const registry = new AdapterRegistry();
  
  try {
    // Load configurations from database
    const configs = await configManager.loadConfigurations();
    
    // Get default configurations as fallback
    const defaultConfigs = getDefaultConfigurations();
    
    // Register adapters for each supported blockchain
    
    // XRP Ledger
    try {
      const xrpConfig = configs.get('xrp') || defaultConfigs.xrp;
      if (xrpConfig && xrpConfig.isActive) {
        const xrpAdapter = new XRPAdapter(xrpConfig);
        registry.registerAdapter('XRP', xrpAdapter);
        registry.registerAdapter('xrp', xrpAdapter); // Alias
        console.log('[Blockchain Registry] ✅ XRP adapter registered successfully');
      }
    } catch (error) {
      console.error('[Blockchain Registry] ❌ Failed to register XRP adapter:', error.message);
    }
    
    // Stellar
    try {
      const xlmConfig = configs.get('xlm') || defaultConfigs.xlm;
      if (xlmConfig && xlmConfig.isActive) {
        const xlmAdapter = new XLMAdapter(xlmConfig);
        registry.registerAdapter('STELLAR', xlmAdapter);
        registry.registerAdapter('xlm', xlmAdapter); // Alias
        console.log('[Blockchain Registry] ✅ Stellar adapter registered successfully');
      }
    } catch (error) {
      console.error('[Blockchain Registry] ❌ Failed to register Stellar adapter:', error.message);
    }
    
    // XDC Network
    try {
      const xdcConfig = configs.get('xdc') || defaultConfigs.xdc;
      if (xdcConfig && xdcConfig.isActive) {
        const xdcAdapter = new XDCAdapter(xdcConfig);
        registry.registerAdapter('XDC', xdcAdapter);
        registry.registerAdapter('xdc', xdcAdapter); // Alias
        console.log('[Blockchain Registry] ✅ XDC adapter registered successfully');
      }
    } catch (error) {
      console.error('[Blockchain Registry] ❌ Failed to register XDC adapter:', error.message);
    }
    
    // Solana
    try {
      const solanaConfig = configs.get('solana') || defaultConfigs.solana;
      if (solanaConfig && solanaConfig.isActive) {
        const solanaAdapter = new SolanaAdapter(solanaConfig);
        registry.registerAdapter('SOLANA', solanaAdapter);
        registry.registerAdapter('solana', solanaAdapter); // Alias
        console.log('[Blockchain Registry] ✅ Solana adapter registered successfully');
      }
    } catch (error) {
      console.error('[Blockchain Registry] ❌ Failed to register Solana adapter:', error.message);
    }
    
    // Avalanche
    try {
      const avaxConfig = configs.get('avalanche') || defaultConfigs.avalanche;
      if (avaxConfig && avaxConfig.isActive) {
        const avaxAdapter = new AVAXAdapter(avaxConfig);
        registry.registerAdapter('AVALANCHE', avaxAdapter);
        registry.registerAdapter('avax', avaxAdapter); // Alias
        console.log('[Blockchain Registry] ✅ Avalanche adapter registered successfully');
      }
    } catch (error) {
      console.error('[Blockchain Registry] ❌ Failed to register Avalanche adapter:', error.message);
    }
    
    // Polygon
    try {
      const maticConfig = configs.get('polygon') || defaultConfigs.polygon;
      if (maticConfig && maticConfig.isActive) {
        const maticAdapter = new MATICAdapter(maticConfig);
        registry.registerAdapter('POLYGON', maticAdapter);
        registry.registerAdapter('matic', maticAdapter); // Alias
        console.log('[Blockchain Registry] ✅ Polygon adapter registered successfully');
      }
    } catch (error) {
      console.error('[Blockchain Registry] ❌ Failed to register Polygon adapter:', error.message);
    }
    
    // Binance Smart Chain
    try {
      const bscConfig = configs.get('bsc') || defaultConfigs.bsc;
      if (bscConfig && bscConfig.isActive) {
        const bnbAdapter = new BNBAdapter(bscConfig);
        registry.registerAdapter('BSC', bnbAdapter);
        registry.registerAdapter('bnb', bnbAdapter); // Alias
        console.log('[Blockchain Registry] ✅ BSC adapter registered successfully');
      }
    } catch (error) {
      console.error('[Blockchain Registry] ❌ Failed to register BSC adapter:', error.message);
    }
    
    console.log(`[Blockchain Registry] Registered ${registry.getSupportedChains().length} blockchain adapters`);
    
  } catch (error) {
    console.error('[Blockchain Registry] Failed to load configurations:', error);
    
    // Fallback: Register adapters with default configurations
    const defaultConfigs = getDefaultConfigurations();
    
    registry.registerAdapter('XRP', new XRPAdapter(defaultConfigs.xrp));
    registry.registerAdapter('STELLAR', new XLMAdapter(defaultConfigs.xlm));
    registry.registerAdapter('XDC', new XDCAdapter(defaultConfigs.xdc));
    registry.registerAdapter('SOLANA', new SolanaAdapter(defaultConfigs.solana));
    registry.registerAdapter('AVALANCHE', new AVAXAdapter(defaultConfigs.avalanche));
    registry.registerAdapter('POLYGON', new MATICAdapter(defaultConfigs.polygon));
    registry.registerAdapter('BSC', new BNBAdapter(defaultConfigs.bsc));
    
    console.log('[Blockchain Registry] Registered adapters with default configurations');
  }
  
  return registry;
};

// Initialize blockchain services
const initializeBlockchainServices = async (db) => {
  try {
    // Create configuration manager
    const configManager = new ConfigurationManager(db?.models?.Blockchain);
    
    // Create adapter registry
    const registry = await createAdapterRegistry(configManager);
    
    // Create blockchain service
    const blockchainService = new BlockchainService(registry);
    
    // Create wallet operations
    const walletOperations = new WalletOperations(registry);
    
    // Create transaction service
    const transactionService = new TransactionService(registry, db?.models?.Transaction);
    
    // Create swap operations
    const swapOperations = new SwapOperations(registry, transactionService);
    
    // Create specialized services
    const walletService = new WalletService(registry);
    const swapService = new SwapService(registry, transactionService);
    const nftService = new NFTService(registry, db?.models?.Item);
    
    console.log('[Blockchain Services] All services initialized successfully');
    
    return {
      blockchainService,
      walletOperations,
      transactionService,
      swapOperations,
      walletService,
      swapService,
      nftService,
      registry,
      configManager
    };
  } catch (error) {
    console.error('[Blockchain Services] Failed to initialize services:', error);
    throw new BlockchainError(
      `Failed to initialize blockchain services: ${error.message}`,
      ErrorCodes.CONNECTION_ERROR,
      'SYSTEM',
      error
    );
  }
};

// Get supported blockchain networks
const getSupportedNetworks = () => {
  return [
    {
      chainId: 'XRP',
      name: 'XRP Ledger',
      symbol: 'XRP',
      type: 'native',
      isEVM: false,
      walletSupport: ['XUMM', 'WalletConnect']
    },
    {
      chainId: 'STELLAR',
      name: 'Stellar Network',
      symbol: 'XLM',
      type: 'native',
      isEVM: false,
      walletSupport: ['Stellar Wallet', 'WalletConnect']
    },
    {
      chainId: 'XDC',
      name: 'XDC Network',
      symbol: 'XDC',
      type: 'evm',
      isEVM: true,
      walletSupport: ['MetaMask', 'WalletConnect']
    },
    {
      chainId: 'SOLANA',
      name: 'Solana',
      symbol: 'SOL',
      type: 'native',
      isEVM: false,
      walletSupport: ['Phantom', 'Solflare', 'WalletConnect']
    },
    {
      chainId: 'AVALANCHE',
      name: 'Avalanche C-Chain',
      symbol: 'AVAX',
      type: 'evm',
      isEVM: true,
      walletSupport: ['MetaMask', 'WalletConnect']
    },
    {
      chainId: 'POLYGON',
      name: 'Polygon',
      symbol: 'MATIC',
      type: 'evm',
      isEVM: true,
      walletSupport: ['MetaMask', 'WalletConnect']
    },
    {
      chainId: 'BSC',
      name: 'Binance Smart Chain',
      symbol: 'BNB',
      type: 'evm',
      isEVM: true,
      walletSupport: ['MetaMask', 'WalletConnect']
    }
  ];
};

// Get EVM-compatible networks
const getEVMNetworks = () => {
  return getSupportedNetworks().filter(network => network.isEVM);
};

// Get native (non-EVM) networks
const getNativeNetworks = () => {
  return getSupportedNetworks().filter(network => !network.isEVM);
};

// Utility function to get adapter by chain ID
const getAdapterByChainId = (registry, chainId) => {
  try {
    return registry.getAdapter(chainId.toUpperCase());
  } catch (error) {
    // Try lowercase
    try {
      return registry.getAdapter(chainId.toLowerCase());
    } catch (error2) {
      throw new BlockchainError(
        `Unsupported blockchain: ${chainId}`,
        ErrorCodes.INVALID_PARAMS,
        chainId
      );
    }
  }
};

// Health check for all blockchain adapters
const performHealthCheck = async (registry) => {
  const supportedChains = registry.getSupportedChains();
  const healthStatus = {};
  
  for (const chainId of supportedChains) {
    try {
      const adapter = registry.getAdapter(chainId);
      const status = await adapter.getNetworkStatus();
      healthStatus[chainId] = {
        status: 'healthy',
        blockNumber: status.blockNumber,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      healthStatus[chainId] = {
        status: 'unhealthy',
        error: error.message,
        lastChecked: new Date().toISOString()
      };
    }
  }
  
  return healthStatus;
};

module.exports = {
  // Core classes and errors
  BlockchainError,
  ErrorCodes,
  BlockchainAdapter,
  AdapterRegistry,
  ConfigurationManager,
  BlockchainService,
  WalletOperations,
  TransactionService,
  SwapOperations,
  
  // Initialization
  initializeBlockchainServices,
  createAdapterRegistry,
  
  // Service classes
  WalletService,
  SwapService,
  NFTService,
  
  // Utility functions
  getSupportedNetworks,
  getEVMNetworks,
  getNativeNetworks,
  getAdapterByChainId,
  performHealthCheck,
  getDefaultConfigurations
};

