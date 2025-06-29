/**
 * Cross-Chain NFT Bridge Service
 * Handles NFT bridging between different blockchain networks
 */

const db = require('../models');
const crypto = require('crypto');
const { Op } = require('sequelize');

class CrossChainNFTBridge {
  constructor() {
    this.bridgeValidators = new Map(); // Validator nodes for cross-chain verification
    this.bridgeTransactions = new Map(); // Active bridge transactions
    this.supportedChains = ['ETH', 'BNB', 'AVAX', 'MATIC', 'XDC', 'SOL', 'XRP', 'XLM'];
    this.bridgeFees = new Map(); // Bridge fees per chain pair
    this.verificationThreshold = 3; // Minimum validator confirmations
    this.socketIO = null;
    
    // Initialize bridge fees
    this.initializeBridgeFees();
  }

  /**
   * Initialize the bridge service
   */
  async initialize(socketIO = null) {
    try {
      this.socketIO = socketIO;
      
      // Load active bridge transactions
      await this.loadActiveBridgeTransactions();
      
      // Initialize validator network
      await this.initializeValidatorNetwork();
      
      // Start bridge monitoring
      this.startBridgeMonitoring();
      
      console.log('[CrossChainNFTBridge] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[CrossChainNFTBridge] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initiate NFT bridge transfer
   */
  async initiateBridge(bridgeData) {
    try {
      const {
        nft_id,
        user_id,
        source_chain,
        destination_chain,
        destination_address,
        bridge_type = 'BURN_MINT'
      } = bridgeData;

      // Validate bridge request
      await this.validateBridgeRequest(bridgeData);

      // Get NFT details
      const nft = await db.nfts.findByPk(nft_id, {
        include: [
          { model: db.nft_collections, as: 'collection' },
          { model: db.users, as: 'current_owner' }
        ]
      });

      if (!nft) {
        throw new Error('NFT not found');
      }

      if (nft.current_owner_id !== user_id) {
        throw new Error('User is not the owner of this NFT');
      }

      if (nft.blockchain !== source_chain) {
        throw new Error('NFT is not on the specified source chain');
      }

      // Calculate bridge fees
      const bridgeFee = this.calculateBridgeFee(source_chain, destination_chain, nft);

      // Create bridge transaction record
      const bridgeTransaction = await db.nft_bridge_transactions.create({
        nft_id,
        user_id,
        source_chain,
        destination_chain,
        destination_address,
        bridge_type,
        bridge_fee_amount: bridgeFee.amount,
        bridge_fee_currency: bridgeFee.currency,
        status: 'INITIATED',
        verification_hash: this.generateVerificationHash(nft_id, user_id, source_chain, destination_chain),
        required_confirmations: this.verificationThreshold,
        current_confirmations: 0
      });

      // Add to active transactions
      this.bridgeTransactions.set(bridgeTransaction.id, bridgeTransaction);

      // Emit bridge initiated event
      if (this.socketIO) {
        this.socketIO.emit('bridge_initiated', {
          bridge_id: bridgeTransaction.id,
          nft_id,
          source_chain,
          destination_chain,
          bridge_fee: bridgeFee
        });
      }

      console.log(`[CrossChainNFTBridge] Bridge initiated: ${bridgeTransaction.id} for NFT ${nft_id}`);
      return {
        bridge_transaction: bridgeTransaction,
        bridge_fee: bridgeFee,
        estimated_completion_time: this.estimateCompletionTime(source_chain, destination_chain)
      };
    } catch (error) {
      console.error('[CrossChainNFTBridge] Bridge initiation failed:', error);
      throw error;
    }
  }

  /**
   * Execute burn phase of bridge
   */
  async executeBurnPhase(bridgeId, burnSignature) {
    try {
      const bridgeTransaction = await db.nft_bridge_transactions.findByPk(bridgeId, {
        include: [{ model: db.nfts, as: 'nft' }]
      });

      if (!bridgeTransaction) {
        throw new Error('Bridge transaction not found');
      }

      if (bridgeTransaction.status !== 'INITIATED') {
        throw new Error('Bridge transaction is not in initiated status');
      }

      // Verify burn signature
      const isValidSignature = await this.verifyBurnSignature(
        bridgeTransaction,
        burnSignature
      );

      if (!isValidSignature) {
        throw new Error('Invalid burn signature');
      }

      // Update NFT status to burned
      await bridgeTransaction.nft.update({
        status: 'BURNED',
        bridge_transaction_id: bridgeId
      });

      // Update bridge transaction
      await bridgeTransaction.update({
        status: 'BURN_COMPLETED',
        burn_transaction_hash: burnSignature.transactionHash,
        burn_block_number: burnSignature.blockNumber,
        burn_timestamp: new Date()
      });

      // Start verification process
      await this.startCrossChainVerification(bridgeId);

      // Emit burn completed event
      if (this.socketIO) {
        this.socketIO.emit('bridge_burn_completed', {
          bridge_id: bridgeId,
          nft_id: bridgeTransaction.nft_id,
          burn_tx_hash: burnSignature.transactionHash
        });
      }

      console.log(`[CrossChainNFTBridge] Burn phase completed for bridge ${bridgeId}`);
      return bridgeTransaction;
    } catch (error) {
      console.error('[CrossChainNFTBridge] Burn phase failed:', error);
      throw error;
    }
  }

  /**
   * Execute mint phase of bridge
   */
  async executeMintPhase(bridgeId, validatorSignatures) {
    try {
      const bridgeTransaction = await db.nft_bridge_transactions.findByPk(bridgeId, {
        include: [
          { model: db.nfts, as: 'nft' },
          { model: db.users, as: 'user' }
        ]
      });

      if (!bridgeTransaction) {
        throw new Error('Bridge transaction not found');
      }

      if (bridgeTransaction.status !== 'VERIFIED') {
        throw new Error('Bridge transaction is not verified');
      }

      // Verify validator signatures
      const isValidSignatures = await this.verifyValidatorSignatures(
        bridgeTransaction,
        validatorSignatures
      );

      if (!isValidSignatures) {
        throw new Error('Invalid validator signatures');
      }

      // Create mirrored NFT on destination chain
      const mirroredNFT = await this.createMirroredNFT(bridgeTransaction);

      // Update bridge transaction
      await bridgeTransaction.update({
        status: 'MINT_COMPLETED',
        destination_nft_id: mirroredNFT.id,
        mint_transaction_hash: mirroredNFT.transaction_hash,
        mint_block_number: mirroredNFT.block_number,
        mint_timestamp: new Date(),
        completion_timestamp: new Date()
      });

      // Remove from active transactions
      this.bridgeTransactions.delete(bridgeId);

      // Emit mint completed event
      if (this.socketIO) {
        this.socketIO.emit('bridge_mint_completed', {
          bridge_id: bridgeId,
          original_nft_id: bridgeTransaction.nft_id,
          mirrored_nft_id: mirroredNFT.id,
          destination_chain: bridgeTransaction.destination_chain,
          mint_tx_hash: mirroredNFT.transaction_hash
        });
      }

      console.log(`[CrossChainNFTBridge] Mint phase completed for bridge ${bridgeId}`);
      return {
        bridge_transaction: bridgeTransaction,
        mirrored_nft: mirroredNFT
      };
    } catch (error) {
      console.error('[CrossChainNFTBridge] Mint phase failed:', error);
      throw error;
    }
  }

  /**
   * Start cross-chain verification process
   */
  async startCrossChainVerification(bridgeId) {
    try {
      const bridgeTransaction = await db.nft_bridge_transactions.findByPk(bridgeId);
      
      if (!bridgeTransaction) {
        throw new Error('Bridge transaction not found');
      }

      // Update status to verification
      await bridgeTransaction.update({ status: 'VERIFYING' });

      // Request verification from validator network
      const verificationRequest = {
        bridge_id: bridgeId,
        verification_hash: bridgeTransaction.verification_hash,
        source_chain: bridgeTransaction.source_chain,
        destination_chain: bridgeTransaction.destination_chain,
        burn_tx_hash: bridgeTransaction.burn_transaction_hash,
        timestamp: new Date()
      };

      // Simulate validator confirmations (in production, this would be real validator network)
      setTimeout(async () => {
        await this.processValidatorConfirmations(bridgeId, this.verificationThreshold);
      }, 5000); // 5 second delay for simulation

      console.log(`[CrossChainNFTBridge] Verification started for bridge ${bridgeId}`);
    } catch (error) {
      console.error('[CrossChainNFTBridge] Verification start failed:', error);
      throw error;
    }
  }

  /**
   * Process validator confirmations
   */
  async processValidatorConfirmations(bridgeId, confirmationCount) {
    try {
      const bridgeTransaction = await db.nft_bridge_transactions.findByPk(bridgeId);
      
      if (!bridgeTransaction) {
        return;
      }

      // Update confirmation count
      await bridgeTransaction.update({
        current_confirmations: confirmationCount
      });

      // Check if verification threshold is met
      if (confirmationCount >= bridgeTransaction.required_confirmations) {
        await bridgeTransaction.update({
          status: 'VERIFIED',
          verification_timestamp: new Date()
        });

        // Emit verification completed event
        if (this.socketIO) {
          this.socketIO.emit('bridge_verified', {
            bridge_id: bridgeId,
            confirmations: confirmationCount,
            required: bridgeTransaction.required_confirmations
          });
        }

        console.log(`[CrossChainNFTBridge] Bridge verified: ${bridgeId}`);
      } else {
        // Emit confirmation update
        if (this.socketIO) {
          this.socketIO.emit('bridge_confirmation_update', {
            bridge_id: bridgeId,
            confirmations: confirmationCount,
            required: bridgeTransaction.required_confirmations
          });
        }
      }
    } catch (error) {
      console.error('[CrossChainNFTBridge] Confirmation processing failed:', error);
    }
  }

  /**
   * Create mirrored NFT on destination chain
   */
  async createMirroredNFT(bridgeTransaction) {
    try {
      const originalNFT = await db.nfts.findByPk(bridgeTransaction.nft_id, {
        include: [{ model: db.nft_collections, as: 'collection' }]
      });

      if (!originalNFT) {
        throw new Error('Original NFT not found');
      }

      // Create mirrored NFT
      const mirroredNFT = await db.nfts.create({
        collection_id: originalNFT.collection_id,
        name: originalNFT.name,
        description: originalNFT.description,
        image_url: originalNFT.image_url,
        animation_url: originalNFT.animation_url,
        external_url: originalNFT.external_url,
        attributes: originalNFT.attributes,
        blockchain: bridgeTransaction.destination_chain,
        token_standard: this.getTokenStandard(bridgeTransaction.destination_chain),
        token_id: this.generateMirroredTokenId(originalNFT, bridgeTransaction),
        contract_address: this.getBridgeContractAddress(bridgeTransaction.destination_chain),
        creator_id: originalNFT.creator_id,
        current_owner_id: bridgeTransaction.user_id,
        royalty_percentage: originalNFT.royalty_percentage,
        royalty_recipients: originalNFT.royalty_recipients,
        status: 'MINTED',
        is_bridged: true,
        original_nft_id: originalNFT.id,
        bridge_transaction_id: bridgeTransaction.id,
        metadata_uri: originalNFT.metadata_uri,
        transaction_hash: this.generateMockTransactionHash(),
        block_number: Math.floor(Math.random() * 1000000),
        gas_used: 150000,
        gas_price: '20000000000'
      });

      console.log(`[CrossChainNFTBridge] Mirrored NFT created: ${mirroredNFT.id} on ${bridgeTransaction.destination_chain}`);
      return mirroredNFT;
    } catch (error) {
      console.error('[CrossChainNFTBridge] Mirrored NFT creation failed:', error);
      throw error;
    }
  }

  /**
   * Get bridge status
   */
  async getBridgeStatus(bridgeId) {
    try {
      const bridgeTransaction = await db.nft_bridge_transactions.findByPk(bridgeId, {
        include: [
          { model: db.nfts, as: 'nft' },
          { model: db.users, as: 'user' }
        ]
      });

      if (!bridgeTransaction) {
        throw new Error('Bridge transaction not found');
      }

      // Calculate progress percentage
      const progress = this.calculateBridgeProgress(bridgeTransaction);

      // Estimate remaining time
      const estimatedTimeRemaining = this.estimateRemainingTime(bridgeTransaction);

      return {
        ...bridgeTransaction.toJSON(),
        progress_percentage: progress,
        estimated_time_remaining: estimatedTimeRemaining,
        is_completed: bridgeTransaction.status === 'MINT_COMPLETED',
        can_claim: bridgeTransaction.status === 'VERIFIED'
      };
    } catch (error) {
      console.error('[CrossChainNFTBridge] Get bridge status failed:', error);
      throw error;
    }
  }

  /**
   * Get user's bridge transactions
   */
  async getUserBridgeTransactions(userId, filters = {}) {
    try {
      const {
        status,
        source_chain,
        destination_chain,
        limit = 20,
        offset = 0
      } = filters;

      const whereClause = { user_id: userId };

      if (status) {
        whereClause.status = status;
      }

      if (source_chain) {
        whereClause.source_chain = source_chain;
      }

      if (destination_chain) {
        whereClause.destination_chain = destination_chain;
      }

      const bridgeTransactions = await db.nft_bridge_transactions.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: db.nfts,
            as: 'nft',
            include: [{ model: db.nft_collections, as: 'collection' }]
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Add progress information
      const transactionsWithProgress = bridgeTransactions.rows.map(tx => ({
        ...tx.toJSON(),
        progress_percentage: this.calculateBridgeProgress(tx),
        estimated_time_remaining: this.estimateRemainingTime(tx)
      }));

      return {
        transactions: transactionsWithProgress,
        total: bridgeTransactions.count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };
    } catch (error) {
      console.error('[CrossChainNFTBridge] Get user bridge transactions failed:', error);
      throw error;
    }
  }

  /**
   * Get bridge statistics
   */
  async getBridgeStatistics(filters = {}) {
    try {
      const { time_period = '7d', source_chain, destination_chain } = filters;
      
      const timeFilter = this.getTimeFilter(time_period);
      const whereClause = {
        created_at: {
          [Op.gte]: timeFilter
        }
      };

      if (source_chain) {
        whereClause.source_chain = source_chain;
      }

      if (destination_chain) {
        whereClause.destination_chain = destination_chain;
      }

      const stats = await db.NFTBridgeTransaction.findAll({
        where: whereClause,
        attributes: [
          'status',
          'source_chain',
          'destination_chain',
          [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count'],
          [db.sequelize.fn('AVG', db.sequelize.col('bridge_fee_amount')), 'avg_fee'],
          [db.sequelize.fn('SUM', db.sequelize.col('bridge_fee_amount')), 'total_fees']
        ],
        group: ['status', 'source_chain', 'destination_chain'],
        raw: true
      });

      // Get chain pair statistics
      const chainPairStats = await this.getChainPairStatistics(timeFilter);

      return {
        statistics: stats,
        chain_pairs: chainPairStats,
        time_period,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('[CrossChainNFTBridge] Get bridge statistics failed:', error);
      throw error;
    }
  }

  /**
   * Validate bridge request
   */
  async validateBridgeRequest(bridgeData) {
    const { source_chain, destination_chain, nft_id } = bridgeData;

    if (!this.supportedChains.includes(source_chain)) {
      throw new Error(`Source chain ${source_chain} is not supported`);
    }

    if (!this.supportedChains.includes(destination_chain)) {
      throw new Error(`Destination chain ${destination_chain} is not supported`);
    }

    if (source_chain === destination_chain) {
      throw new Error('Source and destination chains cannot be the same');
    }

    // Check if NFT is already being bridged
    const existingBridge = await db.nft_bridge_transactions.findOne({
      where: {
        nft_id,
        status: ['INITIATED', 'BURN_COMPLETED', 'VERIFYING', 'VERIFIED']
      }
    });

    if (existingBridge) {
      throw new Error('NFT is already being bridged');
    }
  }

  /**
   * Calculate bridge fee
   */
  calculateBridgeFee(sourceChain, destinationChain, nft) {
    const chainPair = `${sourceChain}-${destinationChain}`;
    const baseFee = this.bridgeFees.get(chainPair) || { amount: 0.01, currency: 'ETH' };
    
    // Add complexity fee based on NFT attributes
    let complexityMultiplier = 1;
    if (nft.attributes && nft.attributes.length > 5) {
      complexityMultiplier = 1.2;
    }
    
    if (nft.animation_url) {
      complexityMultiplier *= 1.1;
    }

    return {
      amount: baseFee.amount * complexityMultiplier,
      currency: baseFee.currency,
      breakdown: {
        base_fee: baseFee.amount,
        complexity_multiplier: complexityMultiplier,
        total: baseFee.amount * complexityMultiplier
      }
    };
  }

  /**
   * Generate verification hash
   */
  generateVerificationHash(nftId, userId, sourceChain, destinationChain) {
    const data = `${nftId}-${userId}-${sourceChain}-${destinationChain}-${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Verify burn signature
   */
  async verifyBurnSignature(bridgeTransaction, burnSignature) {
    // In production, this would verify the actual blockchain transaction
    // For now, we'll simulate verification
    return burnSignature && 
           burnSignature.transactionHash && 
           burnSignature.blockNumber &&
           burnSignature.transactionHash.length === 66; // Ethereum tx hash length
  }

  /**
   * Verify validator signatures
   */
  async verifyValidatorSignatures(bridgeTransaction, validatorSignatures) {
    // In production, this would verify actual validator signatures
    // For now, we'll simulate verification
    return validatorSignatures && 
           Array.isArray(validatorSignatures) && 
           validatorSignatures.length >= this.verificationThreshold;
  }

  /**
   * Calculate bridge progress
   */
  calculateBridgeProgress(bridgeTransaction) {
    const statusProgress = {
      'INITIATED': 10,
      'BURN_COMPLETED': 30,
      'VERIFYING': 60,
      'VERIFIED': 80,
      'MINT_COMPLETED': 100,
      'FAILED': 0,
      'CANCELLED': 0
    };

    return statusProgress[bridgeTransaction.status] || 0;
  }

  /**
   * Estimate remaining time
   */
  estimateRemainingTime(bridgeTransaction) {
    const statusTimes = {
      'INITIATED': 300, // 5 minutes
      'BURN_COMPLETED': 180, // 3 minutes
      'VERIFYING': 120, // 2 minutes
      'VERIFIED': 60, // 1 minute
      'MINT_COMPLETED': 0,
      'FAILED': 0,
      'CANCELLED': 0
    };

    return statusTimes[bridgeTransaction.status] || 0;
  }

  /**
   * Estimate completion time
   */
  estimateCompletionTime(sourceChain, destinationChain) {
    // Base times in seconds
    const chainTimes = {
      'ETH': 300,
      'BNB': 180,
      'AVAX': 120,
      'MATIC': 60,
      'XDC': 90,
      'SOL': 30,
      'XRP': 15,
      'XLM': 10
    };

    const sourceTime = chainTimes[sourceChain] || 300;
    const destTime = chainTimes[destinationChain] || 300;
    const verificationTime = 120; // 2 minutes for verification

    return sourceTime + destTime + verificationTime;
  }

  /**
   * Get token standard for chain
   */
  getTokenStandard(blockchain) {
    const standards = {
      'ETH': 'ERC721',
      'BNB': 'BEP721',
      'AVAX': 'ERC721',
      'MATIC': 'ERC721',
      'XDC': 'XRC721',
      'SOL': 'SPL',
      'XRP': 'XLS20',
      'XLM': 'STELLAR_NFT'
    };

    return standards[blockchain] || 'ERC721';
  }

  /**
   * Generate mirrored token ID
   */
  generateMirroredTokenId(originalNFT, bridgeTransaction) {
    // Create a unique token ID for the mirrored NFT
    const prefix = bridgeTransaction.destination_chain.toLowerCase();
    const originalId = originalNFT.token_id || originalNFT.id;
    return `${prefix}_bridge_${originalId}_${Date.now()}`;
  }

  /**
   * Get bridge contract address
   */
  getBridgeContractAddress(blockchain) {
    // In production, these would be actual deployed bridge contract addresses
    const contracts = {
      'ETH': '0x1234567890123456789012345678901234567890',
      'BNB': '0x2345678901234567890123456789012345678901',
      'AVAX': '0x3456789012345678901234567890123456789012',
      'MATIC': '0x4567890123456789012345678901234567890123',
      'XDC': '0x5678901234567890123456789012345678901234',
      'SOL': 'BridgeContract1234567890123456789012345678',
      'XRP': 'rBridgeContract123456789012345678901234',
      'XLM': 'GBRIDGECONTRACT1234567890123456789012345'
    };

    return contracts[blockchain] || '0x0000000000000000000000000000000000000000';
  }

  /**
   * Generate mock transaction hash
   */
  generateMockTransactionHash() {
    return '0x' + crypto.randomBytes(32).toString('hex');
  }

  /**
   * Initialize bridge fees
   */
  initializeBridgeFees() {
    // Set bridge fees for different chain pairs
    const fees = [
      { pair: 'ETH-BNB', amount: 0.01, currency: 'ETH' },
      { pair: 'ETH-AVAX', amount: 0.01, currency: 'ETH' },
      { pair: 'ETH-MATIC', amount: 0.01, currency: 'ETH' },
      { pair: 'ETH-XDC', amount: 0.01, currency: 'ETH' },
      { pair: 'ETH-SOL', amount: 0.01, currency: 'ETH' },
      { pair: 'ETH-XRP', amount: 0.01, currency: 'ETH' },
      { pair: 'ETH-XLM', amount: 0.01, currency: 'ETH' },
      { pair: 'BNB-ETH', amount: 0.05, currency: 'BNB' },
      { pair: 'AVAX-ETH', amount: 0.5, currency: 'AVAX' },
      { pair: 'MATIC-ETH', amount: 20, currency: 'MATIC' },
      { pair: 'XDC-ETH', amount: 100, currency: 'XDC' },
      { pair: 'SOL-ETH', amount: 0.1, currency: 'SOL' },
      { pair: 'XRP-ETH', amount: 10, currency: 'XRP' },
      { pair: 'XLM-ETH', amount: 50, currency: 'XLM' }
    ];

    for (const fee of fees) {
      this.bridgeFees.set(fee.pair, { amount: fee.amount, currency: fee.currency });
      // Also set reverse pair
      const [source, dest] = fee.pair.split('-');
      this.bridgeFees.set(`${dest}-${source}`, { amount: fee.amount, currency: fee.currency });
    }
  }

  /**
   * Load active bridge transactions
   */
  async loadActiveBridgeTransactions() {
    try {
      const activeTransactions = await db.NFTBridgeTransaction.findAll({
        where: {
          status: ['INITIATED', 'BURN_COMPLETED', 'VERIFYING', 'VERIFIED']
        }
      });

      for (const tx of activeTransactions) {
        this.bridgeTransactions.set(tx.id, tx);
      }

      console.log(`[CrossChainNFTBridge] Loaded ${activeTransactions.length} active bridge transactions`);
    } catch (error) {
      console.error('[CrossChainNFTBridge] Load active transactions failed:', error);
    }
  }

  /**
   * Initialize validator network
   */
  async initializeValidatorNetwork() {
    // In production, this would connect to actual validator nodes
    // For now, we'll simulate a validator network
    const validators = [
      { id: 'validator_1', address: '0xValidator1', stake: 1000 },
      { id: 'validator_2', address: '0xValidator2', stake: 1500 },
      { id: 'validator_3', address: '0xValidator3', stake: 2000 },
      { id: 'validator_4', address: '0xValidator4', stake: 1200 },
      { id: 'validator_5', address: '0xValidator5', stake: 1800 }
    ];

    for (const validator of validators) {
      this.bridgeValidators.set(validator.id, validator);
    }

    console.log(`[CrossChainNFTBridge] Initialized ${validators.length} validators`);
  }

  /**
   * Start bridge monitoring
   */
  startBridgeMonitoring() {
    // Monitor for stuck transactions every 5 minutes
    setInterval(async () => {
      try {
        const stuckTransactions = await db.NFTBridgeTransaction.findAll({
          where: {
            status: ['INITIATED', 'BURN_COMPLETED', 'VERIFYING'],
            created_at: {
              [Op.lt]: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
            }
          }
        });

        for (const tx of stuckTransactions) {
          console.warn(`[CrossChainNFTBridge] Stuck transaction detected: ${tx.id}`);
          // In production, this would trigger recovery procedures
        }
      } catch (error) {
        console.error('[CrossChainNFTBridge] Monitoring error:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Get chain pair statistics
   */
  async getChainPairStatistics(timeFilter) {
    try {
      const chainPairs = await db.NFTBridgeTransaction.findAll({
        where: {
          created_at: {
            [Op.gte]: timeFilter
          }
        },
        attributes: [
          'source_chain',
          'destination_chain',
          [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'bridge_count'],
          [db.sequelize.fn('AVG', db.sequelize.col('bridge_fee_amount')), 'avg_fee'],
          [db.sequelize.fn('SUM', db.sequelize.col('bridge_fee_amount')), 'total_volume']
        ],
        group: ['source_chain', 'destination_chain'],
        raw: true
      });

      return chainPairs;
    } catch (error) {
      console.error('[CrossChainNFTBridge] Chain pair statistics failed:', error);
      return [];
    }
  }

  /**
   * Get time filter for statistics
   */
  getTimeFilter(period) {
    const now = new Date();
    switch (period) {
      case '1d':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }
}

module.exports = CrossChainNFTBridge;

