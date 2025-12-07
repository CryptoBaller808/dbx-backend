/**
 * RouteExecutionService.js
 * Stage 6: Route Execution for XRPL Orders
 * 
 * Responsibilities:
 * - Accept route execution requests
 * - Validate routes and execution parameters
 * - Execute XRPL routes via Stage 3 pipeline
 * - Return structured execution results
 * - Handle errors and unsupported chains
 */

const RoutePlanner = require('./RoutePlanner');
const { XRPLTransactionService } = require('../XRPLTransactionService');
const EvmRouteExecutionService = require('./EvmRouteExecutionService');

class RouteExecutionService {
  constructor() {
    this.routePlanner = new RoutePlanner();
    this.xrplService = new XRPLTransactionService();
    this.evmService = new EvmRouteExecutionService();
    
    // Execution mode from environment
    this.executionMode = process.env.XRPL_EXECUTION_MODE || 'demo';
    
    // Demo wallet configuration (testnet only)
    this.demoConfig = {
      sourceWallet: {
        address: process.env.DEMO_XRPL_SOURCE_ADDRESS || 'rN7n7otQDd6FczFgLdlqtyMVrn3z4zQnJa',
        seed: process.env.DEMO_XRPL_SOURCE_SEED || 'sEd7VBbQbqGvZrXKjNQABxqGVJ8yjqG'
      },
      destWallet: {
        address: process.env.DEMO_XRPL_DEST_ADDRESS || 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY',
        seed: process.env.DEMO_XRPL_DEST_SEED || 'sEd7VBbQbqGvZrXKjNQABxqGVJ8yjqG'
      },
      network: 'testnet'
    };
    
    console.log('[RouteExecution] Initialized with execution mode:', this.executionMode);
  }
  
  /**
   * Execute a route end-to-end
   * @param {Object} params - Execution parameters
   * @returns {Promise<Object>} Execution result
   */
  async executeRoute(params) {
    const startTime = Date.now();
    const {
      base,
      quote,
      amount,
      side,
      fromChain,
      toChain,
      mode = 'auto',
      routeId,
      preview = true,
      executionMode = 'demo'
    } = params;
    
    console.log('[RouteExecution] Executing route:', {
      base,
      quote,
      amount,
      side,
      fromChain,
      toChain,
      mode,
      executionMode
    });
    
    try {
      // Step 1: Validate execution mode
      if (this.executionMode === 'disabled') {
        return this._errorResponse('EXECUTION_DISABLED', 'Route execution is currently disabled');
      }
      
      if (executionMode !== 'demo' && this.executionMode !== 'production') {
        return this._errorResponse('INVALID_EXECUTION_MODE', 'Only demo execution mode is supported in Stage 6');
      }
      
      // Step 2: Get or validate route
      let route;
      if (routeId) {
        // Validate provided route ID (not implemented yet)
        console.log('[RouteExecution] Route ID provided:', routeId);
        route = await this._getRouteById(routeId);
      } else {
        // Compute best route
        console.log('[RouteExecution] Computing best route...');
        route = await this.routePlanner.findBestRoute({
          fromToken: base,
          toToken: quote,
          amount: parseFloat(amount),
          side,
          fromChain,
          toChain,
          mode
        });
        
        if (!route) {
          return this._errorResponse('NO_ROUTE', 'No valid route found for the given parameters', {
            base,
            quote,
            amount,
            side
          });
        }
      }
      
      console.log('[RouteExecution] Route selected:', {
        chain: route.chain,
        pathType: route.pathType,
        expectedOutput: route.expectedOutput
      });
      
      // Step 3: Route to appropriate execution service based on chain
      const chain = route.chain;
      console.log('[RouteExecution] Route chain detected:', chain);
      
      // Determine which execution service to use
      if (chain === 'XRPL') {
        // Use XRPL execution path (existing, stable)
        console.log('[RouteExecution] Routing to XRPL execution service...');
        
        // Validate XRPL route path type
        const supportedPathTypes = ['direct', 'XRPL_AMM', 'XRPL_DEX'];
        if (!supportedPathTypes.includes(route.pathType)) {
          return this._errorResponse('UNSUPPORTED_PATH_TYPE', `Path type ${route.pathType} is not supported for XRPL`, {
            pathType: route.pathType,
            supportedPathTypes
          });
        }
        
        // Execute XRPL transaction
        console.log('[RouteExecution] Executing XRPL transaction...');
        const txResult = await this._executeXrplRoute(route, {
          base,
          quote,
          amount,
          side,
          executionMode,
          routeId: routeId || `route_${Date.now()}`
        });
        
        const executionTime = Date.now() - startTime;
        
        // Build XRPL success response
        return {
          success: true,
          chain: 'XRPL',
          executionMode,
          route: {
            pathType: route.pathType,
            expectedOutput: route.expectedOutput,
            hops: route.hops,
            fees: route.fees,
            slippage: route.slippage
          },
          transaction: txResult.transaction,
          settlement: txResult.settlement,
          timestamp: new Date().toISOString(),
          executionTimeMs: executionTime
        };
        
      } else if (['ETH', 'BSC', 'AVAX', 'MATIC'].includes(chain)) {
        // Use EVM execution path (Stage 6A)
        console.log('[RouteExecution] Routing to EVM execution service...');
        
        // Delegate to EvmRouteExecutionService
        const evmResult = await this.evmService.executeRoute(route, {
          base,
          quote,
          amount,
          side,
          executionMode,
          routeId: routeId || `route_${Date.now()}`
        });
        
        // EvmRouteExecutionService already returns structured response
        return evmResult;
        
      } else {
        // Unsupported chain
        return this._errorResponse('UNSUPPORTED_CHAIN', `Chain ${chain} is not supported for route execution`, {
          routeChain: chain,
          supportedChains: ['XRPL', 'ETH', 'BSC', 'AVAX', 'MATIC']
        });
      }
      
    } catch (error) {
      console.error('[RouteExecution] Execution failed:', error);
      return this._errorResponse('EXECUTION_FAILED', error.message, {
        error: error.toString(),
        stack: error.stack
      });
    }
  }
  
  /**
   * Execute XRPL route via Stage 3 pipeline
   * @private
   */
  async _executeXrplRoute(route, params) {
    const { base, quote, amount, side, executionMode, routeId } = params;
    
    console.log('[RouteExecution][XRPL] Executing XRPL route:', {
      pathType: route.pathType,
      amount,
      side,
      executionMode
    });
    
    // Use demo wallets for testnet execution
    const sourceWallet = this.demoConfig.sourceWallet;
    const destWallet = this.demoConfig.destWallet;
    
    // Determine transaction amount based on side
    let txAmount;
    if (side === 'sell') {
      // Selling base token (XRP) → use input amount
      txAmount = amount;
    } else {
      // Buying base token (XRP) → use expected output
      txAmount = route.expectedOutput;
    }
    
    console.log('[RouteExecution][XRPL] Transaction details:', {
      from: sourceWallet.address,
      to: destWallet.address,
      amount: txAmount,
      currency: base
    });
    
    // Build XRPL Payment transaction
    const payment = {
      TransactionType: 'Payment',
      Account: sourceWallet.address,
      Destination: destWallet.address,
      Amount: this._toXrplAmount(txAmount, base),
      Memos: [{
        Memo: {
          MemoType: Buffer.from('Stage6-RouteExecution', 'utf8').toString('hex').toUpperCase(),
          MemoData: Buffer.from(routeId, 'utf8').toString('hex').toUpperCase(),
          MemoFormat: Buffer.from('text/plain', 'utf8').toString('hex').toUpperCase()
        }
      }]
    };
    
    console.log('[RouteExecution][XRPL] Submitting payment transaction...');
    
    // Submit transaction via Stage 3 XRPLTransactionService
    const txResult = await this.xrplService.submitTransaction(payment, sourceWallet.seed);
    
    console.log('[RouteExecution][XRPL] Transaction submitted:', {
      hash: txResult.hash,
      result: txResult.result
    });
    
    // Wait for ledger confirmation
    console.log('[RouteExecution][XRPL] Waiting for confirmation...');
    const confirmedTx = await this.xrplService.waitForConfirmation(txResult.hash);
    
    console.log('[RouteExecution][XRPL] Transaction confirmed:', {
      hash: confirmedTx.hash,
      ledgerIndex: confirmedTx.ledgerIndex,
      status: confirmedTx.status
    });
    
    // Build transaction result
    return {
      transaction: {
        hash: confirmedTx.hash,
        ledgerIndex: confirmedTx.ledgerIndex,
        network: 'xrpl-testnet',
        amount: txAmount,
        fee: confirmedTx.fee || '0.000012',
        from: sourceWallet.address,
        to: destWallet.address,
        currency: base,
        memo: routeId
      },
      settlement: {
        status: confirmedTx.status === 'tesSUCCESS' ? 'confirmed' : 'failed',
        balanceChanges: confirmedTx.balanceChanges || {},
        ledgerIndex: confirmedTx.ledgerIndex,
        timestamp: confirmedTx.timestamp || new Date().toISOString()
      }
    };
  }
  
  /**
   * Convert amount to XRPL format
   * @private
   */
  _toXrplAmount(amount, currency) {
    if (currency === 'XRP') {
      // XRP in drops (1 XRP = 1,000,000 drops)
      return String(Math.floor(parseFloat(amount) * 1000000));
    } else {
      // IOU format
      return {
        currency,
        value: String(amount),
        issuer: 'rN7n7otQDd6FczFgLdlqtyMVrn3z4zQnJa' // Demo issuer
      };
    }
  }
  
  /**
   * Get route by ID (placeholder for future implementation)
   * @private
   */
  async _getRouteById(routeId) {
    // TODO: Implement route caching/retrieval
    throw new Error('Route ID lookup not implemented yet');
  }
  
  /**
   * Build error response
   * @private
   */
  _errorResponse(errorCode, message, details = {}) {
    return {
      success: false,
      errorCode,
      message,
      details,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = RouteExecutionService;
