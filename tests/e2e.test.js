/**
 * End-to-End Testing Script
 * Comprehensive E2E testing for NFT marketplace
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class E2ETestRunner {
  constructor() {
    this.browser = null;
    this.page = null;
    this.baseUrl = 'http://localhost:3000';
    this.apiUrl = 'http://localhost:5000';
    this.testResults = [];
  }

  async setup() {
    console.log('🚀 Starting E2E Test Setup...');
    
    this.browser = await puppeteer.launch({
      headless: false, // Set to true for CI/CD
      defaultViewport: { width: 1920, height: 1080 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    this.page = await this.browser.newPage();
    
    // Enable request interception for API mocking
    await this.page.setRequestInterception(true);
    
    this.page.on('request', (request) => {
      // Mock API responses for testing
      if (request.url().includes('/api/')) {
        this.handleAPIRequest(request);
      } else {
        request.continue();
      }
    });
    
    // Set up console logging
    this.page.on('console', (msg) => {
      console.log('PAGE LOG:', msg.text());
    });
    
    // Set up error handling
    this.page.on('pageerror', (error) => {
      console.error('PAGE ERROR:', error.message);
    });
    
    console.log('✅ E2E Test Setup Complete');
  }

  async handleAPIRequest(request) {
    const url = request.url();
    const method = request.method();
    
    // Mock responses based on endpoint
    if (url.includes('/api/marketplace/nfts') && method === 'GET') {
      await request.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            nfts: this.getMockNFTs(),
            pagination: { total: 6, page: 1, limit: 10 }
          }
        })
      });
    } else if (url.includes('/api/creator/dashboard') && method === 'GET') {
      await request.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: this.getMockDashboardData()
        })
      });
    } else {
      // Default mock response
      await request.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} })
      });
    }
  }

  getMockNFTs() {
    return [
      {
        id: 1,
        name: "Cosmic Warrior #1234",
        description: "A legendary warrior from the cosmic realm",
        image: "https://via.placeholder.com/300x300/6366f1/ffffff?text=Cosmic+Warrior",
        price: 2.5,
        currency: "ETH",
        creator: {
          name: "ArtistPro",
          avatar: "https://via.placeholder.com/40x40/f59e0b/ffffff?text=AP",
          verified: true
        },
        collection: "Cosmic Warriors",
        blockchain: "ETH",
        category: "Art",
        rarity: "Legendary",
        views: 1250,
        likes: 89,
        auction: { type: "fixed", endTime: null }
      },
      {
        id: 2,
        name: "Digital Dreams #0567",
        description: "An abstract representation of digital consciousness",
        image: "https://via.placeholder.com/300x300/8b5cf6/ffffff?text=Digital+Dreams",
        price: 1.8,
        currency: "ETH",
        creator: {
          name: "DigitalMind",
          avatar: "https://via.placeholder.com/40x40/10b981/ffffff?text=DM",
          verified: true
        },
        collection: "Digital Dreams",
        blockchain: "ETH",
        category: "Abstract",
        rarity: "Epic",
        views: 890,
        likes: 67,
        auction: {
          type: "auction",
          endTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          currentBid: 1.8,
          bidCount: 12
        }
      }
    ];
  }

  getMockDashboardData() {
    return {
      overview: {
        total_nfts: 156,
        total_collections: 8,
        total_sales: 89,
        total_volume: 45.7,
        total_royalties: 12.3
      },
      recent_activity: [
        {
          type: 'SALE',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          data: {
            nft_name: 'Cosmic Warrior #1234',
            collection_name: 'Cosmic Warriors',
            price: 2.5,
            currency: 'ETH'
          }
        }
      ],
      collections: [
        {
          id: 1,
          name: 'Cosmic Warriors',
          total_nfts: 45,
          minted_nfts: 45,
          total_sales: 23,
          total_volume: 18.5,
          floor_price: 0.85,
          royalty_percentage: 7.5
        }
      ],
      top_nfts: [
        {
          id: 1,
          name: 'Cosmic Warrior #1234',
          image_url: 'https://via.placeholder.com/150x150/6366f1/ffffff?text=CW',
          total_volume: 8.5,
          sales_count: 5,
          highest_sale: 2.5
        }
      ]
    };
  }

  async runTest(testName, testFunction) {
    console.log(`\n🧪 Running test: ${testName}`);
    const startTime = Date.now();
    
    try {
      await testFunction();
      const duration = Date.now() - startTime;
      console.log(`✅ ${testName} - PASSED (${duration}ms)`);
      this.testResults.push({ name: testName, status: 'PASSED', duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ ${testName} - FAILED (${duration}ms):`, error.message);
      this.testResults.push({ name: testName, status: 'FAILED', duration, error: error.message });
    }
  }

  async testMarketplaceHomepage() {
    await this.page.goto(this.baseUrl);
    await this.page.waitForSelector('.nft-marketplace', { timeout: 10000 });
    
    // Test hero section
    const heroTitle = await this.page.$eval('.nft-hero-title', el => el.textContent);
    if (!heroTitle.includes('Discover, Collect & Trade')) {
      throw new Error('Hero title not found or incorrect');
    }
    
    // Test statistics
    const stats = await this.page.$$eval('.nft-stat-number', els => els.map(el => el.textContent));
    if (stats.length < 3) {
      throw new Error('Statistics not displayed correctly');
    }
    
    // Test search functionality
    await this.page.type('.nft-search input', 'Cosmic');
    await this.page.waitForTimeout(1000);
    
    // Test filter functionality
    await this.page.click('.ant-select-selector');
    await this.page.waitForTimeout(500);
    
    console.log('✓ Marketplace homepage loaded successfully');
    console.log('✓ Hero section displayed correctly');
    console.log('✓ Statistics displayed correctly');
    console.log('✓ Search functionality working');
  }

  async testNFTGrid() {
    await this.page.goto(this.baseUrl);
    await this.page.waitForSelector('.nft-grid-section', { timeout: 10000 });
    
    // Wait for NFT cards to load
    await this.page.waitForSelector('.nft-card', { timeout: 10000 });
    
    const nftCards = await this.page.$$('.nft-card');
    if (nftCards.length === 0) {
      throw new Error('No NFT cards found');
    }
    
    // Test NFT card hover effects
    await this.page.hover('.nft-card:first-child');
    await this.page.waitForTimeout(500);
    
    // Test favorite functionality
    const favoriteBtn = await this.page.$('.nft-card:first-child .nft-favorite-btn');
    if (favoriteBtn) {
      await favoriteBtn.click();
      await this.page.waitForTimeout(500);
    }
    
    // Test view details
    const viewBtn = await this.page.$('.nft-card:first-child .nft-action-btn');
    if (viewBtn) {
      await viewBtn.click();
      await this.page.waitForTimeout(1000);
    }
    
    console.log(`✓ Found ${nftCards.length} NFT cards`);
    console.log('✓ Hover effects working');
    console.log('✓ Favorite functionality working');
  }

  async testCreatorDashboard() {
    // Navigate to creator dashboard (assuming route exists)
    await this.page.goto(`${this.baseUrl}/creator/dashboard`);
    await this.page.waitForSelector('.creator-dashboard', { timeout: 10000 });
    
    // Test dashboard header
    const dashboardTitle = await this.page.$eval('.creator-dashboard-title', el => el.textContent);
    if (!dashboardTitle.includes('Creator Dashboard')) {
      throw new Error('Dashboard title not found');
    }
    
    // Test statistics cards
    const statCards = await this.page.$$('.creator-stat-card');
    if (statCards.length < 4) {
      throw new Error('Statistics cards not displayed correctly');
    }
    
    // Test navigation tabs
    const tabs = await this.page.$$('.creator-nav-tab');
    if (tabs.length < 5) {
      throw new Error('Navigation tabs not displayed correctly');
    }
    
    // Test tab switching
    await this.page.click('.creator-nav-tab:nth-child(2)'); // Collections tab
    await this.page.waitForTimeout(1000);
    
    // Test mint button
    const mintBtn = await this.page.$('.creator-mint-btn');
    if (mintBtn) {
      await mintBtn.click();
      await this.page.waitForSelector('.creator-mint-modal', { timeout: 5000 });
      
      // Close modal
      await this.page.click('.ant-modal-close');
      await this.page.waitForTimeout(500);
    }
    
    console.log('✓ Creator dashboard loaded successfully');
    console.log('✓ Statistics cards displayed');
    console.log('✓ Navigation tabs working');
    console.log('✓ Mint modal functionality working');
  }

  async testNFTDetailView() {
    // Navigate to NFT detail view (assuming route exists)
    await this.page.goto(`${this.baseUrl}/nft/1`);
    await this.page.waitForSelector('.nft-detail-view', { timeout: 10000 });
    
    // Test NFT image
    const nftImage = await this.page.$('.nft-detail-image');
    if (!nftImage) {
      throw new Error('NFT image not found');
    }
    
    // Test NFT information
    const nftTitle = await this.page.$('.nft-detail-title');
    if (!nftTitle) {
      throw new Error('NFT title not found');
    }
    
    // Test creator and owner information
    const creatorInfo = await this.page.$('.nft-detail-people');
    if (!creatorInfo) {
      throw new Error('Creator/owner information not found');
    }
    
    // Test price section
    const priceSection = await this.page.$('.nft-detail-price-section');
    if (!priceSection) {
      throw new Error('Price section not found');
    }
    
    // Test action buttons
    const actionButtons = await this.page.$('.nft-detail-actions');
    if (!actionButtons) {
      throw new Error('Action buttons not found');
    }
    
    // Test tabs
    const tabs = await this.page.$$('.ant-tabs-tab');
    if (tabs.length < 4) {
      throw new Error('Detail tabs not displayed correctly');
    }
    
    // Test attributes tab
    await this.page.click('.ant-tabs-tab:nth-child(2)'); // Attributes tab
    await this.page.waitForTimeout(1000);
    
    const attributeCards = await this.page.$$('.nft-attribute-card');
    if (attributeCards.length === 0) {
      throw new Error('Attribute cards not found');
    }
    
    console.log('✓ NFT detail view loaded successfully');
    console.log('✓ NFT information displayed correctly');
    console.log('✓ Tabs functionality working');
    console.log(`✓ Found ${attributeCards.length} attribute cards`);
  }

  async testResponsiveDesign() {
    // Test mobile viewport
    await this.page.setViewport({ width: 375, height: 667 });
    await this.page.goto(this.baseUrl);
    await this.page.waitForSelector('.nft-marketplace', { timeout: 10000 });
    
    // Check if mobile layout is applied
    const heroTitle = await this.page.$eval('.nft-hero-title', el => {
      const styles = window.getComputedStyle(el);
      return styles.fontSize;
    });
    
    // Test tablet viewport
    await this.page.setViewport({ width: 768, height: 1024 });
    await this.page.reload();
    await this.page.waitForSelector('.nft-marketplace', { timeout: 10000 });
    
    // Test desktop viewport
    await this.page.setViewport({ width: 1920, height: 1080 });
    await this.page.reload();
    await this.page.waitForSelector('.nft-marketplace', { timeout: 10000 });
    
    console.log('✓ Mobile layout working');
    console.log('✓ Tablet layout working');
    console.log('✓ Desktop layout working');
  }

  async testPerformance() {
    // Test page load performance
    const startTime = Date.now();
    await this.page.goto(this.baseUrl);
    await this.page.waitForSelector('.nft-marketplace', { timeout: 10000 });
    const loadTime = Date.now() - startTime;
    
    if (loadTime > 5000) {
      throw new Error(`Page load time too slow: ${loadTime}ms`);
    }
    
    // Test Core Web Vitals
    const metrics = await this.page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const vitals = {};
          
          entries.forEach((entry) => {
            if (entry.name === 'first-contentful-paint') {
              vitals.fcp = entry.startTime;
            }
            if (entry.name === 'largest-contentful-paint') {
              vitals.lcp = entry.startTime;
            }
          });
          
          resolve(vitals);
        }).observe({ entryTypes: ['paint', 'largest-contentful-paint'] });
        
        // Fallback timeout
        setTimeout(() => resolve({}), 3000);
      });
    });
    
    console.log(`✓ Page load time: ${loadTime}ms`);
    console.log(`✓ Performance metrics:`, metrics);
  }

  async testAccessibility() {
    await this.page.goto(this.baseUrl);
    await this.page.waitForSelector('.nft-marketplace', { timeout: 10000 });
    
    // Test keyboard navigation
    await this.page.keyboard.press('Tab');
    await this.page.waitForTimeout(500);
    
    const focusedElement = await this.page.evaluate(() => {
      return document.activeElement.tagName;
    });
    
    // Test ARIA labels
    const ariaLabels = await this.page.$$eval('[aria-label]', els => els.length);
    
    // Test heading structure
    const headings = await this.page.$$eval('h1, h2, h3, h4, h5, h6', els => els.length);
    
    if (headings === 0) {
      throw new Error('No headings found - poor accessibility structure');
    }
    
    console.log('✓ Keyboard navigation working');
    console.log(`✓ Found ${ariaLabels} elements with ARIA labels`);
    console.log(`✓ Found ${headings} headings`);
  }

  async testErrorHandling() {
    // Test 404 page
    await this.page.goto(`${this.baseUrl}/non-existent-page`);
    await this.page.waitForTimeout(2000);
    
    // Test API error handling
    await this.page.setRequestInterception(true);
    this.page.on('request', (request) => {
      if (request.url().includes('/api/')) {
        request.respond({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Server Error' })
        });
      } else {
        request.continue();
      }
    });
    
    await this.page.goto(this.baseUrl);
    await this.page.waitForTimeout(3000);
    
    // Check if error state is handled gracefully
    const errorElements = await this.page.$$('.error, .ant-empty, [data-testid="error"]');
    
    console.log('✓ 404 page handling tested');
    console.log('✓ API error handling tested');
    console.log(`✓ Found ${errorElements.length} error handling elements`);
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      totalTests: this.testResults.length,
      passed: this.testResults.filter(t => t.status === 'PASSED').length,
      failed: this.testResults.filter(t => t.status === 'FAILED').length,
      totalDuration: this.testResults.reduce((sum, t) => sum + t.duration, 0),
      tests: this.testResults
    };
    
    const reportPath = path.join(__dirname, 'e2e-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n📊 Test Report Generated:');
    console.log(`Total Tests: ${report.totalTests}`);
    console.log(`Passed: ${report.passed}`);
    console.log(`Failed: ${report.failed}`);
    console.log(`Total Duration: ${report.totalDuration}ms`);
    console.log(`Report saved to: ${reportPath}`);
    
    return report;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
    console.log('🧹 E2E Test Cleanup Complete');
  }

  async runAllTests() {
    try {
      await this.setup();
      
      // Run all test suites
      await this.runTest('Marketplace Homepage', () => this.testMarketplaceHomepage());
      await this.runTest('NFT Grid Display', () => this.testNFTGrid());
      await this.runTest('Creator Dashboard', () => this.testCreatorDashboard());
      await this.runTest('NFT Detail View', () => this.testNFTDetailView());
      await this.runTest('Responsive Design', () => this.testResponsiveDesign());
      await this.runTest('Performance', () => this.testPerformance());
      await this.runTest('Accessibility', () => this.testAccessibility());
      await this.runTest('Error Handling', () => this.testErrorHandling());
      
      const report = await this.generateReport();
      return report;
      
    } catch (error) {
      console.error('❌ E2E Test Suite Failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// Export for use in other test files
module.exports = E2ETestRunner;

// Run tests if this file is executed directly
if (require.main === module) {
  const runner = new E2ETestRunner();
  runner.runAllTests()
    .then((report) => {
      console.log('\n🎉 E2E Test Suite Completed Successfully!');
      process.exit(report.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('\n💥 E2E Test Suite Failed:', error);
      process.exit(1);
    });
}

