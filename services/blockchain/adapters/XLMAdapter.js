const { BlockchainAdapter, BlockchainError, ErrorCodes } = require('../blockchain-abstraction-layer');
const {
  Server,
  Keypair,
  Account,
  TransactionBuilder,
  Operation,
  Asset,
  Networks,
  StrKey,
  Memo
} = require('@stellar/stellar-sdk');

/**
 * Stellar (XLM) Blockchain Adapter
 * Supports Stellar network with native XLM and custom asset operations
 */
class XLMAdapter extends BlockchainAdapter {
  constructor(config) {
    super(config);
    this.server = null;
    this.chainId = 'STELLAR';
    this.networkConfig = {
      mainnet: {
        name: 'Stellar Mainnet',
        horizonUrl: 'https://horizon.stellar.org',
        explorerUrl: 'https://stellar.expert/explorer/public',
        networkPassphrase: Networks.PUBLIC,
        nativeCurrency: {
          name: 'Stellar Lumens',
          symbol: 'XLM',
          decimals: 7
        }
      },
      testnet: {
        name: 'Stellar Testnet',
        horizonUrl: 'https://horizon-testnet.stellar.org',
        explorerUrl: 'https://stellar.expert/explorer/testnet',
        networkPassphrase: Networks.TESTNET,
        nativeCurrency: {
          name: 'Stellar Lumens',
          symbol: 'XLM',
          decimals: 7
        }
      }
    };
  }

  /**
   * Initialize the Stellar adapter
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

      // Initialize Horizon server
      const horizonUrl = this.config.horizonUrl || networkConfig.horizonUrl;
      this.server = new Server(horizonUrl);

      // Test connection
      const serverInfo = await this.server.serverInfo();
      
      this.isInitialized = true;
      console.log(`[Stellar Adapter] Initialized for ${network} (version: ${serverInfo.version})`);
      
      return {
        success: true,
        chainId: this.chainId,
        network: networkConfig.name,
        version: serverInfo.version,
        ledger: serverInfo.history_latest_ledger
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to initialize Stellar adapter: ${error.message}`,
        ErrorCodes.CONNECTION_ERROR,
        this.chainId,
        error
      );
    }
  }

  /**
   * Validate Stellar address
   */
  isValidAddress(address) {
    return StrKey.isValidEd25519PublicKey(address);
  }

  /**
   * Get balance for an address
   */
  async getBalance(address, assetCode = null, assetIssuer = null) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.isValidAddress(address)) {
        throw new BlockchainError(
          'Invalid Stellar address format',
          ErrorCodes.INVALID_PARAMS,
          this.chainId
        );
      }

      // Load account from Stellar network
      const account = await this.server.loadAccount(address);

      if (assetCode && assetIssuer) {
        // Custom asset balance
        const balance = account.balances.find(b => 
          b.asset_code === assetCode && b.asset_issuer === assetIssuer
        );

        if (!balance) {
          return {
            address,
            balance: '0',
            assetCode,
            assetIssuer,
            limit: '0',
            chainId: this.chainId,
            network: this.config.network || 'mainnet',
            hasTrustline: false
          };
        }

        return {
          address,
          balance: balance.balance,
          assetCode: balance.asset_code,
          assetIssuer: balance.asset_issuer,
          limit: balance.limit,
          chainId: this.chainId,
          network: this.config.network || 'mainnet',
          hasTrustline: true
        };
      } else {
        // Native XLM balance
        const xlmBalance = account.balances.find(b => b.asset_type === 'native');

        return {
          address,
          balance: xlmBalance ? xlmBalance.balance : '0',
          assetCode: 'XLM',
          assetIssuer: null,
          chainId: this.chainId,
          network: this.config.network || 'mainnet',
          sequence: account.sequence,
          subentryCount: account.subentry_count,
          thresholds: account.thresholds
        };
      }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        // Account doesn't exist
        return {
          address,
          balance: '0',
          assetCode: assetCode || 'XLM',
          assetIssuer: assetIssuer || null,
          chainId: this.chainId,
          network: this.config.network || 'mainnet',
          accountExists: false
        };
      }

      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to get balance: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        this.chainId,
        error
      );
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(hash) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const transaction = await this.server.transactions()
        .transaction(hash)
        .call();

      // Get operations for this transaction
      const operations = await this.server.operations()
        .forTransaction(hash)
        .call();

      return {
        hash: transaction.hash,
        ledger: transaction.ledger,
        createdAt: transaction.created_at,
        sourceAccount: transaction.source_account,
        fee: transaction.fee_charged,
        operationCount: transaction.operation_count,
        envelope: transaction.envelope_xdr,
        result: transaction.result_xdr,
        resultMeta: transaction.result_meta_xdr,
        successful: transaction.successful,
        operations: operations.records.map(op => ({
          id: op.id,
          type: op.type,
          from: op.from,
          to: op.to,
          amount: op.amount,
          asset: op.asset_type === 'native' ? 'XLM' : `${op.asset_code}:${op.asset_issuer}`,
          createdAt: op.created_at
        })),
        chainId: this.chainId,
        network: this.config.network || 'mainnet'
      };
    } catch (error) {
      if (error.response && error.response.status === 404) {
        throw new BlockchainError(
          'Transaction not found',
          ErrorCodes.INVALID_PARAMS,
          this.chainId
        );
      }

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
        assetCode = null,
        assetIssuer = null,
        memo = null,
        timeBounds = null
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

      // Load source account
      const sourceAccount = await this.server.loadAccount(from);

      // Determine asset
      let asset;
      if (assetCode && assetIssuer) {
        asset = new Asset(assetCode, assetIssuer);
      } else {
        asset = Asset.native(); // XLM
      }

      // Get network passphrase
      const network = this.config.network || 'mainnet';
      const networkPassphrase = this.networkConfig[network].networkPassphrase;

      // Create transaction builder
      const txBuilder = new TransactionBuilder(sourceAccount, {
        fee: '100', // Base fee in stroops
        networkPassphrase
      });

      // Add payment operation
      txBuilder.addOperation(Operation.payment({
        destination: to,
        asset: asset,
        amount: amount.toString()
      }));

      // Add memo if provided
      if (memo) {
        if (memo.type === 'text') {
          txBuilder.addMemo(Memo.text(memo.value));
        } else if (memo.type === 'id') {
          txBuilder.addMemo(Memo.id(memo.value));
        } else if (memo.type === 'hash') {
          txBuilder.addMemo(Memo.hash(memo.value));
        }
      }

      // Add time bounds if provided
      if (timeBounds) {
        txBuilder.setTimeout(timeBounds.timeout || 300); // 5 minutes default
      } else {
        txBuilder.setTimeout(300);
      }

      // Build transaction
      const transaction = txBuilder.build();

      return {
        transaction,
        chainId: this.chainId,
        network: this.config.network || 'mainnet',
        fee: transaction.fee,
        operationCount: transaction.operations.length,
        envelope: transaction.toEnvelope().toXDR('base64')
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
   * Sign a transaction
   */
  async signTransaction(tx, signingParams) {
    try {
      const { secretKey, keypair, wallet } = signingParams;

      let signer;
      if (secretKey) {
        signer = Keypair.fromSecret(secretKey);
      } else if (keypair) {
        signer = keypair;
      } else if (wallet) {
        // For browser wallet integration (Freighter, etc.)
        if (typeof window !== 'undefined' && wallet.signTransaction) {
          const signedTx = await wallet.signTransaction(tx.transaction.toEnvelope().toXDR('base64'));
          return {
            signedTransaction: signedTx,
            hash: null, // Will be generated on submission
            chainId: this.chainId,
            from: wallet.publicKey
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
        hash: tx.transaction.hash().toString('hex'),
        chainId: this.chainId,
        from: signer.publicKey()
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

      const result = await this.server.submitTransaction(signedTx.signedTransaction);

      return {
        hash: result.hash,
        ledger: result.ledger,
        status: result.successful ? 'success' : 'failed',
        envelope: result.envelope_xdr,
        result: result.result_xdr,
        chainId: this.chainId,
        network: this.config.network || 'mainnet'
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
   * Connect to wallet (Freighter, etc.)
   */
  async connectWallet(options = {}) {
    try {
      const { walletType = 'freighter' } = options;

      if (typeof window === 'undefined') {
        throw new BlockchainError(
          'Wallet connection only available in browser',
          ErrorCodes.WALLET_ERROR,
          this.chainId
        );
      }

      let wallet;

      if (walletType === 'freighter') {
        if (window.freighter) {
          wallet = window.freighter;
        } else {
          throw new BlockchainError(
            'Freighter wallet not detected',
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

      // Request access
      const isAllowed = await wallet.isAllowed();
      if (!isAllowed) {
        await wallet.requestAccess();
      }

      // Get public key
      const publicKey = await wallet.getPublicKey();

      return {
        success: true,
        walletType,
        publicKey,
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
      // Freighter doesn't have a disconnect method
      // User needs to disconnect manually from the extension
      return {
        success: true,
        message: 'Please disconnect from your wallet manually'
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

      const [serverInfo, feeStats] = await Promise.all([
        this.server.serverInfo(),
        this.server.feeStats()
      ]);

      return {
        chainId: this.chainId,
        network: this.config.network || 'mainnet',
        version: serverInfo.version,
        ledger: serverInfo.history_latest_ledger,
        baseFee: feeStats.last_ledger_base_fee,
        baseReserve: feeStats.last_ledger_base_reserve,
        maxTxSetSize: feeStats.max_tx_set_size,
        isConnected: true,
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
   * Create trustline for custom asset
   */
  async createTrustline(sourceSecret, assetCode, assetIssuer, limit = null) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const sourceKeypair = Keypair.fromSecret(sourceSecret);
      const sourceAccount = await this.server.loadAccount(sourceKeypair.publicKey());

      const asset = new Asset(assetCode, assetIssuer);
      const network = this.config.network || 'mainnet';
      const networkPassphrase = this.networkConfig[network].networkPassphrase;

      const transaction = new TransactionBuilder(sourceAccount, {
        fee: '100',
        networkPassphrase
      })
      .addOperation(Operation.changeTrust({
        asset: asset,
        limit: limit
      }))
      .setTimeout(300)
      .build();

      transaction.sign(sourceKeypair);

      const result = await this.server.submitTransaction(transaction);

      return {
        hash: result.hash,
        successful: result.successful,
        assetCode,
        assetIssuer,
        limit: limit || 'max'
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to create trustline: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        this.chainId,
        error
      );
    }
  }

  /**
   * Get popular Stellar assets
   */
  getPopularAssets() {
    const network = this.config.network || 'mainnet';
    
    if (network === 'mainnet') {
      return {
        USDC: {
          code: 'USDC',
          issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
          name: 'USD Coin'
        },
        USDT: {
          code: 'USDT',
          issuer: 'GCQTGZQQ5G4PTM2GL7CDIFKUBIPEC52BROAQIAPW53XBRJVN6ZJVTG6V',
          name: 'Tether USD'
        },
        BTC: {
          code: 'BTC',
          issuer: 'GAUTUYY2THLF7SGITDFMXJVYH3LHDSMGEAKSBU267M2K7A3W543CKUEF',
          name: 'Bitcoin'
        },
        ETH: {
          code: 'ETH',
          issuer: 'GBDEVU63Y6NTHJQQZIKVTC23NWLQVP3WJ2RI2OTSJTNYOIGICST6DUXR',
          name: 'Ethereum'
        },
        AQUA: {
          code: 'AQUA',
          issuer: 'GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA',
          name: 'Aquarius'
        },
        yXLM: {
          code: 'yXLM',
          issuer: 'GARDNV3Q7YGT4AKSDF25LT32YSCCW67G2P2AFZQHSJQD2VQFAAUJEQHP',
          name: 'Yieldblox XLM'
        }
      };
    } else {
      // Testnet assets
      return {
        USDC: {
          code: 'USDC',
          issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
          name: 'USD Coin (Test)'
        }
      };
    }
  }

  /**
   * Get Stellar DEX offers
   */
  async getDEXOffers(selling, buying, limit = 20) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const offers = await this.server.offers()
        .selling(selling)
        .buying(buying)
        .limit(limit)
        .order('desc')
        .call();

      return offers.records.map(offer => ({
        id: offer.id,
        seller: offer.seller,
        selling: offer.selling,
        buying: offer.buying,
        amount: offer.amount,
        price: offer.price,
        priceR: offer.price_r
      }));
    } catch (error) {
      throw new BlockchainError(
        `Failed to get DEX offers: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        this.chainId,
        error
      );
    }
  }

  /**
   * Get swap quote using Stellar DEX
   */
  async getSwapQuote(sellingAsset, buyingAsset, amount) {
    try {
      // This would implement path finding on Stellar DEX
      // For now, return a placeholder
      throw new BlockchainError(
        'DEX swap functionality not fully implemented yet',
        ErrorCodes.NOT_SUPPORTED,
        this.chainId
      );
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to get swap quote: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        this.chainId,
        error
      );
    }
  }
}

module.exports = XLMAdapter;

