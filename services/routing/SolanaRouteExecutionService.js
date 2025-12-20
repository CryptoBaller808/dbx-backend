/**
 * SolanaRouteExecutionService.js
 * Stage 7.4: Solana Live Execution Service
 * 
 * Handles execution of Solana trades on Devnet
 * - Native SOL transfers only (no SPL tokens yet)
 * - Builds unsigned transactions for Phantom signing
 * - Estimates transaction fees
 * - Returns transaction signature and confirmation details
 */

const {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL
} = require('@solana/web3.js');

class SolanaRouteExecutionService {
  constructor() {
    this.connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    this.cluster = 'devnet';
  }

  /**
   * Execute a Solana route
   * @param {Object} route - Route object from RoutePlanner
   * @param {Object} params - Execution parameters
   * @returns {Object} Execution result with unsigned transaction
   */
  async executeRoute(route, params) {
    const { walletAddress, executionMode } = params;

    console.log(`[Solana Execution] Starting ${executionMode} execution for route:`, route.routeId);

    try {
      // Validate wallet address
      if (!walletAddress) {
        throw new Error('Wallet address is required for Solana execution');
      }

      let fromPubkey;
      try {
        fromPubkey = new PublicKey(walletAddress);
      } catch (err) {
        throw new Error(`Invalid Solana wallet address: ${walletAddress}`);
      }

      // For live execution, build unsigned transaction
      if (executionMode === 'live') {
        return await this.buildUnsignedTransaction(route, fromPubkey);
      }

      // For demo execution, simulate the transaction
      if (executionMode === 'demo') {
        return await this.simulateExecution(route, fromPubkey);
      }

      throw new Error(`Unsupported execution mode: ${executionMode}`);
    } catch (error) {
      console.error('[Solana Execution] Error:', error);
      throw error;
    }
  }

  /**
   * Build unsigned transaction for live execution
   * @param {Object} route - Route object
   * @param {PublicKey} fromPubkey - Sender's public key
   * @returns {Object} Unsigned transaction details
   */
  async buildUnsignedTransaction(route, fromPubkey) {
    console.log('[Solana Execution] Building unsigned transaction for live execution');

    try {
      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');

      // Calculate amount in lamports
      const amountLamports = Math.floor(route.expectedOutput * LAMPORTS_PER_SOL);

      // For now, we'll use a self-transfer (send to same address)
      // In the future, this would be a swap transaction
      const transaction = new Transaction({
        feePayer: fromPubkey,
        blockhash,
        lastValidBlockHeight
      });

      // Add transfer instruction
      transaction.add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey: fromPubkey, // Self-transfer for demo
          lamports: amountLamports
        })
      );

      // Estimate fee
      const fee = await this.connection.getFeeForMessage(
        transaction.compileMessage(),
        'confirmed'
      );

      // Serialize transaction for frontend
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false
      }).toString('base64');

      console.log('[Solana Execution] Unsigned transaction built successfully');

      return {
        success: true,
        network: 'SOL_DEVNET',
        executionMode: 'live',
        requiresSignature: true,
        unsignedTransaction: {
          serialized: serializedTransaction,
          blockhash,
          lastValidBlockHeight,
          feeLamports: fee.value || 5000 // Default to 5000 lamports if estimation fails
        },
        route: {
          routeId: route.routeId,
          chain: 'SOL',
          expectedOutput: route.expectedOutput,
          fees: route.fees
        }
      };
    } catch (error) {
      console.error('[Solana Execution] Failed to build unsigned transaction:', error);
      throw new Error(`Failed to build Solana transaction: ${error.message}`);
    }
  }

  /**
   * Simulate execution for demo mode
   * @param {Object} route - Route object
   * @param {PublicKey} fromPubkey - Sender's public key
   * @returns {Object} Simulated execution result
   */
  async simulateExecution(route, fromPubkey) {
    console.log('[Solana Execution] Simulating demo execution');

    // Check balance
    const balance = await this.connection.getBalance(fromPubkey);
    const balanceSOL = balance / LAMPORTS_PER_SOL;
    const requiredSOL = route.expectedOutput;

    if (balanceSOL < requiredSOL) {
      throw new Error(`Insufficient SOL balance. Required: ${requiredSOL} SOL, Available: ${balanceSOL} SOL`);
    }

    // Return simulated result
    return {
      success: true,
      network: 'SOL_DEVNET',
      executionMode: 'demo',
      transaction: {
        signature: 'DEMO_' + Date.now(),
        slot: Math.floor(Math.random() * 1000000),
        fee: 5000 // 5000 lamports = 0.000005 SOL
      },
      route: {
        routeId: route.routeId,
        chain: 'SOL',
        expectedOutput: route.expectedOutput,
        actualOutput: route.expectedOutput,
        fees: route.fees
      }
    };
  }

  /**
   * Get transaction confirmation details
   * @param {string} signature - Transaction signature
   * @returns {Object} Confirmation details
   */
  async getTransactionConfirmation(signature) {
    try {
      const confirmation = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      if (!confirmation) {
        return {
          success: false,
          error: 'Transaction not found'
        };
      }

      return {
        success: true,
        signature,
        slot: confirmation.slot,
        blockTime: confirmation.blockTime,
        fee: confirmation.meta.fee,
        status: confirmation.meta.err ? 'failed' : 'confirmed'
      };
    } catch (error) {
      console.error('[Solana Execution] Failed to get confirmation:', error);
      throw error;
    }
  }
}

module.exports = SolanaRouteExecutionService;
