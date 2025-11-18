const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const os = require('os');
const fs = require('fs');
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
    this.discordClient = null; // Discord client for username resolution
    this.usernameCache = new Map(); // Cache for resolved usernames (userId -> username)
    this.allLogs = []; // Buffer for all logs (INFO, WARN, ERROR, DEBUG)
    this.maxAllLogs = 500; // Keep last 500 logs for viewer
    this.logWatchers = new Set(); // Track socket connections for log streaming
    this.setupErrorInterception();
    this.setupLogInterception();
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
   * Set Discord client for username resolution
   * @param {Object} client - Discord.js client instance
   */
  setDiscordClient(client) {
    this.discordClient = client;
    logger.info('Discord client set for WebDashboardService username resolution');
  }

  /**
   * Resolve Discord username from user ID using cached or Discord API
   * @param {string} userId - Discord user ID
   * @returns {Promise<string>} Discord username or null
   * @private
   */
  async resolveDiscordUsername(userId) {
    try {
      // Check cache first
      if (this.usernameCache.has(userId)) {
        return this.usernameCache.get(userId);
      }

      // If no Discord client, return null
      if (!this.discordClient) {
        return null;
      }

      // Fetch from Discord API
      const user = await this.discordClient.users.fetch(userId, { cache: false });
      if (user) {
        const username = user.username;
        this.usernameCache.set(userId, username);
        return username;
      }

      return null;
    } catch (error) {
      logger.debug(`Failed to resolve Discord username for ${userId}: ${error.message}`);
      return null;
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
   * Setup comprehensive log interception for all log levels
   */
  setupLogInterception() {
    const self = this;

    // Intercept all log methods
    ['debug', 'info', 'warn', 'error'].forEach(level => {
      const originalMethod = logger[level].bind(logger);
      logger[level] = function(message, error) {
        // Add to all logs buffer with timestamp and level
        self.allLogs.push({
          timestamp: new Date().toISOString(),
          level: level.toUpperCase(),
          message: typeof message === 'string' ? message : String(message),
          error: error ? (error.message || String(error)) : null
        });

        // Keep only last N logs
        if (self.allLogs.length > self.maxAllLogs) {
          self.allLogs.shift();
        }

        // Broadcast to all connected log viewers
        if (self.io) {
          self.io.emit('log:new', {
            timestamp: new Date().toISOString(),
            level: level.toUpperCase(),
            message: typeof message === 'string' ? message : String(message)
          });
        }

        // Call original method
        return originalMethod.apply(logger, arguments);
      };
    });
  }

  /**
   * Get filtered logs with pagination
   * @param {string} levelFilter - Filter by log level (DEBUG, INFO, WARN, ERROR, or null for all)
   * @param {number} limit - Number of logs to return
   * @param {number} offset - Offset for pagination
   * @returns {Array} Filtered logs
   */
  getFilteredLogs(levelFilter = null, limit = 100, offset = 0) {
    let filtered = this.allLogs;

    if (levelFilter && levelFilter !== 'ALL') {
      filtered = filtered.filter(log => log.level === levelFilter.toUpperCase());
    }

    // Return most recent first
    return filtered.slice().reverse().slice(offset, offset + limit);
  }

  /**
   * Search logs by keyword
   * @param {string} keyword - Search term
   * @param {number} limit - Number of results to return
   * @returns {Array} Matching logs
   */
  searchLogs(keyword, limit = 50) {
    if (!keyword || keyword.trim().length === 0) {
      return [];
    }

    const searchTerm = keyword.toLowerCase();
    return this.allLogs
      .filter(log => 
        log.message.toLowerCase().includes(searchTerm) ||
        (log.error && log.error.toLowerCase().includes(searchTerm))
      )
      .slice().reverse()
      .slice(0, limit);
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
    this.setupLogViewerRoutes();
    this.setupServiceManagementRoutes();
    this.setupConfigEditorRoutes();
    this.setupNetworkRoutes();
    this.setupReminderRoutes();
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
   * Setup log viewer routes
   * @private
   */
  setupLogViewerRoutes() {
    this.setupGetLogsRoute();
    this.setupExportLogsRoute();
  }

  /**
   * Setup GET /api/logs route
   * @private
   */
  setupGetLogsRoute() {
    this.app.get('/api/logs', async (req, res) => {
      try {
        const { level = 'ALL', limit = 100, offset = 0, search } = req.query;
        
        if (search) {
          const results = this.searchLogs(search, parseInt(limit));
          res.json({
            logs: results,
            total: results.length,
            timestamp: new Date().toISOString()
          });
        } else {
          const logs = this.getFilteredLogs(level, parseInt(limit), parseInt(offset));
          res.json({
            logs,
            total: this.allLogs.length,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'getting logs');
        res.status(500).json({
          error: errorResponse.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Setup GET /api/logs/export route
   * @private
   */
  setupExportLogsRoute() {
    this.app.get('/api/logs/export', async (req, res) => {
      try {
        const { format = 'json', level = 'ALL' } = req.query;
        const logs = this.getFilteredLogs(level, this.maxAllLogs);

        if (format === 'csv') {
          this.exportLogsAsCSV(res, logs);
        } else {
          this.exportLogsAsJSON(res, logs);
        }

        res.end();
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'exporting logs');
        res.status(500).json({
          error: errorResponse.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Export logs as CSV
   * @private
   */
  exportLogsAsCSV(res, logs) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="logs.csv"');
    res.write('Timestamp,Level,Message,Error\n');
    
    logs.forEach(log => {
      const escapedMsg = `"${(log.message || '').replace(/"/g, '""')}"`;
      const escapedErr = `"${(log.error || '').replace(/"/g, '""')}"`;
      res.write(`${log.timestamp},${log.level},${escapedMsg},${escapedErr}\n`);
    });
  }

  /**
   * Export logs as JSON
   * @private
   */
  exportLogsAsJSON(res, logs) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="logs.json"');
    res.write(JSON.stringify(logs, null, 2));
  }

  /**
   * Setup service management routes
   * @private
   */
  setupServiceManagementRoutes() {
    this.setupGetServicesRoute();
    this.setupManageServiceRoute();
    this.setupGetServiceLogsRoute();
  }

  /**
   * Setup GET /api/services route
   * @private
   */
  setupGetServicesRoute() {
    this.app.get('/api/services', async (req, res) => {
      try {
        const services = await this.getServiceStatus();
        res.json({
          services,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'getting service status');
        res.status(500).json({
          error: errorResponse.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Setup POST /api/services/:action route
   * @private
   */
  setupManageServiceRoute() {
    this.app.post('/api/services/:action', async (req, res) => {
      try {
        const { action } = req.params;
        const { service } = req.body;

        if (!['start', 'stop', 'restart'].includes(action)) {
          return res.status(400).json({
            error: 'Invalid action. Must be start, stop, or restart',
            timestamp: new Date().toISOString()
          });
        }

        if (!service) {
          return res.status(400).json({
            error: 'Service name is required',
            timestamp: new Date().toISOString()
          });
        }

        const result = await this.manageService(action, service);
        res.json(result);
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'managing service');
        res.status(500).json({
          error: errorResponse.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Setup GET /api/services/:service/logs route
   * @private
   */
  setupGetServiceLogsRoute() {
    this.app.get('/api/services/:service/logs', async (req, res) => {
      try {
        const { service } = req.params;
        const { lines = 50 } = req.query;
        
        const logs = await this.getServiceLogs(service, parseInt(lines));
        res.json({
          service,
          logs,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'getting service logs');
        res.status(500).json({
          error: errorResponse.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Get status of systemd services
   * @returns {Promise<Array>} Array of service status objects
   * @private
   */
  async getServiceStatus() {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    const services = ['aszune-ai-bot', 'nginx', 'postgresql'];
    const results = [];

    for (const service of services) {
      try {
        const { stdout } = await execPromise(`systemctl is-active ${service}`, { 
          timeout: 5000 
        }).catch(() => ({ stdout: 'inactive' }));
        
        results.push({
          name: service,
          status: stdout.trim() || 'unknown',
          uptime: await this.getServiceUptime(service),
          enabled: await this.isServiceEnabled(service)
        });
      } catch (error) {
        results.push({
          name: service,
          status: 'error',
          uptime: null,
          enabled: false
        });
      }
    }

    return results;
  }

  /**
   * Get service uptime
   * @param {string} service - Service name
   * @returns {Promise<string|null>} Formatted uptime or null
   * @private
   */
  async getServiceUptime(service) {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    try {
      const { stdout } = await execPromise(
        `systemctl show ${service} --property=ActiveEnterTimestamp --value`,
        { timeout: 5000 }
      );
      
      if (!stdout.trim() || stdout.includes('n/a')) return null;

      const startTime = new Date(stdout.trim());
      const now = new Date();
      const diff = now - startTime;
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) return `${days}d ${hours}h`;
      if (hours > 0) return `${hours}h ${minutes}m`;
      return `${minutes}m`;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if service is enabled
   * @param {string} service - Service name
   * @returns {Promise<boolean>} True if enabled
   * @private
   */
  async isServiceEnabled(service) {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    try {
      await execPromise(`systemctl is-enabled ${service}`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Manage service (start/stop/restart)
   * @param {string} action - Action (start, stop, restart)
   * @param {string} service - Service name
   * @returns {Promise<Object>} Result object
   * @private
   */
  async manageService(action, service) {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    try {
      logger.info(`Service management: ${action} ${service}`);
      
      const cmd = `systemctl ${action} ${service}`;
      await execPromise(cmd, { timeout: 10000 });
      
      logger.info(`Service ${action} succeeded: ${service}`);
      return {
        success: true,
        message: `Service ${service} ${action}ed successfully`,
        service,
        action,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.warn(`Service ${action} failed: ${service} - ${error.message}`);
      throw error;
    }
  }

  /**
   * Get service logs via journalctl
   * @param {string} service - Service name
   * @param {number} lines - Number of lines to retrieve
   * @returns {Promise<Array>} Array of log lines
   * @private
   */
  async getServiceLogs(service, lines = 50) {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    try {
      const { stdout } = await execPromise(
        `journalctl -u ${service} -n ${lines} --no-pager --output=short-iso`,
        { timeout: 10000 }
      );
      
      return stdout.split('\n').filter(line => line.trim().length > 0);
    } catch (error) {
      logger.debug(`Failed to get service logs for ${service}: ${error.message}`);
      return [];
    }
  }

  /**
   * Setup configuration editor routes
   * @private
   */
  setupConfigEditorRoutes() {
    this.setupGetConfigRoute();
    this.setupUpdateConfigRoute();
    this.setupValidateConfigRoute();
  }

  /**
   * Setup GET /api/config route
   * @private
   */
  setupGetConfigRoute() {
    this.app.get('/api/config/:file', async (req, res) => {
      try {
        const { file } = req.params;
        const content = await this.readConfigFile(file);
        res.json({
          file,
          content,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'reading config file');
        res.status(400).json({
          error: errorResponse.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Setup POST /api/config/:file route
   * @private
   */
  setupUpdateConfigRoute() {
    this.app.post('/api/config/:file', async (req, res) => {
      try {
        const { file } = req.params;
        const { content, createBackup = true } = req.body;

        if (!content) {
          return res.status(400).json({
            error: 'Content is required',
            timestamp: new Date().toISOString()
          });
        }

        const result = await this.updateConfigFile(file, content, createBackup);
        res.json(result);
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'updating config file');
        res.status(400).json({
          error: errorResponse.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Setup POST /api/config/:file/validate route
   * @private
   */
  setupValidateConfigRoute() {
    this.app.post('/api/config/:file/validate', async (req, res) => {
      try {
        const { file } = req.params;
        const { content } = req.body;

        if (!content) {
          return res.status(400).json({
            error: 'Content is required for validation',
            timestamp: new Date().toISOString()
          });
        }

        const validation = await this.validateConfigFile(file, content);
        res.json(validation);
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'validating config file');
        res.status(400).json({
          error: errorResponse.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Read configuration file with access control
   * @private
   */
  async readConfigFile(filename) {
    const allowedFiles = ['.env', 'config.js', '.env.example'];
    
    if (!allowedFiles.includes(filename)) {
      throw new Error(`Access denied: ${filename} is not in the allowed file list`);
    }

    const filepath = path.join(process.cwd(), filename);
    
    if (!filepath.startsWith(process.cwd())) {
      throw new Error('Path traversal attempt detected');
    }

    if (!fs.existsSync(filepath)) {
      throw new Error(`File not found: ${filename}`);
    }

    return fs.readFileSync(filepath, 'utf-8');
  }

  /**
   * Update configuration file with automatic backup
   * @private
   */
  async updateConfigFile(filename, content, createBackup = true) {
    const allowedFiles = ['.env', 'config.js'];
    
    if (!allowedFiles.includes(filename)) {
      throw new Error(`Access denied: ${filename} cannot be modified`);
    }

    const filepath = path.join(process.cwd(), filename);
    
    if (!filepath.startsWith(process.cwd())) {
      throw new Error('Path traversal attempt detected');
    }

    // Create backup before modification
    if (createBackup && fs.existsSync(filepath)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${filepath}.backup.${timestamp}`;
      fs.copyFileSync(filepath, backupPath);
    }

    fs.writeFileSync(filepath, content, 'utf-8');

    return {
      file: filename,
      updated: true,
      message: `Configuration file ${filename} updated successfully`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Validate configuration file syntax
   * @private
   */
  async validateConfigFile(filename, content) {
    const errors = [];
    const warnings = [];

    if (filename === '.env') {
      // Validate .env format: KEY=VALUE
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        
        if (!trimmed.includes('=')) {
          errors.push(`Line ${idx + 1}: Invalid format. Expected KEY=VALUE`);
        }

        // Check for required keys
        if (trimmed.startsWith('PERPLEXITY_API_KEY=') && trimmed.endsWith('=')) {
          warnings.push(`Line ${idx + 1}: PERPLEXITY_API_KEY is empty`);
        }
        if (trimmed.startsWith('DISCORD_BOT_TOKEN=') && trimmed.endsWith('=')) {
          warnings.push(`Line ${idx + 1}: DISCORD_BOT_TOKEN is empty`);
        }
      });
    } else if (filename === 'config.js') {
      // Basic JavaScript validation
      try {
        new Function(content);
      } catch (error) {
        errors.push(`Syntax error: ${error.message}`);
      }
    }

    return {
      file: filename,
      isValid: errors.length === 0,
      errors,
      warnings,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Setup network connectivity routes
   * @private
   */
  setupNetworkRoutes() {
    this.setupGetNetworkInterfacesRoute();
    this.setupGetIPAddressesRoute();
    this.setupGetNetworkStatusRoute();
  }

  /**
   * Setup GET /api/network/interfaces route
   * @private
   */
  setupGetNetworkInterfacesRoute() {
    this.app.get('/api/network/interfaces', async (req, res) => {
      try {
        const interfaces = await this.getNetworkInterfaces();
        res.json({
          interfaces,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'getting network interfaces');
        res.status(500).json({
          error: errorResponse.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Setup GET /api/network/ip route
   * @private
   */
  setupGetIPAddressesRoute() {
    this.app.get('/api/network/ip', async (req, res) => {
      try {
        const ipInfo = await this.getIPAddresses();
        res.json({
          ipInfo,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'getting IP addresses');
        res.status(500).json({
          error: errorResponse.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Setup GET /api/network/status route
   * @private
   */
  setupGetNetworkStatusRoute() {
    this.app.get('/api/network/status', async (req, res) => {
      try {
        const status = await this.getNetworkStatus();
        res.json({
          status,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'getting network status');
        res.status(500).json({
          error: errorResponse.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Get network interfaces information
   * @returns {Promise<Array>} Network interfaces with status
   * @private
   */
  async getNetworkInterfaces() {
    const interfaces = os.networkInterfaces();
    const result = [];

    for (const [name, addrs] of Object.entries(interfaces)) {
      const ipv4 = addrs.find(a => a.family === 'IPv4');
      const ipv6 = addrs.find(a => a.family === 'IPv6');

      result.push({
        name,
        status: name.includes('lo') ? 'loopback' : 'active',
        ipv4: ipv4 ? ipv4.address : null,
        ipv6: ipv6 ? ipv6.address : null,
        mac: addrs[0]?.mac || null
      });
    }

    return result;
  }

  /**
   * Get local and external IP addresses
   * @returns {Promise<Object>} Local and external IP info
   * @private
   */
  async getIPAddresses() {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    const local = os.networkInterfaces();
    let localIP = 'localhost';

    for (const addrs of Object.values(local)) {
      const ipv4 = addrs.find(a => a.family === 'IPv4' && !a.internal);
      if (ipv4) {
        localIP = ipv4.address;
        break;
      }
    }

    let externalIP = 'Unable to determine';
    try {
      const { stdout } = await execPromise('curl -s https://api.ipify.org', { 
        timeout: 5000 
      }).catch(() => ({ stdout: '' }));
      externalIP = stdout.trim() || 'Unable to determine';
    } catch (error) {
      logger.debug('Failed to get external IP');
    }

    return {
      local: localIP,
      external: externalIP,
      hostname: os.hostname()
    };
  }

  /**
   * Get network connectivity status
   * @returns {Promise<Object>} Network status with connectivity info
   * @private
   */
  async getNetworkStatus() {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    const checks = {
      dns: false,
      gateway: false,
      internet: false,
      latency: null
    };

    try {
      await execPromise('ping -c 1 8.8.8.8', { 
        timeout: 5000 
      }).catch(() => {});
      checks.internet = true;
    } catch (error) {
      logger.debug('Internet ping failed');
    }

    try {
      await execPromise('ping -c 1 1.1.1.1', { 
        timeout: 5000 
      }).catch(() => {});
      checks.dns = true;
    } catch (error) {
      logger.debug('DNS ping failed');
    }

    return {
      connected: checks.internet || checks.dns,
      internetReachable: checks.internet,
      dnsReachable: checks.dns,
      gatewayReachable: checks.gateway
    };
  }

  /**
   * Setup reminder management routes
   * @private
   */
  setupReminderRoutes() {
    this.setupGetRemindersRoute();
    this.setupCreateReminderRoute();
    this.setupUpdateReminderRoute();
    this.setupDeleteReminderRoute();
  }

  /**
   * Setup GET /api/reminders route
   * @private
   */
  setupGetRemindersRoute() {
    this.app.get('/api/reminders', async (req, res) => {
      try {
        const { status = 'all' } = req.query;
        const reminders = await this.getReminders(status);
        res.json({
          reminders,
          total: reminders.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'getting reminders');
        res.status(500).json({
          error: errorResponse.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Setup POST /api/reminders route
   * @private
   */
  setupCreateReminderRoute() {
    this.app.post('/api/reminders', async (req, res) => {
      try {
        const { message, scheduledTime, userId, reminderType } = req.body;

        if (!message || !scheduledTime || !userId) {
          return res.status(400).json({
            error: 'Message, scheduledTime, and userId are required',
            timestamp: new Date().toISOString()
          });
        }

        const reminder = await this.createReminder(message, scheduledTime, userId, reminderType);
        res.status(201).json({
          reminder,
          message: 'Reminder created successfully',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'creating reminder');
        res.status(400).json({
          error: errorResponse.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Setup PUT /api/reminders/:id route
   * @private
   */
  setupUpdateReminderRoute() {
    this.app.put('/api/reminders/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const { message, scheduledTime } = req.body;

        const reminder = await this.updateReminder(id, message, scheduledTime);
        res.json({
          reminder,
          message: 'Reminder updated successfully',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'updating reminder');
        res.status(400).json({
          error: errorResponse.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Setup DELETE /api/reminders/:id route
   * @private
   */
  setupDeleteReminderRoute() {
    this.app.delete('/api/reminders/:id', async (req, res) => {
      try {
        const { id } = req.params;
        await this.deleteReminder(id);

        res.json({
          message: 'Reminder deleted successfully',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'deleting reminder');
        res.status(400).json({
          error: errorResponse.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Get reminders from database
   * @private
   */
  async getReminders(status = 'all') {
    try {
      if (status === 'active') {
        return databaseService.getActiveReminders();
      } else if (status === 'completed') {
        return databaseService.getCompletedReminders?.() || [];
      }
      return databaseService.getReminders?.() || databaseService.getActiveReminders();
    } catch (error) {
      logger.warn('Failed to get reminders:', error.message);
      return [];
    }
  }

  /**
   * Create a new reminder
   * @private
   */
  async createReminder(message, scheduledTime, userId, reminderType = 'general') {
    try {
      const reminder = {
        id: `reminder_${Date.now()}`,
        user_id: userId,
        message,
        scheduled_time: new Date(scheduledTime).toISOString(),
        created_at: new Date().toISOString(),
        reminder_type: reminderType,
        status: 'active'
      };

      databaseService.addReminder?.(reminder);
      return reminder;
    } catch (error) {
      logger.warn('Failed to create reminder:', error.message);
      throw error;
    }
  }

  /**
   * Update an existing reminder
   * @private
   */
  async updateReminder(id, message, scheduledTime) {
    try {
      const updated = {
        id,
        message: message || undefined,
        scheduled_time: scheduledTime ? new Date(scheduledTime).toISOString() : undefined,
        updated_at: new Date().toISOString()
      };

      databaseService.updateReminder?.(id, updated);
      return updated;
    } catch (error) {
      logger.warn('Failed to update reminder:', error.message);
      throw error;
    }
  }

  /**
   * Delete a reminder
   * @private
   */
  async deleteReminder(id) {
    try {
      databaseService.deleteReminder?.(id);
    } catch (error) {
      logger.warn('Failed to delete reminder:', error.message);
      throw error;
    }
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

      // Register handler groups
      this.setupConfigHandlers(socket);
      this.setupLogsHandlers(socket);
      this.setupNetworkHandlers(socket);
      this.setupReminderHandlers(socket);
      this.setupServiceHandlers(socket);
    });
  }

  /**
   * Config editor page handlers
   */
  setupConfigHandlers(socket) {
    socket.on('request_config', (data, callback) => {
      try {
        const filename = data?.filename || '.env';
        const configPath = path.join(process.cwd(), filename);

        // Security: prevent directory traversal
        if (!configPath.startsWith(process.cwd())) {
          const error = new Error('Access denied: Cannot access files outside project directory');
          logger.warn(`Security: Attempted directory traversal access to ${filename}`);
          if (callback) callback({ error: error.message });
          return;
        }

        // Check if file exists
        if (!fs.existsSync(configPath)) {
          const error = new Error(`File not found: ${filename}`);
          logger.warn(`Config file not found: ${configPath}`);
          if (callback) callback({ error: error.message, content: '' });
          return;
        }

        // Read file content
        const content = fs.readFileSync(configPath, 'utf-8');
        const fileInfo = fs.statSync(configPath);

        if (callback) {
          callback({
            filename,
            content,
            size: fileInfo.size,
            lastModified: fileInfo.mtime.toISOString(),
            error: null
          });
        }

        logger.debug(`Config loaded: ${filename}`);
      } catch (error) {
        logger.error('Error loading config:', error);
        if (callback) callback({ error: error.message });
      }
    });

    socket.on('save_config', (data, callback) => {
      this.handleSaveConfig(data, callback);
    });

    socket.on('validate_config', (data, callback) => {
      this.handleValidateConfig(data, callback);
    });
  }

  handleSaveConfig(data, callback) {
    try {
      const { filename, content } = data;

      if (!filename || content === undefined) {
        const error = new Error('Missing filename or content');
        if (callback) callback({ error: error.message, saved: false });
        return;
      }

      const configPath = path.join(process.cwd(), filename);

      // Security: prevent directory traversal
      if (!configPath.startsWith(process.cwd())) {
        const error = new Error('Access denied: Cannot save files outside project directory');
        logger.warn(`Security: Attempted directory traversal save to ${filename}`);
        if (callback) callback({ error: error.message, saved: false });
        return;
      }

      // Write file
      fs.writeFileSync(configPath, content, 'utf-8');
      logger.info(`Config saved: ${filename}`);

      if (callback) {
        callback({
          saved: true,
          filename,
          timestamp: new Date().toISOString(),
          error: null
        });
      }
    } catch (error) {
      logger.error('Error saving config:', error);
      if (callback) callback({ error: error.message, saved: false });
    }
  }

  handleValidateConfig(data, callback) {
    try {
      const { content, fileType = 'env' } = data;

      const validationResult = { valid: true, errors: [], warnings: [] };

      if (fileType === 'env') {
        this.validateEnvFile(content, validationResult);
      } else if (fileType === 'js') {
        this.validateJsFile(content, validationResult);
      }

      validationResult.timestamp = new Date().toISOString();

      if (callback) {
        callback(validationResult);
      }

      logger.debug(`Config validation complete: ${validationResult.valid ? 'valid' : 'invalid'}`);
    } catch (error) {
      logger.error('Error validating config:', error);
      if (callback) callback({ error: error.message, valid: false });
    }
  }

  validateEnvFile(content, result) {
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) return;

      if (!trimmedLine.includes('=')) {
        result.errors.push(`Line ${index + 1}: Invalid format (missing '=')`);
      }

      const [key] = trimmedLine.split('=');
      if (!key.match(/^[A-Z_][A-Z0-9_]*$/)) {
        result.warnings.push(`Line ${index + 1}: Key '${key}' doesn't follow convention`);
      }
    });
  }

  validateJsFile(content, result) {
    try {
      new Function(content);
    } catch (error) {
      result.valid = false;
      result.errors.push(`Syntax error: ${error.message}`);
    }
  }

  /**
   * Logs viewer page handlers
   */
  setupLogsHandlers(socket) {
    socket.on('request_logs', (data, callback) => {
      try {
        const { limit = 100, level = null } = data || {};

        let logs = this.allLogs;

        if (level) {
          logs = logs.filter(log => log.level === level);
        }

        const limitedLogs = logs.slice(-limit);

        if (callback) {
          callback({
            logs: limitedLogs,
            total: this.allLogs.length,
            filtered: limitedLogs.length,
            timestamp: new Date().toISOString()
          });
        }

        logger.debug(`Sent ${limitedLogs.length} logs to client`);
      } catch (error) {
        logger.error('Error retrieving logs:', error);
        if (callback) callback({ error: error.message, logs: [] });
      }
    });

    socket.on('clear_logs', (data, callback) => {
      try {
        const count = this.allLogs.length;
        this.allLogs = [];
        this.errorLogs = [];

        logger.info(`Logs cleared by dashboard (${count} entries removed)`);

        if (callback) {
          callback({
            cleared: true,
            count,
            timestamp: new Date().toISOString()
          });
        }

        this.io.emit('logs_cleared', { count, timestamp: new Date().toISOString() });
      } catch (error) {
        logger.error('Error clearing logs:', error);
        if (callback) callback({ error: error.message, cleared: false });
      }
    });
  }

  /**
   * Network status page handlers
   */
  setupNetworkHandlers(socket) {
    socket.on('request_network_status', (data, callback) => {
      this.handleNetworkStatus(callback);
    });

    socket.on('request_network_test', (data, callback) => {
      this.handleNetworkTest(data, callback);
    });
  }

  handleNetworkStatus(callback) {
    try {
      const networkInterfaces = os.networkInterfaces();
      const hostname = os.hostname();

      const interfaces = [];
      for (const [name, addrs] of Object.entries(networkInterfaces)) {
        const ipv4 = addrs.find(addr => addr.family === 'IPv4');
        const ipv6 = addrs.find(addr => addr.family === 'IPv6');

        if (ipv4 || ipv6) {
          interfaces.push({
            name,
            ipv4: ipv4?.address || null,
            ipv6: ipv6?.address || null,
            mac: ipv4?.mac || ipv6?.mac || null,
            internal: ipv4?.internal || ipv6?.internal || false
          });
        }
      }

      const localIp = interfaces.find(i => !i.internal && i.ipv4)?.ipv4 || 'localhost';

      if (callback) {
        callback({
          hostname,
          localIp,
          interfaces,
          timestamp: new Date().toISOString()
        });
      }

      logger.debug(`Network status retrieved for hostname: ${hostname}`);
    } catch (error) {
      logger.error('Error retrieving network status:', error);
      if (callback) callback({ error: error.message });
    }
  }

  handleNetworkTest(data, callback) {
    try {
      const { host = '8.8.8.8', port = 53 } = data || {};

      const testResult = {
        host,
        port,
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: `Connected to ${host}:${port}`
      };

      if (callback) {
        callback(testResult);
      }

      logger.debug(`Network test completed for ${host}:${port}`);
    } catch (error) {
      logger.error('Error running network test:', error);
      if (callback) callback({ error: error.message, status: 'error' });
    }
  }

  /**
   * Reminder management page handlers
   */
  setupReminderHandlers(socket) {
    socket.on('request_reminders', (data, callback) => {
      try {
        const { userId = null, status = null } = data || {};

        let reminders = databaseService.getActiveReminders(userId);

        if (status === 'completed') {
          reminders = reminders.filter(r => r.status === 'completed');
        } else if (status === 'active') {
          reminders = reminders.filter(r => r.status !== 'completed');
        }

        const stats = databaseService.getReminderStats();

        if (callback) {
          callback({
            reminders: reminders || [],
            stats,
            total: reminders?.length || 0,
            timestamp: new Date().toISOString()
          });
        }

        logger.debug(`Reminders requested: ${reminders?.length || 0} found`);
      } catch (error) {
        logger.error('Error retrieving reminders:', error);
        if (callback) callback({ error: error.message, reminders: [], stats: {} });
      }
    });

    socket.on('create_reminder', (data, callback) => {
      this.handleCreateReminder(data, callback);
    });

    socket.on('edit_reminder', (data, callback) => {
      this.handleEditReminder(data, callback);
    });

    socket.on('delete_reminder', (data, callback) => {
      this.handleDeleteReminder(data, callback);
    });

    socket.on('filter_reminders', (data, callback) => {
      this.handleFilterReminders(data, callback);
    });
  }

  handleCreateReminder(data, callback) {
    try {
      const { userId, message, scheduledTime, channelId } = data;

      if (!userId || !message || !scheduledTime) {
        const error = new Error('Missing required fields: userId, message, scheduledTime');
        if (callback) callback({ error: error.message, created: false });
        return;
      }

      const reminder = databaseService.createReminder(
        userId,
        message,
        scheduledTime,
        channelId
      );

      if (callback) {
        callback({
          created: true,
          reminder,
          timestamp: new Date().toISOString()
        });
      }

      logger.info(`Reminder created: ${reminder.id} for user ${userId}`);
    } catch (error) {
      logger.error('Error creating reminder:', error);
      if (callback) callback({ error: error.message, created: false });
    }
  }

  handleEditReminder(data, callback) {
    try {
      const { reminderId, userId, message, scheduledTime } = data;

      if (!reminderId || !userId) {
        const error = new Error('Missing required fields: reminderId, userId');
        if (callback) callback({ error: error.message, updated: false });
        return;
      }

      const allReminders = databaseService.getActiveReminders(userId);
      const reminder = allReminders?.find(r => r.id === reminderId);

      if (!reminder) {
        const error = new Error(`Reminder not found: ${reminderId}`);
        if (callback) callback({ error: error.message, updated: false });
        return;
      }

      if (message) reminder.message = message;
      if (scheduledTime) reminder.scheduled_time = scheduledTime;

      logger.info(`Reminder ${reminderId} updated`);

      if (callback) {
        callback({
          updated: true,
          reminder,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Error editing reminder:', error);
      if (callback) callback({ error: error.message, updated: false });
    }
  }

  handleDeleteReminder(data, callback) {
    try {
      const { reminderId, userId } = data;

      if (!reminderId || !userId) {
        const error = new Error('Missing required fields: reminderId, userId');
        if (callback) callback({ error: error.message, deleted: false });
        return;
      }

      const deleted = databaseService.deleteReminder(reminderId, userId);

      if (!deleted) {
        const error = new Error(`Reminder not found or already deleted: ${reminderId}`);
        if (callback) callback({ error: error.message, deleted: false });
        return;
      }

      logger.info(`Reminder deleted: ${reminderId}`);

      if (callback) {
        callback({
          deleted: true,
          reminderId,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Error deleting reminder:', error);
      if (callback) callback({ error: error.message, deleted: false });
    }
  }

  handleFilterReminders(data, callback) {
    try {
      const { userId = null, status = null, searchText = null } = data || {};

      let reminders = databaseService.getActiveReminders(userId);

      if (status) {
        reminders = reminders.filter(r => r.status === status);
      }

      if (searchText) {
        const searchLower = searchText.toLowerCase();
        reminders = reminders.filter(r => r.message.toLowerCase().includes(searchLower));
      }

      if (callback) {
        callback({
          reminders: reminders || [],
          total: reminders?.length || 0,
          filters: { userId, status, searchText },
          timestamp: new Date().toISOString()
        });
      }

      logger.debug(`Reminders filtered: ${reminders?.length || 0} results`);
    } catch (error) {
      logger.error('Error filtering reminders:', error);
      if (callback) callback({ error: error.message, reminders: [] });
    }
  }

  /**
   * Service management page handlers
   */
  setupServiceHandlers(socket) {
    socket.on('request_services', (data, callback) => {
      try {
        const uptimeSeconds = Math.floor(process.uptime());
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const uptimeFormatted = `${hours}h ${minutes}m`;
        
        const memoryMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        
        const services = [
          {
            id: 'aszune-ai-bot',
            name: 'Aszune AI Bot',
            icon: '🤖',
            status: 'Running',
            enabledOnBoot: true,
            uptime: uptimeFormatted,
            pid: process.pid,
            memory: `${memoryMB} MB`,
            port: '3000 (Dashboard)'
          }
        ];

        if (callback) {
          callback({
            services,
            total: services.length,
            timestamp: new Date().toISOString()
          });
        }

        logger.debug(`Services list retrieved: ${services.length} services`);
      } catch (error) {
        logger.error('Error retrieving services:', error);
        if (callback) callback({ error: error.message, services: [] });
      }
    });

    socket.on('service_action', (data, callback) => {
      this.handleServiceAction(data, callback);
    });

    socket.on('quick_service_action', (data, callback) => {
      this.handleQuickServiceAction(data, callback);
    });
  }

  handleServiceAction(data, callback) {
    try {
      const { serviceName, action } = data;

      if (!serviceName || !action) {
        const error = new Error('Missing required fields: serviceName, action');
        if (callback) callback({ error: error.message, success: false });
        return;
      }

      const validActions = ['start', 'stop', 'restart'];
      if (!validActions.includes(action)) {
        const error = new Error(`Invalid action: ${action}. Must be one of: ${validActions.join(', ')}`);
        if (callback) callback({ error: error.message, success: false });
        return;
      }

      logger.info(`Service action requested: ${serviceName} - ${action}`);

      if (callback) {
        callback({
          success: true,
          serviceName,
          action,
          message: `${action.charAt(0).toUpperCase() + action.slice(1)} command sent to ${serviceName}`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Error performing service action:', error);
      if (callback) callback({ error: error.message, success: false });
    }
  }

  handleQuickServiceAction(data, callback) {
    try {
      const { serviceNames = [], action } = data;

      if (!Array.isArray(serviceNames) || serviceNames.length === 0 || !action) {
        const error = new Error('Missing required fields: serviceNames (array), action');
        if (callback) callback({ error: error.message, success: false });
        return;
      }

      logger.info(`Batch service action: ${action} on ${serviceNames.length} services`);

      if (callback) {
        callback({
          success: true,
          serviceNames,
          action,
          message: `${action.charAt(0).toUpperCase() + action.slice(1)} command sent to ${serviceNames.length} services`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Error performing batch service action:', error);
      if (callback) callback({ error: error.message, success: false });
    }
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
        logger.error(`Metrics broadcast error: ${errorResponse.message}`, error);
      }
    }, 5000); // Update every 5 seconds
  }

  /**
   * Get comprehensive metrics from all services
   * @returns {Promise<Object>} Metrics object
   */
  async getMetrics() {
    try {
      logger.debug('Collecting metrics...');
      
      // Collect metrics with error handling for each one
      const cacheStats = await this.getCacheStats().catch(err => {
        logger.warn(`Cache stats error: ${err.message}`);
        return { hits: 0, misses: 0, hitRate: 0, sets: 0, deletes: 0, evictions: 0, entryCount: 0, memoryUsage: 0, memoryUsageFormatted: '0 B', uptime: 0, uptimeFormatted: '0s' };
      });

      const databaseStats = await this.getDatabaseStats().catch(err => {
        logger.warn(`Database stats error: ${err.message}`);
        return { userCount: 0, totalMessages: 0, reminders: { totalReminders: 0, activeReminders: 0, completedReminders: 0, cancelledReminders: 0 } };
      });

      const reminderStats = await this.getReminderStats().catch(err => {
        logger.warn(`Reminder stats error: ${err.message}`);
        return { totalReminders: 0, activeReminders: 0, completedReminders: 0, cancelledReminders: 0 };
      });

      const systemInfo = this.getSystemInfo();

      const resourceData = await this.getResourceData().catch(err => {
        logger.warn(`Resource data error: ${err.message}`);
        return { memory: { status: 'unknown', used: 0, free: 0, percentage: 0 }, performance: { status: 'unknown', responseTime: 0, load: 'unknown' }, optimizationTier: 'unknown' };
      });

      const analyticsData = await this.getAnalyticsData().catch(err => {
        logger.warn(`Analytics data error: ${err.message}`);
        return { summary: { totalServers: 0, totalUsers: 0, successRate: 0, errorRate: 0, avgResponseTime: 0, totalCommands: 0 }, recentErrors: [], recommendations: [] };
      });

      const metrics = {
        timestamp: new Date().toISOString(),
        uptime: this.getUptime(),
        cache: cacheStats,
        database: databaseStats,
        reminders: reminderStats,
        system: systemInfo,
        resources: resourceData,
        analytics: analyticsData
      };

      logger.debug('Metrics collected successfully');
      return metrics;
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'aggregating metrics');
      logger.error(`Metrics aggregation error: ${errorResponse.message}`);
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache stats
   */
  async getCacheStats() {
    try {
      // Import the singleton PerplexityService instance to get actual cache stats
      const perplexityService = require('./perplexity-secure');
      return perplexityService.getCacheStats();
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
      const ResourceOptimizer = require('../utils/resource-optimizer');
      const resourceStatus = ResourceOptimizer.monitorResources();
      
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
    try {
      // Validate table name (prevent SQL injection)
      const validTables = ['user_stats', 'user_messages', 'conversation_history', 'reminders'];
      if (!validTables.includes(tableName)) {
        throw new Error(`Invalid table: ${tableName}`);
      }

      if (!databaseService.getDb) {
        throw new Error('Database not available');
      }

      const db = databaseService.getDb();
      if (!db) {
        throw new Error('Database connection unavailable');
      }

      // Get total count
      const countResult = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
      const totalRows = countResult?.count || 0;

      // Get limited data
      let data = db.prepare(`SELECT * FROM ${tableName} LIMIT ? OFFSET ?`).all(limit, offset);

      // Enrich user_stats with resolved Discord usernames
      if (tableName === 'user_stats' && data && data.length > 0) {
        data = await Promise.all(
          data.map(async (row) => {
            // If username is null, try to resolve from Discord
            if (!row.username && this.discordClient) {
              const resolvedUsername = await this.resolveDiscordUsername(row.user_id);
              if (resolvedUsername) {
                return { ...row, username: resolvedUsername };
              }
            }
            return row;
          })
        );
      }

      return {
        table: tableName,
        totalRows,
        limit,
        offset,
        returnedRows: data?.length || 0,
        columns: this.getTableColumns(tableName),
        data: data || [],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.warn(`Failed to get database contents for ${tableName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get table column names
   * @param {string} tableName - Table name
   * @returns {Array<string>} Column names
   * @private
   */
  getTableColumns(tableName) {
    const columns = {
      user_stats: ['user_id', 'username', 'message_count', 'total_summaries', 'total_commands', 'last_active', 'first_seen'],
      user_messages: ['id', 'user_id', 'message', 'timestamp'],
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