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
    
    console.log('[XRPL Execution] Initialized:', {
      network: this.network,
      rpcUrl: this.rpcUrl,
      xummConfigured: !!(process.env.XUMM_API_KEY && process.env.XUMM_API_SECRET)
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

      // Calculate amount in drops (1 XRP = 1,000,000 drops)
      const amountDrops = Math.floor(route.expectedOutput * 1000000).toString();

      // For this stage, we'll do a self-transfer to prove the signing flow
      // In production, this would be a swap transaction or payment to exchange
      const txJson = {
        TransactionType: 'Payment',
        Account: walletAddress,
        Destination: walletAddress, // Self-transfer for demo
        Amount: amountDrops,
        Fee: '12' // 12 drops = 0.000012 XRP (standard fee)
      };

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
          type: 'Payment',
          from: walletAddress,
          to: walletAddress,
          amount: route.expectedOutput,
          amountDrops: amountDrops,
          fee: '12'
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
}

module.exports = XrplRouteExecutionService;
