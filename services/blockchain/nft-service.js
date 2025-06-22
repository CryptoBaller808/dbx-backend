/**
 * NFT Service Implementation
 * 
 * Provides NFT operations across all supported blockchains.
 */

const { BlockchainError, ErrorCodes } = require('./blockchain-abstraction-layer');

class NFTService {
  constructor(adapterRegistry, nftRepository) {
    this.adapterRegistry = adapterRegistry;
    this.nftRepository = nftRepository;
  }

  /**
   * Mint a new NFT
   * @param {string} chainId - Chain identifier
   * @param {Object} nftData - NFT metadata and parameters
   * @param {Object} mintOptions - Minting options
   * @returns {Promise<Object>} Minting result
   */
  async mintNFT(chainId, nftData, mintOptions = {}) {
    try {
      const adapter = this.adapterRegistry.getAdapter(chainId);
      
      // Check if adapter supports NFT minting
      if (typeof adapter.mintNFT !== 'function') {
        throw new BlockchainError(
          `NFT minting not supported for chain: ${chainId}`,
          ErrorCodes.NOT_SUPPORTED,
          chainId
        );
      }
      
      // Mint NFT
      const result = await adapter.mintNFT(nftData, mintOptions);
      
      // Record in database
      await this._recordNFT(chainId, result, nftData);
      
      return result;
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to mint NFT: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        chainId,
        error
      );
    }
  }

  /**
   * Transfer an NFT
   * @param {string} chainId - Chain identifier
   * @param {string} tokenId - NFT token ID
   * @param {string} fromAddress - Sender address
   * @param {string} toAddress - Recipient address
   * @param {Object} transferOptions - Transfer options
   * @returns {Promise<Object>} Transfer result
   */
  async transferNFT(chainId, tokenId, fromAddress, toAddress, transferOptions = {}) {
    try {
      const adapter = this.adapterRegistry.getAdapter(chainId);
      
      // Check if adapter supports NFT transfer
      if (typeof adapter.transferNFT !== 'function') {
        throw new BlockchainError(
          `NFT transfer not supported for chain: ${chainId}`,
          ErrorCodes.NOT_SUPPORTED,
          chainId
        );
      }
      
      // Transfer NFT
      const result = await adapter.transferNFT(tokenId, fromAddress, toAddress, transferOptions);
      
      // Update in database
      await this._updateNFTOwnership(chainId, tokenId, toAddress);
      
      return result;
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to transfer NFT: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        chainId,
        error
      );
    }
  }

  /**
   * Get NFT metadata
   * @param {string} chainId - Chain identifier
   * @param {string} tokenId - NFT token ID
   * @param {string} contractAddress - NFT contract address
   * @returns {Promise<Object>} NFT metadata
   */
  async getNFTMetadata(chainId, tokenId, contractAddress) {
    try {
      const adapter = this.adapterRegistry.getAdapter(chainId);
      
      // Check if adapter supports NFT metadata retrieval
      if (typeof adapter.getNFTMetadata !== 'function') {
        throw new BlockchainError(
          `NFT metadata retrieval not supported for chain: ${chainId}`,
          ErrorCodes.NOT_SUPPORTED,
          chainId
        );
      }
      
      return await adapter.getNFTMetadata(tokenId, contractAddress);
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to get NFT metadata: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        chainId,
        error
      );
    }
  }

  /**
   * Get NFTs owned by an address
   * @param {string} chainId - Chain identifier
   * @param {string} ownerAddress - Owner address
   * @param {Object} queryOptions - Query options
   * @returns {Promise<Array<Object>>} Owned NFTs
   */
  async getNFTsByOwner(chainId, ownerAddress, queryOptions = {}) {
    try {
      const adapter = this.adapterRegistry.getAdapter(chainId);
      
      // Check if adapter supports NFT ownership query
      if (typeof adapter.getNFTsByOwner !== 'function') {
        throw new BlockchainError(
          `NFT ownership query not supported for chain: ${chainId}`,
          ErrorCodes.NOT_SUPPORTED,
          chainId
        );
      }
      
      return await adapter.getNFTsByOwner(ownerAddress, queryOptions);
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        `Failed to get NFTs by owner: ${error.message}`,
        ErrorCodes.UNKNOWN_ERROR,
        chainId,
        error
      );
    }
  }

  /**
   * Record NFT in database
   * @param {string} chainId - Chain identifier
   * @param {Object} mintResult - Minting result
   * @param {Object} nftData - NFT metadata
   * @private
   */
  async _recordNFT(chainId, mintResult, nftData) {
    try {
      const nftRecord = {
        chainId,
        tokenId: mintResult.tokenId,
        contractAddress: mintResult.contractAddress,
        ownerAddress: mintResult.ownerAddress,
        creatorAddress: mintResult.creatorAddress || mintResult.ownerAddress,
        name: nftData.name,
        description: nftData.description,
        imageUrl: nftData.imageUrl,
        metadata: nftData,
        mintTxHash: mintResult.txHash,
        status: 'minted',
        createdAt: new Date()
      };
      
      await this.nftRepository.create(nftRecord);
    } catch (error) {
      console.error('Failed to record NFT in database:', error);
      // Don't throw here to avoid affecting the main flow
    }
  }

  /**
   * Update NFT ownership in database
   * @param {string} chainId - Chain identifier
   * @param {string} tokenId - NFT token ID
   * @param {string} newOwnerAddress - New owner address
   * @private
   */
  async _updateNFTOwnership(chainId, tokenId, newOwnerAddress) {
    try {
      await this.nftRepository.update(
        { ownerAddress: newOwnerAddress },
        { where: { chainId, tokenId } }
      );
    } catch (error) {
      console.error('Failed to update NFT ownership in database:', error);
      // Don't throw here to avoid affecting the main flow
    }
  }
}

module.exports = NFTService;
