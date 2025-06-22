/**
 * Unified Transaction Manager - Task 3.4 Phase 3
 * 
 * Comprehensive unified transaction management system that combines bridge transactions
 * and atomic swaps into a single interface with intelligent routing and optimization.
 */

const { CrossChainBridgeIntegration, BridgeProviders, TransactionStatus } = require('./CrossChainBridgeIntegration');
const { CrossChainAtomicSwap, SwapStatus } = require('./CrossChainAtomicSwap');
const { BlockchainError, ErrorCodes } = require('./enhanced-blockchain-adapter');

/**
 * Transaction Types
 */
const TransactionTypes = {
  BRIDGE: 'bridge',
  ATOMIC_SWAP: 'atomic_swap',
  HYBRID: 'hybrid' // Combination of bridge and swap
};

/**
 * Transaction Methods
 */
const TransactionMethods = {
  FASTEST: 'fastest',
  CHEAPEST: 'cheapest',
  MOST_SECURE: 'most_secure',
  BALANCED: 'balanced'
};

/**
 * Unified Transaction Status
 */
const UnifiedTransactionStatus = {
  CREATED: 'created',
  QUOTE_GENERATED: 'quote_generated',
  INITIATED: 'initiated',
  IN_PROGRESS: 'in_progress',
  CONFIRMING: 'confirming',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired'
};

/**
 * Route Scoring Criteria
 */
const RouteScoringCriteria = {
  SPEED: { weight: 0.3, factor: 'time' },
  COST: { weight: 0.4, factor: 'fees' },
  SECURITY: { weight: 0.2, factor: 'confidence' },
  RELIABILITY: { weight: 0.1, factor: 'success_rate' }
};

/**
 * Unified Cross-Chain Transaction Manager
 */
class UnifiedTransactionManager {
  constructor(config = {}) {
    this.config = {
      enableBridges: true,
      enableAtomicSwaps: true,
      defaultMethod: TransactionMethods.BALANCED,
      maxRoutes: 5,
      quoteTimeout: 30000,
      ...config
    };

    // Initialize sub-systems
    this.bridgeIntegration = new CrossChainBridgeIntegration(config);
    this.atomicSwap = new CrossChainAtomicSwap(config);
    
    // Transaction storage
    this.transactions = new Map();
    this.routes = new Map();
    
    this.isInitialized = false;
    
    console.log('🔧 Unified Transaction Manager initialized');
  }

  /**
   * Initialize the unified transaction manager
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Unified Transaction Manager...');
      
      const initResults = [];

      // Initialize bridge integration
      if (this.config.enableBridges) {
        try {
          const bridgeResult = await this.bridgeIntegration.initialize();
          initResults.push({ system: 'bridges', ...bridgeResult });
        } catch (error) {
          console.warn('⚠️ Bridge integration failed to initialize:', error.message);
          initResults.push({ system: 'bridges', success: false, error: error.message });
        }
      }

      // Initialize atomic swap system
      if (this.config.enableAtomicSwaps) {
        try {
          // Atomic swap doesn't need async initialization
          initResults.push({ 
            system: 'atomic_swaps', 
            success: true, 
            supportedPairs: this.atomicSwap.getSupportedPairs().length 
          });
        } catch (error) {
          console.warn('⚠️ Atomic swap system failed to initialize:', error.message);
          initResults.push({ system: 'atomic_swaps', success: false, error: error.message });
        }
      }

      // Build unified route map
      await this.buildUnifiedRoutes();

      this.isInitialized = true;
      
      const successfulSystems = initResults.filter(r => r.success).length;
      
      console.log(`✅ Unified Transaction Manager initialized with ${successfulSystems} systems`);
      
      return {
        success: true,
        initializedSystems: successfulSystems,
        totalSystems: initResults.length,
        systems: initResults,
        unifiedRoutes: this.routes.size
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to initialize unified transaction manager: ${error.message}`,
        ErrorCodes.SYSTEM_INITIALIZATION_FAILED,
        'unified_manager',
        error
      );
    }
  }

  /**
   * Build unified routes combining bridges and atomic swaps
   */
  async buildUnifiedRoutes() {
    try {
      console.log('🗺️ Building unified cross-chain routes...');
      
      // Get bridge routes
      let bridgeRoutes = [];
      if (this.config.enableBridges && this.bridgeIntegration.isInitialized) {
        bridgeRoutes = this.bridgeIntegration.getAllSupportedRoutes();
      }

      // Get atomic swap routes
      let atomicSwapRoutes = [];
      if (this.config.enableAtomicSwaps) {
        const swapPairs = this.atomicSwap.getSupportedPairs();
        atomicSwapRoutes = swapPairs.map(pair => ({
          from: pair.from,
          to: pair.to,
          type: TransactionTypes.ATOMIC_SWAP,
          method: 'atomic_swap',
          timelock: pair.timelock,
          estimatedTime: this.atomicSwap.estimateSwapTime(pair.from, pair.to),
          feeRate: 0.001 // 0.1% base fee for atomic swaps
        }));
      }

      // Combine and organize routes
      const allRoutes = [...bridgeRoutes, ...atomicSwapRoutes];
      
      for (const route of allRoutes) {
        const routeKey = `${route.from}-${route.to}`;
        
        if (!this.routes.has(routeKey)) {
          this.routes.set(routeKey, []);
        }
        
        this.routes.get(routeKey).push({
          type: route.type || TransactionTypes.BRIDGE,
          method: route.method || route.providers?.[0] || 'atomic_swap',
          estimatedTime: route.estimatedTime,
          feeRate: route.feeRate || route.bestFeeRate,
          confidence: route.confidence || 0.9,
          ...route
        });
      }

      console.log(`📊 Built ${this.routes.size} unified cross-chain routes`);
    } catch (error) {
      console.error('Error building unified routes:', error);
    }
  }

  /**
   * Get comprehensive quotes for cross-chain transaction
   */
  async getUnifiedQuotes(params) {
    try {
      const {
        fromNetwork,
        toNetwork,
        token,
        amount,
        method = this.config.defaultMethod,
        maxRoutes = this.config.maxRoutes
      } = params;

      if (!this.isInitialized) {
        throw new Error('Unified transaction manager not initialized');
      }

      console.log(`💰 Getting unified quotes: ${fromNetwork} -> ${toNetwork} (${amount} ${token})`);

      const quotes = [];

      // Get bridge quotes
      if (this.config.enableBridges && this.bridgeIntegration.isInitialized) {
        try {
          const bridgeQuotes = await this.bridgeIntegration.getQuotes(
            fromNetwork, 
            toNetwork, 
            token, 
            amount
          );
          
          if (bridgeQuotes.success && bridgeQuotes.quotes.length > 0) {
            for (const quote of bridgeQuotes.quotes) {
              quotes.push({
                type: TransactionTypes.BRIDGE,
                method: quote.provider,
                ...quote,
                score: this.calculateRouteScore(quote, method)
              });
            }
          }
        } catch (error) {
          console.warn('Bridge quotes failed:', error.message);
        }
      }

      // Get atomic swap quotes
      if (this.config.enableAtomicSwaps) {
        try {
          const swapFees = this.atomicSwap.calculateSwapFees(
            fromNetwork, 
            toNetwork, 
            amount, 
            amount
          );
          
          const swapTime = this.atomicSwap.estimateSwapTime(fromNetwork, toNetwork);
          
          const atomicQuote = {
            type: TransactionTypes.ATOMIC_SWAP,
            method: 'atomic_swap',
            provider: 'atomic_swap',
            fromNetwork,
            toNetwork,
            token,
            inputAmount: amount,
            outputAmount: amount - swapFees.initiatorFee,
            bridgeFee: swapFees.initiatorFee,
            gasEstimate: 100000, // Estimated gas for HTLC
            estimatedTime: swapTime,
            route: `${fromNetwork} -> HTLC -> ${toNetwork}`,
            confidence: 0.95, // High confidence for atomic swaps
            timestamp: new Date().toISOString(),
            score: 0
          };
          
          atomicQuote.score = this.calculateRouteScore(atomicQuote, method);
          quotes.push(atomicQuote);
        } catch (error) {
          console.warn('Atomic swap quote failed:', error.message);
        }
      }

      // Sort quotes by score (best first)
      quotes.sort((a, b) => b.score - a.score);

      // Limit to max routes
      const limitedQuotes = quotes.slice(0, maxRoutes);

      return {
        success: true,
        fromNetwork,
        toNetwork,
        token,
        amount,
        method,
        quotes: limitedQuotes,
        bestQuote: limitedQuotes[0] || null,
        totalRoutes: quotes.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to get unified quotes: ${error.message}`,
        ErrorCodes.QUOTE_GENERATION_FAILED,
        'unified_manager',
        error
      );
    }
  }

  /**
   * Calculate route score based on method preference
   */
  calculateRouteScore(quote, method) {
    let score = 0;
    
    // Normalize values for scoring
    const normalizedTime = Math.max(0, 1 - (quote.estimatedTime / 120)); // 2 hours max
    const normalizedCost = Math.max(0, 1 - (quote.bridgeFee / quote.inputAmount));
    const normalizedSecurity = quote.confidence || 0.5;
    const normalizedReliability = quote.type === TransactionTypes.ATOMIC_SWAP ? 0.95 : 0.85;

    switch (method) {
      case TransactionMethods.FASTEST:
        score = normalizedTime * 0.6 + normalizedSecurity * 0.2 + normalizedReliability * 0.2;
        break;
      case TransactionMethods.CHEAPEST:
        score = normalizedCost * 0.6 + normalizedTime * 0.2 + normalizedSecurity * 0.2;
        break;
      case TransactionMethods.MOST_SECURE:
        score = normalizedSecurity * 0.5 + normalizedReliability * 0.3 + normalizedTime * 0.2;
        break;
      case TransactionMethods.BALANCED:
      default:
        score = (normalizedTime * RouteScoringCriteria.SPEED.weight) +
                (normalizedCost * RouteScoringCriteria.COST.weight) +
                (normalizedSecurity * RouteScoringCriteria.SECURITY.weight) +
                (normalizedReliability * RouteScoringCriteria.RELIABILITY.weight);
        break;
    }

    return Math.round(score * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Execute unified cross-chain transaction
   */
  async executeTransaction(params) {
    try {
      const {
        fromNetwork,
        toNetwork,
        token,
        amount,
        recipient,
        method = this.config.defaultMethod,
        preferredType = null,
        options = {}
      } = params;

      console.log(`🚀 Executing unified transaction: ${fromNetwork} -> ${toNetwork}`);

      // Get quotes first
      const quotesResult = await this.getUnifiedQuotes({
        fromNetwork,
        toNetwork,
        token,
        amount,
        method
      });

      if (!quotesResult.bestQuote) {
        throw new Error('No valid routes available for transaction');
      }

      let selectedQuote = quotesResult.bestQuote;

      // Use preferred type if specified
      if (preferredType) {
        const preferredQuote = quotesResult.quotes.find(q => q.type === preferredType);
        if (preferredQuote) {
          selectedQuote = preferredQuote;
        }
      }

      const transactionId = `unified_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create unified transaction record
      const unifiedTransaction = {
        id: transactionId,
        type: selectedQuote.type,
        method: selectedQuote.method,
        status: UnifiedTransactionStatus.INITIATED,
        fromNetwork,
        toNetwork,
        token,
        amount,
        recipient,
        quote: selectedQuote,
        createdAt: new Date().toISOString(),
        estimatedCompletion: new Date(
          Date.now() + selectedQuote.estimatedTime * 60 * 1000
        ).toISOString(),
        steps: [],
        subTransactions: []
      };

      // Execute based on transaction type
      let executionResult;

      if (selectedQuote.type === TransactionTypes.BRIDGE) {
        executionResult = await this.executeBridgeTransaction(
          selectedQuote,
          recipient,
          options
        );
        
        unifiedTransaction.bridgeTransactionId = executionResult.transactionId;
        unifiedTransaction.steps = executionResult.transaction.steps || [];
      } else if (selectedQuote.type === TransactionTypes.ATOMIC_SWAP) {
        executionResult = await this.executeAtomicSwapTransaction(
          selectedQuote,
          recipient,
          options
        );
        
        unifiedTransaction.atomicSwapId = executionResult.id;
        unifiedTransaction.steps = executionResult.steps || [];
      }

      unifiedTransaction.executionResult = executionResult;
      this.transactions.set(transactionId, unifiedTransaction);

      console.log(`✅ Unified transaction initiated: ${transactionId} (${selectedQuote.type})`);

      return {
        success: true,
        transactionId,
        type: selectedQuote.type,
        method: selectedQuote.method,
        quote: selectedQuote,
        transaction: unifiedTransaction
      };
    } catch (error) {
      throw new BlockchainError(
        `Failed to execute unified transaction: ${error.message}`,
        ErrorCodes.TRANSACTION_EXECUTION_FAILED,
        'unified_manager',
        error
      );
    }
  }

  /**
   * Execute bridge transaction
   */
  async executeBridgeTransaction(quote, recipient, options) {
    try {
      return await this.bridgeIntegration.executeBridge(
        quote.fromNetwork,
        quote.toNetwork,
        quote.token,
        quote.inputAmount,
        recipient,
        options
      );
    } catch (error) {
      throw new Error(`Bridge execution failed: ${error.message}`);
    }
  }

  /**
   * Execute atomic swap transaction
   */
  async executeAtomicSwapTransaction(quote, recipient, options) {
    try {
      // For atomic swaps, we need both initiator and participant
      const initiator = options.initiator || options.sender;
      const participant = recipient;

      if (!initiator) {
        throw new Error('Initiator address required for atomic swap');
      }

      return await this.atomicSwap.createAtomicSwap({
        initiator,
        participant,
        initiatorChain: quote.fromNetwork,
        participantChain: quote.toNetwork,
        initiatorAmount: quote.inputAmount,
        participantAmount: quote.outputAmount,
        initiatorToken: quote.token,
        participantToken: quote.token,
        timelock: options.timelock || 3600
      });
    } catch (error) {
      throw new Error(`Atomic swap execution failed: ${error.message}`);
    }
  }

  /**
   * Get unified transaction status
   */
  async getTransactionStatus(transactionId) {
    try {
      const transaction = this.transactions.get(transactionId);
      if (!transaction) {
        throw new Error(`Transaction ${transactionId} not found`);
      }

      let subStatus = null;

      // Get status from sub-system
      if (transaction.type === TransactionTypes.BRIDGE && transaction.bridgeTransactionId) {
        try {
          subStatus = await this.bridgeIntegration.getTransactionStatus(
            transaction.bridgeTransactionId
          );
        } catch (error) {
          console.warn('Failed to get bridge status:', error.message);
        }
      } else if (transaction.type === TransactionTypes.ATOMIC_SWAP && transaction.atomicSwapId) {
        try {
          const swapDetails = this.atomicSwap.getAtomicSwap(transaction.atomicSwapId);
          if (swapDetails) {
            subStatus = {
              status: swapDetails.status,
              progress: this.calculateSwapProgress(swapDetails),
              steps: swapDetails.steps
            };
          }
        } catch (error) {
          console.warn('Failed to get atomic swap status:', error.message);
        }
      }

      // Update unified transaction status based on sub-status
      if (subStatus) {
        transaction.subStatus = subStatus;
        transaction.lastUpdated = new Date().toISOString();
        
        // Map sub-status to unified status
        if (subStatus.status === TransactionStatus.COMPLETED || subStatus.status === SwapStatus.CLAIMED) {
          transaction.status = UnifiedTransactionStatus.COMPLETED;
          transaction.completedAt = new Date().toISOString();
        } else if (subStatus.status === TransactionStatus.FAILED || subStatus.status === SwapStatus.FAILED) {
          transaction.status = UnifiedTransactionStatus.FAILED;
        } else if (subStatus.status === TransactionStatus.IN_PROGRESS || subStatus.status === SwapStatus.FUNDED) {
          transaction.status = UnifiedTransactionStatus.IN_PROGRESS;
        }
      }

      return {
        transactionId,
        status: transaction.status,
        type: transaction.type,
        method: transaction.method,
        progress: subStatus?.progress || 0,
        subStatus,
        createdAt: transaction.createdAt,
        lastUpdated: transaction.lastUpdated,
        estimatedCompletion: transaction.estimatedCompletion,
        steps: transaction.steps
      };
    } catch (error) {
      throw new Error(`Failed to get transaction status: ${error.message}`);
    }
  }

  /**
   * Calculate atomic swap progress
   */
  calculateSwapProgress(swapDetails) {
    const completedSteps = swapDetails.steps.filter(step => step.status === 'completed').length;
    return Math.round((completedSteps / swapDetails.steps.length) * 100);
  }

  /**
   * Get user's transactions
   */
  getUserTransactions(userAddress) {
    const userTransactions = [];
    
    for (const transaction of this.transactions.values()) {
      // Check if user is involved in the transaction
      if (transaction.quote.fromNetwork && 
          (transaction.recipient === userAddress || 
           transaction.executionResult?.initiator === userAddress ||
           transaction.executionResult?.participant === userAddress)) {
        userTransactions.push(transaction);
      }
    }
    
    return userTransactions.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  /**
   * Get all supported routes
   */
  getAllSupportedRoutes() {
    const routes = [];
    
    for (const [routeKey, routeOptions] of this.routes) {
      const [from, to] = routeKey.split('-');
      
      const bridgeOptions = routeOptions.filter(r => r.type === TransactionTypes.BRIDGE);
      const swapOptions = routeOptions.filter(r => r.type === TransactionTypes.ATOMIC_SWAP);
      
      routes.push({
        from,
        to,
        bridgeSupported: bridgeOptions.length > 0,
        atomicSwapSupported: swapOptions.length > 0,
        totalOptions: routeOptions.length,
        bestTime: Math.min(...routeOptions.map(r => r.estimatedTime)),
        bestFee: Math.min(...routeOptions.map(r => r.feeRate)),
        methods: [...new Set(routeOptions.map(r => r.method))]
      });
    }
    
    return routes;
  }

  /**
   * Get transaction statistics
   */
  getStatistics() {
    const stats = {
      totalTransactions: this.transactions.size,
      bridgeTransactions: 0,
      atomicSwapTransactions: 0,
      completedTransactions: 0,
      failedTransactions: 0,
      activeTransactions: 0,
      totalVolume: 0,
      supportedRoutes: this.routes.size,
      averageCompletionTime: 0
    };

    let totalCompletionTime = 0;
    let completedCount = 0;

    for (const transaction of this.transactions.values()) {
      if (transaction.type === TransactionTypes.BRIDGE) {
        stats.bridgeTransactions++;
      } else if (transaction.type === TransactionTypes.ATOMIC_SWAP) {
        stats.atomicSwapTransactions++;
      }

      switch (transaction.status) {
        case UnifiedTransactionStatus.COMPLETED:
          stats.completedTransactions++;
          stats.totalVolume += transaction.amount;
          
          if (transaction.completedAt) {
            const completionTime = new Date(transaction.completedAt) - new Date(transaction.createdAt);
            totalCompletionTime += completionTime;
            completedCount++;
          }
          break;
        case UnifiedTransactionStatus.FAILED:
          stats.failedTransactions++;
          break;
        case UnifiedTransactionStatus.IN_PROGRESS:
        case UnifiedTransactionStatus.INITIATED:
          stats.activeTransactions++;
          break;
      }
    }

    if (completedCount > 0) {
      stats.averageCompletionTime = Math.round(totalCompletionTime / completedCount / 1000 / 60); // minutes
    }

    return {
      ...stats,
      bridgeIntegration: this.bridgeIntegration.getStatistics(),
      atomicSwap: this.atomicSwap.getStatistics(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Cleanup expired transactions
   */
  cleanupExpiredTransactions() {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [transactionId, transaction] of this.transactions) {
      const estimatedCompletion = new Date(transaction.estimatedCompletion);
      const expiredTime = new Date(estimatedCompletion.getTime() + 24 * 60 * 60 * 1000); // 24 hours after estimated completion
      
      if (transaction.status === UnifiedTransactionStatus.IN_PROGRESS && now > expiredTime) {
        transaction.status = UnifiedTransactionStatus.EXPIRED;
        cleanedCount++;
      }
    }
    
    // Cleanup sub-systems
    const bridgeCleaned = 0; // Bridge integration doesn't have cleanup method
    const swapCleaned = this.atomicSwap.cleanupExpiredSwaps();
    
    console.log(`🧹 Cleaned up ${cleanedCount} expired unified transactions, ${swapCleaned} atomic swaps`);
    return cleanedCount + swapCleaned;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.transactions.clear();
    this.routes.clear();
    
    if (this.atomicSwap) {
      this.atomicSwap.cleanup();
    }
    
    this.isInitialized = false;
    
    console.log('🧹 Unified Transaction Manager cleaned up');
  }
}

module.exports = {
  UnifiedTransactionManager,
  TransactionTypes,
  TransactionMethods,
  UnifiedTransactionStatus,
  RouteScoringCriteria
};

