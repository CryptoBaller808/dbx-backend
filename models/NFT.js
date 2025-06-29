/**
 * Enhanced NFT Model for Multi-Chain Marketplace
 * Supports XRP, XLM, XDC, SOL, AVAX, MATIC, BNB networks
 */

module.exports = (sequelize, DataTypes) => {
  const { Op } = require('sequelize');
  
  const NFT = sequelize.define(
    "NFT",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      // Basic NFT Information
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          len: [1, 255]
        }
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // Media and Metadata
      image_url: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isUrl: true
        }
      },
      image_ipfs_hash: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      animation_url: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isUrl: true
        }
      },
      animation_ipfs_hash: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      external_url: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isUrl: true
        }
      },
      // Blockchain Information
      blockchain: {
        type: DataTypes.ENUM('XRP', 'XLM', 'XDC', 'SOL', 'AVAX', 'MATIC', 'BNB', 'ETH'),
        allowNull: false,
      },
      contract_address: {
        type: DataTypes.STRING,
        allowNull: true, // Some blockchains don't use contract addresses
      },
      token_id: {
        type: DataTypes.STRING,
        allowNull: true, // Will be set after minting
      },
      token_standard: {
        type: DataTypes.ENUM('ERC721', 'ERC1155', 'SPL', 'XLS20', 'STELLAR_NFT'),
        allowNull: false,
      },
      // Ownership and Collection
      collection_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'nft_collections',
          key: 'id'
        }
      },
      creator_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      current_owner_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      // Metadata and Attributes
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {}
      },
      attributes: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
      },
      unlockable_content: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // Royalty Information
      royalty_percentage: {
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
      // Minting Information
      mint_transaction_hash: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      mint_block_number: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      mint_timestamp: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // Status and Flags
      status: {
        type: DataTypes.ENUM('DRAFT', 'MINTING', 'MINTED', 'LISTED', 'SOLD', 'BURNED', 'BRIDGED'),
        allowNull: false,
        defaultValue: 'DRAFT'
      },
      is_nsfw: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      is_featured: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      // Cross-Chain Bridge Information
      original_blockchain: {
        type: DataTypes.ENUM('XRP', 'XLM', 'XDC', 'SOL', 'AVAX', 'MATIC', 'BNB', 'ETH'),
        allowNull: true, // Set if this is a bridged NFT
      },
      original_token_id: {
        type: DataTypes.STRING,
        allowNull: true, // Original token ID before bridging
      },
      bridge_transaction_hash: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      // Analytics
      view_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      like_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      // Pricing (for quick access)
      last_sale_price: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true,
      },
      last_sale_currency: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      current_price: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true,
      },
      current_price_currency: {
        type: DataTypes.STRING,
        allowNull: true,
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
      tableName: "nfts",
      timestamps: true,
      indexes: [
        {
          fields: ['collection_id']
        },
        {
          fields: ['creator_id']
        },
        {
          fields: ['current_owner_id']
        },
        {
          fields: ['blockchain']
        },
        {
          fields: ['status']
        },
        {
          fields: ['token_id', 'blockchain', 'contract_address'],
          unique: true,
          where: {
            token_id: {
              [Op.ne]: null
            }
          }
        },
        {
          fields: ['is_featured', 'status']
        },
        {
          fields: ['createdAt']
        },
        {
          fields: ['view_count']
        },
        {
          fields: ['like_count']
        }
      ],
      hooks: {
        beforeCreate: (nft, options) => {
          // Set creator as initial owner if not specified
          if (!nft.current_owner_id) {
            nft.current_owner_id = nft.creator_id;
          }
        },
        afterUpdate: (nft, options) => {
          // Log ownership changes for audit trail
          if (nft.changed('current_owner_id')) {
            console.log(`[NFT] Ownership changed for NFT ${nft.id}: ${nft._previousDataValues.current_owner_id} -> ${nft.current_owner_id}`);
          }
        }
      }
    }
  );

  return NFT;
};

