const { BlockchainAdapter, BlockchainError, ErrorCodes } = require("../blockchain-abstraction-layer");
const {
  Client,
  Wallet,
  xrpToDrops,
  dropsToXrp,
  isValidAddress,
  Transaction,
  Payment,
  TrustSet,
  AccountSet,
  OfferCreate,
  OfferCancel
} = require("xrpl");
const { XummSdk } = require("xumm-sdk");

/**
 * XRP Ledger (XRP) Blockchain Adapter
 * Supports XRP Ledger with native XRP and IOU token operations
 */
class XRPAdapter extends BlockchainAdapter {
  constructor(config) {
    super(config);
    this.client = null;
    this.xummSdk = null;
    this.chainId = "XRP";
    this.networkConfig = {
      mainnet: {
        name: "XRP Ledger Mainnet",
        server: "wss://xrplcluster.com",
        explorerUrl: "https://livenet.xrpl.org",
        nativeCurrency: {
          name: "XRP",
          symbol: "XRP",
          decimals: 6,
        },
      },
      testnet: {
        name: "XRP Ledger Testnet",
        server: "wss://s.altnet.rippletest.net:51233",
        explorerUrl: "https://testnet.xrpl.org",
        nativeCurrency: {
          name: "XRP",
          symbol: "XRP",
          decimals: 6,
        },
      },
      devnet: {
        name: "XRP Ledger Devnet",
        server: "wss://s.devnet.rippletest.net:51233",
        explorerUrl: "https://devnet.xrpl.org",
        nativeCurrency: {
          name: "XRP",
          symbol: "XRP",
          decimals: 6,
        },
      },
    };
  }

  /**
   * Initialize the XRP adapter
   */
  async initialize() {
    try {
      const network = this.config.network || "mainnet";
      const networkConfig = this.networkConfig[network];

      if (!networkConfig) {
        throw new BlockchainError(
          `Unsupported network: ${network}`,
          ErrorCodes.INVALID_PARAMS,
          this.chainId
        );
      }

      // Initialize XRPL Client
      const server = this.config.server || networkConfig.server;
      this.client = new Client(server);
      await this.client.connect();

      // Initialize XUMM SDK if API keys are provided
      if (this.config.xummApiKey && this.config.xummApiSecret) {
        this.xummSdk = new XummSdk(
          this.config.xummApiKey,
          this.config.xummApiSecret,
          {
            network: process.env.XRPL_NETWORK || 'mainnet' // defaults to mainnet
          }
        );
      }

      this.isInitialized = true;
      console.log(`[XRP Adapter] Initialized for ${network}`);

      return {
        success: true,
        chainId: this.chainId,
        network: networkConfig.name,
        serverStatus: await this.client.request({ command: "server_info" }),
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to initialize XRP adapter: ${error.message}`,
        ErrorCodes.CONNECTION_ERROR,
        this.chainId,
        error
      );
    }
  }

  /**
   * Validate XRP address
   */
  isValidXRPAddress(address) {
    return isValidAddress(address);
  }

  /**
   * Get balance for an address
   */
  async getBalance(address, currency = null, issuer = null) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.isValidXRPAddress(address)) {
        throw new BlockchainError(
          "Invalid XRP address format",
          ErrorCodes.INVALID_PARAMS,
          this.chainId
        );
      }

      if (currency && issuer) {
        // IOU Token balance
        const accountLines = await this.client.request({
          command: "account_lines",
          account: address,
          ledger_index: "validated",
        });

        const line = accountLines.result.lines.find(
          (l) => l.currency === currency && l.account === issuer
        );

        if (!line) {
          return {
            address,
            balance: "0",
            currency,
            issuer,
            limit: "0",
            chainId: this.chainId,
            network: this.config.network || "mainnet",
            hasTrustline: false,
          };
        }

        return {
          address,
          balance: line.balance,
          currency: line.currency,
          issuer: line.account,
          limit: line.limit,
          chainId: this.chainId,
          network: this.config.network || "mainnet",
          hasTrustline: true,
        };
      } else {
        // Native XRP balance
        const accountInfo = await this.client.request({
          command: "account_info",
          account: address,
          ledger_index: "validated",
        });

        const balanceXRP = dropsToXrp(
          accountInfo.result.account_data.Balance
        );

        return {
          address,
          balance: balanceXRP,
          balanceDrops: accountInfo.result.account_data.Balance,
          currency: "XRP",
          issuer: null,
          chainId: this.chainId,
          network: this.config.network || "mainnet",
          sequence: accountInfo.result.account_data.Sequence,
          ownerCount: accountInfo.result.account_data.OwnerCount,
        };
      }
    } catch (error) {
      if (error.data && error.data.error === "actNotFound") {
        // Account doesn_t exist
        return {
          address,
          balance: "0",
          currency: currency || "XRP",
          issuer: issuer || null,
          chainId: this.chainId,
          network: this.config.network || "mainnet",
          accountExists: false,
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

      const tx = await this.client.request({
        command: "tx",
        transaction: hash,
      });

      return {
        hash: tx.result.hash,
        ledgerIndex: tx.result.ledger_index,
        date: tx.result.date,
        type: tx.result.TransactionType,
        account: tx.result.Account,
        destination: tx.result.Destination,
        amount: tx.result.Amount
          ? typeof tx.result.Amount === "string"
            ? dropsToXrp(tx.result.Amount)
            : `${tx.result.Amount.value} ${tx.result.Amount.currency}`
          : null,
        fee: dropsToXrp(tx.result.Fee),
        sequence: tx.result.Sequence,
        validated: tx.result.validated,
        meta: tx.result.meta,
        chainId: this.chainId,
        network: this.config.network || "mainnet",
      };
    } catch (error) {
      if (error.data && error.data.error === "txnNotFound") {
        throw new BlockchainError(
          "Transaction not found",
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
        currency = "XRP",
        issuer = null,
        destinationTag = null,
        memo = null,
        fee = null, // Fee in drops
      } = txParams;

      // Validate addresses
      if (!this.isValidXRPAddress(from)) {
        throw new BlockchainError(
          "Invalid from address",
          ErrorCodes.INVALID_PARAMS,
          this.chainId
        );
      }

      if (!this.isValidXRPAddress(to)) {
        throw new BlockchainError(
          "Invalid to address",
          ErrorCodes.INVALID_PARAMS,
          this.chainId
        );
      }

      // Prepare transaction object
      const tx = {
        TransactionType: "Payment",
        Account: from,
        Destination: to,
      };

      // Set amount
      if (currency === "XRP") {
        tx.Amount = xrpToDrops(amount.toString());
      } else {
        tx.Amount = {
          currency,
          issuer,
          value: amount.toString(),
        };
      }

      // Add destination tag if provided
      if (destinationTag) {
        tx.DestinationTag = parseInt(destinationTag);
      }

      // Add memo if provided
      if (memo) {
        tx.Memos = [
          {
            Memo: {
              MemoType: Buffer.from("text/plain").toString("hex").toUpperCase(),
              MemoData: Buffer.from(memo).toString("hex").toUpperCase(),
            },
          },
        ];
      }

      // Set fee if provided, otherwise auto-fill
      if (fee) {
        tx.Fee = fee.toString();
      } else {
        const preparedTx = await this.client.autofill(tx);
        tx.Fee = preparedTx.Fee;
      }

      // Auto-fill sequence number
      const preparedTx = await this.client.autofill(tx);

      return {
        transaction: preparedTx,
        chainId: this.chainId,
        network: this.config.network || "mainnet",
        fee: preparedTx.Fee,
        sequence: preparedTx.Sequence,
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
      const { secret, wallet, xummPayload } = signingParams;

      if (secret) {
        // Sign with secret key
        const signerWallet = Wallet.fromSeed(secret);
        const signedTx = signerWallet.sign(tx.transaction);

        return {
          signedTransaction: signedTx.tx_blob,
          hash: signedTx.hash,
          chainId: this.chainId,
          from: signerWallet.classicAddress,
        };
      } else if (wallet) {
        // Sign with xrpl.js Wallet object
        const signedTx = wallet.sign(tx.transaction);

        return {
          signedTransaction: signedTx.tx_blob,
          hash: signedTx.hash,
          chainId: this.chainId,
          from: wallet.classicAddress,
        };
      } else if (xummPayload) {
        // XUMM SDK signing (payload already prepared)
        if (!this.xummSdk) {
          throw new BlockchainError(
            "XUMM SDK not initialized",
            ErrorCodes.WALLET_ERROR,
            this.chainId
          );
        }

        const subscription = await this.xummSdk.payload.subscribe(
          xummPayload,
          (event) => {
            if (event.data.signed !== undefined) {
              return event.data;
            }
          }
        );

        const resolveData = await subscription.resolved;

        if (resolveData.signed === false) {
          throw new BlockchainError(
            "Transaction rejected by user",
            ErrorCodes.UNAUTHORIZED,
            this.chainId
          );
        }

        return {
          signedTransaction: resolveData.tx_blob,
          hash: resolveData.txid,
          chainId: this.chainId,
          from: xummPayload.txjson.Account,
          xummResult: resolveData,
        };
      } else {
        throw new BlockchainError(
          "No signing method provided",
          ErrorCodes.INVALID_PARAMS,
          this.chainId
        );
      }
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

      const result = await this.client.submit(signedTx.signedTransaction);

      return {
        hash: result.result.tx_json.hash,
        engineResult: result.result.engine_result,
        engineResultCode: result.result.engine_result_code,
        engineResultMessage: result.result.engine_result_message,
        status: result.result.engine_result === "tesSUCCESS" ? "success" : "failed",
        chainId: this.chainId,
        network: this.config.network || "mainnet",
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
   * Connect to wallet (XUMM)
   */
  async connectWallet(options = {}) {
    try {
      const { walletType = "xumm" } = options;

      if (walletType === "xumm") {
        if (!this.xummSdk) {
          throw new BlockchainError(
            "XUMM SDK not initialized. Provide API keys in config.",
            ErrorCodes.WALLET_ERROR,
            this.chainId
          );
        }

        const signInPayload = {
          txjson: {
            TransactionType: "SignIn",
          },
        };

        const payload = await this.xummSdk.payload.create(signInPayload);

        return {
          success: true,
          walletType: "xumm",
          payloadUuid: payload.uuid,
          qrCodeUrl: payload.next.always,
          qrMatrix: payload.refs.qr_matrix,
          qrPng: payload.refs.qr_png,
          websocketUrl: payload.refs.websocket_status,
          chainId: this.chainId,
          network: this.config.network || "mainnet",
        };
      } else {
        throw new BlockchainError(
          `Unsupported wallet type: ${walletType}`,
          ErrorCodes.INVALID_PARAMS,
          this.chainId
        );
      }
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
      if (this.xummSdk) {
        // XUMM SDK doesn_t have a specific disconnect method
        // User sessions are managed by XUMM app
      }
      return {
        success: true,
        message: "XUMM session management is handled by the XUMM app.",
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

      const [serverInfo, feeInfo] = await Promise.all([
        this.client.request({ command: "server_info" }),
        this.client.request({ command: "fee" }),
      ]);

      return {
        chainId: this.chainId,
        network: this.config.network || "mainnet",
        serverState: serverInfo.result.info.server_state,
        ledgerVersion: serverInfo.result.info.validated_ledger.seq,
        baseFeeXRP: dropsToXrp(feeInfo.result.drops.base_fee),
        reserveBaseXRP: dropsToXrp(feeInfo.result.drops.reserve_base),
        reserveIncrementXRP: dropsToXrp(feeInfo.result.drops.reserve_inc),
        isConnected: this.client.isConnected(),
        lastUpdated: new Date().toISOString(),
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
   * Create trustline for IOU token
   */
  async createTrustline(accountSecret, currency, issuer, limit) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const wallet = Wallet.fromSeed(accountSecret);

      const trustSetTx = {
        TransactionType: "TrustSet",
        Account: wallet.classicAddress,
        LimitAmount: {
          currency,
          issuer,
          value: limit.toString(),
        },
      };

      const preparedTx = await this.client.autofill(trustSetTx);
      const signedTx = wallet.sign(preparedTx);
      const result = await this.client.submitAndWait(signedTx.tx_blob);

      return {
        hash: result.result.tx_json.hash,
        successful: result.result.meta.TransactionResult === "tesSUCCESS",
        currency,
        issuer,
        limit,
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
   * Get popular IOU tokens on XRP Ledger
   */
  getPopularTokens() {
    const network = this.config.network || "mainnet";

    if (network === "mainnet") {
      return {
        USD_Bitstamp: {
          currency: "USD",
          issuer: "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
          name: "Bitstamp USD",
        },
        EUR_Bitstamp: {
          currency: "EUR",
          issuer: "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
          name: "Bitstamp EUR",
        },
        BTC_Bitstamp: {
          currency: "BTC",
          issuer: "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
          name: "Bitstamp BTC",
        },
        USD_GateHub: {
          currency: "USD",
          issuer: "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq",
          name: "GateHub USD",
        },
        EUR_GateHub: {
          currency: "EUR",
          issuer: "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq",
          name: "GateHub EUR",
        },
        SOLO_CoinField: {
          currency: "SOLO",
          issuer: "rsoLo2S1kiGeCcn6hCUX8skgCiGogMAh5w",
          name: "Sologenic SOLO",
        },
        XRP_GateHub: {
          currency: "XRP",
          issuer: "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq",
          name: "GateHub XRP",
        },
      };
    } else {
      // Testnet tokens
      return {
        USD_TestIssuer: {
          currency: "USD",
          issuer: "rP9jPyP5kyvFRb6ZiRk5MThhGpbWjiNB2G", // Example testnet issuer
          name: "Test USD",
        },
      };
    }
  }

  /**
   * Get order book for a trading pair
   */
  async getOrderBook(baseCurrency, counterCurrency, baseIssuer, counterIssuer, limit = 20) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const orderBookRequest = {
        command: "book_offers",
        taker_gets: {
          currency: baseCurrency,
        },
        taker_pays: {
          currency: counterCurrency,
        },
        limit: parseInt(limit),
      };

      if (baseCurrency !== "XRP") {
        orderBookRequest.taker_gets.issuer = baseIssuer;
      }
      if (counterCurrency !== "XRP") {
        orderBookRequest.taker_pays.issuer = counterIssuer;
      }

      const orderBook = await this.client.request(orderBookRequest);

      return {
        bids: orderBook.result.offers
          .filter((offer) => offer.flags === 0) // Bids (taker_gets = base, taker_pays = counter)
          .map((offer) => ({
            price: (typeof offer.TakerPays === "string" ? parseFloat(dropsToXrp(offer.TakerPays)) : parseFloat(offer.TakerPays.value)) / 
                   (typeof offer.TakerGets === "string" ? parseFloat(dropsToXrp(offer.TakerGets)) : parseFloat(offer.TakerGets.value)),
            amount: typeof offer.TakerGets === "string" ? dropsToXrp(offer.TakerGets) : offer.TakerGets.value,
          })),
        asks: orderBook.result.offers
          .filter((offer) => offer.flags !== 0) // Asks (taker_gets = counter, taker_pays = base)
          .map((offer) => ({
            price: (typeof offer.TakerGets === "string" ? parseFloat(dropsToXrp(offer.TakerGets)) : parseFloat(offer.TakerGets.value)) / 
                   (typeof offer.TakerPays === "string" ? parseFloat(dropsToXrp(offer.TakerPays)) : parseFloat(offer.TakerPays.value)),
            amount: typeof offer.TakerPays === "string" ? dropsToXrp(offer.TakerPays) : offer.TakerPays.value,
          })),
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to get order book: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        this.chainId,
        error
      );
    }
  }

  /**
   * Create a DEX offer (limit order)
   */
  async createOffer(accountSecret, takerGets, takerPays) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const wallet = Wallet.fromSeed(accountSecret);

      const offerCreateTx = {
        TransactionType: "OfferCreate",
        Account: wallet.classicAddress,
        TakerGets: takerGets, // Amount and currency/issuer they get
        TakerPays: takerPays, // Amount and currency/issuer they pay
      };

      const preparedTx = await this.client.autofill(offerCreateTx);
      const signedTx = wallet.sign(preparedTx);
      const result = await this.client.submitAndWait(signedTx.tx_blob);

      return {
        hash: result.result.tx_json.hash,
        successful: result.result.meta.TransactionResult === "tesSUCCESS",
        offerSequence: result.result.tx_json.OfferSequence,
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to create offer: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        this.chainId,
        error
      );
    }
  }

  /**
   * Cancel a DEX offer
   */
  async cancelOffer(accountSecret, offerSequence) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const wallet = Wallet.fromSeed(accountSecret);

      const offerCancelTx = {
        TransactionType: "OfferCancel",
        Account: wallet.classicAddress,
        OfferSequence: parseInt(offerSequence),
      };

      const preparedTx = await this.client.autofill(offerCancelTx);
      const signedTx = wallet.sign(preparedTx);
      const result = await this.client.submitAndWait(signedTx.tx_blob);

      return {
        hash: result.result.tx_json.hash,
        successful: result.result.meta.TransactionResult === "tesSUCCESS",
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to cancel offer: ${error.message}`,
        ErrorCodes.TRANSACTION_ERROR,
        this.chainId,
        error
      );
    }
  }
}

module.exports = XRPAdapter;


