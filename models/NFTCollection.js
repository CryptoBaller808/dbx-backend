/**
 * Enhanced NFT Collection Model for Multi-Chain Marketplace
 * Supports creator tools and royalty management
 */

module.exports = (sequelize, DataTypes) => {
  const { Op } = require('sequelize');
  
  const NFTCollection = sequelize.define(
    "NFTCollection",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      // Basic Collection Information
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          len: [1, 255]
        }
      },
      symbol: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          len: [1, 10]
        }
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // Media Assets
      logo_image_url: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isUrl: true
        }
      },
      logo_ipfs_hash: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      banner_image_url: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isUrl: true
        }
      },
      banner_ipfs_hash: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      featured_image_url: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isUrl: true
        }
      },
      // Blockchain and Contract Information
      blockchain: {
        type: DataTypes.ENUM('XRP', 'XLM', 'XDC', 'SOL', 'AVAX', 'MATIC', 'BNB', 'ETH'),
        allowNull: false,
      },
      contract_address: {
        type: DataTypes.STRING,
        allowNull: true, // Some blockchains don't use contract addresses
      },
      contract_type: {
        type: DataTypes.ENUM('ERC721', 'ERC1155', 'SPL', 'XLS20', 'STELLAR_NFT'),
        allowNull: false,
      },
      deploy_transaction_hash: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      // Creator and Category
      creator_id: {
        type: DataTypes.INTEGER,
        allowNull: false
        // REMOVED: inline references to fix PostgreSQL REFERENCES syntax error
        // Foreign key constraint will be handled by migrations instead
      },
      category_id: {
        type: DataTypes.INTEGER,
        allowNull: true
        // REMOVED: inline references to fix PostgreSQL REFERENCES syntax error
        // Foreign key constraint will be handled by migrations instead
      },
      // Collection Configuration
      max_supply: {
        type: DataTypes.INTEGER,
        allowNull: true, // null means unlimited
        validate: {
          min: 1
        }
      },
      current_supply: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
          min: 0
        }
      },
      mint_price: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true,
      },
      mint_price_currency: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      // Royalty Configuration
      default_royalty_percentage: {
        type: DataTypes.DECIMAL(5, 2), // Up to 999.99%
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
          max: 100
        }
      },
      royalty_recipients: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
      },
      // Collection Metadata
      external_url: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isUrl: true
        }
      },
      discord_url: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isUrl: true
        }
      },
      twitter_url: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isUrl: true
        }
      },
      instagram_url: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isUrl: true
        }
      },
      // Status and Configuration
      status: {
        type: DataTypes.ENUM('DRAFT', 'DEPLOYING', 'ACTIVE', 'PAUSED', 'COMPLETED'),
        allowNull: false,
        defaultValue: 'DRAFT'
      },
      is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      is_featured: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      is_nsfw: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      // Minting Configuration
      mint_start_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      mint_end_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      is_public_mint: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      whitelist_addresses: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
      },
      // Analytics
      total_volume: {
        type: DataTypes.DECIMAL(20, 8),
        defaultValue: 0,
      },
      total_volume_currency: {
        type: DataTypes.STRING,
        defaultValue: 'USD',
      },
      floor_price: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true,
      },
      floor_price_currency: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      total_sales: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      unique_owners: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      view_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      like_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      // Cross-Chain Support
      supported_chains: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
      },
      bridge_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      // Timestamp fields with explicit field mapping
      createdAt: {
        type: DataTypes.DATE,
        field: 'created_at',
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at',
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
    },
    {
      tableName: "nft_collections",
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: true, // Ensure snake_case naming for all fields and associations
      indexes: [
        {
          fields: ['creator_id']
        },
        {
          fields: ['category_id']
        },
        {
          fields: ['blockchain']
        },
        {
          fields: ['status']
        },
        {
          fields: ['is_verified']
        },
        {
          fields: ['created_at']
         },
        {       
          fields: ['is_featured']
        },
        {
          fields: ['contract_address', 'blockchain'],
          unique: true,
          where: {
            contract_address: {
              [Op.ne]: null
            }
          }
        },
        {
          fields: ['createdAt']
        },
        {
          fields: ['total_volume']
        },
        {
          fields: ['floor_price']
        },
        {
          fields: ['view_count']
        }
      ],
      hooks: {
        beforeUpdate: (collection, options) => {
          // Validate max_supply vs current_supply
          if (collection.max_supply && collection.current_supply > collection.max_supply) {
            throw new Error('Current supply cannot exceed max supply');
          }
        },
        afterCreate: (collection, options) => {
          console.log(`[NFTCollection] New collection created: ${collection.name} on ${collection.blockchain}`);
        }
      }
    }
  );

  // Define associations
  NFTCollection.associate = function(models) {
    // NFTCollection belongs to User (creator)
    NFTCollection.belongsTo(models.User, {
      foreignKey: 'creator_id',
      as: 'creator'
    });
    
    // NFTCollection has many NFTs
    NFTCollection.hasMany(models.NFT, {
      foreignKey: 'collection_id',
      as: 'nfts'
    });
  };

  return NFTCollection;
};

