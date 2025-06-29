/**
 * NFT Bridge Transaction Model for Cross-Chain Functionality
 * Tracks NFT bridging between different blockchain networks
 */

module.exports = (sequelize, DataTypes) => {
  const { Op } = require('sequelize');
  
  const NFTBridgeTransaction = sequelize.define(
    "NFTBridgeTransaction",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      // Original NFT Information
      original_nft_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'nfts',
          key: 'id'
        }
      },
      // Destination NFT Information (created after bridge)
      destination_nft_id: {
        type: DataTypes.UUID,
        allowNull: true, // Set after successful bridge
        references: {
          model: 'nfts',
          key: 'id'
        }
      },
      // User Information
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      // Blockchain Information
      source_blockchain: {
        type: DataTypes.ENUM('XRP', 'XLM', 'XDC', 'SOL', 'AVAX', 'MATIC', 'BNB', 'ETH'),
        allowNull: false,
      },
      destination_blockchain: {
        type: DataTypes.ENUM('XRP', 'XLM', 'XDC', 'SOL', 'AVAX', 'MATIC', 'BNB', 'ETH'),
        allowNull: false,
      },
      // Transaction Hashes
      burn_transaction_hash: {
        type: DataTypes.STRING,
        allowNull: true, // Hash of the burn transaction on source chain
      },
      mint_transaction_hash: {
        type: DataTypes.STRING,
        allowNull: true, // Hash of the mint transaction on destination chain
      },
      // Bridge Configuration
      bridge_type: {
        type: DataTypes.ENUM('BURN_MINT', 'LOCK_MINT', 'WRAP_UNWRAP'),
        allowNull: false,
        defaultValue: 'BURN_MINT'
      },
      // Status Tracking
      status: {
        type: DataTypes.ENUM('INITIATED', 'BURNING', 'BURNED', 'MINTING', 'COMPLETED', 'FAILED', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'INITIATED'
      },
      // Timing Information
      initiated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      burned_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      minted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // Financial Information
      bridge_fee: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: false,
        defaultValue: 0,
      },
      bridge_fee_currency: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'USD'
      },
      source_gas_fee: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true,
      },
      destination_gas_fee: {
        type: DataTypes.DECIMAL(20, 8),
        allowNull: true,
      },
      // Verification and Security
      verification_signature: {
        type: DataTypes.STRING,
        allowNull: true, // Cryptographic proof for cross-chain verification
      },
      validator_signatures: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [] // Array of validator signatures
      },
      // Metadata Preservation
      original_metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {} // Preserve original NFT metadata
      },
      // Error Handling
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      retry_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      max_retries: {
        type: DataTypes.INTEGER,
        defaultValue: 3,
      },
      // Slippage and Tolerance
      slippage_tolerance: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 1.0, // 1% slippage tolerance
      },
      estimated_completion_time: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "nft_bridge_transactions",
      timestamps: true,
      indexes: [
        {
          fields: ['original_nft_id']
        },
        {
          fields: ['destination_nft_id']
        },
        {
          fields: ['user_id']
        },
        {
          fields: ['source_blockchain']
        },
        {
          fields: ['destination_blockchain']
        },
        {
          fields: ['status']
        },
        {
          fields: ['burn_transaction_hash'],
          unique: true,
          where: {
            burn_transaction_hash: {
              [Op.ne]: null
            }
          }
        },
        {
          fields: ['mint_transaction_hash'],
          unique: true,
          where: {
            mint_transaction_hash: {
              [Op.ne]: null
            }
          }
        },
        {
          fields: ['initiated_at']
        }
      ],
      hooks: {
        beforeCreate: (bridgeTransaction, options) => {
          // Validate source and destination chains are different
          if (bridgeTransaction.source_blockchain === bridgeTransaction.destination_blockchain) {
            throw new Error('Source and destination blockchains must be different');
          }
          
          // Set estimated completion time
          if (!bridgeTransaction.estimated_completion_time) {
            bridgeTransaction.estimated_completion_time = new Date(Date.now() + (30 * 60 * 1000)); // 30 minutes
          }
        },
        afterUpdate: (bridgeTransaction, options) => {
          if (bridgeTransaction.changed('status')) {
            console.log(`[NFTBridgeTransaction] Bridge ${bridgeTransaction.id} status: ${bridgeTransaction.status}`);
            
            // Set timestamps based on status
            const now = new Date();
            switch (bridgeTransaction.status) {
              case 'BURNED':
                if (!bridgeTransaction.burned_at) {
                  bridgeTransaction.burned_at = now;
                }
                break;
              case 'COMPLETED':
                if (!bridgeTransaction.completed_at) {
                  bridgeTransaction.completed_at = now;
                }
                if (!bridgeTransaction.minted_at) {
                  bridgeTransaction.minted_at = now;
                }
                break;
            }
          }
        }
      }
    }
  );

  return NFTBridgeTransaction;
};

