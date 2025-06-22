/**
 * NFT Transaction Model for Marketplace
 * Tracks all NFT-related transactions (mints, sales, transfers, etc.)
 */

module.exports = (sequelize, DataTypes) => {
  const NFTTransaction = sequelize.define(
    "NFTTransaction",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      // NFT and Transaction Information
      nft_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'nfts',
          key: 'id'
        }
      },
      transaction_type: {
        type: DataTypes.ENUM('MINT', 'SALE', 'TRANSFER', 'BURN', 'BRIDGE_OUT', 'BRIDGE_IN', 'LIST', 'DELIST'),
        allowNull: false,
      },
      // Parties Involved
      from_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true, // null for mints
        references: {
          model: 'users',
          key: 'id'
        }
      },
      to_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true, // null for burns
        references: {
          model: 'users',
          key: 'id'
        }
      },
      // Blockchain Information
      blockchain: {
        type: DataTypes.ENUM('XRP', 'XLM', 'XDC', 'SOL', 'AVAX', 'MATIC', 'BNB', 'ETH'),
        allowNull: false,
      },
      transaction_hash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      block_number: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      block_timestamp: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // Financial Information
      price: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true, // null for non-sale transactions
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      gas_fee: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true,
      },
      platform_fee: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true,
      },
      royalty_fee: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true,
      },
      // Related Records
      auction_id: {
        type: DataTypes.UUID,
        allowNull: true, // Set if transaction is from an auction
        references: {
          model: 'nft_auctions',
          key: 'id'
        }
      },
      // Status
      status: {
        type: DataTypes.ENUM('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'PENDING'
      },
      confirmation_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      // Metadata
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {}
      },
      // Cross-chain bridge information
      bridge_destination_chain: {
        type: DataTypes.ENUM('XRP', 'XLM', 'XDC', 'SOL', 'AVAX', 'MATIC', 'BNB', 'ETH'),
        allowNull: true, // Set for bridge transactions
      },
      bridge_transaction_id: {
        type: DataTypes.UUID,
        allowNull: true, // Links bridge out/in transactions
      },
    },
    {
      tableName: "nft_transactions",
      timestamps: true,
      indexes: [
        {
          fields: ['nft_id']
        },
        {
          fields: ['from_user_id']
        },
        {
          fields: ['to_user_id']
        },
        {
          fields: ['transaction_type']
        },
        {
          fields: ['blockchain']
        },
        {
          fields: ['transaction_hash'],
          unique: true
        },
        {
          fields: ['status']
        },
        {
          fields: ['auction_id']
        },
        {
          fields: ['block_timestamp']
        },
        {
          fields: ['price']
        }
      ],
      hooks: {
        afterCreate: (transaction, options) => {
          console.log(`[NFTTransaction] New transaction: ${transaction.transaction_type} for NFT ${transaction.nft_id}`);
        },
        afterUpdate: (transaction, options) => {
          if (transaction.changed('status')) {
            console.log(`[NFTTransaction] Transaction ${transaction.id} status: ${transaction.status}`);
          }
        }
      }
    }
  );

  return NFTTransaction;
};

