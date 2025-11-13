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
    // Health check endpoint
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        uptime: this.getUptime(),
        timestamp: new Date().toISOString()
      });
    });

    // Get current metrics
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

    // Get system information
    this.app.get('/api/system', (req, res) => {
      res.json(this.getSystemInfo());
    });

    // Serve the main dashboard page
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../../dashboard/public/index.html'));
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
        systemInfo
      ] = await Promise.all([
        this.getCacheStats(),
        this.getDatabaseStats(),
        this.getReminderStats(),
        Promise.resolve(this.getSystemInfo())
      ]);

      return {
        timestamp: new Date().toISOString(),
        uptime: this.getUptime(),
        cache: cacheStats,
        database: databaseStats,
        reminders: reminderStats,
        system: systemInfo
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
      cpu: {
        count: os.cpus().length,
        model: os.cpus()[0]?.model || 'Unknown',
        loadAverage: os.loadavg()
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
}

const webDashboardService = new WebDashboardService();
module.exports = webDashboardService;
module.exports.WebDashboardService = WebDashboardService;
module.exports.default = webDashboardService;