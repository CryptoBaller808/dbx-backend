/**
 * Media Upload Service for NFT Marketplace
 * Handles IPFS and AWS S3 media storage for NFTs
 */

const AWS = require('aws-sdk');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

class MediaUploadService {
  constructor() {
    this.ipfsEnabled = process.env.IPFS_ENABLED === 'true';
    this.s3Enabled = process.env.AWS_S3_ENABLED === 'true';
    
    // Configure AWS S3
    if (this.s3Enabled) {
      this.s3 = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1'
      });
      this.bucketName = process.env.AWS_S3_BUCKET || 'dbx-nft-media';
    }

    // Configure IPFS (placeholder for actual IPFS integration)
    this.ipfsGateway = process.env.IPFS_GATEWAY || 'https://ipfs.io/ipfs/';
    this.ipfsApiUrl = process.env.IPFS_API_URL || 'http://localhost:5001';

    // Supported file types
    this.supportedImageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    this.supportedVideoTypes = ['.mp4', '.webm', '.mov', '.avi'];
    this.supportedAudioTypes = ['.mp3', '.wav', '.ogg', '.m4a'];
    this.supportedModelTypes = ['.glb', '.gltf', '.obj'];

    // File size limits (in bytes)
    this.maxImageSize = 50 * 1024 * 1024; // 50MB
    this.maxVideoSize = 500 * 1024 * 1024; // 500MB
    this.maxAudioSize = 100 * 1024 * 1024; // 100MB
    this.maxModelSize = 200 * 1024 * 1024; // 200MB
  }

  /**
   * Initialize the media upload service
   */
  async initialize() {
    try {
      // Create upload directories
      const uploadDir = path.join(__dirname, '../uploads');
      const tempDir = path.join(uploadDir, 'temp');
      const processedDir = path.join(uploadDir, 'processed');

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      if (!fs.existsSync(processedDir)) {
        fs.mkdirSync(processedDir, { recursive: true });
      }

      // Test S3 connection if enabled
      if (this.s3Enabled) {
        await this.testS3Connection();
      }

      // Test IPFS connection if enabled
      if (this.ipfsEnabled) {
        await this.testIPFSConnection();
      }

      console.log('[MediaUploadService] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[MediaUploadService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Configure multer for file uploads
   */
  getMulterConfig() {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/temp');
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + fileExtension);
      }
    });

    const fileFilter = (req, file, cb) => {
      const fileExtension = path.extname(file.originalname).toLowerCase();
      const allSupportedTypes = [
        ...this.supportedImageTypes,
        ...this.supportedVideoTypes,
        ...this.supportedAudioTypes,
        ...this.supportedModelTypes
      ];

      if (allSupportedTypes.includes(fileExtension)) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported file type: ${fileExtension}`), false);
      }
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: this.maxVideoSize // Use largest limit, we'll check specific limits later
      }
    });
  }

  /**
   * Upload media file
   */
  async uploadMedia(file, options = {}) {
    try {
      const { userId, collectionId, nftId, mediaType } = options;

      // Validate file
      await this.validateFile(file);

      // Generate unique filename
      const fileHash = await this.generateFileHash(file.path);
      const fileExtension = path.extname(file.originalname);
      const uniqueFilename = `${fileHash}${fileExtension}`;

      // Determine storage path
      const storagePath = this.generateStoragePath(userId, collectionId, nftId, uniqueFilename);

      // Upload to primary storage
      let primaryUrl, primaryHash;
      if (this.ipfsEnabled) {
        const ipfsResult = await this.uploadToIPFS(file.path, uniqueFilename);
        primaryUrl = `${this.ipfsGateway}${ipfsResult.hash}`;
        primaryHash = ipfsResult.hash;
      } else if (this.s3Enabled) {
        const s3Result = await this.uploadToS3(file.path, storagePath);
        primaryUrl = s3Result.url;
        primaryHash = s3Result.etag;
      } else {
        throw new Error('No storage backend enabled');
      }

      // Upload to backup storage if both are enabled
      let backupUrl, backupHash;
      if (this.ipfsEnabled && this.s3Enabled) {
        if (primaryHash.startsWith('Qm')) { // Primary was IPFS
          const s3Result = await this.uploadToS3(file.path, storagePath);
          backupUrl = s3Result.url;
          backupHash = s3Result.etag;
        } else { // Primary was S3
          const ipfsResult = await this.uploadToIPFS(file.path, uniqueFilename);
          backupUrl = `${this.ipfsGateway}${ipfsResult.hash}`;
          backupHash = ipfsResult.hash;
        }
      }

      // Process media (generate thumbnails, optimize, etc.)
      const processedMedia = await this.processMedia(file, mediaType);

      // Clean up temporary file
      fs.unlinkSync(file.path);

      const result = {
        originalFilename: file.originalname,
        filename: uniqueFilename,
        fileHash,
        size: file.size,
        mimeType: file.mimetype,
        mediaType: this.getMediaType(file),
        primaryUrl,
        primaryHash,
        backupUrl,
        backupHash,
        storagePath,
        processedMedia,
        uploadedAt: new Date()
      };

      console.log(`[MediaUploadService] Media uploaded: ${uniqueFilename}`);
      return result;
    } catch (error) {
      // Clean up temporary file on error
      if (file && file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      console.error('[MediaUploadService] Media upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload metadata to IPFS
   */
  async uploadMetadata(metadata) {
    try {
      if (!this.ipfsEnabled) {
        throw new Error('IPFS is not enabled');
      }

      const metadataJson = JSON.stringify(metadata, null, 2);
      const tempFilePath = path.join(__dirname, '../uploads/temp', `metadata-${Date.now()}.json`);
      
      fs.writeFileSync(tempFilePath, metadataJson);

      const ipfsResult = await this.uploadToIPFS(tempFilePath, 'metadata.json');
      
      // Clean up temporary file
      fs.unlinkSync(tempFilePath);

      const result = {
        metadataUrl: `${this.ipfsGateway}${ipfsResult.hash}`,
        metadataHash: ipfsResult.hash,
        metadata,
        uploadedAt: new Date()
      };

      console.log(`[MediaUploadService] Metadata uploaded to IPFS: ${ipfsResult.hash}`);
      return result;
    } catch (error) {
      console.error('[MediaUploadService] Metadata upload failed:', error);
      throw error;
    }
  }

  /**
   * Validate uploaded file
   */
  async validateFile(file) {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const fileSize = file.size;

    // Check file type and size limits
    if (this.supportedImageTypes.includes(fileExtension)) {
      if (fileSize > this.maxImageSize) {
        throw new Error(`Image file too large. Maximum size: ${this.maxImageSize / (1024 * 1024)}MB`);
      }
    } else if (this.supportedVideoTypes.includes(fileExtension)) {
      if (fileSize > this.maxVideoSize) {
        throw new Error(`Video file too large. Maximum size: ${this.maxVideoSize / (1024 * 1024)}MB`);
      }
    } else if (this.supportedAudioTypes.includes(fileExtension)) {
      if (fileSize > this.maxAudioSize) {
        throw new Error(`Audio file too large. Maximum size: ${this.maxAudioSize / (1024 * 1024)}MB`);
      }
    } else if (this.supportedModelTypes.includes(fileExtension)) {
      if (fileSize > this.maxModelSize) {
        throw new Error(`3D model file too large. Maximum size: ${this.maxModelSize / (1024 * 1024)}MB`);
      }
    } else {
      throw new Error(`Unsupported file type: ${fileExtension}`);
    }

    return true;
  }

  /**
   * Generate file hash
   */
  async generateFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => {
        hash.update(data);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Generate storage path
   */
  generateStoragePath(userId, collectionId, nftId, filename) {
    const datePath = new Date().toISOString().slice(0, 7); // YYYY-MM
    return `nft-media/${datePath}/${userId}/${collectionId || 'misc'}/${nftId || 'collection'}/${filename}`;
  }

  /**
   * Get media type from file
   */
  getMediaType(file) {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (this.supportedImageTypes.includes(fileExtension)) {
      return 'image';
    } else if (this.supportedVideoTypes.includes(fileExtension)) {
      return 'video';
    } else if (this.supportedAudioTypes.includes(fileExtension)) {
      return 'audio';
    } else if (this.supportedModelTypes.includes(fileExtension)) {
      return 'model';
    }
    
    return 'unknown';
  }

  /**
   * Upload to IPFS (placeholder implementation)
   */
  async uploadToIPFS(filePath, filename) {
    // This is a placeholder implementation
    // In a real implementation, you would use an IPFS client library
    // like ipfs-http-client or kubo-rpc-client
    
    try {
      // Simulate IPFS upload
      const fileContent = fs.readFileSync(filePath);
      const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
      const ipfsHash = `Qm${hash.substring(0, 44)}`; // Simulate IPFS hash format

      console.log(`[MediaUploadService] Simulated IPFS upload: ${filename} -> ${ipfsHash}`);
      
      return {
        hash: ipfsHash,
        size: fileContent.length,
        filename
      };
    } catch (error) {
      console.error('[MediaUploadService] IPFS upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload to AWS S3
   */
  async uploadToS3(filePath, storagePath) {
    try {
      if (!this.s3Enabled) {
        throw new Error('S3 is not enabled');
      }

      const fileContent = fs.readFileSync(filePath);
      const contentType = this.getContentType(filePath);

      const uploadParams = {
        Bucket: this.bucketName,
        Key: storagePath,
        Body: fileContent,
        ContentType: contentType,
        ACL: 'public-read'
      };

      const result = await this.s3.upload(uploadParams).promise();

      console.log(`[MediaUploadService] S3 upload successful: ${storagePath}`);
      
      return {
        url: result.Location,
        etag: result.ETag,
        key: result.Key
      };
    } catch (error) {
      console.error('[MediaUploadService] S3 upload failed:', error);
      throw error;
    }
  }

  /**
   * Process media (generate thumbnails, optimize, etc.)
   */
  async processMedia(file, mediaType) {
    try {
      const processed = {
        thumbnails: [],
        optimized: null,
        metadata: {}
      };

      const fileType = this.getMediaType(file);

      switch (fileType) {
        case 'image':
          processed.thumbnails = await this.generateImageThumbnails(file);
          processed.optimized = await this.optimizeImage(file);
          processed.metadata = await this.extractImageMetadata(file);
          break;
        case 'video':
          processed.thumbnails = await this.generateVideoThumbnails(file);
          processed.metadata = await this.extractVideoMetadata(file);
          break;
        case 'audio':
          processed.metadata = await this.extractAudioMetadata(file);
          break;
        case 'model':
          processed.thumbnails = await this.generate3DModelThumbnails(file);
          processed.metadata = await this.extract3DModelMetadata(file);
          break;
      }

      return processed;
    } catch (error) {
      console.error('[MediaUploadService] Media processing failed:', error);
      // Don't throw error for processing failures, just log and return empty
      return {
        thumbnails: [],
        optimized: null,
        metadata: {}
      };
    }
  }

  /**
   * Generate image thumbnails (placeholder)
   */
  async generateImageThumbnails(file) {
    // Placeholder for image thumbnail generation
    // In a real implementation, you would use libraries like sharp or jimp
    return [
      { size: '150x150', url: null },
      { size: '300x300', url: null },
      { size: '600x600', url: null }
    ];
  }

  /**
   * Optimize image (placeholder)
   */
  async optimizeImage(file) {
    // Placeholder for image optimization
    return null;
  }

  /**
   * Extract image metadata (placeholder)
   */
  async extractImageMetadata(file) {
    // Placeholder for image metadata extraction
    return {
      width: null,
      height: null,
      format: path.extname(file.originalname).substring(1),
      colorSpace: null
    };
  }

  /**
   * Generate video thumbnails (placeholder)
   */
  async generateVideoThumbnails(file) {
    // Placeholder for video thumbnail generation
    return [
      { time: '00:00:01', url: null },
      { time: '00:00:05', url: null },
      { time: '00:00:10', url: null }
    ];
  }

  /**
   * Extract video metadata (placeholder)
   */
  async extractVideoMetadata(file) {
    // Placeholder for video metadata extraction
    return {
      duration: null,
      width: null,
      height: null,
      format: path.extname(file.originalname).substring(1),
      bitrate: null
    };
  }

  /**
   * Extract audio metadata (placeholder)
   */
  async extractAudioMetadata(file) {
    // Placeholder for audio metadata extraction
    return {
      duration: null,
      format: path.extname(file.originalname).substring(1),
      bitrate: null,
      sampleRate: null
    };
  }

  /**
   * Generate 3D model thumbnails (placeholder)
   */
  async generate3DModelThumbnails(file) {
    // Placeholder for 3D model thumbnail generation
    return [
      { angle: 'front', url: null },
      { angle: 'side', url: null },
      { angle: 'top', url: null }
    ];
  }

  /**
   * Extract 3D model metadata (placeholder)
   */
  async extract3DModelMetadata(file) {
    // Placeholder for 3D model metadata extraction
    return {
      format: path.extname(file.originalname).substring(1),
      vertices: null,
      faces: null,
      materials: null
    };
  }

  /**
   * Get content type for file
   */
  getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/mp4',
      '.glb': 'model/gltf-binary',
      '.gltf': 'model/gltf+json',
      '.obj': 'model/obj'
    };
    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Test S3 connection
   */
  async testS3Connection() {
    try {
      await this.s3.headBucket({ Bucket: this.bucketName }).promise();
      console.log('[MediaUploadService] S3 connection successful');
    } catch (error) {
      console.error('[MediaUploadService] S3 connection failed:', error);
      throw error;
    }
  }

  /**
   * Test IPFS connection (placeholder)
   */
  async testIPFSConnection() {
    try {
      // Placeholder for IPFS connection test
      console.log('[MediaUploadService] IPFS connection test (simulated)');
    } catch (error) {
      console.error('[MediaUploadService] IPFS connection failed:', error);
      throw error;
    }
  }

  /**
   * Delete media file
   */
  async deleteMedia(storagePath, ipfsHash) {
    try {
      const results = [];

      // Delete from S3 if enabled
      if (this.s3Enabled && storagePath) {
        try {
          await this.s3.deleteObject({
            Bucket: this.bucketName,
            Key: storagePath
          }).promise();
          results.push({ storage: 'S3', success: true });
        } catch (error) {
          results.push({ storage: 'S3', success: false, error: error.message });
        }
      }

      // Delete from IPFS (note: IPFS doesn't support deletion, files are garbage collected)
      if (this.ipfsEnabled && ipfsHash) {
        // IPFS doesn't support direct deletion
        results.push({ storage: 'IPFS', success: true, note: 'IPFS files are garbage collected automatically' });
      }

      console.log('[MediaUploadService] Media deletion completed:', results);
      return results;
    } catch (error) {
      console.error('[MediaUploadService] Media deletion failed:', error);
      throw error;
    }
  }
}

module.exports = MediaUploadService;

