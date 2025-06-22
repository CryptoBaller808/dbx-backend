/**
 * Transaction Service Implementation
 * 
 * Provides transaction-related operations across all supported blockchains.
 */

const { TransactionService: BaseTransactionService } = require('./blockchain-abstraction-layer');

class TransactionService extends BaseTransactionService {
  constructor(adapterRegistry, transactionRepository) {
    super(adapterRegistry, transactionRepository);
    this.pendingTransactions = new Map();
  }

  /**
   * Create and submit a transaction
   * @param {string} chainId - Chain identifier
   * @param {Object} txParams - Transaction parameters
   * @param {Object} signingParams - Parameters for signing
   * @returns {Promise<Object>} Transaction result
   */
  async createAndSubmitTransaction(chainId, txParams, signingParams) {
    // Build transaction
    const unsignedTx = await this.buildTransaction(chainId, txParams);
    
    // Sign transaction
    const signedTx = await this.signTransaction(chainId, unsignedTx, signingParams);
    
    // Submit transaction
    return await this.submitTransaction(chainId, signedTx);
  }

  /**
   * Track a pending transaction
   * @param {string} chainId - Chain identifier
   * @param {string} txHash - Transaction hash
   * @param {Object} metadata - Additional transaction metadata
   * @returns {Promise<void>}
   */
  async trackTransaction(chainId, txHash, metadata = {}) {
    // Add to pending transactions
    this.pendingTransactions.set(txHash, {
      chainId,
      txHash,
      status: 'pending',
      createdAt: new Date(),
      metadata
    });
    
    // Start monitoring transaction status
    this._monitorTransaction(chainId, txHash);
  }

  /**
   * Monitor transaction status
   * @param {string} chainId - Chain identifier
   * @param {string} txHash - Transaction hash
   * @private
   */
  async _monitorTransaction(chainId, txHash) {
    try {
      const adapter = this.adapterRegistry.getAdapter(chainId);
      
      // Check if adapter supports transaction monitoring
      if (typeof adapter.monitorTransaction !== 'function') {
        // Fallback to polling
        await this._pollTransactionStatus(chainId, txHash);
        return;
      }
      
      // Use adapter's native monitoring
      await adapter.monitorTransaction(txHash, async (status) => {
        await this._updateTransactionStatus(txHash, status);
      });
    } catch (error) {
      console.error(`Failed to monitor transaction ${txHash}:`, error);
      // Update status to error
      await this._updateTransactionStatus(txHash, { status: 'error', error });
    }
  }

  /**
   * Poll transaction status
   * @param {string} chainId - Chain identifier
   * @param {string} txHash - Transaction hash
   * @private
   */
  async _pollTransactionStatus(chainId, txHash) {
    const adapter = this.adapterRegistry.getAdapter(chainId);
    let attempts = 0;
    const maxAttempts = 30; // Configurable
    const interval = 10000; // 10 seconds, configurable
    
    const poll = async () => {
      try {
        attempts++;
        
        // Get transaction details
        const tx = await adapter.getTransaction(txHash);
        
        // Update status
        await this._updateTransactionStatus(txHash, {
          status: tx.status || 'pending',
          data: tx
        });
        
        // Continue polling if still pending
        if ((tx.status === 'pending' || !tx.status) && attempts < maxAttempts) {
          setTimeout(poll, interval);
        }
      } catch (error) {
        console.error(`Failed to poll transaction ${txHash}:`, error);
        
        // Retry if not too many attempts
        if (attempts < maxAttempts) {
          setTimeout(poll, interval);
        } else {
          // Update status to error
          await this._updateTransactionStatus(txHash, { status: 'error', error });
        }
      }
    };
    
    // Start polling
    poll();
  }

  /**
   * Update transaction status
   * @param {string} txHash - Transaction hash
   * @param {Object} status - Status update
   * @private
   */
  async _updateTransactionStatus(txHash, status) {
    // Update in-memory cache
    const tx = this.pendingTransactions.get(txHash);
    if (tx) {
      Object.assign(tx, status, { updatedAt: new Date() });
      
      // Remove from pending if final status
      if (['confirmed', 'failed', 'error'].includes(status.status)) {
        this.pendingTransactions.delete(txHash);
      }
    }
    
    // Update in database
    try {
      await this.transactionRepository.update(
        { status: status.status, data: status.data || {} },
        { where: { txHash } }
      );
    } catch (error) {
      console.error(`Failed to update transaction ${txHash} in database:`, error);
    }
  }

  /**
   * Get transaction status
   * @param {string} txHash - Transaction hash
   * @returns {Object|null} Transaction status or null if not found
   */
  getTransactionStatus(txHash) {
    return this.pendingTransactions.get(txHash) || null;
  }

  /**
   * Get all pending transactions
   * @returns {Map<string, Object>} Map of pending transactions by hash
   */
  getAllPendingTransactions() {
    return this.pendingTransactions;
  }
}

module.exports = TransactionService;
