/**
 * NFT Bid Model for Auction System
 * Tracks all bids placed on NFT auctions
 */

module.exports = (sequelize, DataTypes) => {
  const NFTBid = sequelize.define(
    "NFTBid",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      // Auction and Bidder Information
      auction_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'nft_auctions',
          key: 'id'
        }
      },
      bidder_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      // Bid Information
      bid_amount: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false,
        validate: {
          min: 0
        }
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      // Bid Status
      status: {
        type: DataTypes.ENUM('ACTIVE', 'OUTBID', 'WINNING', 'WON', 'REFUNDED', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'ACTIVE'
      },
      // Transaction Information
      bid_transaction_hash: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      refund_transaction_hash: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      // Timing
      bid_timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      expiry_timestamp: {
        type: DataTypes.DATE,
        allowNull: true, // For timed bids
      },
      // Metadata
      bid_signature: {
        type: DataTypes.STRING,
        allowNull: true, // For off-chain bid verification
      },
      gas_fee: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true,
      },
      // Auto-bid Configuration (for proxy bidding)
      is_auto_bid: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      max_auto_bid_amount: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true,
      },
    },
    {
      tableName: "nft_bids",
      timestamps: true,
      indexes: [
        {
          fields: ['auction_id']
        },
        {
          fields: ['bidder_id']
        },
        {
          fields: ['status']
        },
        {
          fields: ['bid_amount']
        },
        {
          fields: ['bid_timestamp']
        },
        {
          fields: ['auction_id', 'bid_amount']
        }
      ],
      hooks: {
        afterCreate: (bid, options) => {
          console.log(`[NFTBid] New bid placed: ${bid.bid_amount} ${bid.currency} on auction ${bid.auction_id}`);
        }
      }
    }
  );

  return NFTBid;
};

