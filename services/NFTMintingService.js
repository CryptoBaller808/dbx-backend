/**
 * NFT Minting Service
 * Handles the complete NFT minting workflow with gas estimation and transaction preview
 */

const MultiChainNFTService = require('./MultiChainNFTService');
const MediaUploadService = require('./MediaUploadService');
const db = require('../models');

class NFTMintingService {
  constructor() {
    this.nftService = new MultiChainNFTService();
    this.mediaService = new MediaUploadService();
    this.gasEstimationCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Initialize the minting service
   */
  async initialize() {
    try {
      await this.nftService.initialize();
      await this.mediaService.initialize();
      console.log('[NFTMintingService] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[NFTMintingService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create a new NFT collection with media upload
   */
  async createCollection(collectionData, logoFile, bannerFile, userId) {
    try {
      const {
        name,
        symbol,
        description,
        blockchain,
        category_id,
        max_supply,
        mint_price,
        mint_price_currency,
        default_royalty_percentage,
        royalty_recipients,
        external_url,
        discord_url,
        twitter_url,
        instagram_url
      } = collectionData;

      // Upload logo image
      let logoResult = null;
      if (logoFile) {
        logoResult = await this.mediaService.uploadMedia(logoFile, {
          userId,
          mediaType: 'collection_logo'
        });
      }

      // Upload banner image
      let bannerResult = null;
      if (bannerFile) {
        bannerResult = await this.mediaService.uploadMedia(bannerFile, {
          userId,
          mediaType: 'collection_banner'
        });
      }

      // Create collection in database
      const collection = await this.nftService.createCollection({
        name,
        symbol,
        description,
        blockchain,
        creator_id: userId,
        category_id,
        logo_image_url: logoResult?.primaryUrl,
        logo_ipfs_hash: logoResult?.primaryHash,
        banner_image_url: bannerResult?.primaryUrl,
        banner_ipfs_hash: bannerResult?.primaryHash,
        max_supply,
        mint_price,
        mint_price_currency,
        default_royalty_percentage,
        royalty_recipients,
        external_url,
        discord_url,
        twitter_url,
        instagram_url
      });

      console.log(`[NFTMintingService] Collection created: ${collection.id}`);
      return {
        collection,
        logoUpload: logoResult,
        bannerUpload: bannerResult
      };
    } catch (error) {
      console.error('[NFTMintingService] Collection creation failed:', error);
      throw error;
    }
  }

  /**
   * Deploy collection contract with gas estimation
   */
  async deployCollection(collectionId, deployerAddress, userWalletAddress) {
    try {
      const collection = await db.nft_collections.findByPk(collectionId);
      if (!collection) {
        throw new Error('Collection not found');
      }

      // Estimate gas for deployment
      const gasEstimation = await this.estimateDeploymentGas(collection, deployerAddress);

      // Create deployment preview
      const deploymentPreview = {
        collection: {
          id: collection.id,
          name: collection.name,
          symbol: collection.symbol,
          blockchain: collection.blockchain
        },
        deployment: {
          estimatedGas: gasEstimation.gasLimit,
          estimatedGasPrice: gasEstimation.gasPrice,
          estimatedCost: gasEstimation.estimatedCost,
          estimatedCostUSD: gasEstimation.estimatedCostUSD,
          currency: gasEstimation.currency
        },
        timeline: {
          estimatedDeploymentTime: gasEstimation.estimatedTime,
          confirmationTime: gasEstimation.confirmationTime
        }
      };

      console.log(`[NFTMintingService] Deployment preview generated for collection ${collectionId}`);
      return deploymentPreview;
    } catch (error) {
      console.error('[NFTMintingService] Deployment preview failed:', error);
      throw error;
    }
  }

  /**
   * Execute collection deployment
   */
  async executeDeployment(collectionId, deployerAddress, gasSettings = {}) {
    try {
      const collection = await db.nft_collections.findByPk(collectionId);
      if (!collection) {
        throw new Error('Collection not found');
      }

      // Deploy the collection
      const deployResult = await this.nftService.deployCollection(collectionId, deployerAddress);

      console.log(`[NFTMintingService] Collection deployed: ${collection.id}`);
      return deployResult;
    } catch (error) {
      console.error('[NFTMintingService] Collection deployment failed:', error);
      throw error;
    }
  }

  /**
   * Create NFT with media upload and metadata
   */
  async createNFT(nftData, imageFile, animationFile, userId) {
    try {
      const {
        collection_id,
        name,
        description,
        external_url,
        attributes,
        unlockable_content,
        royalty_percentage,
        royalty_recipients
      } = nftData;

      // Get collection
      const collection = await db.nft_collections.findByPk(collection_id);
      if (!collection) {
        throw new Error('Collection not found');
      }

      // Upload main image
      let imageResult = null;
      if (imageFile) {
        imageResult = await this.mediaService.uploadMedia(imageFile, {
          userId,
          collectionId: collection_id,
          mediaType: 'nft_image'
        });
      }

      // Upload animation file (video, audio, 3D model)
      let animationResult = null;
      if (animationFile) {
        animationResult = await this.mediaService.uploadMedia(animationFile, {
          userId,
          collectionId: collection_id,
          mediaType: 'nft_animation'
        });
      }

      // Create NFT metadata
      const metadata = {
        name,
        description,
        image: imageResult?.primaryUrl,
        animation_url: animationResult?.primaryUrl,
        external_url,
        attributes: attributes || [],
        properties: {
          creator: userId,
          collection: collection.name,
          blockchain: collection.blockchain
        }
      };

      // Upload metadata to IPFS
      const metadataResult = await this.mediaService.uploadMetadata(metadata);

      // Create NFT in database
      const nft = await this.nftService.mintNFT({
        collection_id,
        creator_id: userId,
        name,
        description,
        image_url: imageResult?.primaryUrl,
        image_ipfs_hash: imageResult?.primaryHash,
        animation_url: animationResult?.primaryUrl,
        animation_ipfs_hash: animationResult?.primaryHash,
        external_url,
        attributes: attributes || [],
        unlockable_content,
        royalty_percentage,
        royalty_recipients,
        metadata: metadataResult.metadata
      });

      console.log(`[NFTMintingService] NFT created: ${nft.id}`);
      return {
        nft,
        imageUpload: imageResult,
        animationUpload: animationResult,
        metadataUpload: metadataResult
      };
    } catch (error) {
      console.error('[NFTMintingService] NFT creation failed:', error);
      throw error;
    }
  }

  /**
   * Generate minting preview with gas estimation
   */
  async generateMintingPreview(nftId, minterAddress) {
    try {
      const nft = await db.nfts.findByPk(nftId, {
        include: [{ model: db.nft_collections, as: 'collection' }]
      });

      if (!nft) {
        throw new Error('NFT not found');
      }

      // Estimate gas for minting
      const gasEstimation = await this.estimateMintingGas(nft, minterAddress);

      // Create minting preview
      const mintingPreview = {
        nft: {
          id: nft.id,
          name: nft.name,
          description: nft.description,
          image_url: nft.image_url,
          blockchain: nft.blockchain
        },
        collection: {
          id: nft.collection.id,
          name: nft.collection.name,
          contract_address: nft.collection.contract_address
        },
        minting: {
          estimatedGas: gasEstimation.gasLimit,
          estimatedGasPrice: gasEstimation.gasPrice,
          estimatedCost: gasEstimation.estimatedCost,
          estimatedCostUSD: gasEstimation.estimatedCostUSD,
          currency: gasEstimation.currency
        },
        royalties: {
          percentage: nft.royalty_percentage,
          recipients: nft.royalty_recipients
        },
        timeline: {
          estimatedMintingTime: gasEstimation.estimatedTime,
          confirmationTime: gasEstimation.confirmationTime
        }
      };

      console.log(`[NFTMintingService] Minting preview generated for NFT ${nftId}`);
      return mintingPreview;
    } catch (error) {
      console.error('[NFTMintingService] Minting preview failed:', error);
      throw error;
    }
  }

  /**
   * Execute NFT minting on blockchain
   */
  async executeNFTMinting(nftId, minterAddress, gasSettings = {}) {
    try {
      const nft = await db.nfts.findByPk(nftId);
      if (!nft) {
        throw new Error('NFT not found');
      }

      // Mint the NFT on blockchain
      const mintResult = await this.nftService.mintNFTOnChain(nftId, minterAddress);

      console.log(`[NFTMintingService] NFT minted: ${nft.id}`);
      return mintResult;
    } catch (error) {
      console.error('[NFTMintingService] NFT minting failed:', error);
      throw error;
    }
  }

  /**
   * Batch mint multiple NFTs
   */
  async batchMintNFTs(nftIds, minterAddress, gasSettings = {}) {
    try {
      const results = [];
      const errors = [];

      for (const nftId of nftIds) {
        try {
          const result = await this.executeNFTMinting(nftId, minterAddress, gasSettings);
          results.push({ nftId, success: true, result });
        } catch (error) {
          errors.push({ nftId, success: false, error: error.message });
        }
      }

      console.log(`[NFTMintingService] Batch minting completed: ${results.length} success, ${errors.length} errors`);
      return {
        successful: results,
        failed: errors,
        totalProcessed: nftIds.length
      };
    } catch (error) {
      console.error('[NFTMintingService] Batch minting failed:', error);
      throw error;
    }
  }

  /**
   * Estimate gas for collection deployment
   */
  async estimateDeploymentGas(collection, deployerAddress) {
    try {
      const cacheKey = `deploy_${collection.blockchain}_${deployerAddress}`;
      const cached = this.gasEstimationCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
        return cached.data;
      }

      // Get current gas prices for the blockchain
      const gasData = await this.getCurrentGasData(collection.blockchain);

      // Estimate gas based on blockchain
      let gasLimit, estimatedTime, confirmationTime;
      switch (collection.blockchain) {
        case 'XRP':
          gasLimit = 12; // XRP drops
          estimatedTime = '3-5 seconds';
          confirmationTime = '3-5 seconds';
          break;
        case 'XLM':
          gasLimit = 100; // Stroops
          estimatedTime = '5-10 seconds';
          confirmationTime = '5-10 seconds';
          break;
        case 'SOL':
          gasLimit = 5000; // Lamports
          estimatedTime = '1-2 seconds';
          confirmationTime = '15-30 seconds';
          break;
        case 'XDC':
        case 'AVAX':
        case 'MATIC':
        case 'BNB':
        case 'ETH':
          gasLimit = 2500000; // Gas units for contract deployment
          estimatedTime = '30-60 seconds';
          confirmationTime = '1-5 minutes';
          break;
        default:
          throw new Error(`Gas estimation not implemented for ${collection.blockchain}`);
      }

      const estimatedCost = gasLimit * gasData.gasPrice;
      const estimatedCostUSD = estimatedCost * gasData.priceUSD;

      const estimation = {
        gasLimit,
        gasPrice: gasData.gasPrice,
        estimatedCost,
        estimatedCostUSD,
        currency: gasData.currency,
        estimatedTime,
        confirmationTime,
        timestamp: Date.now()
      };

      // Cache the estimation
      this.gasEstimationCache.set(cacheKey, {
        data: estimation,
        timestamp: Date.now()
      });

      return estimation;
    } catch (error) {
      console.error('[NFTMintingService] Gas estimation failed:', error);
      throw error;
    }
  }

  /**
   * Estimate gas for NFT minting
   */
  async estimateMintingGas(nft, minterAddress) {
    try {
      const cacheKey = `mint_${nft.blockchain}_${minterAddress}`;
      const cached = this.gasEstimationCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
        return cached.data;
      }

      // Get current gas prices for the blockchain
      const gasData = await this.getCurrentGasData(nft.blockchain);

      // Estimate gas based on blockchain
      let gasLimit, estimatedTime, confirmationTime;
      switch (nft.blockchain) {
        case 'XRP':
          gasLimit = 12; // XRP drops
          estimatedTime = '3-5 seconds';
          confirmationTime = '3-5 seconds';
          break;
        case 'XLM':
          gasLimit = 100; // Stroops
          estimatedTime = '5-10 seconds';
          confirmationTime = '5-10 seconds';
          break;
        case 'SOL':
          gasLimit = 5000; // Lamports
          estimatedTime = '1-2 seconds';
          confirmationTime = '15-30 seconds';
          break;
        case 'XDC':
        case 'AVAX':
        case 'MATIC':
        case 'BNB':
        case 'ETH':
          gasLimit = 150000; // Gas units for NFT minting
          estimatedTime = '15-30 seconds';
          confirmationTime = '1-3 minutes';
          break;
        default:
          throw new Error(`Gas estimation not implemented for ${nft.blockchain}`);
      }

      const estimatedCost = gasLimit * gasData.gasPrice;
      const estimatedCostUSD = estimatedCost * gasData.priceUSD;

      const estimation = {
        gasLimit,
        gasPrice: gasData.gasPrice,
        estimatedCost,
        estimatedCostUSD,
        currency: gasData.currency,
        estimatedTime,
        confirmationTime,
        timestamp: Date.now()
      };

      // Cache the estimation
      this.gasEstimationCache.set(cacheKey, {
        data: estimation,
        timestamp: Date.now()
      });

      return estimation;
    } catch (error) {
      console.error('[NFTMintingService] Gas estimation failed:', error);
      throw error;
    }
  }

  /**
   * Get current gas data for blockchain
   */
  async getCurrentGasData(blockchain) {
    try {
      // This would integrate with real gas price APIs
      // For now, return mock data
      const gasData = {
        'XRP': {
          gasPrice: 0.00001, // XRP
          currency: 'XRP',
          priceUSD: 0.50
        },
        'XLM': {
          gasPrice: 0.00001, // XLM
          currency: 'XLM',
          priceUSD: 0.10
        },
        'SOL': {
          gasPrice: 0.000005, // SOL
          currency: 'SOL',
          priceUSD: 20.00
        },
        'XDC': {
          gasPrice: 0.000000025, // XDC (25 Gwei equivalent)
          currency: 'XDC',
          priceUSD: 0.05
        },
        'AVAX': {
          gasPrice: 0.000000025, // AVAX (25 nAVAX)
          currency: 'AVAX',
          priceUSD: 25.00
        },
        'MATIC': {
          gasPrice: 0.00000003, // MATIC (30 Gwei)
          currency: 'MATIC',
          priceUSD: 0.80
        },
        'BNB': {
          gasPrice: 0.000000005, // BNB (5 Gwei)
          currency: 'BNB',
          priceUSD: 300.00
        },
        'ETH': {
          gasPrice: 0.00000002, // ETH (20 Gwei)
          currency: 'ETH',
          priceUSD: 2000.00
        }
      };

      return gasData[blockchain] || gasData['ETH'];
    } catch (error) {
      console.error('[NFTMintingService] Gas data fetch failed:', error);
      throw error;
    }
  }

  /**
   * Get minting statistics
   */
  async getMintingStatistics(userId = null) {
    try {
      const whereClause = userId ? { creator_id: userId } : {};

      const stats = await db.nfts.findAll({
        where: whereClause,
        attributes: [
          'blockchain',
          'status',
          [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
        ],
        group: ['blockchain', 'status'],
        raw: true
      });

      const collectionStats = await db.nft_collections.findAll({
        where: userId ? { creator_id: userId } : {},
        attributes: [
          'blockchain',
          'status',
          [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
        ],
        group: ['blockchain', 'status'],
        raw: true
      });

      return {
        nfts: stats,
        collections: collectionStats,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('[NFTMintingService] Statistics fetch failed:', error);
      throw error;
    }
  }

  /**
   * Get supported file types
   */
  getSupportedFileTypes() {
    return {
      images: this.mediaService.supportedImageTypes,
      videos: this.mediaService.supportedVideoTypes,
      audio: this.mediaService.supportedAudioTypes,
      models: this.mediaService.supportedModelTypes,
      maxSizes: {
        image: this.mediaService.maxImageSize,
        video: this.mediaService.maxVideoSize,
        audio: this.mediaService.maxAudioSize,
        model: this.mediaService.maxModelSize
      }
    };
  }
}

module.exports = NFTMintingService;

