/**
 * Database query refactoring utility
 * Standardizes all database queries to use Sequelize
 */
const db = require('../models');
const dbUtil = require('../util/database');

/**
 * Example refactored controller method using Sequelize
 * This demonstrates how to refactor legacy MongoDB or direct MySQL queries
 */
async function getAccountOffers(req, res) {
  try {
    const { account, pair } = req.query;
    
    // Build query conditions
    const where = {};
    if (account) where.account = account;
    if (pair) where.pair = pair;
    
    // Use standardized database utility
    const offers = await dbUtil.query({
      model: 'account_offers',
      where,
      order: [['createdAt', 'DESC']],
      limit: req.query.limit ? parseInt(req.query.limit) : 100
    });
    
    return res.json({
      success: true,
      data: offers
    });
  } catch (error) {
    console.error('Error fetching account offers:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch account offers',
      error: error.message
    });
  }
}

/**
 * Example refactored repository method using Sequelize
 * This demonstrates how to refactor legacy MongoDB or direct MySQL queries
 */
class UserRepository {
  /**
   * Find user by ID with associated wallets
   * @param {Number} userId - User ID
   * @returns {Promise} - User with wallets
   */
  async getUserWithWallets(userId) {
    return dbUtil.findById('users', userId, [
      {
        model: db.transactions,
        as: 'transactions',
        required: false,
        where: {
          type: 'wallet_connection'
        }
      }
    ]);
  }
  
  /**
   * Find users by role
   * @param {Number} roleId - Role ID
   * @returns {Promise} - Users with specified role
   */
  async getUsersByRole(roleId) {
    return dbUtil.query({
      model: 'users',
      where: { role_id: roleId },
      include: [
        {
          model: db.roles,
          as: 'role',
          required: true
        }
      ]
    });
  }
  
  /**
   * Create new user
   * @param {Object} userData - User data
   * @returns {Promise} - Created user
   */
  async createUser(userData) {
    const transaction = await db.sequelize.transaction();
    
    try {
      const user = await dbUtil.create('users', userData, { transaction });
      
      // Create default settings for user
      await dbUtil.create('settings', {
        user_id: user.id,
        type: 'notification_preferences',
        config: JSON.stringify({
          email: true,
          push: true
        })
      }, { transaction });
      
      await transaction.commit();
      return user;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = {
  getAccountOffers,
  UserRepository
};
