/**
 * XRP Wallet-Backed Order Controller
 * Stage 3 - Phase 1: XRP SELL orders with XUMM signing in SIM mode
 * 
 * This controller handles wallet-backed XRP SELL orders:
 * - Validates order parameters
 * - Checks wallet balance
 * - Creates XUMM signing request
 * - Handles signed transaction in SIM mode (no real funds)
 */

const express = require('express');
const router = express.Router();
const xumm = require('../services/xumm.js');
const xrplHelper = require('../services/xrpl.js');
const io = require('../services/socket.js');

// SIM mode flag - always true for Phase 1
const SETTLEMENT_SIM_MODE = process.env.SETTLEMENT_SIM_MODE || 'SIM';

/**
 * POST /api/xrp/wallet-order
 * Create a wallet-backed XRP SELL order
 */
router.post('/wallet-order', async (req, res) => {
  try {
    const {
      side,
      pair,
      amount,
      price,
      type,
      clientOrderId,
      walletAddress,
      source,
      userToken,
      socketId
    } = req.body;

    console.log('[DBX XRPL][Stage3] /api/xrp/wallet-order called:', {
      side,
      pair,
      amount,
      price,
      type,
      walletAddress: walletAddress?.substring(0, 10) + '...',
      source,
      simMode: SETTLEMENT_SIM_MODE
    });

    // Validation: Only SELL orders for XRP/USDT via XUMM
    if (side !== 'SELL') {
      return res.status(400).json({
        ok: false,
        code: 'INVALID_SIDE',
        message: 'Only SELL orders are supported in Phase 1'
      });
    }

    if (pair !== 'XRP/USDT') {
      return res.status(400).json({
        ok: false,
        code: 'INVALID_PAIR',
        message: 'Only XRP/USDT pair is supported in Phase 1'
      });
    }

    if (source !== 'xumm') {
      return res.status(400).json({
        ok: false,
        code: 'INVALID_SOURCE',
        message: 'Only XUMM wallet is supported in Phase 1'
      });
    }

    if (!walletAddress || !amount || !price) {
      return res.status(400).json({
        ok: false,
        code: 'MISSING_PARAMETERS',
        message: 'Missing required parameters: walletAddress, amount, or price'
      });
    }

    // Fetch current wallet balance
    console.log('[DBX XRPL][Stage3] Fetching wallet balance for:', walletAddress);
    const balanceData = await xrplHelper.getBalance(walletAddress);
    const availableBalance = parseFloat(balanceData || 0);

    console.log('[DBX XRPL][Stage3] Using wallet balance for validation:', {
      availableBalance,
      requestedAmount: amount
    });

    // Validate sufficient balance
    const requestedAmount = parseFloat(amount);
    if (requestedAmount > availableBalance) {
      console.log('[DBX XRPL][Stage3] Insufficient balance:', {
        need: requestedAmount,
        have: availableBalance
      });

      return res.status(400).json({
        ok: false,
        code: 'INSUFFICIENT_WALLET_BALANCE',
        need: requestedAmount.toFixed(6),
        have: availableBalance.toFixed(6),
        message: `Need ${requestedAmount.toFixed(6)} XRP, have ${availableBalance.toFixed(6)} XRP.`
      });
    }

    // Create XUMM signing request
    console.log('[DBX XRPL][Stage3] Creating XUMM sign request for order');

    // For SIM mode, we create a simple Payment transaction to a DBX sim account
    // This proves the user can sign, but doesn't actually trade on XRPL DEX
    const simDestination = process.env.DBX_SIM_XRP_ACCOUNT || 'rN7n7otQDd6FczFgLdlqtyMVrn3HMgkd1';

    const xummPayload = {
      txjson: {
        TransactionType: 'Payment',
        Destination: simDestination,
        Amount: String(Math.floor(requestedAmount * 1000000)), // Convert to drops
        Memos: [
          {
            Memo: {
              MemoType: Buffer.from('DBX_SIM_ORDER', 'utf8').toString('hex').toUpperCase(),
              MemoData: Buffer.from(JSON.stringify({
                side,
                pair,
                amount: requestedAmount,
                price: parseFloat(price),
                type,
                simMode: true,
                clientOrderId: clientOrderId || `sim-${Date.now()}`
              }), 'utf8').toString('hex').toUpperCase()
            }
          }
        ]
      },
      user_token: userToken || ''
    };

    console.log('[DBX XRPL][Stage3] XUMM payload created:', {
      destination: simDestination,
      amount: requestedAmount,
      simMode: SETTLEMENT_SIM_MODE
    });

    // Create and subscribe to XUMM payload
    const subscription = await xumm.payload.createAndSubscribe(xummPayload, (event) => {
      console.log('[DBX XRPL][Stage3] XUMM event:', event.data);

      if (Object.keys(event.data).indexOf('signed') > -1) {
        return event.data;
      }
    });

    console.log('[DBX XRPL][Stage3] XUMM QR URL:', subscription.created.next.always);
    console.log('[DBX XRPL][Stage3] XUMM Payload UUID:', subscription.created.uuid);

    // Return immediately with QR/deep link info
    // The signing will be handled asynchronously
    res.json({
      ok: true,
      message: 'XUMM signing request created',
      qrUrl: subscription.created.next.always,
      deepLink: subscription.created.next.always,
      payloadUuid: subscription.created.uuid,
      simMode: SETTLEMENT_SIM_MODE
    });

    // Handle signing result asynchronously
    handleXummSigningResult(subscription, {
      side,
      pair,
      amount: requestedAmount,
      price: parseFloat(price),
      type,
      walletAddress,
      clientOrderId: clientOrderId || `sim-${Date.now()}`,
      socketId
    });

  } catch (error) {
    console.error('[DBX XRPL][Stage3] Error creating wallet order:', error);
    res.status(500).json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

/**
 * Handle XUMM signing result asynchronously
 */
async function handleXummSigningResult(subscription, orderData) {
  try {
    console.log('[DBX XRPL][Stage3] Waiting for XUMM signing result...');
    
    const resolvedData = await subscription.resolved;

    if (!resolvedData.signed) {
      console.log('[DBX XRPL][Stage3] Sign request rejected by user');
      
      // Emit rejection to frontend
      if (orderData.socketId) {
        io.getIO().to(orderData.socketId).emit('xrp-wallet-order-result', {
          ok: false,
          status: 'REJECTED',
          message: 'User rejected the signing request'
        });
      }
      return;
    }

    console.log('[DBX XRPL][Stage3] Sign request accepted!');
    console.log('[DBX XRPL][Stage3] SIM MODE active – not submitting transaction on-chain');

    // In SIM mode, we don't actually submit to XRPL DEX
    // We just mark the order as filled in our internal system

    // Get the signed transaction details
    const payloadDetails = await xumm.payload.get(resolvedData.payload_uuidv4);
    
    console.log('[DBX XRPL][Stage3] Signed transaction hash:', payloadDetails.response?.txid);

    // Simulate order fill
    const fillResult = simulateOrderFill(orderData);

    console.log('[DBX XRPL][Stage3] Order marked FILLED_SIM:', {
      orderId: fillResult.orderId,
      side: orderData.side,
      amount: orderData.amount,
      price: orderData.price
    });

    // Emit success to frontend
    if (orderData.socketId) {
      io.getIO().to(orderData.socketId).emit('xrp-wallet-order-result', {
        ok: true,
        status: 'FILLED_SIM',
        orderId: fillResult.orderId,
        side: orderData.side,
        pair: orderData.pair,
        amount: orderData.amount,
        price: orderData.price,
        total: orderData.amount * orderData.price,
        txHash: payloadDetails.response?.txid,
        message: `Order filled (SIM): SELL ${orderData.amount} XRP @ ${orderData.price} USDT`,
        simMode: true
      });
    }

  } catch (error) {
    console.error('[DBX XRPL][Stage3] Error handling signing result:', error);
    
    if (orderData.socketId) {
      io.getIO().to(orderData.socketId).emit('xrp-wallet-order-result', {
        ok: false,
        status: 'ERROR',
        message: error.message
      });
    }
  }
}

/**
 * Simulate order fill (SIM mode only)
 * In a real implementation, this would interact with XRPL DEX or internal matching engine
 */
function simulateOrderFill(orderData) {
  const orderId = `SIM-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  console.log('[DBX XRPL][Stage3] Simulating order fill:', {
    orderId,
    side: orderData.side,
    pair: orderData.pair,
    amount: orderData.amount,
    price: orderData.price
  });

  // In a real implementation, you would:
  // 1. Create a record in wallet_order_simulations table
  // 2. Update DBX test balances (deduct XRP, credit USDT)
  // 3. Emit balance update events

  // For now, we just return the order ID
  return {
    orderId,
    status: 'FILLED_SIM',
    filledAt: new Date().toISOString()
  };
}

module.exports = router;
