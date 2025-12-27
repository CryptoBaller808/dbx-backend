/**
 * Migration: Update XLM Trading Pair from USDT to USDC
 * 
 * Stage 7.4.0: Rename UI pair + decouple pricing from settlement
 * 
 * Changes:
 * - Updates XLM defaultQuote from USDT to USDC
 * - Changes priceProvider from binance to coingecko (for XLM/USD reference)
 * - Updates tvSymbol to XLMUSD to reflect USD price reference
 * 
 * This migration is idempotent and safe to run multiple times.
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Check if tokens table exists
      const tables = await queryInterface.showAllTables();
      const hasTokensTable = tables.includes('tokens') || tables.includes('Tokens');
      
      if (!hasTokensTable) {
        console.log('[Migration] Tokens table does not exist yet, skipping XLM update');
        await transaction.commit();
        return;
      }
      
      // Check if XLM token exists
      const [xlmTokens] = await queryInterface.sequelize.query(
        `SELECT * FROM tokens WHERE symbol = 'XLM' AND chain = 'XLM' LIMIT 1`,
        { transaction }
      );
      
      if (xlmTokens.length === 0) {
        console.log('[Migration] XLM token not found in database, will be created with new seed data');
        await transaction.commit();
        return;
      }
      
      const xlmToken = xlmTokens[0];
      console.log('[Migration] Found XLM token:', {
        id: xlmToken.id,
        symbol: xlmToken.symbol,
        defaultQuote: xlmToken.default_quote || xlmToken.defaultQuote,
        priceProvider: xlmToken.price_provider || xlmToken.priceProvider
      });
      
      // Update XLM token configuration
      await queryInterface.sequelize.query(
        `UPDATE tokens 
         SET default_quote = 'USDC',
             price_provider = 'coingecko',
             tv_symbol = 'XLMUSD',
             updated_at = NOW()
         WHERE symbol = 'XLM' AND chain = 'XLM'`,
        { transaction }
      );
      
      console.log('[Migration] ✅ Updated XLM token: USDT → USDC, binance → coingecko');
      
      await transaction.commit();
      console.log('[Migration] XLM pair update completed successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('[Migration] Error updating XLM pair:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Check if tokens table exists
      const tables = await queryInterface.showAllTables();
      const hasTokensTable = tables.includes('tokens') || tables.includes('Tokens');
      
      if (!hasTokensTable) {
        console.log('[Migration Rollback] Tokens table does not exist, skipping');
        await transaction.commit();
        return;
      }
      
      // Revert XLM token to original configuration
      await queryInterface.sequelize.query(
        `UPDATE tokens 
         SET default_quote = 'USDT',
             price_provider = 'binance',
             tv_symbol = 'XLMUSDT',
             updated_at = NOW()
         WHERE symbol = 'XLM' AND chain = 'XLM'`,
        { transaction }
      );
      
      console.log('[Migration Rollback] ✅ Reverted XLM token: USDC → USDT, coingecko → binance');
      
      await transaction.commit();
      console.log('[Migration Rollback] XLM pair rollback completed');
      
    } catch (error) {
      await transaction.rollback();
      console.error('[Migration Rollback] Error reverting XLM pair:', error);
      throw error;
    }
  }
};
