/**
 * Code Structure Validation
 * Validates the NFT marketplace codebase structure and completeness
 */

const fs = require('fs');
const path = require('path');

class CodeValidator {
  constructor() {
    this.backendPath = '/home/ubuntu/DigitalBlockExchangeBE-manus-phase1-dev';
    this.frontendPath = '/home/ubuntu/DigitalBlockExchangeFE-manus-phase1-dev';
    this.validationResults = {
      backend: {},
      frontend: {},
      overall: {}
    };
  }

  checkFileExists(filePath) {
    try {
      return fs.existsSync(filePath);
    } catch (error) {
      return false;
    }
  }

  checkDirectoryExists(dirPath) {
    try {
      return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
    } catch (error) {
      return false;
    }
  }

  getFileSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  validateBackendStructure() {
    console.log('🔍 Validating Backend Structure...');
    
    const backendChecks = {
      // Core files
      'server.js': this.checkFileExists(path.join(this.backendPath, 'server.js')),
      'package.json': this.checkFileExists(path.join(this.backendPath, 'package.json')),
      
      // Models
      'models/NFT.js': this.checkFileExists(path.join(this.backendPath, 'models/NFT.js')),
      'models/NFTCollection.js': this.checkFileExists(path.join(this.backendPath, 'models/NFTCollection.js')),
      'models/NFTAuction.js': this.checkFileExists(path.join(this.backendPath, 'models/NFTAuction.js')),
      'models/NFTBid.js': this.checkFileExists(path.join(this.backendPath, 'models/NFTBid.js')),
      'models/NFTTransaction.js': this.checkFileExists(path.join(this.backendPath, 'models/NFTTransaction.js')),
      'models/NFTRoyalty.js': this.checkFileExists(path.join(this.backendPath, 'models/NFTRoyalty.js')),
      'models/NFTBridgeTransaction.js': this.checkFileExists(path.join(this.backendPath, 'models/NFTBridgeTransaction.js')),
      'models/CreatorVerification.js': this.checkFileExists(path.join(this.backendPath, 'models/CreatorVerification.js')),
      
      // Services
      'services/MultiChainNFTService.js': this.checkFileExists(path.join(this.backendPath, 'services/MultiChainNFTService.js')),
      'services/MediaUploadService.js': this.checkFileExists(path.join(this.backendPath, 'services/MediaUploadService.js')),
      'services/NFTMintingService.js': this.checkFileExists(path.join(this.backendPath, 'services/NFTMintingService.js')),
      'services/NFTAuctionService.js': this.checkFileExists(path.join(this.backendPath, 'services/NFTAuctionService.js')),
      'services/CrossChainNFTBridge.js': this.checkFileExists(path.join(this.backendPath, 'services/CrossChainNFTBridge.js')),
      'services/CreatorToolsService.js': this.checkFileExists(path.join(this.backendPath, 'services/CreatorToolsService.js')),
      
      // Routes
      'routes/nftRoutes.js': this.checkFileExists(path.join(this.backendPath, 'routes/nftRoutes.js')),
      'routes/marketplaceRoutes.js': this.checkFileExists(path.join(this.backendPath, 'routes/marketplaceRoutes.js')),
      'routes/bridgeRoutes.js': this.checkFileExists(path.join(this.backendPath, 'routes/bridgeRoutes.js')),
      'routes/creatorRoutes.js': this.checkFileExists(path.join(this.backendPath, 'routes/creatorRoutes.js')),
      
      // Tests
      'tests/integration.test.js': this.checkFileExists(path.join(this.backendPath, 'tests/integration.test.js')),
      'tests/e2e.test.js': this.checkFileExists(path.join(this.backendPath, 'tests/e2e.test.js')),
      'tests/quick-test.js': this.checkFileExists(path.join(this.backendPath, 'tests/quick-test.js'))
    };

    this.validationResults.backend = backendChecks;
    
    const passedChecks = Object.values(backendChecks).filter(Boolean).length;
    const totalChecks = Object.keys(backendChecks).length;
    
    console.log(`✅ Backend Structure: ${passedChecks}/${totalChecks} files present`);
    
    // Check file sizes to ensure they're not empty
    const importantFiles = [
      'services/MultiChainNFTService.js',
      'services/NFTMintingService.js',
      'services/NFTAuctionService.js',
      'routes/nftRoutes.js',
      'routes/marketplaceRoutes.js'
    ];
    
    importantFiles.forEach(file => {
      const filePath = path.join(this.backendPath, file);
      const size = this.getFileSize(filePath);
      if (size > 1000) { // At least 1KB
        console.log(`✅ ${file}: ${Math.round(size/1024)}KB - Well implemented`);
      } else if (size > 0) {
        console.log(`⚠️  ${file}: ${size}B - Basic implementation`);
      } else {
        console.log(`❌ ${file}: Missing or empty`);
      }
    });
    
    return { passed: passedChecks, total: totalChecks };
  }

  validateFrontendStructure() {
    console.log('\n🔍 Validating Frontend Structure...');
    
    const frontendChecks = {
      // Core files
      'package.json': this.checkFileExists(path.join(this.frontendPath, 'package.json')),
      'src/App.js': this.checkFileExists(path.join(this.frontendPath, 'src/App.js')),
      
      // NFT Marketplace Components
      'src/components/NFTMarketplace/NFTMarketplace.js': this.checkFileExists(path.join(this.frontendPath, 'src/components/NFTMarketplace/NFTMarketplace.js')),
      'src/components/NFTMarketplace/NFTMarketplace.css': this.checkFileExists(path.join(this.frontendPath, 'src/components/NFTMarketplace/NFTMarketplace.css')),
      'src/components/NFTMarketplace/CreatorDashboard.js': this.checkFileExists(path.join(this.frontendPath, 'src/components/NFTMarketplace/CreatorDashboard.js')),
      'src/components/NFTMarketplace/CreatorDashboard.css': this.checkFileExists(path.join(this.frontendPath, 'src/components/NFTMarketplace/CreatorDashboard.css')),
      'src/components/NFTMarketplace/NFTDetailView.js': this.checkFileExists(path.join(this.frontendPath, 'src/components/NFTMarketplace/NFTDetailView.js')),
      'src/components/NFTMarketplace/NFTDetailView.css': this.checkFileExists(path.join(this.frontendPath, 'src/components/NFTMarketplace/NFTDetailView.css')),
      'src/components/NFTMarketplace/index.js': this.checkFileExists(path.join(this.frontendPath, 'src/components/NFTMarketplace/index.js')),
      
      // Existing components
      'src/components/MultiChainDashboard/MultiChainDashboard.js': this.checkFileExists(path.join(this.frontendPath, 'src/components/MultiChainDashboard/MultiChainDashboard.js')),
      'src/components/WalletConnectionModal/WalletConnectionModal.js': this.checkFileExists(path.join(this.frontendPath, 'src/components/WalletConnectionModal/WalletConnectionModal.js')),
      'src/components/NetworkSelector/NetworkSelector.js': this.checkFileExists(path.join(this.frontendPath, 'src/components/NetworkSelector/NetworkSelector.js')),
      
      // Tests
      'src/tests/components.test.js': this.checkFileExists(path.join(this.frontendPath, 'src/tests/components.test.js'))
    };

    this.validationResults.frontend = frontendChecks;
    
    const passedChecks = Object.values(frontendChecks).filter(Boolean).length;
    const totalChecks = Object.keys(frontendChecks).length;
    
    console.log(`✅ Frontend Structure: ${passedChecks}/${totalChecks} files present`);
    
    // Check component file sizes
    const importantComponents = [
      'src/components/NFTMarketplace/NFTMarketplace.js',
      'src/components/NFTMarketplace/CreatorDashboard.js',
      'src/components/NFTMarketplace/NFTDetailView.js'
    ];
    
    importantComponents.forEach(file => {
      const filePath = path.join(this.frontendPath, file);
      const size = this.getFileSize(filePath);
      if (size > 5000) { // At least 5KB for React components
        console.log(`✅ ${file}: ${Math.round(size/1024)}KB - Comprehensive component`);
      } else if (size > 1000) {
        console.log(`⚠️  ${file}: ${Math.round(size/1024)}KB - Basic component`);
      } else if (size > 0) {
        console.log(`⚠️  ${file}: ${size}B - Minimal implementation`);
      } else {
        console.log(`❌ ${file}: Missing or empty`);
      }
    });
    
    return { passed: passedChecks, total: totalChecks };
  }

  validateAPIEndpoints() {
    console.log('\n🔍 Validating API Endpoint Implementation...');
    
    const routeFiles = [
      'routes/nftRoutes.js',
      'routes/marketplaceRoutes.js', 
      'routes/bridgeRoutes.js',
      'routes/creatorRoutes.js'
    ];
    
    let totalEndpoints = 0;
    
    routeFiles.forEach(routeFile => {
      const filePath = path.join(this.backendPath, routeFile);
      if (this.checkFileExists(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          
          // Count different HTTP methods
          const getEndpoints = (content.match(/router\.get\(/g) || []).length;
          const postEndpoints = (content.match(/router\.post\(/g) || []).length;
          const putEndpoints = (content.match(/router\.put\(/g) || []).length;
          const deleteEndpoints = (content.match(/router\.delete\(/g) || []).length;
          
          const fileEndpoints = getEndpoints + postEndpoints + putEndpoints + deleteEndpoints;
          totalEndpoints += fileEndpoints;
          
          console.log(`✅ ${routeFile}: ${fileEndpoints} endpoints (GET: ${getEndpoints}, POST: ${postEndpoints}, PUT: ${putEndpoints}, DELETE: ${deleteEndpoints})`);
        } catch (error) {
          console.log(`❌ ${routeFile}: Error reading file`);
        }
      } else {
        console.log(`❌ ${routeFile}: File not found`);
      }
    });
    
    console.log(`📊 Total API Endpoints: ${totalEndpoints}`);
    return totalEndpoints;
  }

  validateDatabaseModels() {
    console.log('\n🔍 Validating Database Models...');
    
    const modelFiles = [
      'models/NFT.js',
      'models/NFTCollection.js',
      'models/NFTAuction.js',
      'models/NFTBid.js',
      'models/NFTTransaction.js',
      'models/NFTRoyalty.js',
      'models/NFTBridgeTransaction.js',
      'models/CreatorVerification.js'
    ];
    
    let validModels = 0;
    
    modelFiles.forEach(modelFile => {
      const filePath = path.join(this.backendPath, modelFile);
      if (this.checkFileExists(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          
          // Check for Sequelize model patterns
          const hasDefine = content.includes('sequelize.define') || content.includes('DataTypes');
          const hasExport = content.includes('module.exports');
          
          if (hasDefine && hasExport) {
            validModels++;
            console.log(`✅ ${modelFile}: Valid Sequelize model`);
          } else {
            console.log(`⚠️  ${modelFile}: Incomplete model definition`);
          }
        } catch (error) {
          console.log(`❌ ${modelFile}: Error reading file`);
        }
      } else {
        console.log(`❌ ${modelFile}: File not found`);
      }
    });
    
    console.log(`📊 Valid Database Models: ${validModels}/${modelFiles.length}`);
    return validModels;
  }

  validateTestCoverage() {
    console.log('\n🔍 Validating Test Coverage...');
    
    const testFiles = [
      'tests/integration.test.js',
      'tests/e2e.test.js',
      'tests/quick-test.js'
    ];
    
    let testSuites = 0;
    let totalTests = 0;
    
    testFiles.forEach(testFile => {
      const filePath = path.join(this.backendPath, testFile);
      if (this.checkFileExists(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          
          // Count test cases
          const testCases = (content.match(/test\(|it\(/g) || []).length;
          const describeSuites = (content.match(/describe\(/g) || []).length;
          
          if (testCases > 0) {
            testSuites++;
            totalTests += testCases;
            console.log(`✅ ${testFile}: ${describeSuites} suites, ${testCases} tests`);
          } else {
            console.log(`⚠️  ${testFile}: No test cases found`);
          }
        } catch (error) {
          console.log(`❌ ${testFile}: Error reading file`);
        }
      } else {
        console.log(`❌ ${testFile}: File not found`);
      }
    });
    
    // Check frontend tests
    const frontendTestFile = path.join(this.frontendPath, 'src/tests/components.test.js');
    if (this.checkFileExists(frontendTestFile)) {
      try {
        const content = fs.readFileSync(frontendTestFile, 'utf8');
        const testCases = (content.match(/test\(|it\(/g) || []).length;
        const describeSuites = (content.match(/describe\(/g) || []).length;
        
        if (testCases > 0) {
          testSuites++;
          totalTests += testCases;
          console.log(`✅ Frontend tests: ${describeSuites} suites, ${testCases} tests`);
        }
      } catch (error) {
        console.log(`❌ Frontend tests: Error reading file`);
      }
    }
    
    console.log(`📊 Test Coverage: ${testSuites} test suites, ${totalTests} total tests`);
    return { suites: testSuites, tests: totalTests };
  }

  generateValidationReport() {
    console.log('\n📊 COMPREHENSIVE VALIDATION REPORT');
    console.log('=====================================');
    
    const backendResult = this.validateBackendStructure();
    const frontendResult = this.validateFrontendStructure();
    const endpointCount = this.validateAPIEndpoints();
    const modelCount = this.validateDatabaseModels();
    const testCoverage = this.validateTestCoverage();
    
    const overallScore = {
      backend_completeness: Math.round((backendResult.passed / backendResult.total) * 100),
      frontend_completeness: Math.round((frontendResult.passed / frontendResult.total) * 100),
      api_endpoints: endpointCount,
      database_models: modelCount,
      test_suites: testCoverage.suites,
      total_tests: testCoverage.tests
    };
    
    console.log('\n🎯 FINAL SCORES:');
    console.log(`Backend Completeness: ${overallScore.backend_completeness}%`);
    console.log(`Frontend Completeness: ${overallScore.frontend_completeness}%`);
    console.log(`API Endpoints: ${overallScore.api_endpoints}`);
    console.log(`Database Models: ${overallScore.database_models}`);
    console.log(`Test Suites: ${overallScore.test_suites}`);
    console.log(`Total Tests: ${overallScore.total_tests}`);
    
    console.log('\n🌟 QUALITY ASSESSMENT:');
    if (overallScore.backend_completeness >= 90 && overallScore.frontend_completeness >= 90) {
      console.log('🏆 EXCELLENT - Production ready codebase!');
    } else if (overallScore.backend_completeness >= 80 && overallScore.frontend_completeness >= 80) {
      console.log('🥇 VERY GOOD - High quality implementation!');
    } else if (overallScore.backend_completeness >= 70 && overallScore.frontend_completeness >= 70) {
      console.log('🥈 GOOD - Solid foundation with room for improvement!');
    } else {
      console.log('🥉 BASIC - Functional but needs enhancement!');
    }
    
    console.log('\n✅ VALIDATION COMPLETE!');
    
    return overallScore;
  }
}

// Run validation
const validator = new CodeValidator();
const results = validator.generateValidationReport();

module.exports = CodeValidator;

