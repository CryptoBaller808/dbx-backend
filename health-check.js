/**
 * DBX Backend Health Check Script
 * Comprehensive health monitoring for Render/Vercel deployment readiness
 */

const express = require('express');
const db = require('./models');

class HealthChecker {
  constructor() {
    this.checks = {
      database: false,
      models: false,
      adapters: false,
      services: false
    };
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Check database connectivity
   */
  async checkDatabase() {
    try {
      await db.sequelize.authenticate();
      console.log('✅ Database connection successful');
      this.checks.database = true;
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      this.errors.push(`Database: ${error.message}`);
      this.checks.database = false;
      return false;
    }
  }

  /**
   * Check model synchronization
   */
  async checkModels() {
    try {
      // Test critical models
      const criticalModels = ['users', 'nft_transactions', 'SystemAlert'];
      const modelResults = {};

      for (const modelName of criticalModels) {
        try {
          const model = db[modelName] || db[modelName.toLowerCase()];
          if (model) {
            // Test basic query
            await model.findOne({ limit: 1 });
            modelResults[modelName] = true;
            console.log(`✅ Model ${modelName} operational`);
          } else {
            modelResults[modelName] = false;
            this.warnings.push(`Model ${modelName} not found`);
            console.warn(`⚠️ Model ${modelName} not found`);
          }
        } catch (error) {
          modelResults[modelName] = false;
          this.warnings.push(`Model ${modelName}: ${error.message}`);
          console.warn(`⚠️ Model ${modelName} error: ${error.message}`);
        }
      }

      // Check if at least basic models work
      const workingModels = Object.values(modelResults).filter(Boolean).length;
      this.checks.models = workingModels >= 2;
      
      if (this.checks.models) {
        console.log(`✅ Models check passed (${workingModels}/${criticalModels.length} working)`);
      } else {
        console.error(`❌ Models check failed (${workingModels}/${criticalModels.length} working)`);
      }

      return this.checks.models;
    } catch (error) {
      console.error('❌ Models check failed:', error.message);
      this.errors.push(`Models: ${error.message}`);
      this.checks.models = false;
      return false;
    }
  }

  /**
   * Check blockchain adapters
   */
  async checkAdapters() {
    try {
      const adapters = ['Solana', 'XRP', 'XLM', 'AVAX', 'BNB'];
      const adapterResults = {};

      for (const adapter of adapters) {
        try {
          // Try to load adapter
          const AdapterClass = require(`./services/blockchain/adapters/${adapter}Adapter.js`);
          adapterResults[adapter] = true;
          console.log(`✅ Adapter ${adapter} loaded`);
        } catch (error) {
          adapterResults[adapter] = false;
          this.warnings.push(`Adapter ${adapter}: ${error.message}`);
          console.warn(`⚠️ Adapter ${adapter} load failed: ${error.message}`);
        }
      }

      // Check if at least some adapters load
      const workingAdapters = Object.values(adapterResults).filter(Boolean).length;
      this.checks.adapters = workingAdapters >= 2;
      
      if (this.checks.adapters) {
        console.log(`✅ Adapters check passed (${workingAdapters}/${adapters.length} working)`);
      } else {
        console.error(`❌ Adapters check failed (${workingAdapters}/${adapters.length} working)`);
      }

      return this.checks.adapters;
    } catch (error) {
      console.error('❌ Adapters check failed:', error.message);
      this.errors.push(`Adapters: ${error.message}`);
      this.checks.adapters = false;
      return false;
    }
  }

  /**
   * Check essential services
   */
  async checkServices() {
    try {
      const services = [
        'RealTimeAnalyticsService',
        'UserManagementService',
        'SystemHealthMonitoringService'
      ];
      const serviceResults = {};

      for (const service of services) {
        try {
          const ServiceClass = require(`./services/${service}.js`);
          serviceResults[service] = true;
          console.log(`✅ Service ${service} loaded`);
        } catch (error) {
          serviceResults[service] = false;
          this.warnings.push(`Service ${service}: ${error.message}`);
          console.warn(`⚠️ Service ${service} load failed: ${error.message}`);
        }
      }

      // Check if at least basic services load
      const workingServices = Object.values(serviceResults).filter(Boolean).length;
      this.checks.services = workingServices >= 2;
      
      if (this.checks.services) {
        console.log(`✅ Services check passed (${workingServices}/${services.length} working)`);
      } else {
        console.error(`❌ Services check failed (${workingServices}/${services.length} working)`);
      }

      return this.checks.services;
    } catch (error) {
      console.error('❌ Services check failed:', error.message);
      this.errors.push(`Services: ${error.message}`);
      this.checks.services = false;
      return false;
    }
  }

  /**
   * Run comprehensive health check
   */
  async runHealthCheck() {
    console.log('🔍 Starting DBX Backend Health Check...');
    const startTime = Date.now();

    // Run all checks
    await this.checkDatabase();
    await this.checkModels();
    await this.checkAdapters();
    await this.checkServices();

    const duration = Date.now() - startTime;
    const passedChecks = Object.values(this.checks).filter(Boolean).length;
    const totalChecks = Object.keys(this.checks).length;

    const result = {
      healthy: passedChecks >= 3, // At least 3 out of 4 checks must pass
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      checks: this.checks,
      passed: passedChecks,
      total: totalChecks,
      errors: this.errors,
      warnings: this.warnings,
      status: passedChecks >= 3 ? 'HEALTHY' : 'UNHEALTHY'
    };

    if (result.healthy) {
      console.log(`✅ Health Check PASSED (${passedChecks}/${totalChecks}) in ${duration}ms`);
    } else {
      console.error(`❌ Health Check FAILED (${passedChecks}/${totalChecks}) in ${duration}ms`);
      console.error('Errors:', this.errors);
    }

    if (this.warnings.length > 0) {
      console.warn('Warnings:', this.warnings);
    }

    return result;
  }
}

/**
 * Create Express app with health check endpoint
 */
function createHealthCheckEndpoint() {
  const app = express();
  
  app.get('/', async (req, res) => {
    try {
      const checker = new HealthChecker();
      const result = await checker.runHealthCheck();
      
      const statusCode = result.healthy ? 200 : 503;
      res.status(statusCode).json(result);
    } catch (error) {
      console.error('Health check endpoint error:', error);
      res.status(500).json({
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        status: 'ERROR'
      });
    }
  });

  app.get('/ping', (req, res) => {
    res.status(200).json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      service: 'DBX Backend'
    });
  });

  return app;
}

/**
 * Standalone health check execution
 */
async function runStandaloneHealthCheck() {
  try {
    const checker = new HealthChecker();
    const result = await checker.runHealthCheck();
    
    // Exit with appropriate code
    process.exit(result.healthy ? 0 : 1);
  } catch (error) {
    console.error('Standalone health check failed:', error);
    process.exit(1);
  }
}

// Export for use in other modules
module.exports = {
  HealthChecker,
  createHealthCheckEndpoint,
  runStandaloneHealthCheck
};

// Run standalone if called directly
if (require.main === module) {
  runStandaloneHealthCheck();
}

