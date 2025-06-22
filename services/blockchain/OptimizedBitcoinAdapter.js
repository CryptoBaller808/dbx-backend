/**
 * Optimized Bitcoin Blockchain Adapter
 * Enhanced with caching, improved UTXO selection, and performance optimizations
 */

const bitcoin = require('bitcoinjs-lib');
const axios = require('axios');
const crypto = require('crypto');

class OptimizedBitcoinAdapter {
  constructor(config = {}) {
    this.network = config.network || bitcoin.networks.bitcoin;
    this.apiUrl = config.apiUrl || 'https://blockstream.info/api';
    this.backupApiUrls = [
      'https://api.blockcypher.com/v1/btc/main',
      'https://api.blockchain.info',
      'https://mempool.space/api'
    ];
    this.feeApiUrl = config.feeApiUrl || 'https://mempool.space/api/v1/fees/recommended';
    this.minConfirmations = config.minConfirmations || 1;
    this.dustThreshold = 546;
    this.maxFeeRate = 1000;
    
    // Enhanced caching system
    this.cache = new Map();
    this.cacheTimeout = {
      balance: 30000,      // 30 seconds
      utxos: 60000,        // 1 minute
      fees: 120000,        // 2 minutes
      price: 60000,        // 1 minute
      transaction: 300000, // 5 minutes
      mempool: 30000       // 30 seconds
    };
    
    // Request queue for rate limiting
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.maxConcurrentRequests = 5;
    this.requestDelay = 100; // ms between requests
    
    // Performance metrics
    this.metrics = {
      apiCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgResponseTime: 0,
      errors: 0
    };
  }

  /**
   * Enhanced caching system
   */
  getCacheKey(method, params) {
    return `${method}:${JSON.stringify(params)}`;
  }

  setCache(key, data, timeout) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      timeout
    });
  }

  getCache(key) {
    const cached = this.cache.get(key);
    if (!cached) {
      this.metrics.cacheMisses++;
      return null;
    }

    if (Date.now() - cached.timestamp > cached.timeout) {
      this.cache.delete(key);
      this.metrics.cacheMisses++;
      return null;
    }

    this.metrics.cacheHits++;
    return cached.data;
  }

  /**
   * Enhanced API request with fallback and caching
   */
  async makeRequest(url, options = {}, useCache = true, cacheTimeout = 60000) {
    const cacheKey = this.getCacheKey('request', { url, options });
    
    if (useCache) {
      const cached = this.getCache(cacheKey);
      if (cached) return cached;
    }

    const startTime = Date.now();
    
    try {
      this.metrics.apiCalls++;
      const response = await axios.get(url, {
        timeout: 10000,
        ...options
      });
      
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime);
      
      if (useCache) {
        this.setCache(cacheKey, response.data, cacheTimeout);
      }
      
      return response.data;
    } catch (error) {
      this.metrics.errors++;
      
      // Try backup APIs
      for (const backupUrl of this.backupApiUrls) {
        try {
          const modifiedUrl = url.replace(this.apiUrl, backupUrl);
          const response = await axios.get(modifiedUrl, {
            timeout: 10000,
            ...options
          });
          
          if (useCache) {
            this.setCache(cacheKey, response.data, cacheTimeout);
          }
          
          return response.data;
        } catch (backupError) {
          continue;
        }
      }
      
      throw error;
    }
  }

  /**
   * Update performance metrics
   */
  updateMetrics(responseTime) {
    this.metrics.avgResponseTime = 
      (this.metrics.avgResponseTime + responseTime) / 2;
  }

  /**
   * Optimized UTXO selection algorithm
   */
  selectOptimalUTXOs(utxos, targetAmount, feeRate) {
    // Sort UTXOs by value (largest first for efficiency)
    const sortedUtxos = utxos
      .filter(utxo => utxo.confirmations >= this.minConfirmations)
      .sort((a, b) => b.value - a.value);

    let selectedUtxos = [];
    let totalValue = 0;
    let estimatedFee = 0;

    // Strategy 1: Try to find exact match or minimal overpay
    for (const utxo of sortedUtxos) {
      selectedUtxos.push(utxo);
      totalValue += utxo.value;
      
      // Estimate fee for current selection
      const txSize = this.calculateTransactionSize(selectedUtxos.length, 2, true);
      estimatedFee = txSize * feeRate;
      
      if (totalValue >= targetAmount + estimatedFee) {
        break;
      }
    }

    // Strategy 2: If we have too much overpay, try smaller UTXOs
    if (totalValue > targetAmount + estimatedFee + 10000) { // 0.0001 BTC threshold
      selectedUtxos = [];
      totalValue = 0;
      
      // Sort by value (smallest first)
      const smallSortedUtxos = sortedUtxos.sort((a, b) => a.value - b.value);
      
      for (const utxo of smallSortedUtxos) {
        selectedUtxos.push(utxo);
        totalValue += utxo.value;
        
        const txSize = this.calculateTransactionSize(selectedUtxos.length, 2, true);
        estimatedFee = txSize * feeRate;
        
        if (totalValue >= targetAmount + estimatedFee) {
          break;
        }
      }
    }

    const change = totalValue - targetAmount - estimatedFee;
    
    return {
      utxos: selectedUtxos,
      totalValue,
      estimatedFee,
      change: change > this.dustThreshold ? change : 0,
      efficiency: (targetAmount / totalValue) * 100 // Efficiency percentage
    };
  }

  /**
   * Enhanced fee estimation with mempool analysis
   */
  async estimateOptimalFees() {
    const cacheKey = this.getCacheKey('fees', {});
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      // Get recommended fees
      const feesResponse = await this.makeRequest(this.feeApiUrl, {}, false);
      
      // Get mempool status for better estimation
      const mempoolResponse = await this.makeRequest(
        'https://mempool.space/api/mempool',
        {},
        true,
        this.cacheTimeout.mempool
      );

      // Calculate dynamic fees based on mempool congestion
      const congestionMultiplier = Math.min(
        mempoolResponse.count / 50000, // Normalize by typical mempool size
        2.0 // Cap at 2x
      );

      const fees = {
        slow: Math.max(1, Math.ceil((feesResponse.hourFee || 1) * congestionMultiplier)),
        standard: Math.max(3, Math.ceil((feesResponse.halfHourFee || 5) * congestionMultiplier)),
        fast: Math.max(5, Math.ceil((feesResponse.fastestFee || 10) * congestionMultiplier)),
        priority: Math.max(10, Math.ceil((feesResponse.fastestFee || 10) * congestionMultiplier * 1.5)),
        unit: 'sat/vB',
        timestamp: Date.now(),
        mempoolInfo: {
          count: mempoolResponse.count,
          vsize: mempoolResponse.vsize,
          congestionLevel: congestionMultiplier > 1.5 ? 'high' : 
                          congestionMultiplier > 1.2 ? 'medium' : 'low'
        }
      };

      this.setCache(cacheKey, fees, this.cacheTimeout.fees);
      return fees;
    } catch (error) {
      // Fallback to conservative estimates
      return {
        slow: 2,
        standard: 6,
        fast: 12,
        priority: 20,
        unit: 'sat/vB',
        timestamp: Date.now(),
        mempoolInfo: {
          congestionLevel: 'unknown'
        }
      };
    }
  }

  /**
   * Enhanced balance checking with caching
   */
  async getBalance(address) {
    const cacheKey = this.getCacheKey('balance', { address });
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.makeRequest(
        `${this.apiUrl}/address/${address}`,
        {},
        false
      );

      const balance = {
        confirmed: data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum,
        unconfirmed: data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum,
        total: (data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum) + 
               (data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum),
        currency: 'BTC',
        decimals: 8,
        lastUpdated: Date.now()
      };

      this.setCache(cacheKey, balance, this.cacheTimeout.balance);
      return balance;
    } catch (error) {
      throw new Error(`Failed to get Bitcoin balance: ${error.message}`);
    }
  }

  /**
   * Enhanced UTXO fetching with caching
   */
  async getUTXOs(address) {
    const cacheKey = this.getCacheKey('utxos', { address });
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.makeRequest(
        `${this.apiUrl}/address/${address}/utxo`,
        {},
        false
      );

      const utxos = data.map(utxo => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        confirmations: utxo.status.confirmed ? 
          (utxo.status.block_height ? Date.now() - utxo.status.block_time * 1000 : 0) : 0,
        scriptPubKey: utxo.scriptpubkey,
        address: address,
        spendable: utxo.status.confirmed && utxo.value > this.dustThreshold
      })).filter(utxo => utxo.spendable);

      this.setCache(cacheKey, utxos, this.cacheTimeout.utxos);
      return utxos;
    } catch (error) {
      throw new Error(`Failed to get UTXOs: ${error.message}`);
    }
  }

  /**
   * Enhanced transaction creation with optimal fee calculation
   */
  async createOptimizedTransaction(fromAddress, toAddress, amount, privateKey, options = {}) {
    try {
      const keyPair = bitcoin.ECPair.fromWIF(privateKey, this.network);
      const utxos = await this.getUTXOs(fromAddress);
      const fees = await this.estimateOptimalFees();
      
      if (utxos.length === 0) {
        throw new Error('No spendable UTXOs found');
      }

      // Use specified fee rate or auto-select based on priority
      let feeRate;
      if (options.feeRate) {
        feeRate = options.feeRate;
      } else {
        const priority = options.priority || 'standard';
        feeRate = fees[priority] || fees.standard;
      }

      // Optimize UTXO selection
      const selection = this.selectOptimalUTXOs(utxos, amount, feeRate);
      
      if (selection.totalValue < amount + selection.estimatedFee) {
        throw new Error(`Insufficient funds. Need: ${amount + selection.estimatedFee}, Have: ${selection.totalValue}`);
      }

      const psbt = new bitcoin.Psbt({ network: this.network });

      // Add inputs with proper witness data
      for (const utxo of selection.utxos) {
        const txHex = await this.getTransactionHex(utxo.txid);
        
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          nonWitnessUtxo: Buffer.from(txHex, 'hex'),
          witnessUtxo: {
            script: Buffer.from(utxo.scriptPubKey, 'hex'),
            value: utxo.value
          }
        });
      }

      // Add outputs
      psbt.addOutput({
        address: toAddress,
        value: amount
      });

      // Add change output if necessary
      if (selection.change > 0) {
        psbt.addOutput({
          address: fromAddress,
          value: selection.change
        });
      }

      // Sign all inputs
      for (let i = 0; i < selection.utxos.length; i++) {
        psbt.signInput(i, keyPair);
      }

      // Validate and finalize
      if (!psbt.validateSignaturesOfAllInputs()) {
        throw new Error('Invalid transaction signatures');
      }

      psbt.finalizeAllInputs();
      const transaction = psbt.extractTransaction();

      return {
        txid: transaction.getId(),
        hex: transaction.toHex(),
        size: transaction.byteLength(),
        vsize: transaction.virtualSize(),
        fee: selection.estimatedFee,
        feeRate: Math.ceil(selection.estimatedFee / transaction.virtualSize()),
        inputs: selection.utxos.length,
        outputs: selection.change > 0 ? 2 : 1,
        amount: amount,
        change: selection.change,
        efficiency: selection.efficiency,
        estimatedConfirmTime: this.estimateConfirmationTime(feeRate, fees)
      };
    } catch (error) {
      throw new Error(`Failed to create optimized Bitcoin transaction: ${error.message}`);
    }
  }

  /**
   * Estimate confirmation time based on fee rate
   */
  estimateConfirmationTime(feeRate, currentFees) {
    if (feeRate >= currentFees.fast) {
      return '~10 minutes';
    } else if (feeRate >= currentFees.standard) {
      return '~30 minutes';
    } else if (feeRate >= currentFees.slow) {
      return '~1 hour';
    } else {
      return '1+ hours';
    }
  }

  /**
   * Enhanced transaction broadcasting with retry logic
   */
  async broadcastTransaction(txHex, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.post(`${this.apiUrl}/tx`, txHex, {
          headers: { 'Content-Type': 'text/plain' },
          timeout: 15000
        });
        
        return {
          txid: response.data,
          status: 'broadcasted',
          timestamp: Date.now(),
          attempt: attempt
        };
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          
          // Try backup APIs
          for (const backupUrl of this.backupApiUrls) {
            try {
              const response = await axios.post(`${backupUrl}/tx`, txHex, {
                headers: { 'Content-Type': 'text/plain' },
                timeout: 15000
              });
              
              return {
                txid: response.data,
                status: 'broadcasted',
                timestamp: Date.now(),
                attempt: attempt,
                api: 'backup'
              };
            } catch (backupError) {
              continue;
            }
          }
        }
      }
    }
    
    throw new Error(`Failed to broadcast transaction after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Batch transaction processing for efficiency
   */
  async batchProcessTransactions(transactions) {
    const results = [];
    const batchSize = 5;
    
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      const batchPromises = batch.map(tx => this.processTransaction(tx));
      
      try {
        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        console.error('Batch processing error:', error);
      }
      
      // Rate limiting delay between batches
      if (i + batchSize < transactions.length) {
        await new Promise(resolve => setTimeout(resolve, this.requestDelay));
      }
    }
    
    return results;
  }

  /**
   * Memory management - clear old cache entries
   */
  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > value.timeout) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100,
      errorRate: this.metrics.errors / this.metrics.apiCalls * 100
    };
  }

  /**
   * Health check for the adapter
   */
  async healthCheck() {
    try {
      const startTime = Date.now();
      await this.makeRequest(`${this.apiUrl}/blocks/tip/height`, {}, false);
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        responseTime,
        metrics: this.getPerformanceMetrics(),
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        metrics: this.getPerformanceMetrics(),
        timestamp: Date.now()
      };
    }
  }

  // Inherit all other methods from the original adapter
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
        derivationPath: "m/84'/0'/0'/0/0"
      };
    } catch (error) {
      throw new Error(`Failed to generate Bitcoin wallet: ${error.message}`);
    }
  }

  importWallet(privateKeyOrSeed, options = {}) {
    try {
      let keyPair;
      
      if (privateKeyOrSeed.length === 51 || privateKeyOrSeed.length === 52) {
        keyPair = bitcoin.ECPair.fromWIF(privateKeyOrSeed, this.network);
      } else if (privateKeyOrSeed.length === 64) {
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

  getAddressType(address) {
    if (address.startsWith('1')) return 'Legacy (P2PKH)';
    if (address.startsWith('3')) return 'SegWit (P2SH)';
    if (address.startsWith('bc1q')) return 'Native SegWit (P2WPKH)';
    if (address.startsWith('bc1p')) return 'Taproot (P2TR)';
    return 'Unknown';
  }

  calculateTransactionSize(inputCount, outputCount, hasSegWit = true) {
    if (hasSegWit) {
      const baseSize = 10 + (inputCount * 41) + (outputCount * 31);
      const witnessSize = inputCount * 107;
      return Math.ceil(baseSize + (witnessSize / 4));
    } else {
      return 10 + (inputCount * 148) + (outputCount * 34);
    }
  }

  async getTransactionHex(txid) {
    const cacheKey = this.getCacheKey('txhex', { txid });
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.makeRequest(
        `${this.apiUrl}/tx/${txid}/hex`,
        {},
        false
      );
      
      this.setCache(cacheKey, data, this.cacheTimeout.transaction);
      return data;
    } catch (error) {
      throw new Error(`Failed to get transaction hex: ${error.message}`);
    }
  }

  async getTransaction(txid) {
    const cacheKey = this.getCacheKey('transaction', { txid });
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const tx = await this.makeRequest(
        `${this.apiUrl}/tx/${txid}`,
        {},
        false
      );

      const result = {
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

      this.setCache(cacheKey, result, this.cacheTimeout.transaction);
      return result;
    } catch (error) {
      throw new Error(`Failed to get transaction: ${error.message}`);
    }
  }

  async getCurrentPrice(currency = 'USD') {
    const cacheKey = this.getCacheKey('price', { currency });
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.makeRequest(
        `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${currency.toLowerCase()}`,
        {},
        false
      );
      
      const result = {
        price: data.bitcoin[currency.toLowerCase()],
        currency: currency.toUpperCase(),
        timestamp: Date.now()
      };

      this.setCache(cacheKey, result, this.cacheTimeout.price);
      return result;
    } catch (error) {
      throw new Error(`Failed to get Bitcoin price: ${error.message}`);
    }
  }

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

  satoshisToBTC(satoshis) {
    return satoshis / 100000000;
  }

  btcToSatoshis(btc) {
    return Math.round(btc * 100000000);
  }

  formatAmount(satoshis, decimals = 8) {
    const btc = this.satoshisToBTC(satoshis);
    return btc.toFixed(decimals);
  }

  getAdapterInfo() {
    return {
      name: 'Optimized Bitcoin',
      symbol: 'BTC',
      network: this.network.messagePrefix,
      decimals: 8,
      type: 'UTXO',
      features: [
        'wallet_generation',
        'wallet_import',
        'balance_checking',
        'optimized_utxo_selection',
        'dynamic_fee_estimation',
        'transaction_creation',
        'transaction_broadcasting',
        'enhanced_caching',
        'batch_processing',
        'performance_monitoring',
        'health_checking'
      ],
      version: '2.0.0',
      optimizations: [
        'intelligent_caching',
        'optimal_utxo_selection',
        'dynamic_fee_calculation',
        'mempool_analysis',
        'api_fallback',
        'batch_processing',
        'performance_metrics'
      ]
    };
  }
}

module.exports = OptimizedBitcoinAdapter;

