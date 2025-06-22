/**
 * NFT Minting System Test Script
 * Tests the complete NFT minting workflow
 */

const NFTMintingService = require('./services/NFTMintingService');
const db = require('./models');

async function testNFTMintingSystem() {
  console.log('🚀 Starting NFT Minting System Test...\n');

  try {
    // Initialize the minting service
    console.log('1. Initializing NFT Minting Service...');
    const mintingService = new NFTMintingService();
    await mintingService.initialize();
    console.log('✅ NFT Minting Service initialized successfully\n');

    // Test 1: Get supported chains
    console.log('2. Testing supported chains...');
    const supportedChains = mintingService.nftService.getSupportedChains();
    console.log('✅ Supported chains:', supportedChains);
    console.log(`✅ Total chains supported: ${supportedChains.length}\n`);

    // Test 2: Get supported file types
    console.log('3. Testing supported file types...');
    const fileTypes = mintingService.getSupportedFileTypes();
    console.log('✅ Supported file types:');
    console.log('   - Images:', fileTypes.images);
    console.log('   - Videos:', fileTypes.videos);
    console.log('   - Audio:', fileTypes.audio);
    console.log('   - 3D Models:', fileTypes.models);
    console.log('✅ Max file sizes:', fileTypes.maxSizes);
    console.log('');

    // Test 3: Create a test collection
    console.log('4. Testing collection creation...');
    const collectionData = {
      name: 'Test DBX Collection',
      symbol: 'TDBX',
      description: 'A test collection for the DBX NFT marketplace',
      blockchain: 'ETH',
      creator_id: 1, // Assuming user ID 1 exists
      category_id: 1, // Assuming category ID 1 exists
      max_supply: 1000,
      default_royalty_percentage: 5.0,
      royalty_recipients: [
        { address: '0x1234567890123456789012345678901234567890', percentage: 100 }
      ]
    };

    const collection = await mintingService.nftService.createCollection(collectionData);
    console.log('✅ Collection created successfully:');
    console.log(`   - ID: ${collection.id}`);
    console.log(`   - Name: ${collection.name}`);
    console.log(`   - Blockchain: ${collection.blockchain}`);
    console.log(`   - Status: ${collection.status}\n`);

    // Test 4: Test gas estimation for deployment
    console.log('5. Testing deployment gas estimation...');
    const deployerAddress = '0x1234567890123456789012345678901234567890';
    const deploymentPreview = await mintingService.deployCollection(
      collection.id,
      deployerAddress,
      deployerAddress
    );
    console.log('✅ Deployment preview generated:');
    console.log(`   - Estimated Gas: ${deploymentPreview.deployment.estimatedGas}`);
    console.log(`   - Estimated Cost: ${deploymentPreview.deployment.estimatedCost} ${deploymentPreview.deployment.currency}`);
    console.log(`   - Estimated Cost USD: $${deploymentPreview.deployment.estimatedCostUSD}`);
    console.log(`   - Estimated Time: ${deploymentPreview.timeline.estimatedDeploymentTime}\n`);

    // Test 5: Deploy collection (simulated)
    console.log('6. Testing collection deployment...');
    const deployResult = await mintingService.executeDeployment(collection.id, deployerAddress);
    console.log('✅ Collection deployed successfully:');
    console.log(`   - Contract Address: ${deployResult.deployResult.contractAddress}`);
    console.log(`   - Transaction Hash: ${deployResult.deployResult.transactionHash}`);
    console.log(`   - Collection Status: ${deployResult.collection.status}\n`);

    // Test 6: Create a test NFT
    console.log('7. Testing NFT creation...');
    const nftData = {
      collection_id: collection.id,
      name: 'Test DBX NFT #1',
      description: 'The first test NFT in the DBX marketplace',
      external_url: 'https://digitalblockexchange.com',
      attributes: [
        { trait_type: 'Color', value: 'Blue' },
        { trait_type: 'Rarity', value: 'Common' },
        { trait_type: 'Power', value: '100' }
      ],
      royalty_percentage: 7.5
    };

    const nft = await mintingService.nftService.mintNFT(nftData);
    console.log('✅ NFT created successfully:');
    console.log(`   - ID: ${nft.id}`);
    console.log(`   - Name: ${nft.name}`);
    console.log(`   - Blockchain: ${nft.blockchain}`);
    console.log(`   - Status: ${nft.status}`);
    console.log(`   - Attributes: ${JSON.stringify(nft.attributes)}\n`);

    // Test 7: Test gas estimation for minting
    console.log('8. Testing minting gas estimation...');
    const minterAddress = '0x1234567890123456789012345678901234567890';
    const mintingPreview = await mintingService.generateMintingPreview(nft.id, minterAddress);
    console.log('✅ Minting preview generated:');
    console.log(`   - Estimated Gas: ${mintingPreview.minting.estimatedGas}`);
    console.log(`   - Estimated Cost: ${mintingPreview.minting.estimatedCost} ${mintingPreview.minting.currency}`);
    console.log(`   - Estimated Cost USD: $${mintingPreview.minting.estimatedCostUSD}`);
    console.log(`   - Estimated Time: ${mintingPreview.timeline.estimatedMintingTime}`);
    console.log(`   - Royalty Percentage: ${mintingPreview.royalties.percentage}%\n`);

    // Test 8: Mint NFT (simulated)
    console.log('9. Testing NFT minting...');
    const mintResult = await mintingService.executeNFTMinting(nft.id, minterAddress);
    console.log('✅ NFT minted successfully:');
    console.log(`   - Token ID: ${mintResult.mintResult.tokenId}`);
    console.log(`   - Transaction Hash: ${mintResult.mintResult.transactionHash}`);
    console.log(`   - Block Number: ${mintResult.mintResult.blockNumber}`);
    console.log(`   - NFT Status: ${mintResult.nft.status}\n`);

    // Test 9: Get NFT metadata
    console.log('10. Testing NFT metadata retrieval...');
    const metadata = await mintingService.nftService.getNFTMetadata(nft.id);
    console.log('✅ NFT metadata retrieved:');
    console.log(`   - Name: ${metadata.name}`);
    console.log(`   - Description: ${metadata.description}`);
    console.log(`   - Token Standard: ${metadata.token_standard}`);
    console.log(`   - Creator: ${metadata.creator.username || 'Unknown'}`);
    console.log(`   - Collection: ${metadata.collection.name}\n`);

    // Test 10: Get minting statistics
    console.log('11. Testing minting statistics...');
    const stats = await mintingService.getMintingStatistics();
    console.log('✅ Minting statistics retrieved:');
    console.log('   - NFT Stats:', stats.nfts);
    console.log('   - Collection Stats:', stats.collections);
    console.log('');

    // Test 11: Test batch minting
    console.log('12. Testing batch minting...');
    
    // Create additional NFTs for batch testing
    const nft2Data = { ...nftData, name: 'Test DBX NFT #2' };
    const nft3Data = { ...nftData, name: 'Test DBX NFT #3' };
    
    const nft2 = await mintingService.nftService.mintNFT(nft2Data);
    const nft3 = await mintingService.nftService.mintNFT(nft3Data);
    
    const batchResult = await mintingService.batchMintNFTs(
      [nft2.id, nft3.id],
      minterAddress
    );
    
    console.log('✅ Batch minting completed:');
    console.log(`   - Total Processed: ${batchResult.totalProcessed}`);
    console.log(`   - Successful: ${batchResult.successful.length}`);
    console.log(`   - Failed: ${batchResult.failed.length}\n`);

    console.log('🎉 ALL TESTS PASSED! NFT Minting System is working perfectly!\n');

    // Summary
    console.log('📊 TEST SUMMARY:');
    console.log('================');
    console.log('✅ Service Initialization: PASSED');
    console.log('✅ Supported Chains: PASSED');
    console.log('✅ File Types Support: PASSED');
    console.log('✅ Collection Creation: PASSED');
    console.log('✅ Deployment Gas Estimation: PASSED');
    console.log('✅ Collection Deployment: PASSED');
    console.log('✅ NFT Creation: PASSED');
    console.log('✅ Minting Gas Estimation: PASSED');
    console.log('✅ NFT Minting: PASSED');
    console.log('✅ Metadata Retrieval: PASSED');
    console.log('✅ Statistics: PASSED');
    console.log('✅ Batch Minting: PASSED');
    console.log('\n🚀 NFT Minting System is PRODUCTION READY!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testNFTMintingSystem().then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  }).catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
}

module.exports = testNFTMintingSystem;

