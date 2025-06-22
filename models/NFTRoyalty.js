/**
 * NFT Royalty Model for Creator Revenue Management
 * Tracks royalty payments and recipient configurations
 */

module.exports = (sequelize, DataTypes) => {
  const NFTRoyalty = sequelize.define(
    "NFTRoyalty",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      // NFT and Transaction Information
      nft_id: {
        type: DataTypes.UUID,
        allowNull: true, // null for collection-level royalties
        references: {
          model: 'nfts',
          key: 'id'
        }
      },
      collection_id: {
        type: DataTypes.UUID,
        allowNull: true, // null for NFT-specific royalties
        references: {
          model: 'nft_collections',
          key: 'id'
        }
      },
      transaction_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'nft_transactions',
          key: 'id'
        }
      },
      // Recipient Information
      recipient_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      recipient_address: {
        type: DataTypes.STRING,
        allowNull: false, // Blockchain address for royalty payment
      },
      // Royalty Configuration
      royalty_percentage: {
        type: DataTypes.DECIMAL(5, 2), // Up to 999.99%
        allowNull: false,
        validate: {
          min: 0,
          max: 100
        }
      },
      // Financial Information
      sale_price: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false,
      },
      royalty_amount: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      // Payment Status
      payment_status: {
        type: DataTypes.ENUM('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'PENDING'
      },
      payment_transaction_hash: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      payment_timestamp: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // Blockchain Information
      blockchain: {
        type: DataTypes.ENUM('XRP', 'XLM', 'XDC', 'SOL', 'AVAX', 'MATIC', 'BNB', 'ETH'),
        allowNull: false,
      },
      // Split Information (for multi-recipient royalties)
      split_percentage: {
        type: DataTypes.DECIMAL(5, 2), // Percentage of total royalty this recipient gets
        allowNull: false,
        defaultValue: 100,
        validate: {
          min: 0,
          max: 100
        }
      },
      split_group_id: {
        type: DataTypes.UUID,
        allowNull: true, // Groups multiple recipients for the same royalty
      },
      // Metadata
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {}
      },
    },
    {
      tableName: "nft_royalties",
      timestamps: true,
      indexes: [
        {
          fields: ['nft_id']
        },
        {
          fields: ['collection_id']
        },
        {
          fields: ['transaction_id']
        },
        {
          fields: ['recipient_id']
        },
        {
          fields: ['payment_status']
        },
        {
          fields: ['blockchain']
        },
        {
          fields: ['split_group_id']
        },
        {
          fields: ['payment_timestamp']
        }
      ],
      hooks: {
        beforeCreate: (royalty, options) => {
          // Calculate royalty amount if not provided
          if (!royalty.royalty_amount && royalty.sale_price && royalty.royalty_percentage) {
            royalty.royalty_amount = (royalty.sale_price * royalty.royalty_percentage / 100) * (royalty.split_percentage / 100);
          }
        },
        afterUpdate: (royalty, options) => {
          if (royalty.changed('payment_status')) {
            console.log(`[NFTRoyalty] Royalty payment ${royalty.id} status: ${royalty.payment_status}`);
          }
        }
      }
    }
  );

  return NFTRoyalty;
};

