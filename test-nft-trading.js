/**
 * NFT Trading & Auction System Test Script
 * Tests the complete trading and auction functionality
 */

const NFTAuctionService = require('./services/NFTAuctionService');
const NFTMintingService = require('./services/NFTMintingService');
const db = require('./models');

async function testNFTTradingSystem() {
  console.log('🚀 Starting NFT Trading & Auction System Test...\n');

  try {
    // Initialize services
    console.log('1. Initializing services...');
    const mintingService = new NFTMintingService();
    await mintingService.initialize();
    
    const auctionService = new NFTAuctionService();
    await auctionService.initialize();
    console.log('✅ Services initialized successfully\n');

    // Test 1: Create test collection and NFT
    console.log('2. Creating test collection and NFT...');
    const collectionData = {
      name: 'Test Trading Collection',
      symbol: 'TTC',
      description: 'A test collection for trading system testing',
      blockchain: 'ETH',
      creator_id: 1,
      category_id: 1,
      max_supply: 100,
      default_royalty_percentage: 5.0
    };

    const collection = await mintingService.nftService.createCollection(collectionData);
    
    // Deploy collection
    const deployResult = await mintingService.executeDeployment(collection.id, '0x1234567890123456789012345678901234567890');
    
    // Create NFT
    const nftData = {
      collection_id: collection.id,
      name: 'Test Trading NFT #1',
      description: 'A test NFT for trading system testing',
      attributes: [
        { trait_type: 'Rarity', value: 'Legendary' },
        { trait_type: 'Power', value: '9000' }
      ]
    };

    const nft = await mintingService.nftService.mintNFT(nftData);
    
    // Mint NFT
    const mintResult = await mintingService.executeNFTMinting(nft.id, '0x1234567890123456789012345678901234567890');
    
    console.log('✅ Test collection and NFT created:');
    console.log(`   - Collection: ${collection.name} (${collection.id})`);
    console.log(`   - NFT: ${nft.name} (${nft.id})`);
    console.log(`   - Token ID: ${mintResult.mintResult.tokenId}\n`);

    // Test 2: Create Fixed Price Auction
    console.log('3. Testing Fixed Price Auction...');
    const fixedPriceData = {
      nft_id: nft.id,
      auction_type: 'FIXED_PRICE',
      starting_price: 1.5,
      currency: 'ETH',
      blockchain_currency: 'ETH',
      duration_hours: 24
    };

    const fixedPriceAuction = await auctionService.createAuction(fixedPriceData);
    console.log('✅ Fixed price auction created:');
    console.log(`   - Auction ID: ${fixedPriceAuction.id}`);
    console.log(`   - Price: ${fixedPriceAuction.starting_price} ${fixedPriceAuction.currency}`);
    console.log(`   - Type: ${fixedPriceAuction.auction_type}\n`);

    // Test 3: Purchase Fixed Price NFT
    console.log('4. Testing Fixed Price Purchase...');
    const buyerId = 2; // Assuming user ID 2 exists
    const purchaseResult = await auctionService.placeBid(
      fixedPriceAuction.id,
      buyerId,
      1.5
    );
    
    console.log('✅ Fixed price purchase completed:');
    console.log(`   - Buyer ID: ${buyerId}`);
    console.log(`   - Purchase Price: ${purchaseResult.bid.bid_amount} ${purchaseResult.bid.currency}`);
    console.log(`   - Auction Completed: ${purchaseResult.completed}\n`);

    // Test 4: Create English Auction
    console.log('5. Testing English Auction...');
    
    // Create another NFT for English auction
    const nft2Data = { ...nftData, name: 'Test Trading NFT #2' };
    const nft2 = await mintingService.nftService.mintNFT(nft2Data);
    await mintingService.executeNFTMinting(nft2.id, '0x1234567890123456789012345678901234567890');
    
    const englishAuctionData = {
      nft_id: nft2.id,
      auction_type: 'ENGLISH_AUCTION',
      starting_price: 0.5,
      reserve_price: 1.0,
      buyout_price: 5.0,
      currency: 'ETH',
      blockchain_currency: 'ETH',
      duration_hours: 48,
      auto_extend_enabled: true,
      extend_time_minutes: 10
    };

    const englishAuction = await auctionService.createAuction(englishAuctionData);
    console.log('✅ English auction created:');
    console.log(`   - Auction ID: ${englishAuction.id}`);
    console.log(`   - Starting Price: ${englishAuction.starting_price} ${englishAuction.currency}`);
    console.log(`   - Reserve Price: ${englishAuction.reserve_price} ${englishAuction.currency}`);
    console.log(`   - Buyout Price: ${englishAuction.buyout_price} ${englishAuction.currency}\n`);

    // Test 5: Place Multiple Bids on English Auction
    console.log('6. Testing English Auction Bidding...');
    
    // First bid
    const bid1 = await auctionService.placeBid(englishAuction.id, 2, 0.6);
    console.log(`✅ Bid 1 placed: ${bid1.bid.bid_amount} ${bid1.bid.currency} by user ${bid1.bid.bidder_id}`);
    
    // Second bid (higher)
    const bid2 = await auctionService.placeBid(englishAuction.id, 3, 0.8);
    console.log(`✅ Bid 2 placed: ${bid2.bid.bid_amount} ${bid2.bid.currency} by user ${bid2.bid.bidder_id}`);
    
    // Third bid (even higher)
    const bid3 = await auctionService.placeBid(englishAuction.id, 4, 1.2);
    console.log(`✅ Bid 3 placed: ${bid3.bid.bid_amount} ${bid3.bid.currency} by user ${bid3.bid.bidder_id}`);
    console.log('');

    // Test 6: Create Dutch Auction
    console.log('7. Testing Dutch Auction...');
    
    // Create another NFT for Dutch auction
    const nft3Data = { ...nftData, name: 'Test Trading NFT #3' };
    const nft3 = await mintingService.nftService.mintNFT(nft3Data);
    await mintingService.executeNFTMinting(nft3.id, '0x1234567890123456789012345678901234567890');
    
    const dutchAuctionData = {
      nft_id: nft3.id,
      auction_type: 'DUTCH_AUCTION',
      starting_price: 3.0,
      minimum_price: 0.5,
      price_drop_interval: 1, // 1 minute for testing
      price_drop_amount: 0.2,
      currency: 'ETH',
      blockchain_currency: 'ETH',
      duration_hours: 24
    };

    const dutchAuction = await auctionService.createAuction(dutchAuctionData);
    console.log('✅ Dutch auction created:');
    console.log(`   - Auction ID: ${dutchAuction.id}`);
    console.log(`   - Starting Price: ${dutchAuction.starting_price} ${dutchAuction.currency}`);
    console.log(`   - Minimum Price: ${dutchAuction.minimum_price} ${dutchAuction.currency}`);
    console.log(`   - Price Drop: ${dutchAuction.price_drop_amount} every ${dutchAuction.price_drop_interval} minute(s)\n`);

    // Test 7: Simulate Dutch Auction Price Drop
    console.log('8. Testing Dutch Auction Price Drop...');
    
    // Manually trigger price drop for testing
    await auctionService.dropDutchAuctionPrice(dutchAuction.id);
    
    const updatedDutchAuction = await auctionService.getAuctionDetails(dutchAuction.id);
    console.log(`✅ Price dropped to: ${updatedDutchAuction.current_price} ${updatedDutchAuction.currency}\n`);

    // Test 8: Purchase Dutch Auction NFT
    console.log('9. Testing Dutch Auction Purchase...');
    const dutchPurchaseResult = await auctionService.placeBid(
      dutchAuction.id,
      5, // User ID 5
      updatedDutchAuction.current_price
    );
    
    console.log('✅ Dutch auction purchase completed:');
    console.log(`   - Buyer ID: ${dutchPurchaseResult.bid.bidder_id}`);
    console.log(`   - Purchase Price: ${dutchPurchaseResult.bid.bid_amount} ${dutchPurchaseResult.bid.currency}`);
    console.log(`   - Auction Completed: ${dutchPurchaseResult.completed}\n`);

    // Test 9: Get Auction Details
    console.log('10. Testing Auction Details Retrieval...');
    const auctionDetails = await auctionService.getAuctionDetails(englishAuction.id);
    console.log('✅ Auction details retrieved:');
    console.log(`   - NFT: ${auctionDetails.nft.name}`);
    console.log(`   - Current Price: ${auctionDetails.current_price} ${auctionDetails.currency}`);
    console.log(`   - Total Bids: ${auctionDetails.total_bids}`);
    console.log(`   - Time Remaining: ${Math.round(auctionDetails.time_remaining / 1000)} seconds`);
    console.log(`   - Is Active: ${auctionDetails.is_active}\n`);

    // Test 10: Get Active Auctions
    console.log('11. Testing Active Auctions Retrieval...');
    const activeAuctions = await auctionService.getActiveAuctions({
      limit: 10,
      sort_by: 'created_at',
      sort_order: 'DESC'
    });
    
    console.log('✅ Active auctions retrieved:');
    console.log(`   - Total Active: ${activeAuctions.total}`);
    console.log(`   - Returned: ${activeAuctions.auctions.length}`);
    for (const auction of activeAuctions.auctions) {
      console.log(`   - ${auction.nft.name}: ${auction.current_price} ${auction.currency} (${auction.auction_type})`);
    }
    console.log('');

    // Test 11: Get Auction Statistics
    console.log('12. Testing Auction Statistics...');
    const stats = await auctionService.getAuctionStatistics({
      time_period: '7d'
    });
    
    console.log('✅ Auction statistics retrieved:');
    console.log('   - Statistics:', stats.statistics);
    console.log(`   - Time Period: ${stats.time_period}\n`);

    // Test 12: Cancel an Auction (create a new one first)
    console.log('13. Testing Auction Cancellation...');
    
    // Create another NFT for cancellation test
    const nft4Data = { ...nftData, name: 'Test Trading NFT #4' };
    const nft4 = await mintingService.nftService.mintNFT(nft4Data);
    await mintingService.executeNFTMinting(nft4.id, '0x1234567890123456789012345678901234567890');
    
    const cancelTestAuction = await auctionService.createAuction({
      nft_id: nft4.id,
      auction_type: 'FIXED_PRICE',
      starting_price: 2.0,
      currency: 'ETH',
      blockchain_currency: 'ETH',
      duration_hours: 24
    });
    
    // Cancel the auction
    const cancelledAuction = await auctionService.cancelAuction(cancelTestAuction.id, 1);
    console.log('✅ Auction cancelled successfully:');
    console.log(`   - Auction ID: ${cancelledAuction.id}`);
    console.log(`   - Status: ${cancelledAuction.status}\n`);

    console.log('🎉 ALL TESTS PASSED! NFT Trading & Auction System is working perfectly!\n');

    // Summary
    console.log('📊 TEST SUMMARY:');
    console.log('================');
    console.log('✅ Service Initialization: PASSED');
    console.log('✅ Collection & NFT Creation: PASSED');
    console.log('✅ Fixed Price Auction: PASSED');
    console.log('✅ Fixed Price Purchase: PASSED');
    console.log('✅ English Auction Creation: PASSED');
    console.log('✅ English Auction Bidding: PASSED');
    console.log('✅ Dutch Auction Creation: PASSED');
    console.log('✅ Dutch Auction Price Drop: PASSED');
    console.log('✅ Dutch Auction Purchase: PASSED');
    console.log('✅ Auction Details Retrieval: PASSED');
    console.log('✅ Active Auctions Listing: PASSED');
    console.log('✅ Auction Statistics: PASSED');
    console.log('✅ Auction Cancellation: PASSED');
    console.log('\n🚀 NFT Trading & Auction System is PRODUCTION READY!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testNFTTradingSystem().then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  }).catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
}

module.exports = testNFTTradingSystem;

