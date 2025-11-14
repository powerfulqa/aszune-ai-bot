const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const os = require('os');
const databaseService = require('./database');
const logger = require('../utils/logger');
const { ErrorHandler } = require('../utils/error-handler');

class WebDashboardService {
  constructor() {
    this.app = null;
    this.server = null;
    this.io = null;
    this.metricsInterval = null;
    this.isRunning = false;
    this.startTime = Date.now();
    this.errorLogs = []; // Buffer for error logs
    this.maxErrorLogs = 75; // Keep last 75 errors for professional log snapshot
    this.setupErrorInterception();
  }

  /**
   * Initialize and start the web dashboard
   * @param {number} port - Port to run the dashboard on (optional for testing)
   */
  async start(port) {
    try {
      if (this.isRunning) {
        logger.warn('Web dashboard is already running');
        return;
      }

      // Use provided port, or default to 3000, or find random port for testing
      const defaultPort = port || 3000;
      const testPort = process.env.NODE_ENV === 'test' ? await this.findAvailablePort() : defaultPort;

      this.app = express();
      this.server = http.createServer(this.app);
      this.io = socketIo(this.server, {
        cors: {
          origin: '*',
          methods: ['GET', 'POST']
        }
      });

      this.setupMiddleware();
      this.setupRoutes();
      this.setupSocketHandlers();
      this.startMetricsBroadcast();

      await new Promise((resolve, reject) => {
        this.server.listen(testPort, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      this.isRunning = true;
      logger.info(`Web dashboard started on port ${testPort}`);
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'starting web dashboard');
      logger.error(`Failed to start web dashboard: ${errorResponse.message}`);
      throw error;
    }
  }

  /**
   * Find an available port for testing
   * @returns {Promise<number>} Available port number
   */
  async findAvailablePort() {
    return new Promise((resolve, reject) => {
      const testServer = http.createServer();
      testServer.listen(0, () => {
        const port = testServer.address().port;
        testServer.close(() => resolve(port));
      });
      testServer.on('error', reject);
    });
  }

  /**
   * Stop the web dashboard
   */
  async stop() {
    try {
      if (!this.isRunning) return;

      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
        this.metricsInterval = null;
      }

      if (this.io) {
        this.io.close();
        this.io = null;
      }

      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(resolve);
        });
        this.server = null;
      }

      this.app = null;
      this.isRunning = false;
      logger.info('Web dashboard stopped');
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'stopping web dashboard');
      logger.error(`Failed to stop web dashboard: ${errorResponse.message}`);
      throw error;
    }
  }

  /**
   * Setup error logging interception
   */
  setupErrorInterception() {
    // Intercept logger.error calls to track errors for dashboard
    const originalError = logger.error.bind(logger);
    logger.error = (message, error) => {
      // Add to error log buffer
      this.errorLogs.push({
        timestamp: new Date().toISOString(),
        message,
        error: error ? (error.message || String(error)) : null
      });

      // Keep only last N errors
      if (this.errorLogs.length > this.maxErrorLogs) {
        this.errorLogs.shift();
      }

      // Call original error method
      return originalError(message, error);
    };
  }

  /**
   * Get recent error logs
   * @param {number} limit - Number of recent errors to return
   * @returns {Array} Array of recent errors
   */
  getRecentErrors(limit = 10) {
    return this.errorLogs.slice(-limit).reverse(); // Return most recent first
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // Serve static files from dashboard directory
    this.app.use(express.static(path.join(__dirname, '../../dashboard/public')));

    // JSON parsing
    this.app.use(express.json());

    // CORS headers
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health and metrics
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        uptime: this.getUptime(),
        timestamp: new Date().toISOString()
      });
    });

    this.app.get('/api/metrics', async (req, res) => {
      try {
        const metrics = await this.getMetrics();
        res.json(metrics);
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'getting metrics');
        res.status(500).json({
          error: errorResponse.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    this.app.get('/api/system', (req, res) => {
      res.json(this.getSystemInfo());
    });

    this.setupDatabaseRoutes();
    this.setupVersionRoutes();
    this.setupRecommendationRoutes();
    this.setupControlRoutes();

    // Serve the main dashboard page
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../../dashboard/public/index.html'));
    });
  }

  /**
   * Setup database-related routes
   * @private
   */
  setupDatabaseRoutes() {
    this.app.get('/api/database/:table', async (req, res) => {
      try {
        const { table } = req.params;
        const { limit = 100, offset = 0 } = req.query;
        const data = await this.getDatabaseTableContents(table, parseInt(limit), parseInt(offset));
        res.json(data);
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, `getting database table ${req.params.table}`);
        res.status(400).json({
          error: errorResponse.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    this.app.get('/api/database-schema', async (req, res) => {
      try {
        const schema = await this.getDatabaseSchema();
        res.json(schema);
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'getting database schema');
        res.status(500).json({
          error: errorResponse.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Setup version-related routes
   * @private
   */
  setupVersionRoutes() {
    this.app.get('/api/version', (req, res) => {
      res.json(this.getVersionInfo());
    });
  }

  /**
   * Setup recommendation routes
   * @private
   */
  setupRecommendationRoutes() {
    this.app.get('/api/recommendations', async (req, res) => {
      try {
        const recommendations = await this.getDetailedRecommendations();
        res.json(recommendations);
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'getting recommendations');
        res.status(500).json({
          error: errorResponse.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Setup control routes for bot management
   * @private
   */
  setupControlRoutes() {
    this.app.post('/api/control/restart', async (req, res) => {
      try {
        logger.info('Restart command received from dashboard');
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);

                // Determine service name - typically 'aszune-ai-bot' or similar
        const serviceName = process.env.SERVICE_NAME || 'aszune-ai-bot';
        
        try {
          let restartCmd;
          // Always try without sudo first, since we're likely running as root
          restartCmd = `systemctl restart ${serviceName}`;
          
          logger.info(`Attempting restart with: ${restartCmd}`);
          await execPromise(restartCmd, {
            timeout: 10000
          });
          
          logger.info(`Bot restart initiated via systemctl (${serviceName})`);
          res.json({
            success: true,
            message: `Bot restart initiated via systemctl ${serviceName}`,
            timestamp: new Date().toISOString()
          });
        } catch (systemctlError) {
          logger.warn(`Systemctl restart failed: ${systemctlError.message}`);
          logger.info('Attempting with sudo...');
          
          try {
            // Retry with sudo
            await execPromise(`sudo systemctl restart ${serviceName}`, {
              timeout: 10000
            });
            logger.info('Bot restart succeeded with sudo');
            res.json({
              success: true,
              message: 'Bot restart initiated via systemctl (with sudo)',
              timestamp: new Date().toISOString()
            });
          } catch (sudoError) {
            logger.warn(`Systemctl with sudo also failed: ${sudoError.message}`);
            logger.info('Attempting direct process restart (fallback)...');
            
            // Fallback: direct process exit
            res.json({
              success: true,
              message: 'Bot restart initiated (fallback mode)',
              timestamp: new Date().toISOString()
            });
            
            setTimeout(() => {
              logger.info('Executing direct bot restart');
              process.exit(0);
            }, 500);
          }
        }
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'restarting bot');
        logger.error(`Restart error: ${error.message}`);
        res.status(500).json({
          success: false,
          error: errorResponse.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    this.app.post('/api/control/git-pull', async (req, res) => {
      try {
        logger.info('Git pull command received from dashboard');
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);

        try {
          const { stdout, stderr } = await execPromise('git pull origin main', {
            cwd: path.join(__dirname, '../../'),
            timeout: 30000
          });

          logger.info('Git pull completed successfully');
          res.json({
            success: true,
            message: 'Git pull completed successfully',
            output: stdout,
            timestamp: new Date().toISOString()
          });
        } catch (pullError) {
          // Check for permission errors
          const errorMsg = pullError.message || '';
          const stderrMsg = pullError.stderr || '';
          
          if (stderrMsg.includes('Permission denied') || errorMsg.includes('EACCES')) {
            logger.error(`Git pull permission denied: ${errorMsg}`);
            res.status(403).json({
              success: false,
              error: 'Permission denied - the current user cannot write to the repository',
              details: 'Make sure the bot process has write permissions to the git repository directory',
              output: stderrMsg || errorMsg,
              timestamp: new Date().toISOString()
            });
          } else {
            logger.error(`Git pull failed: ${errorMsg}`);
            res.status(400).json({
              success: false,
              error: 'Git pull failed',
              details: errorMsg,
              output: stderrMsg || errorMsg,
              timestamp: new Date().toISOString()
            });
          }
        }
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'executing git pull');
        res.status(500).json({
          success: false,
          error: errorResponse.message,
          output: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Setup Socket.IO handlers
   */
  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      logger.debug(`Dashboard client connected: ${socket.id}`);

      // Send initial metrics
      this.getMetrics().then(metrics => {
        socket.emit('metrics', metrics);
      }).catch(error => {
        const errorResponse = ErrorHandler.handleError(error, 'sending initial metrics');
        socket.emit('error', { message: errorResponse.message });
      });

      socket.on('disconnect', () => {
        logger.debug(`Dashboard client disconnected: ${socket.id}`);
      });

      socket.on('request-metrics', () => {
        this.getMetrics().then(metrics => {
          socket.emit('metrics', metrics);
        }).catch(error => {
          const errorResponse = ErrorHandler.handleError(error, 'sending requested metrics');
          socket.emit('error', { message: errorResponse.message });
        });
      });
    });
  }

  /**
   * Start broadcasting metrics to connected clients
   */
  startMetricsBroadcast() {
    this.metricsInterval = setInterval(async () => {
      try {
        if (this.io && this.io.sockets.sockets.size > 0) {
          const metrics = await this.getMetrics();
          this.io.emit('metrics', metrics);
        }
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'broadcasting metrics');
        logger.warn(`Metrics broadcast error: ${errorResponse.message}`);
      }
    }, 5000); // Update every 5 seconds
  }

  /**
   * Get comprehensive metrics from all services
   * @returns {Promise<Object>} Metrics object
   */
  async getMetrics() {
    try {
      const [
        cacheStats,
        databaseStats,
        reminderStats,
        systemInfo,
        resourceData,
        analyticsData
      ] = await Promise.all([
        this.getCacheStats(),
        this.getDatabaseStats(),
        this.getReminderStats(),
        Promise.resolve(this.getSystemInfo()),
        this.getResourceData(),
        this.getAnalyticsData()
      ]);

      return {
        timestamp: new Date().toISOString(),
        uptime: this.getUptime(),
        cache: cacheStats,
        database: databaseStats,
        reminders: reminderStats,
        system: systemInfo,
        resources: resourceData,
        analytics: analyticsData
      };
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'aggregating metrics');
      logger.error(`Metrics aggregation error: ${errorResponse.message}`);
      throw error;
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache stats
   */
  async getCacheStats() {
    try {
      // Import cache manager dynamically to avoid circular dependencies
      const PerplexityService = require('./perplexity-secure');
      const service = new PerplexityService();
      return service.getCacheStats();
    } catch (error) {
      logger.warn(`Failed to get cache stats: ${error.message}`);
      return {
        hits: 0,
        misses: 0,
        hitRate: 0,
        sets: 0,
        deletes: 0,
        evictions: 0,
        entryCount: 0,
        memoryUsage: 0,
        memoryUsageFormatted: '0 B',
        uptime: 0,
        uptimeFormatted: '0s'
      };
    }
  }

  /**
   * Get database statistics
   * @returns {Promise<Object>} Database stats
   */
  async getDatabaseStats() {
    try {
      // Get user count
      const userCount = databaseService.getUserCount ? databaseService.getUserCount() : 0;

      // Get total messages
      const totalMessages = databaseService.getTotalMessageCount ? databaseService.getTotalMessageCount() : 0;

      // Get reminder stats
      const reminderStats = databaseService.getReminderStats();

      return {
        userCount,
        totalMessages,
        reminders: reminderStats
      };
    } catch (error) {
      logger.warn(`Failed to get database stats: ${error.message}`);
      return {
        userCount: 0,
        totalMessages: 0,
        reminders: {
          totalReminders: 0,
          activeReminders: 0,
          completedReminders: 0,
          cancelledReminders: 0
        }
      };
    }
  }

  /**
   * Get reminder statistics
   * @returns {Promise<Object>} Reminder stats
   */
  async getReminderStats() {
    try {
      // Get stats from database service
      return databaseService.getReminderStats();
    } catch (error) {
      logger.warn(`Failed to get reminder stats: ${error.message}`);
      return {
        totalReminders: 0,
        activeReminders: 0,
        completedReminders: 0,
        cancelledReminders: 0
      };
    }
  }

  /**
   * Get system information
   * @returns {Object} System info
   */
  getSystemInfo() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const processMemory = process.memoryUsage();

    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: os.uptime(),
      uptimeFormatted: this.formatUptime(os.uptime() * 1000),
      memory: {
        total: totalMemory,
        free: freeMemory,
        used: usedMemory,
        totalFormatted: this.formatBytes(totalMemory),
        freeFormatted: this.formatBytes(freeMemory),
        usedFormatted: this.formatBytes(usedMemory),
        usagePercent: Math.round((usedMemory / totalMemory) * 100)
      },
      process: {
        pid: process.pid,
        rss: processMemory.rss,
        heapTotal: processMemory.heapTotal,
        heapUsed: processMemory.heapUsed,
        external: processMemory.external,
        rssFormatted: this.formatBytes(processMemory.rss),
        heapTotalFormatted: this.formatBytes(processMemory.heapTotal),
        heapUsedFormatted: this.formatBytes(processMemory.heapUsed)
      },
      cpu: {
        count: os.cpus().length,
        model: os.cpus()[0]?.model || 'Unknown',
        loadAverage: os.loadavg(),
        loadPercent: Math.round((os.loadavg()[0] / os.cpus().length) * 100)
      }
    };
  }

  /**
   * Get dashboard uptime
   * @returns {string} Formatted uptime
   */
  getUptime() {
    return this.formatUptime(Date.now() - this.startTime);
  }

  /**
   * Get resource optimization data (similar to /resources command)
   * @returns {Promise<Object>} Resource data
   */
  async getResourceData() {
    try {
      const ResourceOptimizer = require('./resource-optimizer');
      const resourceStatus = await ResourceOptimizer.monitorResources();
      
      return {
        memory: {
          status: resourceStatus.memory.status,
          used: resourceStatus.memory.used,
          free: resourceStatus.memory.free,
          percentage: Math.round(resourceStatus.memory.percentage)
        },
        performance: {
          status: resourceStatus.performance.status,
          responseTime: resourceStatus.performance.responseTime,
          load: resourceStatus.performance.load
        },
        optimizationTier: resourceStatus.optimizationTier || 'Standard'
      };
    } catch (error) {
      logger.warn(`Failed to get resource data: ${error.message}`);
      return {
        memory: { status: 'unknown', used: 0, free: 0, percentage: 0 },
        performance: { status: 'unknown', responseTime: 0, load: 'unknown' },
        optimizationTier: 'Standard'
      };
    }
  }

  /**
   * Get analytics data (similar to /analytics command)
   * @returns {Promise<Object>} Analytics data
   */
  async getAnalyticsData() {
    try {
      const databaseStats = await this.getDatabaseStats();
      
      // Get optimization recommendations
      let recommendations = [];
      try {
        const ResourceOptimizer = require('./resource-optimizer');
        const DiscordAnalytics = require('../utils/discord-analytics');
        const analyticsData = await DiscordAnalytics.generateDailyReport();
        const resourceStatus = await ResourceOptimizer.monitorResources();
        
        recommendations = await ResourceOptimizer.generateOptimizationRecommendations(
          analyticsData,
          { averageResponseTime: resourceStatus.performance.responseTime }
        );
      } catch (err) {
        logger.debug(`Could not generate recommendations: ${err.message}`);
        recommendations = ['System monitoring active'];
      }

      return {
        summary: {
          totalServers: 1,
          totalUsers: databaseStats.userCount,
          totalCommands: 0,
          successRate: 100,
          errorRate: 0,
          avgResponseTime: 0
        },
        recommendations: recommendations.slice(0, 3),
        recentErrors: this.getRecentErrors(10)
      };
    } catch (error) {
      logger.warn(`Failed to get analytics data: ${error.message}`);
      return {
        summary: {
          totalServers: 1,
          totalUsers: 0,
          totalCommands: 0,
          successRate: 100,
          errorRate: 0,
          avgResponseTime: 0
        },
        recommendations: ['System monitoring active'],
        recentErrors: this.getRecentErrors(10)
      };
    }
  }

  /**
   * Get dashboard uptime
   * @returns {string} Formatted uptime
   */
  getUptimeFormatted() {
    return this.formatUptime(Date.now() - this.startTime);
  }

  /**
   * Format uptime in human-readable format
   * @param {number} ms - Milliseconds
   * @returns {string} Formatted uptime
   */
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Format bytes in human-readable format
   * @param {number} bytes - Bytes
   * @returns {string} Formatted size
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get version and commit information
   * @returns {Object} Version info
   */
  getVersionInfo() {
    try {
      const packageJson = require('../../package.json');
      const { execSync } = require('child_process');
      
      let commitSha = 'unknown';
      let commitUrl = '';
      let releaseUrl = '';
      
      try {
        commitSha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
        commitUrl = `https://github.com/chrishaycock/aszune-ai-bot/commit/${commitSha}`;
      } catch (e) {
        // Git not available
      }

      const version = packageJson.version || '1.8.0';
      releaseUrl = `https://github.com/chrishaycock/aszune-ai-bot/releases/tag/v${version}`;

      return {
        version,
        commit: commitSha,
        commitUrl,
        releaseUrl,
        nodeVersion: process.version,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.warn(`Failed to get version info: ${error.message}`);
      return {
        version: '1.8.0',
        commit: 'unknown',
        commitUrl: '',
        releaseUrl: 'https://github.com/chrishaycock/aszune-ai-bot/releases',
        nodeVersion: process.version,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get database schema (list of tables with row counts)
   * @returns {Promise<Object>} Database schema
   */
  async getDatabaseSchema() {
    try {
      const tables = [];
      
      // Define expected tables
      const expectedTables = ['users', 'user_messages', 'conversation_history', 'reminders'];
      
      for (const tableName of expectedTables) {
        try {
          const count = await this.getDatabaseTableRowCount(tableName);
          tables.push({
            name: tableName,
            rowCount: count,
            description: this.getTableDescription(tableName)
          });
        } catch (e) {
          logger.debug(`Table ${tableName} not found or error reading: ${e.message}`);
        }
      }
      
      return {
        tables,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.warn(`Failed to get database schema: ${error.message}`);
      return {
        tables: [],
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get table description
   * @param {string} tableName - Table name
   * @returns {string} Description
   * @private
   */
  getTableDescription(tableName) {
    const descriptions = {
      users: 'User profiles and stats',
      user_messages: 'Legacy user messages (deprecated)',
      conversation_history: 'AI conversation history with roles',
      reminders: 'User reminders with scheduling info'
    };
    return descriptions[tableName] || 'Unknown table';
  }

  /**
   * Get row count for a table
   * @param {string} tableName - Table name
   * @returns {Promise<number>} Row count
   * @private
   */
  async getDatabaseTableRowCount(tableName) {
    return new Promise((resolve, reject) => {
      try {
        if (!databaseService.getDb) {
          reject(new Error('Database not available'));
          return;
        }

        const db = databaseService.getDb();
        if (!db) {
          reject(new Error('Database connection unavailable'));
          return;
        }

        const result = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
        resolve(result?.count || 0);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get database table contents with pagination
   * @param {string} tableName - Table name
   * @param {number} limit - Row limit
   * @param {number} offset - Row offset
   * @returns {Promise<Object>} Table data
   */
  async getDatabaseTableContents(tableName, limit = 100, offset = 0) {
    return new Promise((resolve, reject) => {
      try {
        // Validate table name (prevent SQL injection)
        const validTables = ['user_stats', 'user_messages', 'conversation_history', 'reminders'];
        if (!validTables.includes(tableName)) {
          reject(new Error(`Invalid table: ${tableName}`));
          return;
        }

        if (!databaseService.getDb) {
          reject(new Error('Database not available'));
          return;
        }

        const db = databaseService.getDb();
        if (!db) {
          reject(new Error('Database connection unavailable'));
          return;
        }

        // Get total count
        const countResult = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
        const totalRows = countResult?.count || 0;

        // Get limited data
        const data = db.prepare(`SELECT * FROM ${tableName} LIMIT ? OFFSET ?`).all(limit, offset);

        resolve({
          table: tableName,
          totalRows,
          limit,
          offset,
          returnedRows: data?.length || 0,
          columns: this.getTableColumns(tableName),
          data: data || [],
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.warn(`Failed to get database contents for ${tableName}: ${error.message}`);
        reject(error);
      }
    });
  }

  /**
   * Get table column names
   * @param {string} tableName - Table name
   * @returns {Array<string>} Column names
   * @private
   */
  getTableColumns(tableName) {
    const columns = {
      users: ['user_id', 'username', 'message_count', 'summary_count', 'last_active'],
      user_messages: ['id', 'user_id', 'message_content', 'timestamp'],
      conversation_history: ['id', 'user_id', 'role', 'message', 'timestamp'],
      reminders: ['id', 'user_id', 'message', 'scheduled_time', 'status', 'created_at']
    };
    return columns[tableName] || [];
  }

  /**
   * Get detailed recommendations based on metrics
   * @returns {Promise<Array>} Recommendations
   */
  async getDetailedRecommendations() {
    try {
      const recommendations = [];
      const metrics = await this.getMetrics();

      this.addMemoryRecommendations(recommendations, metrics);
      this.addPerformanceRecommendations(recommendations, metrics);
      this.addDatabaseRecommendations(recommendations, metrics);

      // System health
      if (recommendations.length === 0) {
        recommendations.push({
          category: 'general',
          severity: 'info',
          message: 'System healthy and performing optimally',
          action: 'Continue monitoring',
          timestamp: new Date().toISOString()
        });
      }

      return recommendations.slice(0, 5); // Return top 5 recommendations
    } catch (error) {
      logger.warn(`Failed to generate recommendations: ${error.message}`);
      return [
        {
          category: 'general',
          severity: 'info',
          message: 'System monitoring active',
          action: 'Continue monitoring',
          timestamp: new Date().toISOString()
        }
      ];
    }
  }

  /**
   * Add memory-related recommendations
   * @private
   */
  addMemoryRecommendations(recommendations, metrics) {
    if (!metrics.system || !metrics.system.process) return;

    const ratio = metrics.system.process.heapUsed / metrics.system.process.heapTotal;
    if (ratio > 0.9) {
      recommendations.push({
        category: 'memory',
        severity: 'critical',
        message: 'Heap memory usage exceeds 90%',
        action: 'Consider cache cleanup or server restart',
        timestamp: new Date().toISOString()
      });
    } else if (ratio > 0.75) {
      recommendations.push({
        category: 'memory',
        severity: 'warning',
        message: 'Heap memory usage at 75%+',
        action: 'Monitor memory usage closely',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Add performance-related recommendations
   * @private
   */
  addPerformanceRecommendations(recommendations, metrics) {
    if (metrics.cache && metrics.cache.hitRate < 50) {
      recommendations.push({
        category: 'performance',
        severity: 'warning',
        message: `Cache hit rate is low (${metrics.cache.hitRate}%)`,
        action: 'Review cache configuration and eviction policy',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Add database-related recommendations
   * @private
   */
  addDatabaseRecommendations(recommendations, metrics) {
    if (metrics.database && metrics.database.totalMessages > 10000) {
      recommendations.push({
        category: 'database',
        severity: 'info',
        message: `Database contains ${metrics.database.totalMessages} messages`,
        action: 'Consider archival of old messages',
        timestamp: new Date().toISOString()
      });
    }
  }
}

const webDashboardService = new WebDashboardService();
module.exports = webDashboardService;
module.exports.WebDashboardService = WebDashboardService;
module.exports.default = webDashboardService;