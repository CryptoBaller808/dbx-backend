'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     * 
     * Currency list examples for DBX Exchange
     * XRP, USDT, and XLM with realistic configurations
     */
    await queryInterface.bulkInsert('currency_list', [
      {
        // XRP - Ripple (Native XRP Ledger)
        asset_code: 'XRP',
        asset_issuer: 'native',
        asset_name: 'XRP',
        is_live_net: true,
        ledger: 'xrp',
        visible: true,
        symbol: 'XRP',
        type: 'native',
        subunit: 1000000,
        precision: 6,
        blockchain_key: 'xrp-mainnet',
        icon_url: 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png',
        deposit: true,
        deposit_fee: 0.00,
        min_deposit_amount: 1.00,
        min_collection_amount: 0.50,
        withdraw: true,
        withdraw_fee: 0.10,
        min_withdraw_amount: 2.00,
        withdraw_limit_24hr: 100000.00,
        erc20_contract_address: null,
        gas_limit: null,
        gas_price: null,
        properties: JSON.stringify({
          "category": "payment",
          "consensus": "federated_consensus",
          "website": "https://ripple.com",
          "explorer": "https://xrpscan.com",
          "market_cap_rank": 6,
          "circulating_supply": "53000000000",
          "total_supply": "100000000000",
          "reserve_requirement": "10"
        }),
        is_swap: true,
        is_exchange: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        // USDT - Tether USD (Ethereum ERC-20)
        asset_code: 'USDT',
        asset_issuer: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        asset_name: 'Tether USD',
        is_live_net: true,
        ledger: 'eth',
        visible: true,
        symbol: 'USDT',
        type: 'erc20',
        subunit: 1000000,
        precision: 6,
        blockchain_key: 'eth-mainnet',
        icon_url: 'https://assets.coingecko.com/coins/images/325/large/Tether.png',
        deposit: true,
        deposit_fee: 0.00,
        min_deposit_amount: 10.00,
        min_collection_amount: 5.00,
        withdraw: true,
        withdraw_fee: 5.00,
        min_withdraw_amount: 20.00,
        withdraw_limit_24hr: 50000.00,
        erc20_contract_address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        gas_limit: 60000,
        gas_price: 20,
        properties: JSON.stringify({
          "category": "stablecoin",
          "backing": "USD",
          "audit_firm": "BDO",
          "website": "https://tether.to",
          "explorer": "https://etherscan.io/token/0xdac17f958d2ee523a2206206994597c13d831ec7",
          "whitepaper": "https://tether.to/wp-content/uploads/2016/06/TetherWhitePaper.pdf",
          "market_cap_rank": 3,
          "circulating_supply": "83000000000"
        }),
        is_swap: true,
        is_exchange: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        // XLM - Stellar Lumens (Native Stellar)
        asset_code: 'XLM',
        asset_issuer: 'native',
        asset_name: 'Stellar Lumens',
        is_live_net: true,
        ledger: 'xlm',
        visible: true,
        symbol: 'XLM',
        type: 'native',
        subunit: 10000000,
        precision: 7,
        blockchain_key: 'stellar-mainnet',
        icon_url: 'https://assets.coingecko.com/coins/images/100/large/Stellar_symbol_black_RGB.png',
        deposit: true,
        deposit_fee: 0.00,
        min_deposit_amount: 1.00,
        min_collection_amount: 0.50,
        withdraw: true,
        withdraw_fee: 0.01,
        min_withdraw_amount: 2.00,
        withdraw_limit_24hr: 75000.00,
        erc20_contract_address: null,
        gas_limit: null,
        gas_price: null,
        properties: JSON.stringify({
          "category": "payment",
          "consensus": "stellar_consensus_protocol",
          "website": "https://stellar.org",
          "explorer": "https://stellarchain.io",
          "whitepaper": "https://stellar.org/papers/stellar-consensus-protocol.pdf",
          "market_cap_rank": 25,
          "circulating_supply": "27000000000",
          "total_supply": "50000000000",
          "base_fee": "100",
          "base_reserve": "0.5"
        }),
        is_swap: true,
        is_exchange: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     * 
     * Remove the example currency list data
     */
    await queryInterface.bulkDelete('currency_list', {
      asset_code: {
        [Sequelize.Op.in]: ['XRP', 'USDT', 'XLM']
      }
    }, {});
  }
};

