// 'use strict';

// module.exports = {
//   up: async (queryInterface, Sequelize) => {
//     // Existing columns
//     // await queryInterface.addColumn('currency_list', 'is_live_net', {
//     //   type: Sequelize.BOOLEAN,
//     //   allowNull: true,
//     // });
//     // await queryInterface.addColumn('currency_list', 'visible', {
//     //   type: Sequelize.BOOLEAN,
//     //   allowNull: true,
//     // });
//     // await queryInterface.addColumn('currency_list', 'symbol', {
//     //   type: Sequelize.CHAR(1),
//     //   allowNull: true,
//     // });
//     // await queryInterface.addColumn('currency_list', 'type', {
//     //   type: Sequelize.STRING,
//     //   allowNull: true,
//     // });
//     // await queryInterface.addColumn('currency_list', 'subunit', {
//     //   type: Sequelize.INTEGER,
//     //   allowNull: true,
//     // });
//     // await queryInterface.addColumn('currency_list', 'precision', {
//     //   type: Sequelize.INTEGER,
//     //   allowNull: true,
//     // });
//     // await queryInterface.addColumn('currency_list', 'blockchain_key', {
//     //   type: Sequelize.STRING,
//     //   allowNull: true,
//     // });
//     // await queryInterface.addColumn('currency_list', 'icon_url', {
//     //   type: Sequelize.STRING,
//     //   allowNull: true,
//     // });
//     // await queryInterface.addColumn('currency_list', 'deposit', {
//     //   type: Sequelize.BOOLEAN,
//     //   allowNull: true,
//     // });
//     // await queryInterface.addColumn('currency_list', 'deposit_fee', {
//     //   type: Sequelize.DECIMAL,
//     //   allowNull: true,
//     // });
//     // await queryInterface.addColumn('currency_list', 'min_deposit_amount', {
//     //   type: Sequelize.DECIMAL,
//     //   allowNull: true,
//     // });
//     // await queryInterface.addColumn('currency_list', 'min_collection_amount', {
//     //   type: Sequelize.DECIMAL,
//     //   allowNull: true,
//     // });
//     // await queryInterface.addColumn('currency_list', 'withdraw', {
//     //   type: Sequelize.BOOLEAN,
//     //   allowNull: true,
//     // });
//     // await queryInterface.addColumn('currency_list', 'withdraw_fee', {
//     //   type: Sequelize.DECIMAL,
//     //   allowNull: true,
//     // });
//     // await queryInterface.addColumn('currency_list', 'min_withdraw_amount', {
//     //   type: Sequelize.DECIMAL,
//     //   allowNull: true,
//     // });
//     await queryInterface.addColumn('currency_list', 'hr_24_withdraw_limit', {
//       type: Sequelize.DECIMAL,
//       allowNull: true,
//     });
//     // await queryInterface.addColumn('currency_list', 'ledger', {
//     //   type: Sequelize.STRING,
//     //   allowNull: true,
//     // });
//     // await queryInterface.addColumn('currency_list', 'asset_issuer', {
//     //   type: Sequelize.STRING,
//     //   allowNull: true,
//     // });
//     await queryInterface.addColumn('currency_list', 'properties', {
//       type: Sequelize.JSON, // stores dynamic JSON array or object for custom properties
//       allowNull: true,
//     });

//     // New columns
//     await queryInterface.addColumn('currency_list', 'is_swap', {
//       type: Sequelize.BOOLEAN,
//       allowNull: true,
//     });
//     await queryInterface.addColumn('currency_list', 'is_exchange', {
//       type: Sequelize.BOOLEAN,
//       allowNull: true,
//     });
//     await queryInterface.addColumn('currency_list', 'createdAt', {
//       type: Sequelize.DATE,
//       allowNull: false,
//       defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
//     });
//   },

//   down: async (queryInterface, Sequelize) => {
//     // Existing columns
//     await queryInterface.removeColumn('currency_list', 'visible');
//     // await queryInterface.removeColumn('currency_list', 'symbol');
//     // await queryInterface.removeColumn('currency_list', 'type');
//     // await queryInterface.removeColumn('currency_list', 'subunit');
//     // await queryInterface.removeColumn('currency_list', 'precision');
//     // await queryInterface.removeColumn('currency_list', 'blockchain_key');
//     // await queryInterface.removeColumn('currency_list', 'icon_url');
//     // await queryInterface.removeColumn('currency_list', 'deposit');
//     // await queryInterface.removeColumn('currency_list', 'deposit_fee');
//     // await queryInterface.removeColumn('currency_list', 'min_deposit_amount');
//     // await queryInterface.removeColumn('currency_list', 'min_collection_amount');
//     // await queryInterface.removeColumn('currency_list', 'withdraw');
//     // await queryInterface.removeColumn('currency_list', 'withdraw_fee');
//     // await queryInterface.removeColumn('currency_list', 'min_withdraw_amount');
//     await queryInterface.removeColumn('currency_list', 'hr_24_withdraw_limit');
//     // await queryInterface.removeColumn('currency_list', 'ledger');
//     // await queryInterface.removeColumn('currency_list', 'asset_issuer');
//     // await queryInterface.removeColumn('currency_list', 'is_live_net');
//     await queryInterface.removeColumn('currency_list', 'properties');

//     // New columns
//     await queryInterface.removeColumn('currency_list', 'is_swap');
//     await queryInterface.removeColumn('currency_list', 'is_exchange');
//   }
// };
