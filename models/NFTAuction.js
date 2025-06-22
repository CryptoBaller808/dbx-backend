/**
 * NFT Auction Model for Multi-Chain Marketplace
 * Supports English auctions, Dutch auctions, and fixed-price sales
 */

module.exports = (sequelize, DataTypes) => {
  const NFTAuction = sequelize.define(
    "NFTAuction",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      // NFT and Seller Information
      nft_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'nfts',
          key: 'id'
        }
      },
      seller_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      // Auction Type and Configuration
      auction_type: {
        type: DataTypes.ENUM('FIXED_PRICE', 'ENGLISH_AUCTION', 'DUTCH_AUCTION'),
        allowNull: false,
      },
      // Pricing Information
      starting_price: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false,
        validate: {
          min: 0
        }
      },
      reserve_price: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true, // Only for English auctions
        validate: {
          min: 0
        }
      },
      current_price: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false,
        validate: {
          min: 0
        }
      },
      buyout_price: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true, // Optional instant buy price
        validate: {
          min: 0
        }
      },
      currency: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'USD'
      },
      blockchain_currency: {
        type: DataTypes.STRING,
        allowNull: false, // Native currency of the blockchain (ETH, BNB, AVAX, etc.)
      },
      // Timing Information
      start_time: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      end_time: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      duration_hours: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 8760 // Max 1 year
        }
      },
      // Dutch Auction Specific
      price_drop_interval: {
        type: DataTypes.INTEGER,
        allowNull: true, // Minutes between price drops for Dutch auctions
        validate: {
          min: 1
        }
      },
      price_drop_amount: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true, // Amount to drop price each interval
        validate: {
          min: 0
        }
      },
      minimum_price: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true, // Minimum price for Dutch auctions
        validate: {
          min: 0
        }
      },
      // Current Winning Bid
      highest_bidder_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      highest_bid_amount: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true,
        validate: {
          min: 0
        }
      },
      total_bids: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
          min: 0
        }
      },
      // Status and Flags
      status: {
        type: DataTypes.ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED', 'SOLD', 'CANCELLED', 'EXPIRED'),
        allowNull: false,
        defaultValue: 'DRAFT'
      },
      is_featured: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      // Transaction Information
      listing_transaction_hash: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      sale_transaction_hash: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      // Buyer Information (when sold)
      buyer_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      final_sale_price: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true,
      },
      sale_timestamp: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // Fees and Royalties
      platform_fee_percentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 2.5, // 2.5% platform fee
        validate: {
          min: 0,
          max: 100
        }
      },
      royalty_fee_percentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
          max: 100
        }
      },
      // Analytics
      view_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      watch_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      // Auto-extension for English auctions
      auto_extend_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      extend_time_minutes: {
        type: DataTypes.INTEGER,
        defaultValue: 10, // Extend by 10 minutes if bid in last 10 minutes
        validate: {
          min: 1,
          max: 60
        }
      },
    },
    {
      tableName: "nft_auctions",
      timestamps: true,
      indexes: [
        {
          fields: ['nft_id']
        },
        {
          fields: ['seller_id']
        },
        {
          fields: ['highest_bidder_id']
        },
        {
          fields: ['buyer_id']
        },
        {
          fields: ['status']
        },
        {
          fields: ['auction_type']
        },
        {
          fields: ['start_time']
        },
        {
          fields: ['end_time']
        },
        {
          fields: ['current_price']
        },
        {
          fields: ['is_featured', 'status']
        },
        {
          fields: ['created_at']
        }
      ],
      hooks: {
        beforeCreate: (auction, options) => {
          // Set current price to starting price initially
          if (!auction.current_price) {
            auction.current_price = auction.starting_price;
          }
          
          // Calculate end time if not provided
          if (!auction.end_time && auction.start_time && auction.duration_hours) {
            auction.end_time = new Date(auction.start_time.getTime() + (auction.duration_hours * 60 * 60 * 1000));
          }
        },
        beforeUpdate: (auction, options) => {
          // Validate reserve price for English auctions
          if (auction.auction_type === 'ENGLISH_AUCTION' && auction.reserve_price) {
            if (auction.reserve_price < auction.starting_price) {
              throw new Error('Reserve price cannot be less than starting price');
            }
          }
          
          // Validate Dutch auction configuration
          if (auction.auction_type === 'DUTCH_AUCTION') {
            if (!auction.price_drop_interval || !auction.price_drop_amount || !auction.minimum_price) {
              throw new Error('Dutch auction requires price drop interval, amount, and minimum price');
            }
            if (auction.minimum_price >= auction.starting_price) {
              throw new Error('Minimum price must be less than starting price for Dutch auction');
            }
          }
        },
        afterUpdate: (auction, options) => {
          // Log status changes
          if (auction.changed('status')) {
            console.log(`[NFTAuction] Status changed for auction ${auction.id}: ${auction._previousDataValues.status} -> ${auction.status}`);
          }
          
          // Log new bids
          if (auction.changed('highest_bid_amount')) {
            console.log(`[NFTAuction] New bid on auction ${auction.id}: ${auction.highest_bid_amount} ${auction.currency}`);
          }
        }
      }
    }
  );

  return NFTAuction;
};

