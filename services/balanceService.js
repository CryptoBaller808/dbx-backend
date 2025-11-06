/**
 * Balance Service
 * Manages user token balances with atomic operations
 */

const { sequelize } = require('../models');

/**
 * Get all balances for a user
 * @param {string} userId - User identifier
 * @returns {Promise<Array>} Array of balance objects
 */
async function getBalances(userId) {
  console.log(`[BALANCE] getBalances userId=${userId}`);
  
  try {
    const { UserBalance } = sequelize.models;
    const balances = await UserBalance.findAll({
      where: { userId },
      attributes: ['token', 'amount', 'updatedAt'],
      order: [['token', 'ASC']]
    });
    
    return balances.map(b => ({
      token: b.token,
      amount: b.amount,
      updatedAt: b.updatedAt
    }));
  } catch (error) {
    console.error(`[BALANCE] ERROR getBalances userId=${userId}:`, error.message);
    throw error;
  }
}

/**
 * Get balance for a specific token
 * @param {string} userId - User identifier
 * @param {string} token - Token symbol
 * @returns {Promise<number>} Balance amount
 */
async function getBalance(userId, token) {
  console.log(`[BALANCE] getBalance userId=${userId} token=${token}`);
  
  try {
    const { UserBalance } = sequelize.models;
    const balance = await UserBalance.findOne({
      where: { userId, token }
    });
    
    return balance ? balance.amount : 0;
  } catch (error) {
    console.error(`[BALANCE] ERROR getBalance userId=${userId} token=${token}:`, error.message);
    throw error;
  }
}

/**
 * Credit (add) funds to user balance
 * @param {string} userId - User identifier
 * @param {string} token - Token symbol
 * @param {number} amount - Amount to add
 * @returns {Promise<number>} New balance
 */
async function credit(userId, token, amount) {
  console.log(`[BALANCE] credit userId=${userId} token=${token} amount=${amount}`);
  
  if (amount <= 0) {
    throw new Error('Credit amount must be positive');
  }
  
  const transaction = await sequelize.transaction();
  
  try {
    const { UserBalance } = sequelize.models;
    
    // Find or create balance record
    const [balance, created] = await UserBalance.findOrCreate({
      where: { userId, token },
      defaults: { userId, token, amount: 0 },
      transaction
    });
    
    // Update balance
    const newAmount = parseFloat(balance.amount) + parseFloat(amount);
    await balance.update({ amount: newAmount }, { transaction });
    
    await transaction.commit();
    
    console.log(`[BALANCE] credit success userId=${userId} token=${token} newBalance=${newAmount}`);
    return newAmount;
  } catch (error) {
    await transaction.rollback();
    console.error(`[BALANCE] ERROR credit userId=${userId} token=${token}:`, error.message);
    throw error;
  }
}

/**
 * Debit (subtract) funds from user balance
 * @param {string} userId - User identifier
 * @param {string} token - Token symbol
 * @param {number} amount - Amount to subtract
 * @returns {Promise<number>} New balance
 */
async function debit(userId, token, amount) {
  console.log(`[BALANCE] debit userId=${userId} token=${token} amount=${amount}`);
  
  if (amount <= 0) {
    throw new Error('Debit amount must be positive');
  }
  
  const transaction = await sequelize.transaction();
  
  try {
    const { UserBalance } = sequelize.models;
    
    // Find balance record
    const balance = await UserBalance.findOne({
      where: { userId, token },
      transaction
    });
    
    const currentAmount = balance ? parseFloat(balance.amount) : 0;
    
    // Check sufficient balance
    if (currentAmount < amount) {
      console.error(`[BALANCE] ERROR insufficient balance userId=${userId} token=${token} required=${amount} available=${currentAmount}`);
      throw new Error(`Insufficient ${token} balance. Required: ${amount}, Available: ${currentAmount}`);
    }
    
    // Update balance
    const newAmount = currentAmount - parseFloat(amount);
    
    if (balance) {
      await balance.update({ amount: newAmount }, { transaction });
    } else {
      // Should not happen due to check above, but handle it
      await UserBalance.create({
        userId,
        token,
        amount: newAmount
      }, { transaction });
    }
    
    await transaction.commit();
    
    console.log(`[BALANCE] debit success userId=${userId} token=${token} newBalance=${newAmount}`);
    return newAmount;
  } catch (error) {
    await transaction.rollback();
    console.error(`[BALANCE] ERROR debit userId=${userId} token=${token}:`, error.message);
    throw error;
  }
}

/**
 * Check if user has enough balance
 * @param {string} userId - User identifier
 * @param {string} token - Token symbol
 * @param {number} amount - Required amount
 * @returns {Promise<boolean>} True if sufficient balance
 */
async function hasEnough(userId, token, amount) {
  const balance = await getBalance(userId, token);
  return balance >= amount;
}

/**
 * Reset demo funds (delete all balances for a user)
 * @param {string} userId - User identifier
 * @returns {Promise<number>} Number of balances deleted
 */
async function resetDemo(userId) {
  console.log(`[BALANCE] resetDemo userId=${userId}`);
  
  try {
    const { UserBalance } = sequelize.models;
    const count = await UserBalance.destroy({
      where: { userId }
    });
    
    console.log(`[BALANCE] resetDemo success userId=${userId} deleted=${count}`);
    return count;
  } catch (error) {
    console.error(`[BALANCE] ERROR resetDemo userId=${userId}:`, error.message);
    throw error;
  }
}

module.exports = {
  getBalances,
  getBalance,
  credit,
  debit,
  hasEnough,
  resetDemo
};

