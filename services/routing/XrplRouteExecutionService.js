/**
 * XrplRouteExecutionService.js
 * Stage 7.3: XRPL Live Execution Service via Xaman
 * 
 * Handles execution of XRPL trades on Testnet/Mainnet
 * - Builds XRPL payment transactions
 * - Generates Xaman signing payloads
 * - Polls for signature completion
 * - Submits signed transactions to XRPL
 * - Returns transaction confirmation details
 */

const { XummSdk } = require('xumm-sdk');
const xrpl = require('xrpl');

class XrplRouteExecutionService {
  constructor() {
    // Initialize Xaman SDK
    this.xumm = new XummSdk(
      process.env.XUMM_API_KEY || '',
      process.env.XUMM_API_SECRET || ''
    );
    
    // Network configuration
    this.network = process.env.XRPL_NETWORK || 'testnet';
    this.rpcUrl = this.network === 'testnet' 
      ? 'wss://s.altnet.rippletest.net:51233'
      : 'wss://xrplcluster.com';
    
    // USDT issuer configuration
    this.issuers = {
      testnet: {
        USDT: process.env.XRPL_TESTNET_USDT_ISSUER || 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
        USD: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
        USDC: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH'
      },
      mainnet: {
        USDT: 'rcvxE9PS9YBwxtGg1qNeewV6ZB3wGubZq', // Tether
        USD: 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B', // Bitstamp
        USDC: 'rcEGREd8NmkKRE8GE424sksyt1tJVFZwu' // Circle
      }
    };
    
    console.log('[XRPL Execution] Initialized:', {
      network: this.network,
      rpcUrl: this.rpcUrl,
      xummConfigured: !!(process.env.XUMM_API_KEY && process.env.XUMM_API_SECRET),
      usdtIssuer: this.issuers[this.network].USDT
    });
  }

  /**
   * Execute an XRPL route
   * @param {Object} route - Route object from RoutePlanner
   * @param {Object} params - Execution parameters
   * @returns {Object} Execution result with Xaman payload
   */
  async executeRoute(route, params) {
    const { walletAddress, executionMode } = params;

    console.log(`[XRPL Execution] Starting ${executionMode} execution for route:`, route.routeId);

    try {
      // Validate wallet address
      if (!walletAddress) {
        throw new Error('Wallet address is required for XRPL execution');
      }

      // Validate XRPL address format
      if (!walletAddress.startsWith('r')) {
        throw new Error(`Invalid XRPL wallet address: ${walletAddress}`);
      }

      // For live execution, build Xaman signing payload
      if (executionMode === 'live') {
        return await this.buildXamanPayload(route, walletAddress);
      }

      // For demo execution, simulate the transaction
      if (executionMode === 'demo') {
        return await this.simulateExecution(route, walletAddress);
      }

      throw new Error(`Unsupported execution mode: ${executionMode}`);
    } catch (error) {
      console.error('[XRPL Execution] Error:', error);
      throw error;
    }
  }

  /**
   * Build OfferCreate transaction for XRPL DEX
   * @param {Object} route - Route object
   * @param {string} walletAddress - User's XRPL wallet address
   * @param {Object} client - XRPL client
   * @returns {Object} Transaction JSON
   */
  async buildOfferCreateTx(route, walletAddress, client) {
    console.log('[XRPL Execution] Building OfferCreate transaction');

    // Parse trade details from route
    const base = route.fromToken || 'XRP';
    const quote = route.toToken || 'USDT';
    const amount = route.amount || 0;
    const side = route.side || 'buy'; // buy = buy quote with base, sell = sell base for quote

    console.log('[XRPL Execution] Trade details:', { base, quote, amount, side });

    // Get issuer for quote currency (USDT)
    const quoteIssuer = this.issuers[this.network][quote];
    if (!quoteIssuer) {
      throw new Error(`No issuer configured for ${quote} on ${this.network}`);
    }

    // Calculate amounts with slippage
    const slippageTolerance = 0.01; // 1% slippage
    const expectedOutput = route.expectedOutput || amount;

    let takerGets, takerPays;

    if (side === 'buy') {
      // Buy USDT with XRP
      // TakerGets = what we receive (USDT)
      // TakerPays = what we pay (XRP)
      const usdtAmount = expectedOutput;
      const xrpAmount = amount;
      const maxXrpWithSlippage = xrpAmount * (1 + slippageTolerance);

      takerGets = {
        currency: quote,
        issuer: quoteIssuer,
        value: usdtAmount.toString()
      };

      takerPays = Math.floor(maxXrpWithSlippage * 1000000).toString(); // XRP in drops

    } else {
      // Sell XRP for USDT
      // TakerGets = what we receive (XRP)
      // TakerPays = what we pay (USDT)
      const xrpAmount = amount;
      const usdtAmount = expectedOutput;
      const minUsdtWithSlippage = usdtAmount * (1 - slippageTolerance);

      takerGets = Math.floor(xrpAmount * 1000000).toString(); // XRP in drops

      takerPays = {
        currency: quote,
        issuer: quoteIssuer,
        value: minUsdtWithSlippage.toString()
      };
    }

    console.log('[XRPL Execution] OfferCreate amounts:', {
      takerGets,
      takerPays,
      side
    });

    const txJson = {
      TransactionType: 'OfferCreate',
      Account: walletAddress,
      TakerGets: takerGets,
      TakerPays: takerPays,
      Fee: '12' // 12 drops = 0.000012 XRP (standard fee)
    };

    return txJson;
  }

  /**
   * Check if wallet has trustline to a specific issuer
   * @param {Object} client - XRPL client
   * @param {string} walletAddress - User's XRPL wallet address
   * @param {string} currency - Currency code (e.g., 'USDT')
   * @param {string} issuer - Issuer address
   * @returns {boolean} True if trustline exists
   */
  async checkTrustline(client, walletAddress, currency, issuer) {
    console.log('[XRPL Execution] Checking trustline:', { walletAddress, currency, issuer });

    try {
      const response = await client.request({
        command: 'account_lines',
        account: walletAddress,
        ledger_index: 'current'
      });

      const lines = response.result.lines || [];
      const hasTrustline = lines.some(line => 
        line.currency === currency && line.account === issuer
      );

      console.log('[XRPL Execution] Trustline check result:', {
        hasTrustline,
        totalLines: lines.length
      });

      return hasTrustline;
    } catch (error) {
      console.error('[XRPL Execution] Error checking trustline:', error);
      // If we can't check, assume no trustline to be safe
      return false;
    }
  }

  /**
   * Build Xaman signing payload for live execution
   * @param {Object} route - Route object
   * @param {string} walletAddress - User's XRPL wallet address
   * @returns {Object} Xaman payload details
   */
  async buildXamanPayload(route, walletAddress) {
    console.log('[XRPL Execution] Building Xaman payload for live execution');

    try {
      // Connect to XRPL to get account info and fee
      const client = new xrpl.Client(this.rpcUrl);
      await client.connect();

      // Get account info to validate wallet exists
      try {
        await client.request({
          command: 'account_info',
          account: walletAddress,
          ledger_index: 'current'
        });
      } catch (err) {
        client.disconnect();
        throw new Error(`Wallet address not found on XRPL ${this.network}: ${walletAddress}`);
      }

      // Validate trustline before building OfferCreate
      const quote = route.toToken || 'USDT';
      if (quote !== 'XRP') {
        const quoteIssuer = this.issuers[this.network][quote];
        const hasTrustline = await this.checkTrustline(client, walletAddress, quote, quoteIssuer);
        
        if (!hasTrustline) {
          client.disconnect();
          const error = new Error(`Trustline required for ${quote}`);
          error.code = 'TRUSTLINE_REQUIRED';
          error.details = {
            currency: quote,
            issuer: quoteIssuer,
            message: `Your wallet needs a trustline to ${quote} (issuer: ${quoteIssuer}) before trading. Please set up the trustline in your Xaman wallet first.`
          };
          throw error;
        }
      }

      // Build OfferCreate transaction for XRPL DEX
      const txJson = await this.buildOfferCreateTx(route, walletAddress, client);

      // Auto-fill transaction fields (sequence, last ledger sequence, etc.)
      const prepared = await client.autofill(txJson);

      client.disconnect();

      console.log('[XRPL Execution] Prepared transaction:', prepared);

      // Create Xaman signing payload
      const payload = await this.xumm.payload.create({
        txjson: prepared,
        options: {
          submit: false, // We'll submit after getting the signed blob
          expire: 5, // Expire in 5 minutes
          return_url: {
            web: `${process.env.FRONTEND_URL || 'https://dbx-frontend.onrender.com'}/exchange?network=XRP`
          }
        }
      });

      console.log('[XRPL Execution] Xaman payload created:', {
        uuid: payload.uuid,
        qrUrl: payload.refs.qr_png,
        deepLink: payload.next.always
      });

      return {
        success: true,
        network: `XRPL_${this.network.toUpperCase()}`,
        executionMode: 'live',
        requiresSignature: true,
        xamanPayload: {
          uuid: payload.uuid,
          qrUrl: payload.refs.qr_png,
          deepLink: payload.next.always,
          websocket: payload.refs.websocket_status,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
        },
        transaction: {
          type: 'OfferCreate',
          account: walletAddress,
          takerGets: prepared.TakerGets,
          takerPays: prepared.TakerPays,
          fee: prepared.Fee || '12'
        },
        route: {
          routeId: route.routeId,
          chain: 'XRP',
          expectedOutput: route.expectedOutput,
          fees: route.fees
        }
      };
    } catch (error) {
      console.error('[XRPL Execution] Failed to build Xaman payload:', error);
      
      // Re-throw trustline errors with code preserved
      if (error.code === 'TRUSTLINE_REQUIRED') {
        throw error;
      }
      
      throw new Error(`Failed to build XRPL transaction: ${error.message}`);
    }
  }

  /**
   * Get Xaman payload status and signed transaction
   * @param {string} payloadUuid - Xaman payload UUID
   * @returns {Object} Payload status and signed transaction blob
   */
  async getPayloadStatus(payloadUuid) {
    try {
      const payload = await this.xumm.payload.get(payloadUuid);

      console.log('[XRPL Execution] Payload status:', {
        uuid: payloadUuid,
        signed: payload.meta.signed,
        resolved: payload.meta.resolved
      });

      if (!payload.meta.resolved) {
        return {
          status: 'pending',
          signed: false
        };
      }

      if (!payload.meta.signed) {
        return {
          status: 'rejected',
          signed: false,
          reason: 'User rejected the signature request'
        };
      }

      return {
        status: 'signed',
        signed: true,
        signedBlob: payload.response.hex,
        txid: payload.response.txid
      };
    } catch (error) {
      console.error('[XRPL Execution] Failed to get payload status:', error);
      throw error;
    }
  }

  /**
   * Submit signed transaction to XRPL
   * @param {string} signedBlob - Signed transaction hex
   * @returns {Object} Transaction result
   */
  async submitSignedTransaction(signedBlob) {
    console.log('[XRPL Execution] Submitting signed transaction to XRPL');
    console.log('[XRPL Execution] Using endpoint:', this.rpcUrl);

    try {
      const client = new xrpl.Client(this.rpcUrl);
      await client.connect();

      // Submit the signed transaction
      const result = await client.submit(signedBlob);

      console.log('[XRPL Execution] Submit response:', JSON.stringify(result, null, 2));

      const engineResult = result.result.engine_result;
      const engineResultCode = result.result.engine_result_code;
      const engineResultMessage = result.result.engine_result_message;
      const txHash = result.result.tx_json?.hash;

      console.log('[XRPL Execution] Engine result:', {
        engineResult,
        engineResultCode,
        engineResultMessage,
        txHash
      });

      // Check if transaction was successful or queued
      const isSuccess = engineResult === 'tesSUCCESS';
      const isQueued = engineResult === 'terQUEUED';
      const shouldValidate = isSuccess || isQueued;

      // Handle redundant transaction (already submitted)
      if (engineResultCode === -275 || engineResult === 'tefPAST_SEQ') {
        console.log('[XRPL Execution] Transaction redundant (already submitted)');
        client.disconnect();
        
        return {
          success: true,
          status: 'already_submitted',
          network: `xrpl-${this.network}`,
          transaction: {
            hash: txHash || 'unknown',
            network: `XRPL ${this.network.charAt(0).toUpperCase() + this.network.slice(1)}`,
            status: 'redundant'
          },
          settlement: {
            status: 'already_submitted'
          },
          explorerUrl: txHash ? (
            this.network === 'testnet'
              ? `https://testnet.xrpl.org/transactions/${txHash}`
              : `https://livenet.xrpl.org/transactions/${txHash}`
          ) : null,
          message: engineResultMessage,
          timestamp: new Date().toISOString()
        };
      }

      // Handle other non-success results
      if (!shouldValidate) {
        console.log('[XRPL Execution] Transaction not successful, skipping validation');
        client.disconnect();
        
        return {
          success: false,
          status: 'xrpl_engine_result',
          engine_result: engineResult,
          engine_result_code: engineResultCode,
          message: engineResultMessage || `Transaction failed with result: ${engineResult}`,
          network: `xrpl-${this.network}`,
          transaction: {
            hash: txHash,
            network: `XRPL ${this.network.charAt(0).toUpperCase() + this.network.slice(1)}`,
            status: 'failed'
          },
          timestamp: new Date().toISOString()
        };
      }

      // Transaction successful or queued - wait for validation
      console.log('[XRPL Execution] Transaction successful, waiting for validation...');
      const validated = await this.waitForValidation(client, txHash);

      client.disconnect();

      if (!validated.success) {
        return {
          success: false,
          status: 'validation_failed',
          message: validated.error || 'Transaction validation failed',
          network: `xrpl-${this.network}`,
          transaction: {
            hash: txHash,
            network: `XRPL ${this.network.charAt(0).toUpperCase() + this.network.slice(1)}`,
            status: 'pending'
          },
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        status: 'confirmed',
        network: `xrpl-${this.network}`,
        transaction: {
          hash: txHash,
          ledgerIndex: validated.ledgerIndex,
          fee: validated.fee,
          network: `XRPL ${this.network.charAt(0).toUpperCase() + this.network.slice(1)}`,
          status: 'confirmed'
        },
        settlement: {
          status: 'confirmed'
        },
        explorerUrl: this.network === 'testnet'
          ? `https://testnet.xrpl.org/transactions/${txHash}`
          : `https://livenet.xrpl.org/transactions/${txHash}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('[XRPL Execution] Failed to submit transaction:', error);
      // Return structured error instead of throwing
      return {
        success: false,
        status: 'error',
        message: error.message || 'Failed to submit transaction',
        error: error.toString(),
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Wait for transaction validation on XRPL
   * @param {Object} client - XRPL client
   * @param {string} txHash - Transaction hash
   * @returns {Object} Validation result
   */
  async waitForValidation(client, txHash, maxAttempts = 10) {
    console.log('[XRPL Execution] Waiting for transaction validation:', txHash);

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const tx = await client.request({
          command: 'tx',
          transaction: txHash
        });

        if (tx.result.validated) {
          console.log('[XRPL Execution] Transaction validated');
          
          return {
            success: tx.result.meta.TransactionResult === 'tesSUCCESS',
            ledgerIndex: tx.result.ledger_index,
            fee: tx.result.Fee,
            error: tx.result.meta.TransactionResult !== 'tesSUCCESS' 
              ? tx.result.meta.TransactionResult 
              : null
          };
        }
      } catch (err) {
        // Transaction not yet in ledger, wait and retry
      }

      // Wait 1 second before next attempt
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Transaction validation timeout');
  }

  /**
   * Simulate execution for demo mode
   * @param {Object} route - Route object
   * @param {string} walletAddress - User's wallet address
   * @returns {Object} Simulated execution result
   */
  async simulateExecution(route, walletAddress) {
    console.log('[XRPL Execution] Simulating demo execution');

    // Generate a fake transaction hash for demo
    const fakeHash = `DEMO_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    return {
      success: true,
      network: `XRPL_${this.network.toUpperCase()}`,
      executionMode: 'demo',
      transaction: {
        hash: fakeHash,
        ledgerIndex: Math.floor(Math.random() * 1000000) + 50000000,
        fee: '12',
        network: `XRPL ${this.network.charAt(0).toUpperCase() + this.network.slice(1)} (Demo)`
      },
      settlement: {
        status: 'simulated'
      },
      explorerUrl: '#',
      route: {
        routeId: route.routeId,
        chain: 'XRP',
        expectedOutput: route.expectedOutput,
        fees: route.fees
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create Xaman payload for TrustSet transaction
   * @param {string} walletAddress - User's XRPL wallet address
   * @param {string} currency - Currency code (e.g., 'USDT')
   * @returns {Object} Xaman payload details
   */
  async createTrustlinePayload(walletAddress, currency = 'USDT') {
    console.log('[XRPL Execution] Creating TrustSet payload:', { walletAddress, currency });

    try {
      // Get issuer for the currency
      const issuer = this.issuers[this.network][currency];
      if (!issuer) {
        throw new Error(`No issuer configured for ${currency} on ${this.network}`);
      }

      // Build TrustSet transaction
      const txJson = {
        TransactionType: 'TrustSet',
        Account: walletAddress,
        LimitAmount: {
          currency: currency.toUpperCase(),
          issuer: issuer,
          value: '1000000000' // Trust limit (1 billion)
        },
        Flags: 131072 // tfSetNoRipple
      };

      console.log('[XRPL Execution] TrustSet transaction:', txJson);

      // Create Xaman signing payload
      // Validate SDK is initialized
      if (!this.xumm || !process.env.XUMM_API_KEY || !process.env.XUMM_API_SECRET) {
        throw new Error('Xaman SDK not properly initialized - missing API credentials');
      }
      
      console.log('[XRPL Execution] SDK check:', {
        hasXumm: !!this.xumm,
        hasPayloadMethod: !!this.xumm?.payload,
        hasCreateMethod: !!this.xumm?.payload?.create,
        xummType: typeof this.xumm,
        payloadType: typeof this.xumm?.payload,
        hasApiKey: !!process.env.XUMM_API_KEY,
        hasApiSecret: !!process.env.XUMM_API_SECRET,
        apiKeyLength: process.env.XUMM_API_KEY?.length,
        apiSecretLength: process.env.XUMM_API_SECRET?.length
      });
      
      console.log('[XRPL Execution] Calling Xaman SDK with:', {
        txjson: txJson,
        options: {
          submit: false,
          expire: 5,
          return_url: {
            web: `${process.env.FRONTEND_URL || 'https://dbx-frontend.onrender.com'}/exchange?network=XRP`
          }
        }
      });
      
      // Prepare diagnostic info
      const diagnostics = {
        sdkVersion: require('xumm-sdk/package.json').version,
        hasApiKey: !!process.env.XUMM_API_KEY,
        hasApiSecret: !!process.env.XUMM_API_SECRET,
        apiKeyLength: process.env.XUMM_API_KEY?.length,
        apiSecretLength: process.env.XUMM_API_SECRET?.length,
        requestPayloadSummary: {
          TransactionType: txJson.TransactionType,
          issuer: txJson.LimitAmount.issuer,
          currency: txJson.LimitAmount.currency,
          limit: txJson.LimitAmount.value,
          returnUrlDomain: new URL(process.env.FRONTEND_URL || 'https://dbx-frontend.onrender.com').hostname,
          submitFlag: false,
          expire: 5
        }
      };

      let payload;
      let sdkError = null;
      
      try {
        payload = await this.xumm.payload.create({
          txjson: txJson,
          options: {
            submit: false,
            expire: 5,
            return_url: {
              web: `${process.env.FRONTEND_URL || 'https://dbx-frontend.onrender.com'}/exchange?network=XRP`
            }
          }
        });
      } catch (err) {
        sdkError = err;
        console.error('[XRPL Execution] Xaman SDK threw error:', {
          message: err.message,
          stack: err.stack,
          response: err.response?.data,
          status: err.response?.status,
          statusText: err.response?.statusText
        });
      }

      console.log('[XRPL Execution] Xaman SDK returned:', payload);
      
      if (!payload || sdkError) {
        const error = new Error('Xaman SDK failed to create payload');
        error.code = 'XAMAN_CREATE_FAILED';
        error.diagnostics = {
          ...diagnostics,
          httpStatus: sdkError?.response?.status,
          httpBody: sdkError?.response?.data,
          errorMessage: sdkError?.message,
          errorStack: sdkError?.stack?.split('\n').slice(0, 3).join('\n')
        };
        throw error;
      }

      console.log('[XRPL Execution] TrustSet Xaman payload created:', {
        uuid: payload.uuid,
        qrUrl: payload.refs.qr_png,
        deepLink: payload.next.always
      });

      return {
        success: true,
        xamanPayload: {
          uuid: payload.uuid,
          qrUrl: payload.refs.qr_png,
          deepLink: payload.next.always,
          websocket: payload.refs.websocket_status,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
        },
        transaction: {
          type: 'TrustSet',
          currency: currency,
          issuer: issuer,
          limit: '1000'
        }
      };
    } catch (error) {
      console.error('[XRPL Execution] Failed to create TrustSet payload:', error);
      throw new Error(`Failed to create trustline payload: ${error.message}`);
    }
  }
}

module.exports = XrplRouteExecutionService;
