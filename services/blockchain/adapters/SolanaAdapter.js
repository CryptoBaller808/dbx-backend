const {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  Keypair,
  clusterApiUrl
} = require('@solana/web3.js');

const { BlockchainAdapter, BlockchainError, ErrorCodes } = require('../blockchain-abstraction-layer');

/**
 * Solana Blockchain Adapter
 * Supports Solana blockchain with native SOL and SPL token operations
 */
class SolanaAdapter extends BlockchainAdapter {
  constructor(config) {
    super(config);
    this.connection = null;
    this.chainId = 'SOLANA';
    this.networkConfig = {
      mainnet: {
        name: 'Solana Mainnet Beta',
        rpcUrl: 'https://api.mainnet-beta.solana.com',
        backupRpcUrls: [
          'https://solana-mainnet.g.alchemy.com',
          'https://rpc.ankr.com/solana'
        ],
        explorerUrl: 'https://explorer.solana.com',
        cluster: 'mainnet-beta',
        nativeCurrency: {
          name: 'Solana',
          symbol: 'SOL',
          decimals: 9
        }
      },
      testnet: {
        name: 'Solana Testnet',
        rpcUrl: 'https://api.testnet.solana.com',
        explorerUrl: 'https://explorer.solana.com/?cluster=testnet',
        cluster: 'testnet',
        nativeCurrency: {
          name: 'Solana',
          symbol: 'SOL',
          decimals: 9
        }
      },
      devnet: {
        name: 'Solana Devnet',
        rpcUrl: 'https://api.devnet.solana.com',
        explorerUrl: 'https://explorer.solana.com/?cluster=devnet',
        cluster: 'devnet',
        nativeCurrency: {
          name: 'Solana',
          symbol: 'SOL',
          decimals: 9
        }
      }
    };
  }

  /**
   * Initialize the Solana adapter with failover safety
   */
  async initialize() {
    try {
      const network = this.config.network || 'mainnet';
      const networkConfig = this.networkConfig[network];
      
      if (!networkConfig) {
        throw new BlockchainError(
          `Unsupported network: ${network}`,
          ErrorCodes.INVALID_PARAMS,
          this.chainId
        );
      }

      // Try primary RPC first, then fallback to backup URLs
      const rpcUrls = [
        this.config.rpcUrl || networkConfig.rpcUrl,
        ...(networkConfig.backupRpcUrls || [])
      ];

      let lastError = null;
      for (const rpcUrl of rpcUrls) {
        try {
          console.log(`[Solana Adapter] Attempting connection to ${rpcUrl}`);
          this.connection = new Connection(rpcUrl, 'confirmed');

          // Test connection with timeout
          const version = await Promise.race([
            this.connection.getVersion(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Connection timeout')), 10000)
            )
          ]);
          
          this.isInitialized = true;
          this.lastConnectionTime = Date.now();
          console.log(`[Solana Adapter] ✅ Connected to ${network} (version: ${version['solana-core']})`);
          
          return {
            success: true,
            chainId: this.chainId,
            network: networkConfig.name,
            cluster: networkConfig.cluster,
            version: version['solana-core'],
            slot: await this.connection.getSlot()
          };
        } catch (error) {
          lastError = error;
          console.warn(`[Solana Adapter] ⚠️ Failed to connect to ${rpcUrl}: ${error.message}`);
          continue;
        }
      }

      // All RPC URLs failed
      this.isInitialized = false;
      console.error(`[Solana Adapter] ❌ All RPC endpoints failed. Last error: ${lastError?.message}`);
      
      // Don't throw error, just mark as offline for graceful degradation
      return {
        success: false,
        chainId: this.chainId,
        error: `All Solana RPC endpoints unavailable: ${lastError?.message}`,
        offline: true
      };
    } catch (error) {
      this.isInitialized = false;
      console.error(`[Solana Adapter] ❌ Initialization failed: ${error.message}`);
      
      // Return offline status instead of throwing
      return {
        success: false,
        chainId: this.chainId,
        error: error.message,
        offline: true
      };
    }
  }

  /**
   * Check if adapter needs reconnection
   */
  needsReconnection() {
    if (!this.isInitialized) return true;
    if (!this.lastConnectionTime) return true;
    
    // Reconnect if connection is older than 5 minutes
    const fiveMinutes = 5 * 60 * 1000;
    return (Date.now() - this.lastConnectionTime) > fiveMinutes;
  }

  /**
   * Safely execute operations with automatic retry
   */
  async safeExecute(operation, operationName = 'operation') {
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check if we need to reconnect
        if (this.needsReconnection()) {
          console.log(`[Solana Adapter] Reconnecting before ${operationName} (attempt ${attempt})`);
          await this.initialize();
        }

        if (!this.isInitialized) {
          throw new Error('Adapter not initialized and reconnection failed');
        }

        return await operation();
      } catch (error) {
        lastError = error;
        console.warn(`[Solana Adapter] ⚠️ ${operationName} failed (attempt ${attempt}/${maxRetries}): ${error.message}`);
        
        if (attempt < maxRetries) {
          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Mark as uninitialized to force reconnection
          this.isInitialized = false;
        }
      }
    }

    // All retries failed - log warning but don't crash
    console.error(`[Solana Adapter] ❌ ${operationName} failed after ${maxRetries} attempts: ${lastError?.message}`);
    throw new BlockchainError(
      `Solana ${operationName} failed: ${lastError?.message}`,
      ErrorCodes.CONNECTION_ERROR,
      this.chainId
    );
  }

  /**
   * Connect to RPC endpoint
   */
  async connectToRpc(rpcUrl) {
    try {
      console.log(`[Solana Adapter] Connecting to RPC: ${rpcUrl}`);
      
      // Create connection
      this.connection = new Connection(rpcUrl, 'confirmed');
      
      // Test connection
      const version = await this.connection.getVersion();
      const slot = await this.connection.getSlot();
      
      console.log(`[Solana Adapter] Connected to Solana RPC (version: ${version['solana-core']}, slot: ${slot})`);
      
      return {
        success: true,
        chainId: this.chainId,
        rpcUrl: rpcUrl,
        version: version['solana-core'],
        currentSlot: slot
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to connect to Solana RPC: ${error.message}`,
        ErrorCodes.CONNECTION_ERROR,
        this.chainId,
        error
      );
    }
  }

  /**
   * Validate Solana address
   */
  isValidAddress(address) {
    try {
      new PublicKey(address);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get balance for an address with failover safety
   */
  async getBalance(address, tokenMint = null) {
    return this.safeExecute(async () => {
      if (!this.isValidAddress(address)) {
        throw new BlockchainError(
          'Invalid Solana address format',
          ErrorCodes.INVALID_PARAMS,
          this.chainId
        );
      }

      const publicKey = new PublicKey(address);
      let balance, decimals, symbol;

      if (tokenMint) {
        // SPL Token balance
        if (!this.isValidAddress(tokenMint)) {
          throw new BlockchainError(
            'Invalid token mint address format',
            ErrorCodes.INVALID_PARAMS,
            this.chainId
          );
        }

        const mintPublicKey = new PublicKey(tokenMint);
        
        // Get token accounts for this wallet
        const tokenAccounts = await this.connection.getTokenAccountsByOwner(
          publicKey,
          { mint: mintPublicKey }
        );

        if (tokenAccounts.value.length === 0) {
          balance = 0;
          decimals = 9; // Default
          symbol = 'UNKNOWN';
        } else {
          const tokenAccountInfo = await this.connection.getTokenAccountBalance(
            tokenAccounts.value[0].pubkey
          );
          
          balance = tokenAccountInfo.value.amount;
          decimals = tokenAccountInfo.value.decimals;
          symbol = 'SPL'; // Would need to fetch from token metadata
        }

        const formattedBalance = (parseInt(balance) / Math.pow(10, decimals)).toString();

        return {
          address,
          balance: formattedBalance,
          balanceLamports: balance.toString(),
          decimals,
          symbol,
          tokenMint: tokenMint,
          chainId: this.chainId,
          network: this.config.network || 'mainnet'
        };
      } else {
        // Native SOL balance
        const balanceLamports = await this.connection.getBalance(publicKey);
        const balanceSOL = balanceLamports / LAMPORTS_PER_SOL;

        return {
          address,
          balance: balanceSOL.toString(),
          balanceLamports: balanceLamports.toString(),
          decimals: 9,
          symbol: 'SOL',
          tokenMint: null,
          chainId: this.chainId,
          network: this.config.network || 'mainnet'
        };
      }
    }, 'getBalance');
  }

  /**
   * Get transaction details
   */
  async getTransaction(signature) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const transaction = await this.connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0
      });

      if (!transaction) {
        throw new BlockchainError(
          'Transaction not found',
          ErrorCodes.INVALID_PARAMS,
          this.chainId
        );
      }

      const { meta, transaction: tx, slot, blockTime } = transaction;

      return {
        signature,
        slot,
        blockTime: blockTime ? new Date(blockTime * 1000).toISOString() : null,
        confirmations: await this.getConfirmations(slot),
        status: meta?.err ? 'failed' : 'success',
        fee: meta?.fee || 0,
        feePayer: tx.message.accountKeys[0]?.toString(),
        recentBlockhash: tx.message.recentBlockhash,
        instructions: tx.message.instructions.length,
        accounts: tx.message.accountKeys.map(key => key.toString()),
        preBalances: meta?.preBalances || [],
        postBalances: meta?.postBalances || [],
        logMessages: meta?.logMessages || [],
        error: meta?.err ? JSON.stringify(meta.err) : null,
        chainId: this.chainId,
        network: this.config.network || 'mainnet'
      };
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to get transaction: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        this.chainId,
        error
      );
    }
  }

  /**
   * Get confirmations for a slot
   */
  async getConfirmations(slot) {
    try {
      const currentSlot = await this.connection.getSlot();
      return Math.max(0, currentSlot - slot);
    } catch {
      return 0;
    }
  }

  /**
   * Build a transaction
   */
  async buildTransaction(txParams) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const {
        from,
        to,
        amount,
        tokenMint = null,
        memo = null
      } = txParams;

      // Validate addresses
      if (!this.isValidAddress(from)) {
        throw new BlockchainError(
          'Invalid from address',
          ErrorCodes.INVALID_PARAMS,
          this.chainId
        );
      }

      if (!this.isValidAddress(to)) {
        throw new BlockchainError(
          'Invalid to address',
          ErrorCodes.INVALID_PARAMS,
          this.chainId
        );
      }

      const fromPublicKey = new PublicKey(from);
      const toPublicKey = new PublicKey(to);

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();

      // Create transaction
      const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: fromPublicKey
      });

      if (tokenMint) {
        // SPL Token transfer (would need @solana/spl-token)
        throw new BlockchainError(
          'SPL token transfers not implemented yet',
          ErrorCodes.NOT_SUPPORTED,
          this.chainId
        );
      } else {
        // Native SOL transfer
        const lamports = Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL);
        
        const transferInstruction = SystemProgram.transfer({
          fromPubkey: fromPublicKey,
          toPubkey: toPublicKey,
          lamports
        });

        transaction.add(transferInstruction);
      }

      // Add memo if provided
      if (memo) {
        // Would need @solana/spl-memo for memo instruction
        console.log('Memo instruction not implemented yet');
      }

      // Estimate fee
      const fee = await this.estimateTransactionFee(transaction);

      return {
        transaction,
        chainId: this.chainId,
        network: this.config.network || 'mainnet',
        estimatedFee: fee,
        recentBlockhash: blockhash
      };
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to build transaction: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        this.chainId,
        error
      );
    }
  }

  /**
   * Estimate transaction fee
   */
  async estimateTransactionFee(transaction) {
    try {
      const fee = await this.connection.getFeeForMessage(
        transaction.compileMessage(),
        'confirmed'
      );
      return fee.value || 5000; // Default 5000 lamports
    } catch {
      return 5000; // Default fee
    }
  }

  /**
   * Sign a transaction
   */
  async signTransaction(tx, signingParams) {
    try {
      const { privateKey, keypair, wallet } = signingParams;

      let signer;
      if (privateKey) {
        // Convert private key to Keypair
        const secretKey = Buffer.from(privateKey, 'hex');
        signer = Keypair.fromSecretKey(secretKey);
      } else if (keypair) {
        signer = keypair;
      } else if (wallet) {
        // For browser wallet integration (Phantom, Solflare)
        if (typeof window !== 'undefined' && wallet.signTransaction) {
          const signedTx = await wallet.signTransaction(tx.transaction);
          return {
            signedTransaction: signedTx,
            signature: null, // Will be generated on submission
            chainId: this.chainId,
            from: wallet.publicKey.toString()
          };
        } else {
          throw new BlockchainError(
            'Wallet signing not available',
            ErrorCodes.WALLET_ERROR,
            this.chainId
          );
        }
      } else {
        throw new BlockchainError(
          'No signing method provided',
          ErrorCodes.INVALID_PARAMS,
          this.chainId
        );
      }

      // Sign transaction with keypair
      tx.transaction.sign(signer);

      return {
        signedTransaction: tx.transaction,
        signature: null, // Will be generated on submission
        chainId: this.chainId,
        from: signer.publicKey.toString()
      };
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to sign transaction: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        this.chainId,
        error
      );
    }
  }

  /**
   * Submit a signed transaction
   */
  async submitTransaction(signedTx) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const signature = await this.connection.sendRawTransaction(
        signedTx.signedTransaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        }
      );

      return {
        signature,
        status: 'pending',
        chainId: this.chainId,
        network: this.config.network || 'mainnet',
        slot: null,
        confirmations: 0
      };
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to submit transaction: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        this.chainId,
        error
      );
    }
  }

  /**
   * Connect to wallet (Phantom/Solflare)
   */
  async connectWallet(options = {}) {
    try {
      const { walletType = 'phantom' } = options;

      if (typeof window === 'undefined') {
        throw new BlockchainError(
          'Wallet connection only available in browser',
          ErrorCodes.WALLET_ERROR,
          this.chainId
        );
      }

      let wallet;

      if (walletType === 'phantom') {
        if (window.solana && window.solana.isPhantom) {
          wallet = window.solana;
        } else {
          throw new BlockchainError(
            'Phantom wallet not detected',
            ErrorCodes.WALLET_ERROR,
            this.chainId
          );
        }
      } else if (walletType === 'solflare') {
        if (window.solflare && window.solflare.isSolflare) {
          wallet = window.solflare;
        } else {
          throw new BlockchainError(
            'Solflare wallet not detected',
            ErrorCodes.WALLET_ERROR,
            this.chainId
          );
        }
      } else {
        throw new BlockchainError(
          `Unsupported wallet type: ${walletType}`,
          ErrorCodes.INVALID_PARAMS,
          this.chainId
        );
      }

      // Connect to wallet
      const response = await wallet.connect();

      return {
        success: true,
        walletType,
        publicKey: response.publicKey.toString(),
        chainId: this.chainId,
        network: this.config.network || 'mainnet'
      };
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to connect wallet: ${error.message}`,
        ErrorCodes.WALLET_ERROR,
        this.chainId,
        error
      );
    }
  }

  /**
   * Disconnect from wallet
   */
  async disconnectWallet() {
    try {
      if (typeof window !== 'undefined') {
        if (window.solana && window.solana.disconnect) {
          await window.solana.disconnect();
        }
        if (window.solflare && window.solflare.disconnect) {
          await window.solflare.disconnect();
        }
      }

      return {
        success: true,
        message: 'Wallet disconnected successfully'
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to disconnect wallet: ${error.message}`,
        ErrorCodes.WALLET_ERROR,
        this.chainId,
        error
      );
    }
  }

  /**
   * Get network status
   */
  async getNetworkStatus() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const [slot, health, version, epochInfo] = await Promise.all([
        this.connection.getSlot(),
        this.connection.getHealth().catch(() => 'unknown'),
        this.connection.getVersion(),
        this.connection.getEpochInfo()
      ]);

      return {
        chainId: this.chainId,
        network: this.config.network || 'mainnet',
        cluster: this.networkConfig[this.config.network || 'mainnet'].cluster,
        slot,
        health,
        version: version['solana-core'],
        epoch: epochInfo.epoch,
        slotIndex: epochInfo.slotIndex,
        slotsInEpoch: epochInfo.slotsInEpoch,
        isConnected: health === 'ok',
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to get network status: ${error.message}`,
        ErrorCodes.NETWORK_ERROR,
        this.chainId,
        error
      );
    }
  }

  /**
   * Get popular SPL tokens
   */
  getPopularTokens() {
    const network = this.config.network || 'mainnet';
    
    if (network === 'mainnet') {
      return {
        USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
        SRM: 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt',
        COPE: '8HGyAAB1yoM1ttS7pXjHMa3dukTFGQggnFFH3hJZgzQh',
        STEP: 'StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT',
        MEDIA: 'ETAtLmCmsoiEEKfNrHKJ2kYy3MoABhU6NQvpSfij5tDs',
        ROPE: '8PMHT4swUMtBzgHnh5U564N5sjPSiUz2cjEQzFnnP1Fo'
      };
    } else {
      // Devnet/testnet tokens
      return {
        USDC: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        USDT: 'EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS'
      };
    }
  }

  /**
   * Get Serum DEX markets (for swap functionality)
   */
  getSerumMarkets() {
    const network = this.config.network || 'mainnet';
    
    if (network === 'mainnet') {
      return {
        'SOL/USDC': '9wFFyRfZBsuAha4YcuxcXLKwMxJR43S7fPfQLusDBzvT',
        'SOL/USDT': 'HWHvQhFmJB3NUcu1aihKmrKegfVxBEHzwVX6yZCKEsi1',
        'RAY/USDC': '2xiv8A5xrJ7RnGdxXB42uFEkYHJjszEhaJyKKt4WaLep',
        'SRM/USDC': 'ByRys5tuUWDgL73G8JBAEfkdFf8JWBzPBDHsBVQ5vbQA'
      };
    } else {
      return {};
    }
  }

  /**
   * Get swap quote (would integrate with Jupiter or Serum)
   */
  async getSwapQuote(inputMint, outputMint, amount) {
    // This would integrate with Jupiter Aggregator or Serum DEX
    throw new BlockchainError(
      'Swap functionality not implemented yet',
      ErrorCodes.NOT_SUPPORTED,
      this.chainId
    );
  }
}

module.exports = SolanaAdapter;

