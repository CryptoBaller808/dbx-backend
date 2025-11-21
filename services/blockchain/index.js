/**
 * Blockchain Services Index
 * 
 * This file exports all blockchain-related services and adapters
 * for use throughout the application.
 */

// Import database models
const db = require('../models');

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

// Map environment variable names to chain identifiers
const ENV_VAR_MAP = {
  'xrpl': 'UBAL_XRP_RPC_URL',
  'stellar': 'UBAL_XLM_RPC_URL',
  'xdc': 'UBAL_XDC_RPC_URL',
  'bitcoin': 'UBAL_BTC_RPC_URL',
};

// Get RPC URL from environment variable for a given chain
const getRpcUrlFromEnv = (chainId) => {
  const envVarName = ENV_VAR_MAP[chainId.toLowerCase()];
  if (!envVarName) {
    return null;
  }
  return process.env[envVarName] || null;
};

// Create and configure adapter registry
const createAdapterRegistry = async (configManager) => {
  const registry = new AdapterRegistry();
  
  try {
    console.log('[Blockchain Registry] Loading blockchain configurations from database...');
    
    // Load configurations from database
    const configs = await configManager.loadConfigurations();
    
    console.log(`[Blockchain Registry] Loaded ${configs.size} configurations from database`);
    
    // Process each configuration from database
    for (const [chainKey, dbConfig] of configs.entries()) {
      try {
        // Skip if not active
        if (!dbConfig.isActive) {
          console.log(`[Blockchain Registry] ⏭️ Skipping ${chainKey}: not active`);
          continue;
        }

        const chainId = dbConfig.chainId || chainKey;
        
        // Get RPC URL from environment variable
        const rpcUrlFromEnv = getRpcUrlFromEnv(chainId);
        
        if (!rpcUrlFromEnv) {
          console.warn(`[Blockchain Registry] ⚠️ WARNING: No RPC URL configured for ${dbConfig.name} (${chainId})`);
          console.warn(`[Blockchain Registry] ⚠️ Please set ${ENV_VAR_MAP[chainId.toLowerCase()]} environment variable`);
          console.warn(`[Blockchain Registry] ⚠️ Skipping ${chainId} - chain will not be available`);
          continue;
        }

        // Build adapter configuration
        const adapterConfig = {
          chainId: chainId.toUpperCase(),
          network: 'mainnet',
          rpcUrl: rpcUrlFromEnv,
          isActive: dbConfig.isActive,
          ...dbConfig.config, // Merge any additional config from database
        };

        console.log(`[Blockchain Registry] 🔧 Configuring ${dbConfig.name} with RPC from env: ${ENV_VAR_MAP[chainId.toLowerCase()]}`);

        // Register adapter based on adapter type
        const adapterType = dbConfig.adapterType.toLowerCase();
        
        if (chainId.toLowerCase() === 'xrpl') {
          const xrpAdapter = new XRPAdapter(adapterConfig);
          registry.registerAdapter('XRP', xrpAdapter);
          registry.registerAdapter('xrpl', xrpAdapter);
          console.log('[Blockchain Registry] ✅ XRP adapter registered successfully');
        } else if (chainId.toLowerCase() === 'stellar') {
          const xlmAdapter = new XLMAdapter(adapterConfig);
          registry.registerAdapter('STELLAR', xlmAdapter);
          registry.registerAdapter('xlm', xlmAdapter);
          console.log('[Blockchain Registry] ✅ Stellar adapter registered successfully');
        } else if (chainId.toLowerCase() === 'xdc') {
          const xdcAdapter = new XDCAdapter(adapterConfig);
          registry.registerAdapter('XDC', xdcAdapter);
          registry.registerAdapter('xdc', xdcAdapter);
          console.log('[Blockchain Registry] ✅ XDC adapter registered successfully');
        } else if (chainId.toLowerCase() === 'bitcoin') {
          console.log('[Blockchain Registry] ⚠️ Bitcoin adapter not yet implemented, skipping');
          // TODO: Implement Bitcoin adapter when ready
          // const btcAdapter = new BTCAdapter(adapterConfig);
          // registry.registerAdapter('BTC', btcAdapter);
          // registry.registerAdapter('bitcoin', btcAdapter);
        } else {
          console.warn(`[Blockchain Registry] ⚠️ Unknown chain type: ${chainId}, skipping`);
        }
        
      } catch (error) {
        // Graceful per-chain failure - log and continue
        console.error(`[Blockchain Registry] ❌ Failed to register ${chainKey}:`, error.message);
        console.error(`[Blockchain Registry] ❌ Error stack:`, error.stack);
        console.warn(`[Blockchain Registry] ⚠️ Continuing with other chains...`);
      }
    }
    
    const registeredCount = registry.getSupportedChains().length;
    console.log(`[Blockchain Registry] ✅ Successfully registered ${registeredCount} blockchain adapters`);
    
    if (registeredCount === 0) {
      console.warn('[Blockchain Registry] ⚠️ WARNING: No blockchain adapters registered!');
      console.warn('[Blockchain Registry] ⚠️ Please check:');
      console.warn('[Blockchain Registry] ⚠️   1. Database contains blockchain records (run seeders)');
      console.warn('[Blockchain Registry] ⚠️   2. Environment variables are set (UBAL_*_RPC_URL)');
      console.warn('[Blockchain Registry] ⚠️   3. Blockchains are marked as active in database');
    }
    
  } catch (error) {
    console.error('[Blockchain Registry] ❌ Failed to load configurations from database:', error.message);
    console.error('[Blockchain Registry] ❌ Error stack:', error.stack);
    console.warn('[Blockchain Registry] ⚠️ No adapters registered - blockchain functionality will be limited');
  }
  
  return registry;
};

// Initialize blockchain services
const initializeBlockchainServices = async (db) => {
  try {
    console.log('[Blockchain Services] 🚀 Initializing blockchain services with UBAL...');
    
    // Guard: Skip blockchain initialization if explicitly disabled
    if (process.env.DBX_SKIP_CHAIN_INIT === 'true') {
      console.log('[Blockchain Services] ⏭️ Skipping blockchain initialization (DBX_SKIP_CHAIN_INIT=true)');
      return null;
    }
    
    // Validate database connection
    if (!db || !db.models) {
      console.error('[Blockchain Services] ❌ Database models not available');
      throw new Error('Database models not available - cannot initialize blockchain services');
    }
    
    // Validate Blockchain model exists
    if (!db.models.Blockchain) {
      console.error('[Blockchain Services] ❌ Blockchain model not found');
      throw new Error('Blockchain model not found - please run migrations');
    }
    
    // Check if blockchains table exists
    console.log('[Blockchain Services] 🔍 Checking blockchains table...');
    const [results] = await db.sequelize.query(
      "SELECT to_regclass('public.blockchains') as table_exists"
    );
    
    if (!results || !results[0] || !results[0].table_exists) {
      console.error('[Blockchain Services] ❌ Blockchains table does not exist');
      console.error('[Blockchain Services] ❌ Please run migrations: npx sequelize-cli db:migrate');
      throw new Error('Blockchains table does not exist');
    }
    
    // Test table accessibility
    try {
      const blockchainCount = await db.models.Blockchain.count();
      console.log(`[Blockchain Services] ✅ Blockchains table accessible (${blockchainCount} records)`);
      
      if (blockchainCount === 0) {
        console.warn('[Blockchain Services] ⚠️ WARNING: No blockchain records found in database');
        console.warn('[Blockchain Services] ⚠️ Please run seeders: npx sequelize-cli db:seed:all');
        console.warn('[Blockchain Services] ⚠️ Continuing with empty configuration...');
      }
    } catch (tableError) {
      console.error('[Blockchain Services] ❌ Cannot access blockchains table:', tableError.message);
      throw new Error(`Cannot access blockchains table: ${tableError.message}`);
    }
    
    // Create configuration manager with Blockchain model
    console.log('[Blockchain Services] 🔧 Creating configuration manager...');
    const configManager = new ConfigurationManager(db.models.Blockchain);
    
    // Create adapter registry (loads from database and env vars)
    console.log('[Blockchain Services] 🔧 Creating adapter registry...');
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

