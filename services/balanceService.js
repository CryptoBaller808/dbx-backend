const UserBalance = require('../models/UserBalance');
const { Op } = require('sequelize');

/**
 * Balance Service
 * Manages user token balances with ACID guarantees
 */

/**
 * Get all balances for a user
 * @param {string} userId - User identifier (wallet address or email)
 * @returns {Promise<Array>} Array of balance objects
 */
async function getBalances(userId) {
  try {
    const balances = await UserBalance.findAll({
      where: { userId },
      order: [['token', 'ASC']]
    });

    return balances.map(b => ({
      token: b.token,
      amount: parseFloat(b.amount),
      updatedAt: b.updated_at
    }));
  } catch (error) {
    console.error(`[BalanceService] getBalances error for user=${userId}:`, error);
    throw error;
  }
}

/**
 * Get balance for a specific token
 * @param {string} userId - User identifier
 * @param {string} token - Token symbol (e.g., 'BTC', 'ETH')
 * @returns {Promise<number>} Token balance
 */
async function getBalance(userId, token) {
  try {
    const balance = await UserBalance.findOne({
      where: { userId, token: token.toUpperCase() }
    });

    return balance ? parseFloat(balance.amount) : 0;
  } catch (error) {
    console.error(`[BalanceService] getBalance error for user=${userId} token=${token}:`, error);
    throw error;
  }
}

/**
 * Credit (add) tokens to user balance
 * @param {string} userId - User identifier
 * @param {string} token - Token symbol
 * @param {number} amount - Amount to credit (must be positive)
 * @param {string} reason - Reason for credit (for logging)
 * @returns {Promise<number>} New balance
 */
async function credit(userId, token, amount, reason = 'credit') {
  if (amount <= 0) {
    throw new Error('Credit amount must be positive');
  }

  const tokenUpper = token.toUpperCase();
  
  try {
    // Find or create balance record
    const [balance, created] = await UserBalance.findOrCreate({
      where: { userId, token: tokenUpper },
      defaults: { userId, token: tokenUpper, amount: '0' }
    });

    // Update balance
    const currentAmount = parseFloat(balance.amount);
    const newAmount = currentAmount + amount;
    
    await balance.update({ amount: newAmount.toString() });

    console.log(`[BalanceService] CREDIT user=${userId} token=${tokenUpper} amount=${amount} newBalance=${newAmount} reason=${reason}`);
    
    return newAmount;
  } catch (error) {
    console.error(`[BalanceService] credit error for user=${userId} token=${tokenUpper}:`, error);
    throw error;
  }
}

/**
 * Debit (subtract) tokens from user balance
 * @param {string} userId - User identifier
 * @param {string} token - Token symbol
 * @param {number} amount - Amount to debit (must be positive)
 * @param {string} reason - Reason for debit (for logging)
 * @returns {Promise<number>} New balance
 * @throws {Error} If insufficient balance
 */
async function debit(userId, token, amount, reason = 'debit') {
  if (amount <= 0) {
    throw new Error('Debit amount must be positive');
  }

  const tokenUpper = token.toUpperCase();
  
  try {
    // Find balance record
    const balance = await UserBalance.findOne({
      where: { userId, token: tokenUpper }
    });

    const currentAmount = balance ? parseFloat(balance.amount) : 0;

    // Check sufficient balance
    if (currentAmount < amount) {
      throw new Error(`INSUFFICIENT_BALANCE: ${tokenUpper} balance=${currentAmount}, required=${amount}`);
    }

    // Update balance
    const newAmount = currentAmount - amount;
    
    if (balance) {
      await balance.update({ amount: newAmount.toString() });
    } else {
      // This should not happen due to the check above, but handle it
      throw new Error(`INSUFFICIENT_BALANCE: No ${tokenUpper} balance found`);
    }

    console.log(`[BalanceService] DEBIT user=${userId} token=${tokenUpper} amount=${amount} newBalance=${newAmount} reason=${reason}`);
    
    return newAmount;
  } catch (error) {
    console.error(`[BalanceService] debit error for user=${userId} token=${tokenUpper}:`, error);
    throw error;
  }
}

/**
 * Transfer tokens between users
 * @param {string} fromUserId - Sender user ID
 * @param {string} toUserId - Receiver user ID
 * @param {string} token - Token symbol
 * @param {number} amount - Amount to transfer
 * @param {string} reason - Reason for transfer
 * @returns {Promise<Object>} Transfer result with new balances
 */
async function transfer(fromUserId, toUserId, token, amount, reason = 'transfer') {
  if (amount <= 0) {
    throw new Error('Transfer amount must be positive');
  }

  const tokenUpper = token.toUpperCase();
  
  try {
    // Debit from sender
    const fromNewBalance = await debit(fromUserId, tokenUpper, amount, `${reason} (send)`);
    
    // Credit to receiver
    const toNewBalance = await credit(toUserId, tokenUpper, amount, `${reason} (receive)`);

    console.log(`[BalanceService] TRANSFER from=${fromUserId} to=${toUserId} token=${tokenUpper} amount=${amount} reason=${reason}`);
    
    return {
      fromBalance: fromNewBalance,
      toBalance: toNewBalance
    };
  } catch (error) {
    console.error(`[BalanceService] transfer error from=${fromUserId} to=${toUserId} token=${tokenUpper}:`, error);
    throw error;
  }
}

/**
 * Set balance to a specific amount (admin function)
 * @param {string} userId - User identifier
 * @param {string} token - Token symbol
 * @param {number} amount - New balance amount
 * @param {string} reason - Reason for setting balance
 * @returns {Promise<number>} New balance
 */
async function setBalance(userId, token, amount, reason = 'admin_set') {
  if (amount < 0) {
    throw new Error('Balance cannot be negative');
  }

  const tokenUpper = token.toUpperCase();
  
  try {
    // Find or create balance record
    const [balance, created] = await UserBalance.findOrCreate({
      where: { userId, token: tokenUpper },
      defaults: { userId, token: tokenUpper, amount: amount.toString() }
    });

    if (!created) {
      await balance.update({ amount: amount.toString() });
    }

    console.log(`[BalanceService] SET_BALANCE user=${userId} token=${tokenUpper} amount=${amount} reason=${reason}`);
    
    return amount;
  } catch (error) {
    console.error(`[BalanceService] setBalance error for user=${userId} token=${tokenUpper}:`, error);
    throw error;
  }
}

/**
 * Reset all balances for a user (admin function)
 * @param {string} userId - User identifier
 * @returns {Promise<number>} Number of balances deleted
 */
async function resetBalances(userId) {
  try {
    const deleted = await UserBalance.destroy({
      where: { userId }
    });

    console.log(`[BalanceService] RESET_BALANCES user=${userId} deleted=${deleted}`);
    
    return deleted;
  } catch (error) {
    console.error(`[BalanceService] resetBalances error for user=${userId}:`, error);
    throw error;
  }
}

module.exports = {
  getBalances,
  getBalance,
  credit,
  debit,
  transfer,
  setBalance,
  resetBalances
};

