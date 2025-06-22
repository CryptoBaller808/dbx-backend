/**
 * NFT Marketplace API Routes
 * Handles collection creation, NFT minting, and media upload endpoints
 */

const express = require('express');
const NFTMintingService = require('../services/NFTMintingService');
const { auditLogger } = require('../services/auditLogger');

const router = express.Router();
let mintingService;

// Initialize minting service
const initializeMintingService = async () => {
  if (!mintingService) {
    mintingService = new NFTMintingService();
    await mintingService.initialize();
  }
  return mintingService;
};

// Middleware to ensure minting service is initialized
const ensureMintingService = async (req, res, next) => {
  try {
    await initializeMintingService();
    next();
  } catch (error) {
    console.error('[NFT Routes] Service initialization failed:', error);
    res.status(500).json({
      success: false,
      error: 'Service initialization failed',
      message: error.message
    });
  }
};

// Configure multer for file uploads
const getUploadMiddleware = () => {
  if (!mintingService) {
    throw new Error('Minting service not initialized');
  }
  return mintingService.mediaService.getMulterConfig();
};

/**
 * @route GET /api/nft/supported-chains
 * @desc Get supported blockchain networks
 * @access Public
 */
router.get('/supported-chains', ensureMintingService, async (req, res) => {
  try {
    const chains = mintingService.nftService.getSupportedChains();
    
    res.json({
      success: true,
      data: {
        chains,
        count: chains.length
      }
    });
  } catch (error) {
    console.error('[NFT Routes] Get supported chains failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get supported chains',
      message: error.message
    });
  }
});

/**
 * @route GET /api/nft/file-types
 * @desc Get supported file types and size limits
 * @access Public
 */
router.get('/file-types', ensureMintingService, async (req, res) => {
  try {
    const fileTypes = mintingService.getSupportedFileTypes();
    
    res.json({
      success: true,
      data: fileTypes
    });
  } catch (error) {
    console.error('[NFT Routes] Get file types failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get file types',
      message: error.message
    });
  }
});

/**
 * @route POST /api/nft/collections
 * @desc Create a new NFT collection
 * @access Private
 */
router.post('/collections', ensureMintingService, async (req, res) => {
  try {
    const upload = getUploadMiddleware();
    
    // Handle file uploads
    upload.fields([
      { name: 'logo', maxCount: 1 },
      { name: 'banner', maxCount: 1 }
    ])(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: 'File upload failed',
          message: err.message
        });
      }

      try {
        const userId = req.user?.id || req.body.user_id; // Assuming user auth middleware
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: 'User authentication required'
          });
        }

        const logoFile = req.files?.logo?.[0];
        const bannerFile = req.files?.banner?.[0];

        const result = await mintingService.createCollection(
          req.body,
          logoFile,
          bannerFile,
          userId
        );

        // Log collection creation
        await auditLogger.logUserActivity(userId, 'NFT_COLLECTION_CREATED', {
          collection_id: result.collection.id,
          collection_name: result.collection.name,
          blockchain: result.collection.blockchain
        });

        res.status(201).json({
          success: true,
          data: result
        });
      } catch (error) {
        console.error('[NFT Routes] Collection creation failed:', error);
        res.status(500).json({
          success: false,
          error: 'Collection creation failed',
          message: error.message
        });
      }
    });
  } catch (error) {
    console.error('[NFT Routes] Collection creation setup failed:', error);
    res.status(500).json({
      success: false,
      error: 'Collection creation setup failed',
      message: error.message
    });
  }
});

/**
 * @route POST /api/nft/collections/:id/deploy-preview
 * @desc Get deployment preview with gas estimation
 * @access Private
 */
router.post('/collections/:id/deploy-preview', ensureMintingService, async (req, res) => {
  try {
    const { id } = req.params;
    const { deployerAddress, userWalletAddress } = req.body;
    const userId = req.user?.id || req.body.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    if (!deployerAddress) {
      return res.status(400).json({
        success: false,
        error: 'Deployer address is required'
      });
    }

    const preview = await mintingService.deployCollection(id, deployerAddress, userWalletAddress);

    res.json({
      success: true,
      data: preview
    });
  } catch (error) {
    console.error('[NFT Routes] Deployment preview failed:', error);
    res.status(500).json({
      success: false,
      error: 'Deployment preview failed',
      message: error.message
    });
  }
});

/**
 * @route POST /api/nft/collections/:id/deploy
 * @desc Deploy NFT collection contract
 * @access Private
 */
router.post('/collections/:id/deploy', ensureMintingService, async (req, res) => {
  try {
    const { id } = req.params;
    const { deployerAddress, gasSettings } = req.body;
    const userId = req.user?.id || req.body.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    if (!deployerAddress) {
      return res.status(400).json({
        success: false,
        error: 'Deployer address is required'
      });
    }

    const result = await mintingService.executeDeployment(id, deployerAddress, gasSettings);

    // Log collection deployment
    await auditLogger.logUserActivity(userId, 'NFT_COLLECTION_DEPLOYED', {
      collection_id: id,
      contract_address: result.deployResult.contractAddress,
      transaction_hash: result.deployResult.transactionHash
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[NFT Routes] Collection deployment failed:', error);
    res.status(500).json({
      success: false,
      error: 'Collection deployment failed',
      message: error.message
    });
  }
});

/**
 * @route POST /api/nft/create
 * @desc Create a new NFT with media upload
 * @access Private
 */
router.post('/create', ensureMintingService, async (req, res) => {
  try {
    const upload = getUploadMiddleware();
    
    // Handle file uploads
    upload.fields([
      { name: 'image', maxCount: 1 },
      { name: 'animation', maxCount: 1 }
    ])(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: 'File upload failed',
          message: err.message
        });
      }

      try {
        const userId = req.user?.id || req.body.user_id;
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: 'User authentication required'
          });
        }

        const imageFile = req.files?.image?.[0];
        const animationFile = req.files?.animation?.[0];

        if (!imageFile) {
          return res.status(400).json({
            success: false,
            error: 'Image file is required'
          });
        }

        // Parse attributes if provided as JSON string
        let attributes = [];
        if (req.body.attributes) {
          try {
            attributes = JSON.parse(req.body.attributes);
          } catch (e) {
            return res.status(400).json({
              success: false,
              error: 'Invalid attributes format'
            });
          }
        }

        const nftData = {
          ...req.body,
          attributes
        };

        const result = await mintingService.createNFT(
          nftData,
          imageFile,
          animationFile,
          userId
        );

        // Log NFT creation
        await auditLogger.logUserActivity(userId, 'NFT_CREATED', {
          nft_id: result.nft.id,
          nft_name: result.nft.name,
          collection_id: result.nft.collection_id
        });

        res.status(201).json({
          success: true,
          data: result
        });
      } catch (error) {
        console.error('[NFT Routes] NFT creation failed:', error);
        res.status(500).json({
          success: false,
          error: 'NFT creation failed',
          message: error.message
        });
      }
    });
  } catch (error) {
    console.error('[NFT Routes] NFT creation setup failed:', error);
    res.status(500).json({
      success: false,
      error: 'NFT creation setup failed',
      message: error.message
    });
  }
});

/**
 * @route POST /api/nft/:id/mint-preview
 * @desc Get minting preview with gas estimation
 * @access Private
 */
router.post('/:id/mint-preview', ensureMintingService, async (req, res) => {
  try {
    const { id } = req.params;
    const { minterAddress } = req.body;
    const userId = req.user?.id || req.body.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    if (!minterAddress) {
      return res.status(400).json({
        success: false,
        error: 'Minter address is required'
      });
    }

    const preview = await mintingService.generateMintingPreview(id, minterAddress);

    res.json({
      success: true,
      data: preview
    });
  } catch (error) {
    console.error('[NFT Routes] Minting preview failed:', error);
    res.status(500).json({
      success: false,
      error: 'Minting preview failed',
      message: error.message
    });
  }
});

/**
 * @route POST /api/nft/:id/mint
 * @desc Mint NFT on blockchain
 * @access Private
 */
router.post('/:id/mint', ensureMintingService, async (req, res) => {
  try {
    const { id } = req.params;
    const { minterAddress, gasSettings } = req.body;
    const userId = req.user?.id || req.body.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    if (!minterAddress) {
      return res.status(400).json({
        success: false,
        error: 'Minter address is required'
      });
    }

    const result = await mintingService.executeNFTMinting(id, minterAddress, gasSettings);

    // Log NFT minting
    await auditLogger.logUserActivity(userId, 'NFT_MINTED', {
      nft_id: id,
      token_id: result.mintResult.tokenId,
      transaction_hash: result.mintResult.transactionHash
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[NFT Routes] NFT minting failed:', error);
    res.status(500).json({
      success: false,
      error: 'NFT minting failed',
      message: error.message
    });
  }
});

/**
 * @route POST /api/nft/batch-mint
 * @desc Batch mint multiple NFTs
 * @access Private
 */
router.post('/batch-mint', ensureMintingService, async (req, res) => {
  try {
    const { nftIds, minterAddress, gasSettings } = req.body;
    const userId = req.user?.id || req.body.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    if (!nftIds || !Array.isArray(nftIds) || nftIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'NFT IDs array is required'
      });
    }

    if (!minterAddress) {
      return res.status(400).json({
        success: false,
        error: 'Minter address is required'
      });
    }

    const result = await mintingService.batchMintNFTs(nftIds, minterAddress, gasSettings);

    // Log batch minting
    await auditLogger.logUserActivity(userId, 'NFT_BATCH_MINTED', {
      nft_count: nftIds.length,
      successful: result.successful.length,
      failed: result.failed.length
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[NFT Routes] Batch minting failed:', error);
    res.status(500).json({
      success: false,
      error: 'Batch minting failed',
      message: error.message
    });
  }
});

/**
 * @route GET /api/nft/:id/metadata
 * @desc Get NFT metadata
 * @access Public
 */
router.get('/:id/metadata', ensureMintingService, async (req, res) => {
  try {
    const { id } = req.params;

    const metadata = await mintingService.nftService.getNFTMetadata(id);

    res.json({
      success: true,
      data: metadata
    });
  } catch (error) {
    console.error('[NFT Routes] Get metadata failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get metadata',
      message: error.message
    });
  }
});

/**
 * @route GET /api/nft/statistics
 * @desc Get minting statistics
 * @access Private
 */
router.get('/statistics', ensureMintingService, async (req, res) => {
  try {
    const userId = req.user?.id || req.query.user_id;

    const stats = await mintingService.getMintingStatistics(userId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[NFT Routes] Get statistics failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics',
      message: error.message
    });
  }
});

/**
 * @route POST /api/nft/upload-media
 * @desc Upload media file for NFT
 * @access Private
 */
router.post('/upload-media', ensureMintingService, async (req, res) => {
  try {
    const upload = getUploadMiddleware();
    
    upload.single('media')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: 'File upload failed',
          message: err.message
        });
      }

      try {
        const userId = req.user?.id || req.body.user_id;
        if (!userId) {
          return res.status(401).json({
            success: false,
            error: 'User authentication required'
          });
        }

        if (!req.file) {
          return res.status(400).json({
            success: false,
            error: 'Media file is required'
          });
        }

        const options = {
          userId,
          collectionId: req.body.collection_id,
          nftId: req.body.nft_id,
          mediaType: req.body.media_type
        };

        const result = await mintingService.mediaService.uploadMedia(req.file, options);

        res.json({
          success: true,
          data: result
        });
      } catch (error) {
        console.error('[NFT Routes] Media upload failed:', error);
        res.status(500).json({
          success: false,
          error: 'Media upload failed',
          message: error.message
        });
      }
    });
  } catch (error) {
    console.error('[NFT Routes] Media upload setup failed:', error);
    res.status(500).json({
      success: false,
      error: 'Media upload setup failed',
      message: error.message
    });
  }
});

module.exports = { router, initializeMintingService };

