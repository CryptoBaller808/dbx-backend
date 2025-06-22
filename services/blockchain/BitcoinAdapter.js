/**
 * Bitcoin Blockchain Adapter
 * Handles Bitcoin mainnet integration with UTXO model support
 * Provides wallet connectivity, transaction handling, and fee estimation
 */

const bitcoin = require('bitcoinjs-lib');
const axios = require('axios');
const crypto = require('crypto');

class BitcoinAdapter {
  constructor(config = {}) {
    this.network = config.network || bitcoin.networks.bitcoin; // Mainnet
    this.apiUrl = config.apiUrl || 'https://blockstream.info/api';
    this.backupApiUrl = config.backupApiUrl || 'https://api.blockcypher.com/v1/btc/main';
    this.feeApiUrl = config.feeApiUrl || 'https://mempool.space/api/v1/fees/recommended';
    this.minConfirmations = config.minConfirmations || 1;
    this.dustThreshold = 546; // Satoshis
    this.maxFeeRate = 1000; // Sat/vB
  }

  /**
   * Generate new Bitcoin wallet
   */
  generateWallet() {
    try {
      const keyPair = bitcoin.ECPair.makeRandom({ network: this.network });
      const { address } = bitcoin.payments.p2wpkh({ 
        pubkey: keyPair.publicKey, 
        network: this.network 
      });

      return {
        address,
        privateKey: keyPair.toWIF(),
        publicKey: keyPair.publicKey.toString('hex'),
        network: this.network.messagePrefix,
        type: 'bitcoin',
        derivationPath: "m/84'/0'/0'/0/0" // Native SegWit
      };
    } catch (error) {
      throw new Error(`Failed to generate Bitcoin wallet: ${error.message}`);
    }
  }

  /**
   * Import wallet from private key or seed phrase
   */
  importWallet(privateKeyOrSeed, options = {}) {
    try {
      let keyPair;
      
      if (privateKeyOrSeed.length === 51 || privateKeyOrSeed.length === 52) {
        // WIF format private key
        keyPair = bitcoin.ECPair.fromWIF(privateKeyOrSeed, this.network);
      } else if (privateKeyOrSeed.length === 64) {
        // Hex format private key
        const privateKeyBuffer = Buffer.from(privateKeyOrSeed, 'hex');
        keyPair = bitcoin.ECPair.fromPrivateKey(privateKeyBuffer, { network: this.network });
      } else {
        throw new Error('Invalid private key format');
      }

      const { address } = bitcoin.payments.p2wpkh({ 
        pubkey: keyPair.publicKey, 
        network: this.network 
      });

      return {
        address,
        privateKey: keyPair.toWIF(),
        publicKey: keyPair.publicKey.toString('hex'),
        network: this.network.messagePrefix,
        type: 'bitcoin'
      };
    } catch (error) {
      throw new Error(`Failed to import Bitcoin wallet: ${error.message}`);
    }
  }

  /**
   * Validate Bitcoin address
   */
  validateAddress(address) {
    try {
      bitcoin.address.toOutputScript(address, this.network);
      return {
        isValid: true,
        network: this.network.messagePrefix,
        type: this.getAddressType(address)
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.message
      };
    }
  }

  /**
   * Get address type (Legacy, SegWit, Native SegWit)
   */
  getAddressType(address) {
    if (address.startsWith('1')) return 'Legacy (P2PKH)';
    if (address.startsWith('3')) return 'SegWit (P2SH)';
    if (address.startsWith('bc1q')) return 'Native SegWit (P2WPKH)';
    if (address.startsWith('bc1p')) return 'Taproot (P2TR)';
    return 'Unknown';
  }

  /**
   * Get wallet balance
   */
  async getBalance(address) {
    try {
      const response = await axios.get(`${this.apiUrl}/address/${address}`);
      const data = response.data;

      return {
        confirmed: data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum,
        unconfirmed: data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum,
        total: (data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum) + 
               (data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum),
        currency: 'BTC',
        decimals: 8
      };
    } catch (error) {
      // Fallback to backup API
      try {
        const response = await axios.get(`${this.backupApiUrl}/addrs/${address}/balance`);
        return {
          confirmed: response.data.balance,
          unconfirmed: response.data.unconfirmed_balance,
          total: response.data.balance + response.data.unconfirmed_balance,
          currency: 'BTC',
          decimals: 8
        };
      } catch (backupError) {
        throw new Error(`Failed to get Bitcoin balance: ${error.message}`);
      }
    }
  }

  /**
   * Get UTXOs for address
   */
  async getUTXOs(address) {
    try {
      const response = await axios.get(`${this.apiUrl}/address/${address}/utxo`);
      return response.data.map(utxo => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        confirmations: utxo.status.confirmed ? utxo.status.block_height : 0,
        scriptPubKey: utxo.scriptpubkey,
        address: address
      }));
    } catch (error) {
      throw new Error(`Failed to get UTXOs: ${error.message}`);
    }
  }

  /**
   * Estimate transaction fees
   */
  async estimateFees() {
    try {
      const response = await axios.get(this.feeApiUrl);
      const fees = response.data;

      return {
        slow: fees.hourFee || 1,      // ~1 hour
        standard: fees.halfHourFee || 5, // ~30 minutes  
        fast: fees.fastestFee || 10,     // ~10 minutes
        unit: 'sat/vB',
        timestamp: Date.now()
      };
    } catch (error) {
      // Fallback to default fees
      return {
        slow: 1,
        standard: 5,
        fast: 10,
        unit: 'sat/vB',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Calculate transaction size
   */
  calculateTransactionSize(inputCount, outputCount, hasSegWit = true) {
    if (hasSegWit) {
      // SegWit transaction size calculation
      const baseSize = 10 + (inputCount * 41) + (outputCount * 31);
      const witnessSize = inputCount * 107;
      return Math.ceil(baseSize + (witnessSize / 4));
    } else {
      // Legacy transaction size
      return 10 + (inputCount * 148) + (outputCount * 34);
    }
  }

  /**
   * Create Bitcoin transaction
   */
  async createTransaction(fromAddress, toAddress, amount, privateKey, options = {}) {
    try {
      const keyPair = bitcoin.ECPair.fromWIF(privateKey, this.network);
      const utxos = await this.getUTXOs(fromAddress);
      const fees = await this.estimateFees();
      
      const feeRate = options.feeRate || fees.standard;
      const psbt = new bitcoin.Psbt({ network: this.network });

      // Select UTXOs
      let totalInput = 0;
      const selectedUtxos = [];

      for (const utxo of utxos) {
        if (utxo.confirmations >= this.minConfirmations) {
          selectedUtxos.push(utxo);
          totalInput += utxo.value;
          
          // Add input to PSBT
          const txHex = await this.getTransactionHex(utxo.txid);
          psbt.addInput({
            hash: utxo.txid,
            index: utxo.vout,
            nonWitnessUtxo: Buffer.from(txHex, 'hex')
          });

          if (totalInput >= amount + (feeRate * 250)) break; // Rough fee estimate
        }
      }

      if (totalInput < amount) {
        throw new Error('Insufficient funds');
      }

      // Calculate exact fee
      const txSize = this.calculateTransactionSize(selectedUtxos.length, 2, true);
      const fee = txSize * feeRate;
      const change = totalInput - amount - fee;

      // Add outputs
      psbt.addOutput({
        address: toAddress,
        value: amount
      });

      if (change > this.dustThreshold) {
        psbt.addOutput({
          address: fromAddress,
          value: change
        });
      }

      // Sign transaction
      for (let i = 0; i < selectedUtxos.length; i++) {
        psbt.signInput(i, keyPair);
      }

      psbt.finalizeAllInputs();
      const transaction = psbt.extractTransaction();

      return {
        txid: transaction.getId(),
        hex: transaction.toHex(),
        size: transaction.byteLength(),
        fee: fee,
        inputs: selectedUtxos.length,
        outputs: change > this.dustThreshold ? 2 : 1,
        amount: amount,
        change: change > this.dustThreshold ? change : 0
      };
    } catch (error) {
      throw new Error(`Failed to create Bitcoin transaction: ${error.message}`);
    }
  }

  /**
   * Get transaction hex
   */
  async getTransactionHex(txid) {
    try {
      const response = await axios.get(`${this.apiUrl}/tx/${txid}/hex`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get transaction hex: ${error.message}`);
    }
  }

  /**
   * Broadcast transaction
   */
  async broadcastTransaction(txHex) {
    try {
      const response = await axios.post(`${this.apiUrl}/tx`, txHex, {
        headers: { 'Content-Type': 'text/plain' }
      });
      return {
        txid: response.data,
        status: 'broadcasted',
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Failed to broadcast transaction: ${error.message}`);
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(txid) {
    try {
      const response = await axios.get(`${this.apiUrl}/tx/${txid}`);
      const tx = response.data;

      return {
        txid: tx.txid,
        confirmations: tx.status.confirmed ? tx.status.block_height : 0,
        blockHash: tx.status.block_hash,
        blockTime: tx.status.block_time,
        fee: tx.fee,
        size: tx.size,
        vsize: tx.vsize,
        inputs: tx.vin.map(input => ({
          txid: input.txid,
          vout: input.vout,
          value: input.prevout?.value || 0,
          address: input.prevout?.scriptpubkey_address
        })),
        outputs: tx.vout.map(output => ({
          value: output.value,
          address: output.scriptpubkey_address,
          scriptPubKey: output.scriptpubkey
        })),
        status: tx.status.confirmed ? 'confirmed' : 'pending'
      };
    } catch (error) {
      throw new Error(`Failed to get transaction: ${error.message}`);
    }
  }

  /**
   * Get transaction history for address
   */
  async getTransactionHistory(address, limit = 50) {
    try {
      const response = await axios.get(`${this.apiUrl}/address/${address}/txs`);
      const transactions = response.data.slice(0, limit);

      return transactions.map(tx => ({
        txid: tx.txid,
        confirmations: tx.status.confirmed ? tx.status.block_height : 0,
        timestamp: tx.status.block_time * 1000,
        fee: tx.fee,
        amount: this.calculateTransactionAmount(tx, address),
        type: this.getTransactionType(tx, address),
        status: tx.status.confirmed ? 'confirmed' : 'pending'
      }));
    } catch (error) {
      throw new Error(`Failed to get transaction history: ${error.message}`);
    }
  }

  /**
   * Calculate transaction amount for specific address
   */
  calculateTransactionAmount(tx, address) {
    let amount = 0;
    
    // Calculate inputs (negative for this address)
    tx.vin.forEach(input => {
      if (input.prevout?.scriptpubkey_address === address) {
        amount -= input.prevout.value;
      }
    });

    // Calculate outputs (positive for this address)
    tx.vout.forEach(output => {
      if (output.scriptpubkey_address === address) {
        amount += output.value;
      }
    });

    return amount;
  }

  /**
   * Get transaction type (sent/received)
   */
  getTransactionType(tx, address) {
    const amount = this.calculateTransactionAmount(tx, address);
    return amount > 0 ? 'received' : 'sent';
  }

  /**
   * Generate QR code data for Bitcoin address
   */
  generateQRCode(address, amount = null, label = null) {
    let uri = `bitcoin:${address}`;
    const params = [];

    if (amount) {
      params.push(`amount=${amount}`);
    }
    if (label) {
      params.push(`label=${encodeURIComponent(label)}`);
    }

    if (params.length > 0) {
      uri += `?${params.join('&')}`;
    }

    return {
      uri,
      address,
      amount,
      label,
      format: 'BIP21'
    };
  }

  /**
   * Get current Bitcoin price
   */
  async getCurrentPrice(currency = 'USD') {
    try {
      const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${currency.toLowerCase()}`);
      return {
        price: response.data.bitcoin[currency.toLowerCase()],
        currency: currency.toUpperCase(),
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Failed to get Bitcoin price: ${error.message}`);
    }
  }

  /**
   * Get network info
   */
  async getNetworkInfo() {
    try {
      const response = await axios.get(`${this.apiUrl}/blocks/tip/height`);
      const blockHeight = response.data;

      return {
        network: 'bitcoin',
        blockHeight,
        difficulty: null, // Would need additional API call
        hashRate: null,   // Would need additional API call
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Failed to get network info: ${error.message}`);
    }
  }

  /**
   * Monitor mempool status
   */
  async getMempoolStatus() {
    try {
      const response = await axios.get('https://mempool.space/api/mempool');
      return {
        count: response.data.count,
        vsize: response.data.vsize,
        totalFees: response.data.total_fee,
        feeHistogram: response.data.fee_histogram,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Failed to get mempool status: ${error.message}`);
    }
  }

  /**
   * Convert satoshis to BTC
   */
  satoshisToBTC(satoshis) {
    return satoshis / 100000000;
  }

  /**
   * Convert BTC to satoshis
   */
  btcToSatoshis(btc) {
    return Math.round(btc * 100000000);
  }

  /**
   * Format Bitcoin amount
   */
  formatAmount(satoshis, decimals = 8) {
    const btc = this.satoshisToBTC(satoshis);
    return btc.toFixed(decimals);
  }

  /**
   * Get adapter info
   */
  getAdapterInfo() {
    return {
      name: 'Bitcoin',
      symbol: 'BTC',
      network: this.network.messagePrefix,
      decimals: 8,
      type: 'UTXO',
      features: [
        'wallet_generation',
        'wallet_import',
        'balance_checking',
        'transaction_creation',
        'transaction_broadcasting',
        'fee_estimation',
        'address_validation',
        'qr_code_generation',
        'transaction_history',
        'mempool_monitoring'
      ],
      version: '1.0.0'
    };
  }
}

module.exports = BitcoinAdapter;

