/**
 * Atomic Swap Implementation - Task 3.4 Phase 2
 * 
 * Comprehensive atomic swap system enabling trustless cross-chain asset swaps
 * using Hash Time Locked Contracts (HTLCs) and other atomic swap protocols.
 */

const crypto = require('crypto');
const { BlockchainError, ErrorCodes } = require('./enhanced-blockchain-adapter');

/**
 * Atomic Swap Types
 */
const SwapTypes = {
  HTLC: 'htlc', // Hash Time Locked Contract
  PTLC: 'ptlc', // Point Time Locked Contract
  SUBMARINE: 'submarine', // Submarine Swap (Lightning Network)
  CROSS_CHAIN: 'cross_chain' // Direct cross-chain atomic swap
};

/**
 * Swap Status Types
 */
const SwapStatus = {
  CREATED: 'created',
  FUNDED: 'funded',
  CLAIMED: 'claimed',
  REFUNDED: 'refunded',
  EXPIRED: 'expired',
  FAILED: 'failed'
};

/**
 * Supported Atomic Swap Pairs
 */
const AtomicSwapPairs = {
  // Bitcoin-like chains (HTLC support)
  'bitcoin-litecoin': { type: SwapTypes.HTLC, timelock: 24 * 3600 }, // 24 hours
  'bitcoin-ethereum': { type: SwapTypes.HTLC, timelock: 12 * 3600 }, // 12 hours
  
  // EVM chains (smart contract HTLCs)
  'ethereum-polygon': { type: SwapTypes.HTLC, timelock: 2 * 3600 }, // 2 hours
  'ethereum-avalanche': { type: SwapTypes.HTLC, timelock: 2 * 3600 },
  'ethereum-bsc': { type: SwapTypes.HTLC, timelock: 2 * 3600 },
  'ethereum-xdc': { type: SwapTypes.HTLC, timelock: 3 * 3600 }, // 3 hours
  
  // Solana atomic swaps
  'ethereum-solana': { type: SwapTypes.CROSS_CHAIN, timelock: 4 * 3600 }, // 4 hours
  'polygon-solana': { type: SwapTypes.CROSS_CHAIN, timelock: 4 * 3600 },
  
  // Stellar atomic swaps
  'ethereum-stellar': { type: SwapTypes.HTLC, timelock: 6 * 3600 }, // 6 hours
  'polygon-stellar': { type: SwapTypes.HTLC, timelock: 6 * 3600 },
  
  // XRP atomic swaps
  'ethereum-xrp': { type: SwapTypes.HTLC, timelock: 8 * 3600 }, // 8 hours
  'polygon-xrp': { type: SwapTypes.HTLC, timelock: 8 * 3600 }
};

/**
 * Hash Time Locked Contract (HTLC) Implementation
 */
class HTLCContract {
  constructor(config = {}) {
    this.config = config;
    this.contracts = new Map(); // Store active contracts
  }

  /**
   * Generate a secret and its hash
   */
  generateSecret() {
    const secret = crypto.randomBytes(32);
    const hash = crypto.createHash('sha256').update(secret).digest();
    
    return {
      secret: secret.toString('hex'),
      hash: hash.toString('hex'),
      secretBytes: secret,
      hashBytes: hash
    };
  }

  /**
   * Create HTLC contract
   */
  createHTLC(params) {
    const {
      sender,
      recipient,
      amount,
      hashlock,
      timelock,
      network,
      token = 'native'
    } = params;

    const contractId = `htlc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const contract = {
      id: contractId,
      type: SwapTypes.HTLC,
      sender,
      recipient,
      amount,
      token,
      network,
      hashlock,
      timelock,
      status: SwapStatus.CREATED,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + timelock * 1000).toISOString(),
      txHash: null,
      claimTxHash: null,
      refundTxHash: null
    };

    this.contracts.set(contractId, contract);
    
    console.log(`🔒 HTLC contract created: ${contractId}`);
    
    return contract;
  }

  /**
   * Fund HTLC contract
   */
  async fundHTLC(contractId, txHash) {
    try {
      const contract = this.contracts.get(contractId);
      if (!contract) {
        throw new Error(`HTLC contract ${contractId} not found`);
      }

      if (contract.status !== SwapStatus.CREATED) {
        throw new Error(`HTLC contract ${contractId} is not in created status`);
      }

      // Simulate funding transaction
      contract.status = SwapStatus.FUNDED;
      contract.txHash = txHash;
      contract.fundedAt = new Date().toISOString();

      console.log(`💰 HTLC contract funded: ${contractId}`);
      
      return contract;
    } catch (error) {
      throw new Error(`Failed to fund HTLC: ${error.message}`);
    }
  }

  /**
   * Claim HTLC contract with secret
   */
  async claimHTLC(contractId, secret, claimTxHash) {
    try {
      const contract = this.contracts.get(contractId);
      if (!contract) {
        throw new Error(`HTLC contract ${contractId} not found`);
      }

      if (contract.status !== SwapStatus.FUNDED) {
        throw new Error(`HTLC contract ${contractId} is not funded`);
      }

      // Verify secret matches hashlock
      const secretHash = crypto.createHash('sha256').update(Buffer.from(secret, 'hex')).digest('hex');
      if (secretHash !== contract.hashlock) {
        throw new Error('Invalid secret provided');
      }

      // Check if contract has expired
      if (new Date() > new Date(contract.expiresAt)) {
        contract.status = SwapStatus.EXPIRED;
        throw new Error('HTLC contract has expired');
      }

      contract.status = SwapStatus.CLAIMED;
      contract.claimTxHash = claimTxHash;
      contract.claimedAt = new Date().toISOString();
      contract.revealedSecret = secret;

      console.log(`✅ HTLC contract claimed: ${contractId}`);
      
      return contract;
    } catch (error) {
      throw new Error(`Failed to claim HTLC: ${error.message}`);
    }
  }

  /**
   * Refund HTLC contract after expiration
   */
  async refundHTLC(contractId, refundTxHash) {
    try {
      const contract = this.contracts.get(contractId);
      if (!contract) {
        throw new Error(`HTLC contract ${contractId} not found`);
      }

      if (contract.status !== SwapStatus.FUNDED) {
        throw new Error(`HTLC contract ${contractId} is not funded`);
      }

      // Check if contract has expired
      if (new Date() <= new Date(contract.expiresAt)) {
        throw new Error('HTLC contract has not expired yet');
      }

      contract.status = SwapStatus.REFUNDED;
      contract.refundTxHash = refundTxHash;
      contract.refundedAt = new Date().toISOString();

      console.log(`🔄 HTLC contract refunded: ${contractId}`);
      
      return contract;
    } catch (error) {
      throw new Error(`Failed to refund HTLC: ${error.message}`);
    }
  }

  /**
   * Get contract details
   */
  getContract(contractId) {
    return this.contracts.get(contractId);
  }

  /**
   * Get all contracts for a user
   */
  getUserContracts(userAddress) {
    const userContracts = [];
    
    for (const contract of this.contracts.values()) {
      if (contract.sender === userAddress || contract.recipient === userAddress) {
        userContracts.push(contract);
      }
    }
    
    return userContracts;
  }

  /**
   * Clean up expired contracts
   */
  cleanupExpiredContracts() {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [contractId, contract] of this.contracts) {
      if (contract.status === SwapStatus.FUNDED && now > new Date(contract.expiresAt)) {
        contract.status = SwapStatus.EXPIRED;
        cleanedCount++;
      }
    }
    
    console.log(`🧹 Cleaned up ${cleanedCount} expired HTLC contracts`);
    return cleanedCount;
  }
}

/**
 * Cross-Chain Atomic Swap Implementation
 */
class CrossChainAtomicSwap {
  constructor(config = {}) {
    this.config = config;
    this.swaps = new Map(); // Store active swaps
    this.htlc = new HTLCContract(config);
  }

  /**
   * Create atomic swap between two chains
   */
  async createAtomicSwap(params) {
    try {
      const {
        initiator,
        participant,
        initiatorChain,
        participantChain,
        initiatorAmount,
        participantAmount,
        initiatorToken = 'native',
        participantToken = 'native',
        timelock = 3600 // 1 hour default
      } = params;

      // Validate swap pair
      const pairKey = `${initiatorChain}-${participantChain}`;
      const reversePairKey = `${participantChain}-${initiatorChain}`;
      
      const swapConfig = AtomicSwapPairs[pairKey] || AtomicSwapPairs[reversePairKey];
      if (!swapConfig) {
        throw new Error(`Atomic swap not supported between ${initiatorChain} and ${participantChain}`);
      }

      // Generate secret for the swap
      const secretData = this.htlc.generateSecret();
      
      const swapId = `swap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create HTLC contracts for both chains
      const initiatorHTLC = this.htlc.createHTLC({
        sender: initiator,
        recipient: participant,
        amount: initiatorAmount,
        token: initiatorToken,
        network: initiatorChain,
        hashlock: secretData.hash,
        timelock: swapConfig.timelock
      });

      const participantHTLC = this.htlc.createHTLC({
        sender: participant,
        recipient: initiator,
        amount: participantAmount,
        token: participantToken,
        network: participantChain,
        hashlock: secretData.hash,
        timelock: swapConfig.timelock / 2 // Participant has half the time
      });

      const atomicSwap = {
        id: swapId,
        type: swapConfig.type,
        status: SwapStatus.CREATED,
        initiator,
        participant,
        initiatorChain,
        participantChain,
        initiatorAmount,
        participantAmount,
        initiatorToken,
        participantToken,
        secret: secretData.secret,
        secretHash: secretData.hash,
        initiatorHTLC: initiatorHTLC.id,
        participantHTLC: participantHTLC.id,
        timelock: swapConfig.timelock,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + swapConfig.timelock * 1000).toISOString(),
        steps: [
          {
            step: 1,
            description: 'Initiator funds HTLC on initiator chain',
            status: 'pending',
            chain: initiatorChain,
            contractId: initiatorHTLC.id
          },
          {
            step: 2,
            description: 'Participant funds HTLC on participant chain',
            status: 'pending',
            chain: participantChain,
            contractId: participantHTLC.id
          },
          {
            step: 3,
            description: 'Participant claims from initiator chain (reveals secret)',
            status: 'pending',
            chain: initiatorChain,
            contractId: initiatorHTLC.id
          },
          {
            step: 4,
            description: 'Initiator claims from participant chain using revealed secret',
            status: 'pending',
            chain: participantChain,
            contractId: participantHTLC.id
          }
        ]
      };

      this.swaps.set(swapId, atomicSwap);
      
      console.log(`⚛️ Atomic swap created: ${swapId}`);
      console.log(`   ${initiatorChain} -> ${participantChain}`);
      console.log(`   ${initiatorAmount} ${initiatorToken} <-> ${participantAmount} ${participantToken}`);
      
      return atomicSwap;
    } catch (error) {
      throw new BlockchainError(
        `Failed to create atomic swap: ${error.message}`,
        ErrorCodes.ATOMIC_SWAP_CREATION_FAILED,
        'atomic_swap',
        error
      );
    }
  }

  /**
   * Fund atomic swap (step 1 or 2)
   */
  async fundAtomicSwap(swapId, step, txHash) {
    try {
      const swap = this.swaps.get(swapId);
      if (!swap) {
        throw new Error(`Atomic swap ${swapId} not found`);
      }

      if (step === 1) {
        // Initiator funds their HTLC
        await this.htlc.fundHTLC(swap.initiatorHTLC, txHash);
        swap.steps[0].status = 'completed';
        swap.steps[0].txHash = txHash;
        
        console.log(`💰 Atomic swap step 1 completed: ${swapId}`);
      } else if (step === 2) {
        // Participant funds their HTLC
        await this.htlc.fundHTLC(swap.participantHTLC, txHash);
        swap.steps[1].status = 'completed';
        swap.steps[1].txHash = txHash;
        
        console.log(`💰 Atomic swap step 2 completed: ${swapId}`);
      } else {
        throw new Error(`Invalid funding step: ${step}`);
      }

      // Check if both HTLCs are funded
      const initiatorContract = this.htlc.getContract(swap.initiatorHTLC);
      const participantContract = this.htlc.getContract(swap.participantHTLC);
      
      if (initiatorContract.status === SwapStatus.FUNDED && 
          participantContract.status === SwapStatus.FUNDED) {
        swap.status = SwapStatus.FUNDED;
        console.log(`✅ Atomic swap fully funded: ${swapId}`);
      }

      return swap;
    } catch (error) {
      throw new Error(`Failed to fund atomic swap: ${error.message}`);
    }
  }

  /**
   * Claim from atomic swap (step 3 or 4)
   */
  async claimAtomicSwap(swapId, step, secret, txHash) {
    try {
      const swap = this.swaps.get(swapId);
      if (!swap) {
        throw new Error(`Atomic swap ${swapId} not found`);
      }

      if (step === 3) {
        // Participant claims from initiator chain (reveals secret)
        await this.htlc.claimHTLC(swap.initiatorHTLC, secret, txHash);
        swap.steps[2].status = 'completed';
        swap.steps[2].txHash = txHash;
        swap.revealedSecret = secret;
        
        console.log(`🎯 Atomic swap step 3 completed (secret revealed): ${swapId}`);
      } else if (step === 4) {
        // Initiator claims from participant chain using revealed secret
        const revealedSecret = swap.revealedSecret || secret;
        await this.htlc.claimHTLC(swap.participantHTLC, revealedSecret, txHash);
        swap.steps[3].status = 'completed';
        swap.steps[3].txHash = txHash;
        swap.status = SwapStatus.CLAIMED;
        swap.completedAt = new Date().toISOString();
        
        console.log(`✅ Atomic swap completed: ${swapId}`);
      } else {
        throw new Error(`Invalid claim step: ${step}`);
      }

      return swap;
    } catch (error) {
      throw new Error(`Failed to claim atomic swap: ${error.message}`);
    }
  }

  /**
   * Refund atomic swap after expiration
   */
  async refundAtomicSwap(swapId, contractType, txHash) {
    try {
      const swap = this.swaps.get(swapId);
      if (!swap) {
        throw new Error(`Atomic swap ${swapId} not found`);
      }

      if (contractType === 'initiator') {
        await this.htlc.refundHTLC(swap.initiatorHTLC, txHash);
      } else if (contractType === 'participant') {
        await this.htlc.refundHTLC(swap.participantHTLC, txHash);
      } else {
        throw new Error(`Invalid contract type: ${contractType}`);
      }

      // Check if both contracts are refunded or one is claimed
      const initiatorContract = this.htlc.getContract(swap.initiatorHTLC);
      const participantContract = this.htlc.getContract(swap.participantHTLC);
      
      if ((initiatorContract.status === SwapStatus.REFUNDED || initiatorContract.status === SwapStatus.CLAIMED) &&
          (participantContract.status === SwapStatus.REFUNDED || participantContract.status === SwapStatus.CLAIMED)) {
        swap.status = SwapStatus.REFUNDED;
        swap.refundedAt = new Date().toISOString();
        
        console.log(`🔄 Atomic swap refunded: ${swapId}`);
      }

      return swap;
    } catch (error) {
      throw new Error(`Failed to refund atomic swap: ${error.message}`);
    }
  }

  /**
   * Get atomic swap details
   */
  getAtomicSwap(swapId) {
    const swap = this.swaps.get(swapId);
    if (!swap) {
      return null;
    }

    // Include HTLC contract details
    const initiatorContract = this.htlc.getContract(swap.initiatorHTLC);
    const participantContract = this.htlc.getContract(swap.participantHTLC);

    return {
      ...swap,
      initiatorContract,
      participantContract
    };
  }

  /**
   * Get user's atomic swaps
   */
  getUserAtomicSwaps(userAddress) {
    const userSwaps = [];
    
    for (const swap of this.swaps.values()) {
      if (swap.initiator === userAddress || swap.participant === userAddress) {
        userSwaps.push(this.getAtomicSwap(swap.id));
      }
    }
    
    return userSwaps;
  }

  /**
   * Get supported atomic swap pairs
   */
  getSupportedPairs() {
    const pairs = [];
    
    for (const [pairKey, config] of Object.entries(AtomicSwapPairs)) {
      const [from, to] = pairKey.split('-');
      pairs.push({
        from,
        to,
        type: config.type,
        timelock: config.timelock,
        bidirectional: true
      });
    }
    
    return pairs;
  }

  /**
   * Calculate atomic swap fees
   */
  calculateSwapFees(initiatorChain, participantChain, initiatorAmount, participantAmount) {
    // Base fee calculation
    const baseFeeRate = 0.001; // 0.1%
    const crossChainMultiplier = 1.5;
    
    const initiatorFee = Math.floor(initiatorAmount * baseFeeRate * crossChainMultiplier);
    const participantFee = Math.floor(participantAmount * baseFeeRate * crossChainMultiplier);
    
    return {
      initiatorFee,
      participantFee,
      totalFee: initiatorFee + participantFee,
      feeRate: baseFeeRate * crossChainMultiplier
    };
  }

  /**
   * Estimate atomic swap time
   */
  estimateSwapTime(initiatorChain, participantChain) {
    const chainTimes = {
      'ethereum': 15, // minutes
      'polygon': 2,
      'avalanche': 1,
      'bsc': 3,
      'xdc': 2,
      'solana': 1,
      'stellar': 5,
      'xrp': 4
    };

    const initiatorTime = chainTimes[initiatorChain] || 10;
    const participantTime = chainTimes[participantChain] || 10;
    
    // Total time includes funding both sides + claiming both sides
    return (initiatorTime + participantTime) * 2 + 10; // Add 10 minutes buffer
  }

  /**
   * Get atomic swap statistics
   */
  getStatistics() {
    const stats = {
      totalSwaps: this.swaps.size,
      activeSwaps: 0,
      completedSwaps: 0,
      refundedSwaps: 0,
      expiredSwaps: 0,
      totalVolume: 0,
      supportedPairs: Object.keys(AtomicSwapPairs).length
    };

    for (const swap of this.swaps.values()) {
      switch (swap.status) {
        case SwapStatus.CREATED:
        case SwapStatus.FUNDED:
          stats.activeSwaps++;
          break;
        case SwapStatus.CLAIMED:
          stats.completedSwaps++;
          stats.totalVolume += swap.initiatorAmount + swap.participantAmount;
          break;
        case SwapStatus.REFUNDED:
          stats.refundedSwaps++;
          break;
        case SwapStatus.EXPIRED:
          stats.expiredSwaps++;
          break;
      }
    }

    return stats;
  }

  /**
   * Cleanup expired swaps
   */
  cleanupExpiredSwaps() {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [swapId, swap] of this.swaps) {
      if (swap.status === SwapStatus.FUNDED && now > new Date(swap.expiresAt)) {
        swap.status = SwapStatus.EXPIRED;
        cleanedCount++;
      }
    }
    
    // Also cleanup HTLC contracts
    const htlcCleaned = this.htlc.cleanupExpiredContracts();
    
    console.log(`🧹 Cleaned up ${cleanedCount} expired atomic swaps and ${htlcCleaned} HTLC contracts`);
    return cleanedCount + htlcCleaned;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.swaps.clear();
    this.htlc.contracts.clear();
    
    console.log('🧹 Cross-Chain Atomic Swap system cleaned up');
  }
}

module.exports = {
  CrossChainAtomicSwap,
  HTLCContract,
  SwapTypes,
  SwapStatus,
  AtomicSwapPairs
};

