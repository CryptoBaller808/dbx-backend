/**
 * Bitcoin Wallet Service
 * Handles Bitcoin wallet operations, security, and integration
 */

const OptimizedBitcoinAdapter = require('./OptimizedBitcoinAdapter');
const crypto = require('crypto');
const QRCode = require('qrcode');

class BitcoinWalletService {
  constructor(config = {}) {
    this.adapter = new OptimizedBitcoinAdapter(config);
    this.encryptionKey = config.encryptionKey || process.env.ENCRYPTION_KEY;
    this.wallets = new Map(); // In-memory wallet storage (use database in production)
  }

  /**
   * Create new Bitcoin wallet
   */
  async createWallet(userId, options = {}) {
    try {
      const wallet = this.bitcoinAdapter.generateWallet();
      const encryptedWallet = this.encryptWalletData(wallet);
      
      const walletData = {
        id: this.generateWalletId(),
        userId,
        address: wallet.address,
        type: 'bitcoin',
        network: 'mainnet',
        balance: {
          confirmed: 0,
          unconfirmed: 0,
          total: 0
        },
        encryptedData: encryptedWallet,
        createdAt: new Date(),
        lastSyncAt: null,
        isActive: true
      };

      // Store wallet (in production, save to database)
      this.wallets.set(walletData.id, walletData);

      return {
        walletId: walletData.id,
        address: wallet.address,
        type: 'bitcoin',
        network: 'mainnet',
        qrCode: await this.generateAddressQR(wallet.address),
        createdAt: walletData.createdAt
      };
    } catch (error) {
      throw new Error(`Failed to create Bitcoin wallet: ${error.message}`);
    }
  }

  /**
   * Import existing Bitcoin wallet
   */
  async importWallet(userId, privateKey, options = {}) {
    try {
      const wallet = this.bitcoinAdapter.importWallet(privateKey);
      const encryptedWallet = this.encryptWalletData(wallet);
      
      const walletData = {
        id: this.generateWalletId(),
        userId,
        address: wallet.address,
        type: 'bitcoin',
        network: 'mainnet',
        balance: {
          confirmed: 0,
          unconfirmed: 0,
          total: 0
        },
        encryptedData: encryptedWallet,
        createdAt: new Date(),
        lastSyncAt: null,
        isActive: true,
        imported: true
      };

      // Store wallet
      this.wallets.set(walletData.id, walletData);

      // Sync balance
      await this.syncWalletBalance(walletData.id);

      return {
        walletId: walletData.id,
        address: wallet.address,
        type: 'bitcoin',
        network: 'mainnet',
        balance: walletData.balance,
        qrCode: await this.generateAddressQR(wallet.address),
        createdAt: walletData.createdAt
      };
    } catch (error) {
      throw new Error(`Failed to import Bitcoin wallet: ${error.message}`);
    }
  }

  /**
   * Get wallet details
   */
  async getWallet(walletId) {
    try {
      const wallet = this.wallets.get(walletId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Sync balance if needed
      if (!wallet.lastSyncAt || Date.now() - wallet.lastSyncAt.getTime() > 60000) {
        await this.syncWalletBalance(walletId);
      }

      return {
        walletId: wallet.id,
        address: wallet.address,
        type: wallet.type,
        network: wallet.network,
        balance: wallet.balance,
        createdAt: wallet.createdAt,
        lastSyncAt: wallet.lastSyncAt,
        isActive: wallet.isActive
      };
    } catch (error) {
      throw new Error(`Failed to get wallet: ${error.message}`);
    }
  }

  /**
   * Sync wallet balance with blockchain
   */
  async syncWalletBalance(walletId) {
    try {
      const wallet = this.wallets.get(walletId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const balance = await this.bitcoinAdapter.getBalance(wallet.address);
      
      wallet.balance = {
        confirmed: balance.confirmed,
        unconfirmed: balance.unconfirmed,
        total: balance.total
      };
      wallet.lastSyncAt = new Date();

      return wallet.balance;
    } catch (error) {
      throw new Error(`Failed to sync wallet balance: ${error.message}`);
    }
  }

  /**
   * Send Bitcoin transaction
   */
  async sendTransaction(walletId, toAddress, amount, options = {}) {
    try {
      const wallet = this.wallets.get(walletId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Decrypt wallet data
      const decryptedWallet = this.decryptWalletData(wallet.encryptedData);
      
      // Validate recipient address
      const addressValidation = this.bitcoinAdapter.validateAddress(toAddress);
      if (!addressValidation.isValid) {
        throw new Error('Invalid recipient address');
      }

      // Convert amount to satoshis
      const amountSatoshis = this.bitcoinAdapter.btcToSatoshis(amount);

      // Create transaction
      const transaction = await this.bitcoinAdapter.createTransaction(
        wallet.address,
        toAddress,
        amountSatoshis,
        decryptedWallet.privateKey,
        options
      );

      // Broadcast transaction
      const broadcastResult = await this.bitcoinAdapter.broadcastTransaction(transaction.hex);

      // Record transaction
      const transactionRecord = {
        id: this.generateTransactionId(),
        walletId,
        txid: broadcastResult.txid,
        type: 'sent',
        amount: amount,
        fee: this.bitcoinAdapter.satoshisToBTC(transaction.fee),
        fromAddress: wallet.address,
        toAddress,
        status: 'pending',
        createdAt: new Date(),
        broadcastAt: new Date()
      };

      return {
        transactionId: transactionRecord.id,
        txid: broadcastResult.txid,
        amount,
        fee: transactionRecord.fee,
        status: 'pending',
        estimatedConfirmationTime: this.estimateConfirmationTime(options.feeRate)
      };
    } catch (error) {
      throw new Error(`Failed to send Bitcoin transaction: ${error.message}`);
    }
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(walletId, limit = 50) {
    try {
      const wallet = this.wallets.get(walletId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const history = await this.bitcoinAdapter.getTransactionHistory(wallet.address, limit);
      
      return history.map(tx => ({
        txid: tx.txid,
        type: tx.type,
        amount: this.bitcoinAdapter.satoshisToBTC(Math.abs(tx.amount)),
        confirmations: tx.confirmations,
        status: tx.status,
        timestamp: tx.timestamp,
        fee: tx.fee ? this.bitcoinAdapter.satoshisToBTC(tx.fee) : null
      }));
    } catch (error) {
      throw new Error(`Failed to get transaction history: ${error.message}`);
    }
  }

  /**
   * Generate QR code for address
   */
  async generateAddressQR(address, amount = null, label = null) {
    try {
      const qrData = this.bitcoinAdapter.generateQRCode(address, amount, label);
      const qrCodeDataURL = await QRCode.toDataURL(qrData.uri);
      
      return {
        dataURL: qrCodeDataURL,
        uri: qrData.uri,
        address,
        amount,
        label
      };
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  /**
   * Estimate transaction fees
   */
  async estimateTransactionFees(walletId, toAddress, amount) {
    try {
      const wallet = this.wallets.get(walletId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const fees = await this.bitcoinAdapter.estimateFees();
      const utxos = await this.bitcoinAdapter.getUTXOs(wallet.address);
      
      // Estimate transaction size
      const inputCount = Math.min(utxos.length, 10); // Limit inputs for estimation
      const outputCount = 2; // Recipient + change
      const txSize = this.bitcoinAdapter.calculateTransactionSize(inputCount, outputCount, true);

      return {
        slow: {
          feeRate: fees.slow,
          fee: this.bitcoinAdapter.satoshisToBTC(fees.slow * txSize),
          estimatedTime: '60+ minutes'
        },
        standard: {
          feeRate: fees.standard,
          fee: this.bitcoinAdapter.satoshisToBTC(fees.standard * txSize),
          estimatedTime: '10-30 minutes'
        },
        fast: {
          feeRate: fees.fast,
          fee: this.bitcoinAdapter.satoshisToBTC(fees.fast * txSize),
          estimatedTime: '1-10 minutes'
        },
        unit: 'BTC',
        txSize
      };
    } catch (error) {
      throw new Error(`Failed to estimate fees: ${error.message}`);
    }
  }

  /**
   * Get wallet UTXOs
   */
  async getWalletUTXOs(walletId) {
    try {
      const wallet = this.wallets.get(walletId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const utxos = await this.bitcoinAdapter.getUTXOs(wallet.address);
      
      return utxos.map(utxo => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: this.bitcoinAdapter.satoshisToBTC(utxo.value),
        confirmations: utxo.confirmations,
        spendable: utxo.confirmations >= this.bitcoinAdapter.minConfirmations
      }));
    } catch (error) {
      throw new Error(`Failed to get wallet UTXOs: ${error.message}`);
    }
  }

  /**
   * Monitor transaction status
   */
  async monitorTransaction(txid) {
    try {
      const transaction = await this.bitcoinAdapter.getTransaction(txid);
      
      return {
        txid: transaction.txid,
        confirmations: transaction.confirmations,
        status: transaction.status,
        blockHash: transaction.blockHash,
        blockTime: transaction.blockTime,
        fee: this.bitcoinAdapter.satoshisToBTC(transaction.fee),
        size: transaction.size
      };
    } catch (error) {
      throw new Error(`Failed to monitor transaction: ${error.message}`);
    }
  }

  /**
   * Get current Bitcoin price
   */
  async getCurrentPrice(currency = 'USD') {
    try {
      return await this.bitcoinAdapter.getCurrentPrice(currency);
    } catch (error) {
      throw new Error(`Failed to get Bitcoin price: ${error.message}`);
    }
  }

  /**
   * Get mempool status
   */
  async getMempoolStatus() {
    try {
      return await this.bitcoinAdapter.getMempoolStatus();
    } catch (error) {
      throw new Error(`Failed to get mempool status: ${error.message}`);
    }
  }

  /**
   * Encrypt wallet data
   */
  encryptWalletData(walletData) {
    try {
      const algorithm = 'aes-256-gcm';
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, this.encryptionKey);
      
      let encrypted = cipher.update(JSON.stringify(walletData), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        algorithm
      };
    } catch (error) {
      throw new Error(`Failed to encrypt wallet data: ${error.message}`);
    }
  }

  /**
   * Decrypt wallet data
   */
  decryptWalletData(encryptedData) {
    try {
      const decipher = crypto.createDecipher(encryptedData.algorithm, this.encryptionKey);
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error(`Failed to decrypt wallet data: ${error.message}`);
    }
  }

  /**
   * Generate unique wallet ID
   */
  generateWalletId() {
    return 'btc_' + crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate unique transaction ID
   */
  generateTransactionId() {
    return 'tx_' + crypto.randomBytes(16).toString('hex');
  }

  /**
   * Estimate confirmation time based on fee rate
   */
  estimateConfirmationTime(feeRate) {
    if (feeRate >= 10) return '1-10 minutes';
    if (feeRate >= 5) return '10-30 minutes';
    if (feeRate >= 1) return '30-60 minutes';
    return '60+ minutes';
  }

  /**
   * Validate Bitcoin amount
   */
  validateAmount(amount) {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return { isValid: false, error: 'Invalid amount' };
    }
    if (amountNum < 0.00000001) {
      return { isValid: false, error: 'Amount too small (minimum 1 satoshi)' };
    }
    if (amountNum > 21000000) {
      return { isValid: false, error: 'Amount exceeds maximum Bitcoin supply' };
    }
    return { isValid: true };
  }

  /**
   * Get service info
   */
  getServiceInfo() {
    return {
      name: 'Bitcoin Wallet Service',
      version: '1.0.0',
      network: 'mainnet',
      features: [
        'wallet_creation',
        'wallet_import',
        'balance_tracking',
        'transaction_sending',
        'transaction_history',
        'fee_estimation',
        'qr_code_generation',
        'utxo_management',
        'mempool_monitoring'
      ],
      security: [
        'aes_256_encryption',
        'secure_key_storage',
        'address_validation',
        'amount_validation'
      ]
    };
  }
}

module.exports = BitcoinWalletService;

