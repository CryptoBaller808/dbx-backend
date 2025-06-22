/**
 * NFT Marketplace Integration Tests
 * Comprehensive end-to-end testing for the NFT marketplace
 */

const request = require('supertest');
const app = require('../server');

describe('NFT Marketplace Integration Tests', () => {
  let server;
  let testNFTId;
  let testCollectionId;
  let testAuctionId;

  beforeAll(async () => {
    // Start server for testing
    server = app.listen(0);
    console.log('Test server started');
  });

  afterAll(async () => {
    // Close server after tests
    if (server) {
      server.close();
    }
  });

  describe('NFT Minting API', () => {
    test('POST /api/nft/collections - Create new collection', async () => {
      const collectionData = {
        name: 'Test Collection',
        description: 'A test collection for integration testing',
        symbol: 'TEST',
        blockchain: 'ETH',
        royalty_percentage: 5.0,
        max_supply: 1000
      };

      const response = await request(server)
        .post('/api/nft/collections')
        .send(collectionData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(collectionData.name);
      
      testCollectionId = response.body.data.id;
    });

    test('POST /api/nft/mint - Mint new NFT', async () => {
      const nftData = {
        name: 'Test NFT #1',
        description: 'A test NFT for integration testing',
        collection_id: testCollectionId,
        blockchain: 'ETH',
        metadata: {
          attributes: [
            { trait_type: 'Color', value: 'Blue' },
            { trait_type: 'Rarity', value: 'Common' }
          ]
        },
        royalty_percentage: 7.5
      };

      const response = await request(server)
        .post('/api/nft/mint')
        .send(nftData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(nftData.name);
      
      testNFTId = response.body.data.id;
    });

    test('GET /api/nft/estimate-gas - Get gas estimation', async () => {
      const gasData = {
        blockchain: 'ETH',
        operation: 'mint',
        metadata_size: 1024
      };

      const response = await request(server)
        .post('/api/nft/estimate-gas')
        .send(gasData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('gas_estimate');
      expect(response.body.data).toHaveProperty('gas_price');
      expect(response.body.data).toHaveProperty('total_cost');
    });
  });

  describe('NFT Marketplace API', () => {
    test('GET /api/marketplace/nfts - Get marketplace NFTs', async () => {
      const response = await request(server)
        .get('/api/marketplace/nfts')
        .query({
          page: 1,
          limit: 10,
          category: 'all',
          blockchain: 'all'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('nfts');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.nfts)).toBe(true);
    });

    test('POST /api/marketplace/auctions - Create auction', async () => {
      const auctionData = {
        nft_id: testNFTId,
        auction_type: 'english',
        starting_price: 1.0,
        reserve_price: 1.5,
        duration_hours: 24,
        currency: 'ETH'
      };

      const response = await request(server)
        .post('/api/marketplace/auctions')
        .send(auctionData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.auction_type).toBe(auctionData.auction_type);
      
      testAuctionId = response.body.data.id;
    });

    test('POST /api/marketplace/bids - Place bid', async () => {
      const bidData = {
        auction_id: testAuctionId,
        amount: 1.2,
        currency: 'ETH'
      };

      const response = await request(server)
        .post('/api/marketplace/bids')
        .send(bidData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.amount).toBe(bidData.amount);
    });

    test('GET /api/marketplace/auctions/:id - Get auction details', async () => {
      const response = await request(server)
        .get(`/api/marketplace/auctions/${testAuctionId}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id', testAuctionId);
      expect(response.body.data).toHaveProperty('bids');
      expect(Array.isArray(response.body.data.bids)).toBe(true);
    });
  });

  describe('Cross-Chain Bridge API', () => {
    test('POST /api/bridge/initiate - Initiate bridge transfer', async () => {
      const bridgeData = {
        nft_id: testNFTId,
        source_blockchain: 'ETH',
        target_blockchain: 'BNB',
        recipient_address: '0x1234567890123456789012345678901234567890'
      };

      const response = await request(server)
        .post('/api/bridge/initiate')
        .send(bridgeData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('bridge_id');
      expect(response.body.data).toHaveProperty('status', 'INITIATED');
    });

    test('GET /api/bridge/fees - Get bridge fees', async () => {
      const response = await request(server)
        .get('/api/bridge/fees')
        .query({
          source_blockchain: 'ETH',
          target_blockchain: 'BNB',
          nft_complexity: 'standard'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('base_fee');
      expect(response.body.data).toHaveProperty('gas_fee');
      expect(response.body.data).toHaveProperty('total_fee');
    });
  });

  describe('Creator Tools API', () => {
    test('GET /api/creator/dashboard - Get creator dashboard', async () => {
      const response = await request(server)
        .get('/api/creator/dashboard')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('overview');
      expect(response.body.data).toHaveProperty('recent_activity');
      expect(response.body.data).toHaveProperty('collections');
    });

    test('GET /api/creator/analytics - Get creator analytics', async () => {
      const response = await request(server)
        .get('/api/creator/analytics')
        .query({
          timeframe: '30d',
          metrics: 'revenue,sales,views'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('revenue_analytics');
      expect(response.body.data).toHaveProperty('sales_analytics');
    });

    test('POST /api/creator/verification - Submit verification', async () => {
      const verificationData = {
        verification_type: 'CREATOR',
        documents: ['portfolio_url', 'social_media'],
        portfolio_url: 'https://example.com/portfolio',
        social_media: {
          twitter: '@testcreator',
          instagram: '@testcreator'
        }
      };

      const response = await request(server)
        .post('/api/creator/verification')
        .send(verificationData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('verification_id');
      expect(response.body.data).toHaveProperty('status', 'PENDING');
    });
  });

  describe('Media Upload API', () => {
    test('POST /api/nft/upload - Upload media file', async () => {
      // Create a simple test file buffer
      const testFileBuffer = Buffer.from('test image data');
      
      const response = await request(server)
        .post('/api/nft/upload')
        .attach('file', testFileBuffer, 'test.jpg')
        .field('file_type', 'image')
        .field('storage_type', 'ipfs')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('ipfs_hash');
      expect(response.body.data).toHaveProperty('file_url');
    });
  });

  describe('Error Handling', () => {
    test('POST /api/nft/mint - Invalid data should return 400', async () => {
      const invalidData = {
        name: '', // Empty name should fail validation
        description: 'Test'
      };

      const response = await request(server)
        .post('/api/nft/mint')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    test('GET /api/marketplace/nfts/invalid-id - Non-existent NFT should return 404', async () => {
      const response = await request(server)
        .get('/api/marketplace/nfts/99999999')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Performance Tests', () => {
    test('GET /api/marketplace/nfts - Response time should be under 1000ms', async () => {
      const startTime = Date.now();
      
      await request(server)
        .get('/api/marketplace/nfts')
        .query({ page: 1, limit: 50 })
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000);
    });

    test('Concurrent requests should handle properly', async () => {
      const requests = Array(10).fill().map(() => 
        request(server)
          .get('/api/marketplace/nfts')
          .query({ page: 1, limit: 10 })
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
      });
    });
  });

  describe('Security Tests', () => {
    test('SQL injection attempt should be prevented', async () => {
      const maliciousData = {
        name: "'; DROP TABLE nfts; --",
        description: 'Test'
      };

      const response = await request(server)
        .post('/api/nft/mint')
        .send(maliciousData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    test('XSS attempt should be sanitized', async () => {
      const xssData = {
        name: '<script>alert("xss")</script>',
        description: 'Test description'
      };

      const response = await request(server)
        .post('/api/nft/mint')
        .send(xssData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});

// Utility functions for testing
const TestUtils = {
  // Generate test NFT data
  generateTestNFT: (overrides = {}) => ({
    name: 'Test NFT',
    description: 'A test NFT for integration testing',
    blockchain: 'ETH',
    metadata: {
      attributes: [
        { trait_type: 'Color', value: 'Blue' },
        { trait_type: 'Rarity', value: 'Common' }
      ]
    },
    royalty_percentage: 5.0,
    ...overrides
  }),

  // Generate test collection data
  generateTestCollection: (overrides = {}) => ({
    name: 'Test Collection',
    description: 'A test collection for integration testing',
    symbol: 'TEST',
    blockchain: 'ETH',
    royalty_percentage: 5.0,
    max_supply: 1000,
    ...overrides
  }),

  // Generate test auction data
  generateTestAuction: (nftId, overrides = {}) => ({
    nft_id: nftId,
    auction_type: 'english',
    starting_price: 1.0,
    reserve_price: 1.5,
    duration_hours: 24,
    currency: 'ETH',
    ...overrides
  }),

  // Wait for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Validate NFT structure
  validateNFTStructure: (nft) => {
    expect(nft).toHaveProperty('id');
    expect(nft).toHaveProperty('name');
    expect(nft).toHaveProperty('description');
    expect(nft).toHaveProperty('blockchain');
    expect(nft).toHaveProperty('metadata');
    expect(nft).toHaveProperty('created_at');
  },

  // Validate auction structure
  validateAuctionStructure: (auction) => {
    expect(auction).toHaveProperty('id');
    expect(auction).toHaveProperty('nft_id');
    expect(auction).toHaveProperty('auction_type');
    expect(auction).toHaveProperty('starting_price');
    expect(auction).toHaveProperty('current_price');
    expect(auction).toHaveProperty('status');
  }
};

module.exports = { TestUtils };

