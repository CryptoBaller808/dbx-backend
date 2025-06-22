const { Sequelize } = require('sequelize');
const config = require('./config');

/**
 * Enhanced Database Connection Manager for DBX Platform
 * Implements connection pooling, read replicas, health monitoring,
 * and security enhancements for production-grade database operations
 */

class DatabaseManager {
  constructor() {
    this.primaryConnection = null;
    this.readReplicaConnection = null;
    this.isInitialized = false;
    this.healthStatus = {
      primary: 'unknown',
      readReplica: 'unknown',
      lastCheck: null
    };
  }

  /**
   * Initialize database connections with enhanced configuration
   */
  async initialize() {
    try {
      // Initialize primary database connection
      this.primaryConnection = new Sequelize(
        config.primary.DB,
        config.primary.USER,
        config.primary.PASSWORD,
        {
          host: config.primary.HOST,
          port: config.primary.PORT,
          dialect: config.primary.dialect,
          dialectModule: config.primary.dialectModule,
          pool: config.primary.pool,
          dialectOptions: config.primary.dialectOptions,
          logging: config.primary.logging,
          benchmark: config.primary.benchmark,
          define: config.primary.define,
          
          // Enhanced error handling
          retry: {
            max: 3,
            timeout: 5000
          },
          
          // Connection hooks for monitoring
          hooks: {
            beforeConnect: (config) => {
              console.log(`[DB] Connecting to primary database: ${config.host}:${config.port}`);
            },
            afterConnect: (connection, config) => {
              console.log(`[DB] Connected to primary database successfully`);
            },
            beforeDisconnect: (connection) => {
              console.log(`[DB] Disconnecting from primary database`);
            }
          }
        }
      );

      // Initialize read replica connection if configured
      if (config.readReplica.HOST !== config.primary.HOST) {
        this.readReplicaConnection = new Sequelize(
          config.readReplica.DB,
          config.readReplica.USER,
          config.readReplica.PASSWORD,
          {
            host: config.readReplica.HOST,
            port: config.readReplica.PORT,
            dialect: config.readReplica.dialect,
            dialectModule: config.readReplica.dialectModule,
            pool: config.readReplica.pool,
            dialectOptions: config.readReplica.dialectOptions,
            logging: config.readReplica.logging,
            define: config.readReplica.define,
            
            hooks: {
              beforeConnect: (config) => {
                console.log(`[DB] Connecting to read replica: ${config.host}:${config.port}`);
              },
              afterConnect: (connection, config) => {
                console.log(`[DB] Connected to read replica successfully`);
              }
            }
          }
        );
      } else {
        // Use primary connection as read replica if no separate replica configured
        this.readReplicaConnection = this.primaryConnection;
      }

      // Test connections
      await this.testConnections();
      
      // Set up health monitoring
      this.setupHealthMonitoring();
      
      // Set up query monitoring
      this.setupQueryMonitoring();
      
      this.isInitialized = true;
      console.log('[DB] Database manager initialized successfully');
      
      return true;
    } catch (error) {
      console.error('[DB] Failed to initialize database manager:', error);
      throw error;
    }
  }

  /**
   * Test database connections
   */
  async testConnections() {
    try {
      // Test primary connection
      await this.primaryConnection.authenticate();
      this.healthStatus.primary = 'healthy';
      console.log('[DB] Primary database connection established successfully');

      // Test read replica connection
      if (this.readReplicaConnection !== this.primaryConnection) {
        await this.readReplicaConnection.authenticate();
        this.healthStatus.readReplica = 'healthy';
        console.log('[DB] Read replica connection established successfully');
      } else {
        this.healthStatus.readReplica = 'healthy';
      }

      this.healthStatus.lastCheck = new Date().toISOString();
    } catch (error) {
      console.error('[DB] Database connection test failed:', error);
      this.healthStatus.primary = 'unhealthy';
      this.healthStatus.readReplica = 'unhealthy';
      throw error;
    }
  }

  /**
   * Get appropriate connection for query type
   */
  getConnection(queryType = 'read') {
    if (!this.isInitialized) {
      throw new Error('Database manager not initialized');
    }

    // Use read replica for read operations, primary for write operations
    if (queryType === 'read' && this.readReplicaConnection) {
      return this.readReplicaConnection;
    }
    
    return this.primaryConnection;
  }

  /**
   * Execute query with automatic connection selection
   */
  async executeQuery(sql, options = {}) {
    const queryType = this.detectQueryType(sql);
    const connection = this.getConnection(queryType);
    
    const startTime = Date.now();
    
    try {
      const result = await connection.query(sql, {
        type: options.type || Sequelize.QueryTypes.SELECT,
        replacements: options.replacements || {},
        transaction: options.transaction,
        logging: options.logging !== false,
        ...options
      });
      
      const executionTime = Date.now() - startTime;
      
      // Log slow queries
      if (executionTime > config.optimization.slowQueryThreshold) {
        console.warn(`[DB] Slow query detected (${executionTime}ms): ${sql.substring(0, 100)}...`);
      }
      
      return result;
    } catch (error) {
      console.error(`[DB] Query execution failed: ${error.message}`);
      console.error(`[DB] Query: ${sql}`);
      throw error;
    }
  }

  /**
   * Detect query type for connection routing
   */
  detectQueryType(sql) {
    const upperSQL = sql.trim().toUpperCase();
    
    if (upperSQL.startsWith('SELECT') || 
        upperSQL.startsWith('SHOW') || 
        upperSQL.startsWith('DESCRIBE') || 
        upperSQL.startsWith('EXPLAIN')) {
      return 'read';
    }
    
    return 'write';
  }

  /**
   * Set up health monitoring
   */
  setupHealthMonitoring() {
    // Check health every 30 seconds
    setInterval(async () => {
      try {
        await this.checkHealth();
      } catch (error) {
        console.error('[DB] Health check failed:', error);
      }
    }, 30000);
  }

  /**
   * Check database health
   */
  async checkHealth() {
    try {
      // Check primary connection
      const primaryHealth = await config.healthCheck.checkConnection(this.primaryConnection);
      this.healthStatus.primary = primaryHealth.status;

      // Check read replica connection
      if (this.readReplicaConnection !== this.primaryConnection) {
        const replicaHealth = await config.healthCheck.checkConnection(this.readReplicaConnection);
        this.healthStatus.readReplica = replicaHealth.status;
      }

      this.healthStatus.lastCheck = new Date().toISOString();
      
      return this.healthStatus;
    } catch (error) {
      console.error('[DB] Health check error:', error);
      this.healthStatus.primary = 'unhealthy';
      this.healthStatus.readReplica = 'unhealthy';
      throw error;
    }
  }

  /**
   * Get connection pool status
   */
  getPoolStatus() {
    const primaryPool = config.healthCheck.checkPool(this.primaryConnection);
    const replicaPool = this.readReplicaConnection !== this.primaryConnection ? 
      config.healthCheck.checkPool(this.readReplicaConnection) : null;

    return {
      primary: primaryPool,
      readReplica: replicaPool,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Set up query monitoring
   */
  setupQueryMonitoring() {
    // Monitor query performance
    this.primaryConnection.addHook('beforeQuery', (options, query) => {
      query.startTime = Date.now();
    });

    this.primaryConnection.addHook('afterQuery', (options, query) => {
      const executionTime = Date.now() - query.startTime;
      
      if (executionTime > config.optimization.slowQueryThreshold) {
        console.warn(`[DB] Slow query: ${executionTime}ms - ${options.sql?.substring(0, 100)}...`);
      }
    });
  }

  /**
   * Create database indexes for optimization
   */
  async createIndexes() {
    try {
      console.log('[DB] Creating database indexes for optimization...');
      
      for (const index of config.optimization.indexes) {
        try {
          const indexName = `idx_${index.table}_${index.fields.join('_')}`;
          const uniqueClause = index.unique ? 'UNIQUE' : '';
          const fieldsClause = index.fields.join(', ');
          
          const sql = `CREATE ${uniqueClause} INDEX IF NOT EXISTS ${indexName} ON ${index.table} (${fieldsClause})`;
          
          await this.executeQuery(sql, { type: Sequelize.QueryTypes.RAW });
          console.log(`[DB] Created index: ${indexName}`);
        } catch (error) {
          // Index might already exist, log but don't fail
          console.warn(`[DB] Index creation warning for ${index.table}:`, error.message);
        }
      }
      
      console.log('[DB] Database indexes creation completed');
    } catch (error) {
      console.error('[DB] Failed to create indexes:', error);
      throw error;
    }
  }

  /**
   * Optimize database tables
   */
  async optimizeTables() {
    try {
      console.log('[DB] Optimizing database tables...');
      
      // Get all tables
      const tables = await this.executeQuery('SHOW TABLES', { type: Sequelize.QueryTypes.SELECT });
      
      for (const table of tables) {
        const tableName = Object.values(table)[0];
        
        try {
          // Optimize table
          await this.executeQuery(`OPTIMIZE TABLE ${tableName}`, { type: Sequelize.QueryTypes.RAW });
          console.log(`[DB] Optimized table: ${tableName}`);
        } catch (error) {
          console.warn(`[DB] Table optimization warning for ${tableName}:`, error.message);
        }
      }
      
      console.log('[DB] Database table optimization completed');
    } catch (error) {
      console.error('[DB] Failed to optimize tables:', error);
      throw error;
    }
  }

  /**
   * Close all database connections
   */
  async close() {
    try {
      if (this.primaryConnection) {
        await this.primaryConnection.close();
        console.log('[DB] Primary database connection closed');
      }

      if (this.readReplicaConnection && this.readReplicaConnection !== this.primaryConnection) {
        await this.readReplicaConnection.close();
        console.log('[DB] Read replica connection closed');
      }

      this.isInitialized = false;
    } catch (error) {
      console.error('[DB] Error closing database connections:', error);
      throw error;
    }
  }
}

// Create singleton instance
const databaseManager = new DatabaseManager();

module.exports = {
  DatabaseManager,
  databaseManager,
  config
};

