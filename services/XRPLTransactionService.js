/**
 * XRPLTransactionService.js
 * Stage 6: XRPL Transaction Execution Service
 * 
 * Wraps xrpl.js library for transaction submission and confirmation
 */

const xrpl = require('xrpl');

class XRPLTransactionService {
  constructor() {
    this.network = process.env.XRPL_NETWORK || 'testnet';
    this.rpcUrl = this.network === 'testnet' 
      ? (process.env.TESTNET || 'wss://s.altnet.rippletest.net:51233')
      : 'wss://xrplcluster.com';
    
    console.log('[XRPLTransactionService] Initialized with network:', this.network);
    console.log('[XRPLTransactionService] RPC URL:', this.rpcUrl);
  }
  
  /**
   * Submit a transaction to XRPL
   * @param {Object} transaction - XRPL transaction object
   * @param {string} seed - Wallet seed for signing
   * @returns {Promise<Object>} Transaction result
   */
  async submitTransaction(transaction, seed) {
    const client = new xrpl.Client(this.rpcUrl);
    
    try {
      console.log('[XRPLTransactionService] Connecting to XRPL...');
      await client.connect();
      
      // Create wallet from seed
      const wallet = xrpl.Wallet.fromSeed(seed);
      console.log('[XRPLTransactionService] Wallet address:', wallet.address);
      
      // Prepare transaction
      const prepared = await client.autofill(transaction);
      console.log('[XRPLTransactionService] Transaction prepared:', {
        TransactionType: prepared.TransactionType,
        Account: prepared.Account,
        Destination: prepared.Destination,
        Fee: prepared.Fee
      });
      
      // Sign transaction
      const signed = wallet.sign(prepared);
      console.log('[XRPLTransactionService] Transaction signed:', signed.hash);
      
      // Submit transaction
      console.log('[XRPLTransactionService] Submitting transaction...');
      const result = await client.submitAndWait(signed.tx_blob);
      
      console.log('[XRPLTransactionService] Transaction result:', {
        hash: result.result.hash,
        result: result.result.meta.TransactionResult,
        ledgerIndex: result.result.ledger_index
      });
      
      await client.disconnect();
      
      return {
        hash: result.result.hash,
        result: result.result.meta.TransactionResult,
        ledgerIndex: result.result.ledger_index,
        fee: result.result.Fee,
        validated: result.result.validated
      };
      
    } catch (error) {
      console.error('[XRPLTransactionService] Transaction failed:', error);
      await client.disconnect();
      throw error;
    }
  }
  
  /**
   * Wait for transaction confirmation
   * @param {string} txHash - Transaction hash
   * @returns {Promise<Object>} Confirmed transaction
   */
  async waitForConfirmation(txHash) {
    const client = new xrpl.Client(this.rpcUrl);
    
    try {
      console.log('[XRPLTransactionService] Waiting for confirmation:', txHash);
      await client.connect();
      
      // Get transaction details
      const tx = await client.request({
        command: 'tx',
        transaction: txHash
      });
      
      console.log('[XRPLTransactionService] Transaction confirmed:', {
        hash: tx.result.hash,
        ledgerIndex: tx.result.ledger_index,
        status: tx.result.meta.TransactionResult
      });
      
      await client.disconnect();
      
      return {
        hash: tx.result.hash,
        ledgerIndex: tx.result.ledger_index,
        status: tx.result.meta.TransactionResult,
        fee: tx.result.Fee,
        timestamp: tx.result.date ? new Date((tx.result.date + 946684800) * 1000).toISOString() : new Date().toISOString(),
        balanceChanges: this._extractBalanceChanges(tx.result.meta)
      };
      
    } catch (error) {
      console.error('[XRPLTransactionService] Confirmation failed:', error);
      await client.disconnect();
      throw error;
    }
  }
  
  /**
   * Extract balance changes from transaction metadata
   * @private
   */
  _extractBalanceChanges(meta) {
    const changes = {};
    
    if (meta.AffectedNodes) {
      for (const node of meta.AffectedNodes) {
        const modified = node.ModifiedNode || node.CreatedNode || node.DeletedNode;
        if (modified && modified.LedgerEntryType === 'AccountRoot') {
          const account = modified.FinalFields?.Account || modified.NewFields?.Account;
          const prevBalance = modified.PreviousFields?.Balance;
          const finalBalance = modified.FinalFields?.Balance || modified.NewFields?.Balance;
          
          if (account && prevBalance && finalBalance) {
            const change = (parseInt(finalBalance) - parseInt(prevBalance)) / 1000000;
            changes[account] = {
              currency: 'XRP',
              change: change.toFixed(6)
            };
          }
        }
      }
    }
    
    return changes;
  }
}

module.exports = { XRPLTransactionService };
