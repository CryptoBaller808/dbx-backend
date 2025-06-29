/**
 * Enhanced Admin Dashboard Service
 * Provides multi-chain analytics, real-time monitoring, and advanced admin features
 */

const { Op } = require('sequelize');
const db = require('../models');
const { RiskManagementSystem } = require('./trading/RiskManagementSystem');
const MultiChainNFTService = require('./MultiChainNFTService');

class EnhancedAdminDashboardService {
  constructor() {
    this.supportedChains = ['ETH', 'BNB', 'AVAX', 'MATIC', 'XDC', 'SOL', 'XRP', 'XLM'];
    this.riskSystem = new RiskManagementSystem();
    this.nftService = new MultiChainNFTService();
    this.realTimeData = new Map();
    this.alertThresholds = {
      highTransactionVolume: 1000,
      lowBalance: 0.1,
      highErrorRate: 0.05,
      slowResponseTime: 5000
    };
  }

  /**
   * Get comprehensive multi-chain dashboard overview
   */
  async getMultiChainDashboard(timeframe = '24h') {
    try {
      const timeRanges = this.getTimeRange(timeframe);
      
      const [
        chainStats,
        transactionMetrics,
        userMetrics,
        nftMetrics,
        systemHealth,
        topAssets,
        recentActivity
      ] = await Promise.all([
        this.getChainStatistics(timeRanges),
        this.getTransactionMetrics(timeRanges),
        this.getUserMetrics(timeRanges),
        this.getNFTMetrics(timeRanges),
        this.getSystemHealthMetrics(),
        this.getTopTradedAssets(timeRanges),
        this.getRecentActivity(50)
      ]);

      return {
        success: true,
        data: {
          overview: {
            totalChains: this.supportedChains.length,
            activeChains: chainStats.filter(chain => chain.status === 'online').length,
            totalTransactions: transactionMetrics.totalTransactions,
            totalVolume: transactionMetrics.totalVolume,
            activeUsers: userMetrics.activeUsers,
            totalNFTs: nftMetrics.totalNFTs
          },
          chainStats,
          transactionMetrics,
          userMetrics,
          nftMetrics,
          systemHealth,
          topAssets,
          recentActivity,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error getting multi-chain dashboard:', error);
      return {
        success: false,
        error: 'Failed to fetch dashboard data',
        details: error.message
      };
    }
  }

  /**
   * Get detailed statistics for each blockchain network
   */
  async getChainStatistics(timeRanges) {
    const chainStats = [];

    for (const chain of this.supportedChains) {
      try {
        const [transactions, volume, gasUsage, adapterStatus] = await Promise.all([
          this.getChainTransactionCount(chain, timeRanges),
          this.getChainVolume(chain, timeRanges),
          this.getChainGasUsage(chain, timeRanges),
          this.getBlockchainAdapterStatus(chain)
        ]);

        chainStats.push({
          chain,
          name: this.getChainDisplayName(chain),
          status: adapterStatus.status,
          transactions: transactions,
          volume: volume,
          gasUsage: gasUsage,
          avgGasPrice: gasUsage.avgPrice,
          blockHeight: adapterStatus.blockHeight,
          lastUpdate: adapterStatus.lastUpdate,
          responseTime: adapterStatus.responseTime,
          errorRate: adapterStatus.errorRate
        });
      } catch (error) {
        console.error(`Error getting stats for ${chain}:`, error);
        chainStats.push({
          chain,
          name: this.getChainDisplayName(chain),
          status: 'error',
          error: error.message
        });
      }
    }

    return chainStats;
  }

  /**
   * Get comprehensive transaction metrics
   */
  async getTransactionMetrics(timeRanges) {
    try {
      const [
        totalTransactions,
        transactionsByType,
        transactionsByChain,
        volumeByChain,
        hourlyTransactions,
        failedTransactions
      ] = await Promise.all([
        this.getTotalTransactions(timeRanges),
        this.getTransactionsByType(timeRanges),
        this.getTransactionsByChain(timeRanges),
        this.getVolumeByChain(timeRanges),
        this.getHourlyTransactions(timeRanges),
        this.getFailedTransactions(timeRanges)
      ]);

      return {
        totalTransactions,
        totalVolume: volumeByChain.reduce((sum, chain) => sum + chain.volume, 0),
        transactionsByType,
        transactionsByChain,
        volumeByChain,
        hourlyTransactions,
        failedTransactions,
        successRate: ((totalTransactions - failedTransactions) / totalTransactions * 100).toFixed(2)
      };
    } catch (error) {
      console.error('Error getting transaction metrics:', error);
      throw error;
    }
  }

  /**
   * Get user activity and growth metrics
   */
  async getUserMetrics(timeRanges) {
    try {
      const [
        totalUsers,
        activeUsers,
        newUsers,
        usersByChain,
        kycStats,
        userGrowth
      ] = await Promise.all([
        db.users.count(),
        this.getActiveUsers(timeRanges),
        this.getNewUsers(timeRanges),
        this.getUsersByChain(timeRanges),
        this.getKYCStatistics(),
        this.getUserGrowthData(timeRanges)
      ]);

      return {
        totalUsers,
        activeUsers,
        newUsers,
        usersByChain,
        kycStats,
        userGrowth,
        retentionRate: this.calculateRetentionRate(timeRanges)
      };
    } catch (error) {
      console.error('Error getting user metrics:', error);
      throw error;
    }
  }

  /**
   * Get NFT marketplace metrics
   */
  async getNFTMetrics(timeRanges) {
    try {
      const [
        totalNFTs,
        nftsByChain,
        totalCollections,
        nftSales,
        topCollections,
        mintingActivity
      ] = await Promise.all([
        db.nfts.count(),
        this.getNFTsByChain(),
        db.nft_collections.count(),
        this.getNFTSalesData(timeRanges),
        this.getTopCollections(timeRanges),
        this.getMintingActivity(timeRanges)
      ]);

      return {
        totalNFTs,
        nftsByChain,
        totalCollections,
        nftSales,
        topCollections,
        mintingActivity,
        averagePrice: nftSales.totalVolume / nftSales.totalSales || 0
      };
    } catch (error) {
      console.error('Error getting NFT metrics:', error);
      throw error;
    }
  }

  /**
   * Get system health and performance metrics
   */
  async getSystemHealthMetrics() {
    try {
      const [
        databaseHealth,
        apiHealth,
        blockchainHealth,
        serverMetrics,
        errorLogs
      ] = await Promise.all([
        this.getDatabaseHealth(),
        this.getAPIHealth(),
        this.getBlockchainHealth(),
        this.getServerMetrics(),
        this.getRecentErrorLogs()
      ]);

      const overallHealth = this.calculateOverallHealth([
        databaseHealth,
        apiHealth,
        blockchainHealth
      ]);

      return {
        overall: overallHealth,
        database: databaseHealth,
        api: apiHealth,
        blockchain: blockchainHealth,
        server: serverMetrics,
        errors: errorLogs,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting system health:', error);
      throw error;
    }
  }

  /**
   * Get top traded assets across all chains
   */
  async getTopTradedAssets(timeRanges, limit = 10) {
    try {
      const topAssets = await db.nft_transactions.findAll({
        where: {
          timestamp: {
            [Op.gte]: timeRanges.start,
            [Op.lte]: timeRanges.end
          },
          transaction_type: ['SALE', 'AUCTION_WIN']
        },
        include: [
          {
            model: db.nfts,
            as: 'nft',
            include: [
              { model: db.nft_collections, as: 'collection' }
            ]
          }
        ],
        group: ['nft.id'],
        attributes: [
          'nft_id',
          [db.sequelize.fn('COUNT', db.sequelize.col('nft_transactions.id')), 'tradeCount'],
          [db.sequelize.fn('SUM', db.sequelize.col('price')), 'totalVolume'],
          [db.sequelize.fn('AVG', db.sequelize.col('price')), 'avgPrice']
        ],
        order: [[db.sequelize.fn('SUM', db.sequelize.col('price')), 'DESC']],
        limit
      });

      return topAssets.map(asset => ({
        nftId: asset.nft_id,
        name: asset.nft?.name,
        collection: asset.nft?.collection?.name,
        blockchain: asset.nft?.blockchain,
        tradeCount: parseInt(asset.dataValues.tradeCount),
        totalVolume: parseFloat(asset.dataValues.totalVolume),
        avgPrice: parseFloat(asset.dataValues.avgPrice),
        image: asset.nft?.image_url
      }));
    } catch (error) {
      console.error('Error getting top traded assets:', error);
      return [];
    }
  }

  /**
   * Get recent activity across the platform
   */
  async getRecentActivity(limit = 50) {
    try {
      const [transactions, auctions, mints, bridgeTransactions] = await Promise.all([
        db.nft_transactions.findAll({
          limit: limit / 4,
          order: [['timestamp', 'DESC']],
          include: [
            { model: db.nfts, as: 'nft' },
            { model: db.users, as: 'user' }
          ]
        }),
        db.nft_auctions.findAll({
          limit: limit / 4,
          order: [['created_at', 'DESC']],
          include: [
            { model: db.nfts, as: 'nft' }
          ]
        }),
        db.nfts.findAll({
          limit: limit / 4,
          order: [['created_at', 'DESC']],
          include: [
            { model: db.users, as: 'creator' },
            { model: db.nft_collections, as: 'collection' }
          ]
        }),
        db.nft_bridge_transactions.findAll({
          limit: limit / 4,
          order: [['timestamp', 'DESC']],
          include: [
            { model: db.nfts, as: 'nft' }
          ]
        })
      ]);

      const activities = [
        ...transactions.map(tx => ({
          type: 'transaction',
          action: tx.transaction_type,
          timestamp: tx.timestamp,
          user: tx.user?.email,
          nft: tx.nft?.name,
          blockchain: tx.blockchain,
          amount: tx.price,
          currency: tx.currency
        })),
        ...auctions.map(auction => ({
          type: 'auction',
          action: 'AUCTION_CREATED',
          timestamp: auction.created_at,
          nft: auction.nft?.name,
          blockchain: auction.nft?.blockchain,
          startingPrice: auction.starting_price,
          currency: auction.currency
        })),
        ...mints.map(nft => ({
          type: 'mint',
          action: 'NFT_MINTED',
          timestamp: nft.created_at,
          user: nft.creator?.email,
          nft: nft.name,
          blockchain: nft.blockchain,
          collection: nft.collection?.name
        })),
        ...bridgeTransactions.map(bridge => ({
          type: 'bridge',
          action: 'CROSS_CHAIN_TRANSFER',
          timestamp: bridge.timestamp,
          nft: bridge.nft?.name,
          sourceChain: bridge.source_blockchain,
          targetChain: bridge.target_blockchain,
          status: bridge.status
        }))
      ];

      return activities
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting recent activity:', error);
      return [];
    }
  }

  /**
   * Helper methods for data aggregation
   */
  getTimeRange(timeframe) {
    const end = new Date();
    let start = new Date();

    switch (timeframe) {
      case '1h':
        start.setHours(start.getHours() - 1);
        break;
      case '24h':
        start.setDate(start.getDate() - 1);
        break;
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
      default:
        start.setDate(start.getDate() - 1);
    }

    return { start, end };
  }

  getChainDisplayName(chain) {
    const names = {
      ETH: 'Ethereum',
      BNB: 'Binance Smart Chain',
      AVAX: 'Avalanche',
      MATIC: 'Polygon',
      XDC: 'XDC Network',
      SOL: 'Solana',
      XRP: 'XRP Ledger',
      XLM: 'Stellar'
    };
    return names[chain] || chain;
  }

  async getChainTransactionCount(chain, timeRanges) {
    return await db.nft_transactions.count({
      where: {
        blockchain: chain,
        timestamp: {
          [Op.gte]: timeRanges.start,
          [Op.lte]: timeRanges.end
        }
      }
    });
  }

  async getChainVolume(chain, timeRanges) {
    const result = await db.nft_transactions.findOne({
      where: {
        blockchain: chain,
        timestamp: {
          [Op.gte]: timeRanges.start,
          [Op.lte]: timeRanges.end
        }
      },
      attributes: [
        [db.sequelize.fn('SUM', db.sequelize.col('price')), 'totalVolume'],
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'transactionCount']
      ]
    });

    return {
      totalVolume: parseFloat(result?.dataValues?.totalVolume || 0),
      transactionCount: parseInt(result?.dataValues?.transactionCount || 0)
    };
  }

  async getChainGasUsage(chain, timeRanges) {
    // This would integrate with blockchain adapters to get real gas data
    // For now, return mock data structure
    return {
      totalGasUsed: Math.floor(Math.random() * 1000000),
      avgPrice: Math.floor(Math.random() * 100),
      maxPrice: Math.floor(Math.random() * 200),
      minPrice: Math.floor(Math.random() * 50)
    };
  }

  async getBlockchainAdapterStatus(chain) {
    try {
      // This would check the actual blockchain adapter status
      // For now, return mock data
      return {
        status: Math.random() > 0.1 ? 'online' : 'offline',
        blockHeight: Math.floor(Math.random() * 1000000),
        lastUpdate: new Date(),
        responseTime: Math.floor(Math.random() * 1000),
        errorRate: Math.random() * 0.1
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  calculateOverallHealth(healthChecks) {
    const healthyCount = healthChecks.filter(check => check.status === 'healthy').length;
    const percentage = (healthyCount / healthChecks.length) * 100;
    
    if (percentage >= 90) return { status: 'healthy', score: percentage };
    if (percentage >= 70) return { status: 'warning', score: percentage };
    return { status: 'critical', score: percentage };
  }

  async getDatabaseHealth() {
    try {
      const start = Date.now();
      await db.sequelize.authenticate();
      const responseTime = Date.now() - start;
      
      return {
        status: responseTime < 1000 ? 'healthy' : 'warning',
        responseTime,
        connections: 'active'
      };
    } catch (error) {
      return {
        status: 'critical',
        error: error.message
      };
    }
  }

  async getAPIHealth() {
    // Mock API health check
    return {
      status: 'healthy',
      responseTime: Math.floor(Math.random() * 500),
      requestsPerMinute: Math.floor(Math.random() * 1000),
      errorRate: Math.random() * 0.05
    };
  }

  async getBlockchainHealth() {
    const healthyChains = this.supportedChains.filter(() => Math.random() > 0.1).length;
    const percentage = (healthyChains / this.supportedChains.length) * 100;
    
    return {
      status: percentage >= 80 ? 'healthy' : percentage >= 60 ? 'warning' : 'critical',
      healthyChains,
      totalChains: this.supportedChains.length,
      percentage
    };
  }

  async getServerMetrics() {
    return {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      diskUsage: Math.random() * 100,
      uptime: process.uptime(),
      loadAverage: [Math.random(), Math.random(), Math.random()]
    };
  }

  async getRecentErrorLogs() {
    // This would integrate with actual logging system
    return [
      {
        timestamp: new Date(),
        level: 'error',
        message: 'Sample error message',
        service: 'blockchain-adapter',
        count: 1
      }
    ];
  }

  // Additional helper methods would be implemented here...
  async getTotalTransactions(timeRanges) {
    return await db.nft_transactions.count({
      where: {
        timestamp: {
          [Op.gte]: timeRanges.start,
          [Op.lte]: timeRanges.end
        }
      }
    });
  }

  async getTransactionsByType(timeRanges) {
    const result = await db.nft_transactions.findAll({
      where: {
        timestamp: {
          [Op.gte]: timeRanges.start,
          [Op.lte]: timeRanges.end
        }
      },
      group: ['transaction_type'],
      attributes: [
        'transaction_type',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
      ]
    });

    return result.map(item => ({
      type: item.transaction_type,
      count: parseInt(item.dataValues.count)
    }));
  }

  async getTransactionsByChain(timeRanges) {
    const result = await db.nft_transactions.findAll({
      where: {
        timestamp: {
          [Op.gte]: timeRanges.start,
          [Op.lte]: timeRanges.end
        }
      },
      group: ['blockchain'],
      attributes: [
        'blockchain',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
      ]
    });

    return result.map(item => ({
      chain: item.blockchain,
      count: parseInt(item.dataValues.count)
    }));
  }

  async getVolumeByChain(timeRanges) {
    const result = await db.nft_transactions.findAll({
      where: {
        timestamp: {
          [Op.gte]: timeRanges.start,
          [Op.lte]: timeRanges.end
        }
      },
      group: ['blockchain'],
      attributes: [
        'blockchain',
        [db.sequelize.fn('SUM', db.sequelize.col('price')), 'volume']
      ]
    });

    return result.map(item => ({
      chain: item.blockchain,
      volume: parseFloat(item.dataValues.volume || 0)
    }));
  }

  async getHourlyTransactions(timeRanges) {
    const result = await db.nft_transactions.findAll({
      where: {
        timestamp: {
          [Op.gte]: timeRanges.start,
          [Op.lte]: timeRanges.end
        }
      },
      group: [db.sequelize.fn('DATE_TRUNC', 'hour', db.sequelize.col('timestamp'))],
      attributes: [
        [db.sequelize.fn('DATE_TRUNC', 'hour', db.sequelize.col('timestamp')), 'hour'],
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
      ],
      order: [[db.sequelize.fn('DATE_TRUNC', 'hour', db.sequelize.col('timestamp')), 'ASC']]
    });

    return result.map(item => ({
      hour: item.dataValues.hour,
      count: parseInt(item.dataValues.count)
    }));
  }

  async getFailedTransactions(timeRanges) {
    // This would track failed transactions - for now return 0
    return 0;
  }

  async getActiveUsers(timeRanges) {
    return await db.users.count({
      where: {
        updated_at: {
          [Op.gte]: timeRanges.start,
          [Op.lte]: timeRanges.end
        }
      }
    });
  }

  async getNewUsers(timeRanges) {
    return await db.users.count({
      where: {
        created_at: {
          [Op.gte]: timeRanges.start,
          [Op.lte]: timeRanges.end
        }
      }
    });
  }

  async getUsersByChain(timeRanges) {
    // This would require tracking user activity by chain
    // For now return mock data
    return this.supportedChains.map(chain => ({
      chain,
      users: Math.floor(Math.random() * 1000)
    }));
  }

  async getKYCStatistics() {
    const result = await db.creator_verifications.findAll({
      group: ['status'],
      attributes: [
        'status',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
      ]
    });

    return result.map(item => ({
      status: item.status,
      count: parseInt(item.dataValues.count)
    }));
  }

  async getUserGrowthData(timeRanges) {
    // This would return user growth over time
    return [];
  }

  calculateRetentionRate(timeRanges) {
    // This would calculate user retention rate
    return Math.random() * 100;
  }

  async getNFTsByChain() {
    const result = await db.nfts.findAll({
      group: ['blockchain'],
      attributes: [
        'blockchain',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
      ]
    });

    return result.map(item => ({
      chain: item.blockchain,
      count: parseInt(item.dataValues.count)
    }));
  }

  async getNFTSalesData(timeRanges) {
    const result = await db.nft_transactions.findOne({
      where: {
        transaction_type: ['SALE', 'AUCTION_WIN'],
        timestamp: {
          [Op.gte]: timeRanges.start,
          [Op.lte]: timeRanges.end
        }
      },
      attributes: [
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'totalSales'],
        [db.sequelize.fn('SUM', db.sequelize.col('price')), 'totalVolume']
      ]
    });

    return {
      totalSales: parseInt(result?.dataValues?.totalSales || 0),
      totalVolume: parseFloat(result?.dataValues?.totalVolume || 0)
    };
  }

  async getTopCollections(timeRanges, limit = 10) {
    const result = await db.nft_transactions.findAll({
      where: {
        timestamp: {
          [Op.gte]: timeRanges.start,
          [Op.lte]: timeRanges.end
        }
      },
      include: [
        {
          model: db.nfts,
          as: 'nft',
          include: [
            { model: db.nft_collections, as: 'collection' }
          ]
        }
      ],
      group: ['nft.collection.id'],
      attributes: [
        [db.sequelize.fn('COUNT', db.sequelize.col('nft_transactions.id')), 'sales'],
        [db.sequelize.fn('SUM', db.sequelize.col('price')), 'volume']
      ],
      order: [[db.sequelize.fn('SUM', db.sequelize.col('price')), 'DESC']],
      limit
    });

    return result.map(item => ({
      collection: item.nft?.collection?.name,
      sales: parseInt(item.dataValues.sales),
      volume: parseFloat(item.dataValues.volume)
    }));
  }

  async getMintingActivity(timeRanges) {
    const result = await db.nfts.findAll({
      where: {
        created_at: {
          [Op.gte]: timeRanges.start,
          [Op.lte]: timeRanges.end
        }
      },
      group: ['blockchain'],
      attributes: [
        'blockchain',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'mints']
      ]
    });

    return result.map(item => ({
      chain: item.blockchain,
      mints: parseInt(item.dataValues.mints)
    }));
  }
}

module.exports = EnhancedAdminDashboardService;

