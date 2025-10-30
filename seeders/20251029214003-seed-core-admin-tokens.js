'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Core tokens to seed (idempotent - only insert if not exists)
    const coreTokens = [
      {
        symbol: 'BTC',
        name: 'Bitcoin',
        decimals: 8,
        chain: 'Bitcoin',
        contract: null,
        default_quote: 'USDT',
        active: true,
        sort: 1,
        price_provider: 'binance',
        tv_symbol: 'BTCUSDT',
        logo_url: null,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        chain: 'Ethereum',
        contract: null,
        default_quote: 'USDT',
        active: true,
        sort: 2,
        price_provider: 'binance',
        tv_symbol: 'ETHUSDT',
        logo_url: null,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        symbol: 'XRP',
        name: 'Ripple',
        decimals: 6,
        chain: 'XRP Ledger',
        contract: null,
        default_quote: 'USDT',
        active: true,
        sort: 3,
        price_provider: 'binance',
        tv_symbol: 'XRPUSDT',
        logo_url: null,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        symbol: 'XLM',
        name: 'Stellar',
        decimals: 7,
        chain: 'Stellar',
        contract: null,
        default_quote: 'USDT',
        active: true,
        sort: 4,
        price_provider: 'binance',
        tv_symbol: 'XLMUSDT',
        logo_url: null,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        symbol: 'USDT',
        name: 'Tether USD',
        decimals: 6,
        chain: 'Ethereum',
        contract: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        default_quote: 'USDC',
        active: true,
        sort: 5,
        price_provider: 'binance',
        tv_symbol: 'USDTUSDC',
        logo_url: null,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        chain: 'Ethereum',
        contract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        default_quote: 'USDT',
        active: true,
        sort: 6,
        price_provider: 'binance',
        tv_symbol: 'USDCUSDT',
        logo_url: null,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    // Idempotent insert - only add tokens that don't exist
    for (const token of coreTokens) {
      const exists = await queryInterface.rawSelect('admin_tokens', {
        where: { symbol: token.symbol }
      }, ['id']);

      if (!exists) {
        await queryInterface.bulkInsert('admin_tokens', [token], {});
        console.log(`[SEED] Inserted core token: ${token.symbol}`);
      } else {
        console.log(`[SEED] Token already exists, skipping: ${token.symbol}`);
      }
    }
  },

  async down(queryInterface, Sequelize) {
    // Remove only the core tokens we seeded
    await queryInterface.bulkDelete('admin_tokens', {
      symbol: {
        [Sequelize.Op.in]: ['BTC', 'ETH', 'XRP', 'XLM', 'USDT', 'USDC']
      }
    }, {});
  }
};

