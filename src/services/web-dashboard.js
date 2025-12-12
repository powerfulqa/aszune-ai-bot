const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const os = require('os');
const fs = require('fs');
const databaseService = require('./database');
const logger = require('../utils/logger');
const { ErrorHandler } = require('../utils/error-handler');
const NetworkDetector = require('./network-detector');
const { getEmptyCacheStats } = require('../utils/cache-stats-helper');
const configRoutes = require('./web-dashboard/routes/configRoutes');
const logRoutes = require('./web-dashboard/routes/logRoutes');
const networkRoutes = require('./web-dashboard/routes/networkRoutes');
const reminderRoutes = require('./web-dashboard/routes/reminderRoutes');
const serviceRoutes = require('./web-dashboard/routes/serviceRoutes');
const recommendationRoutes = require('./web-dashboard/routes/recommendationRoutes');
const controlRoutes = require('./web-dashboard/routes/controlRoutes');
const { getBootEnabledStatus } = require('./web-dashboard/handlers/serviceHandlers');
const { buildServiceObject, buildNetworkInterfaces } = require('../utils/system-info');
const { validateEnvContent, validateJsContent } = require('../utils/config-validators');
const { processReminderRequest, processFilterReminders } = require('../utils/reminder-filters');

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
    this.externalIpCache = { value: null, timestamp: null }; // Cache external IP for 1 hour
    this.setupErrorInterception();
    this.setupLogInterception();
  }

  /**
   * Create promise-based server listener with timeout
   * @private
   */
  _createServerListener(port, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.server.removeAllListeners('error');
        reject(new Error('Server listen timeout'));
      }, timeoutMs);

      this.server.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      this.server.once('listening', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.server.listen(port);
    });
  }

  /**
   * Check if error is port-in-use
   * @private
   */
  _isPortInUseError(error) {
    return (
      error.code === 'EADDRINUSE' ||
      error.message?.includes('EADDRINUSE') ||
      error.message?.includes('address already in use')
    );
  }

  /**
   * Force kill process on port (Linux/macOS)
   * @private
   */
  async _forceKillPort(port) {
    if (process.platform !== 'linux' && process.platform !== 'darwin') {
      return;
    }

    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execPromise = promisify(exec);
      await execPromise(`fuser -k ${port}/tcp 2>/dev/null || true`, { timeout: 3000 });
    } catch (e) {
      logger.debug(`Failed to force kill port ${port}: ${e.message}`);
    }
  }

  async bindServerWithRetry(preferredPort, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this._createServerListener(preferredPort);
        return preferredPort;
      } catch (portError) {
        if (!this._isPortInUseError(portError) && portError.message !== 'Server listen timeout') {
          throw portError;
        }

        if (attempt >= maxRetries - 1) break;

        logger.warn(
          `Port ${preferredPort} in use (attempt ${attempt + 1}/${maxRetries}), retrying...`
        );
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        await this._forceKillPort(preferredPort);
      }
    }

    // Fallback to alternative port
    logger.warn(
      `Port ${preferredPort} unavailable after ${maxRetries} retries, finding alternative...`
    );
    const altPort = await this.findAvailablePort();

    try {
      await this._createServerListener(altPort);
      logger.info(`Using alternative port ${altPort} due to port conflict on ${preferredPort}`);
      return altPort;
    } catch (altPortError) {
      logger.error(`Failed to bind to alternative port ${altPort}: ${altPortError.message}`);
      throw new Error(
        `Unable to bind web dashboard to any port (preferred: ${preferredPort}, alternative: ${altPort})`
      );
    }
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
      const testPort =
        process.env.NODE_ENV === 'test' ? await this.findAvailablePort() : defaultPort;

      this.app = express();
      this.server = http.createServer(this.app);
      this.io = socketIo(this.server, {
        cors: {
          origin: '*',
          methods: ['GET', 'POST'],
        },
      });

      this.setupMiddleware();
      this.setupRoutes();
      this.setupSocketHandlers();
      this.startMetricsBroadcast();

      const boundPort = await this.bindServerWithRetry(testPort);
      this.isRunning = true;
      logger.info(`Web dashboard started on port ${boundPort}`);
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
  /**
   * Validates Discord user ID format
   * @private
   */
  _isValidDiscordSnowflake(userId) {
    return userId && typeof userId === 'string' && /^\d+$/.test(userId);
  }

  async resolveDiscordUsername(userId) {
    // Validate Discord snowflake format
    if (!this._isValidDiscordSnowflake(userId)) {
      logger.debug(`Skipping Discord username resolution for non-snowflake ID: ${userId}`);
      return null;
    }

    // Check cache first
    const cached = this.usernameCache.get(userId);
    if (cached) {
      return cached;
    }

    // Fetch from Discord API if client available
    return this._fetchDiscordUsername(userId);
  }

  /**
   * Fetches username from Discord API with error handling
   * @private
   */
  async _fetchDiscordUsername(userId) {
    if (!this.discordClient) {
      return null;
    }

    try {
      const user = await this.discordClient.users.fetch(userId, { cache: false });
      if (user?.username) {
        this.usernameCache.set(userId, user.username);
        return user.username;
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
        error: error ? error.message || String(error) : null,
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
    ['debug', 'info', 'warn', 'error'].forEach((level) => {
      const originalMethod = logger[level].bind(logger);
      logger[level] = function (message, error) {
        // Add to all logs buffer with timestamp and level
        self.allLogs.push({
          timestamp: new Date().toISOString(),
          level: level.toUpperCase(),
          message: typeof message === 'string' ? message : String(message),
          error: error ? error.message || String(error) : null,
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
            message: typeof message === 'string' ? message : String(message),
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
      filtered = filtered.filter((log) => log.level === levelFilter.toUpperCase());
    }

    // Return most recent first
    return filtered
      .slice()
      .reverse()
      .slice(offset, offset + limit);
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
      .filter(
        (log) =>
          log.message.toLowerCase().includes(searchTerm) ||
          (log.error && log.error.toLowerCase().includes(searchTerm))
      )
      .slice()
      .reverse()
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
      res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization'
      );
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
        timestamp: new Date().toISOString(),
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
          timestamp: new Date().toISOString(),
        });
      }
    });

    this.app.get('/api/system', (req, res) => {
      res.json(this.getSystemInfo());
    });

    this.setupDatabaseRoutes();
    this.setupVersionRoutes();
    configRoutes.registerConfigRoutes(this.app, this);
    logRoutes.registerLogRoutes(this.app, this);
    networkRoutes.registerNetworkRoutes(this.app, this);
    reminderRoutes.registerReminderRoutes(this.app, this);
    serviceRoutes.registerServiceRoutes(this.app, this);
    recommendationRoutes.registerRecommendationRoutes(this.app, this);
    controlRoutes.registerControlRoutes(this.app, this);

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
        const errorResponse = ErrorHandler.handleError(
          error,
          `getting database table ${req.params.table}`
        );
        res.status(400).json({
          error: errorResponse.message,
          timestamp: new Date().toISOString(),
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
          timestamp: new Date().toISOString(),
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
   * Export logs as CSV
   * @private
   */
  exportLogsAsCSV(res, logs) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="logs.csv"');
    res.write('Timestamp,Level,Message,Error\n');

    logs.forEach((log) => {
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
          timeout: 5000,
        }).catch(() => ({ stdout: 'inactive' }));

        results.push({
          name: service,
          status: stdout.trim() || 'unknown',
          uptime: await this.getServiceUptime(service),
          enabled: await this.isServiceEnabled(service),
        });
      } catch (error) {
        results.push({
          name: service,
          status: 'error',
          uptime: null,
          enabled: false,
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
   * Try PM2 programmatic API
   * @param {string} action - Action (start, stop, restart)
   * @param {string} pm2AppName - PM2 app name
   * @returns {Promise<Object>} Result or null if failed
   * @private
   */
  async tryPm2Api(action, pm2AppName) {
    try {
      const pm2 = require('pm2');
      return await new Promise((resolve, reject) => {
        pm2.connect((connectErr) => {
          if (connectErr) {
            logger.debug(`PM2 daemon not accessible: ${connectErr.message}`);
            reject(connectErr);
            return;
          }

          const pmAction = action === 'restart' ? 'restart' : action === 'stop' ? 'stop' : 'start';
          pm2[pmAction](pm2AppName, (actionErr) => {
            pm2.disconnect();
            if (actionErr) {
              logger.debug(`PM2 ${pmAction} failed: ${actionErr.message}`);
              reject(actionErr);
            } else {
              resolve({
                success: true,
                message: `Service ${pm2AppName} ${action}ed successfully (PM2)`,
                service: pm2AppName,
                action,
                timestamp: new Date().toISOString(),
              });
            }
          });
        });
      });
    } catch (error) {
      logger.debug(`PM2 API error: ${error.message}`);
      return null;
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

      // Map service names to PM2 app names (actual PM2 process name)
      let pm2AppName = service;
      if (service === 'aszune-ai-bot' || service === 'aszune-ai') {
        pm2AppName = 'aszune-bot'; // Actual PM2 process name
      }

      // For PM2 services, use shell command directly (PM2 daemon may not be accessible)
      if (['aszune-ai', 'aszune-ai-bot', 'aszune-bot'].includes(service)) {
        try {
          const pm2Command = `pm2 ${action} ${pm2AppName}`;
          logger.debug(`Executing: ${pm2Command}`);
          await execPromise(pm2Command, { timeout: 10000 });
          logger.info(`PM2 shell succeeded: ${pm2Command}`);
          return {
            success: true,
            message: `Service ${pm2AppName} ${action}ed successfully (PM2)`,
            service: pm2AppName,
            action,
            timestamp: new Date().toISOString(),
          };
        } catch (pm2Error) {
          logger.warn(`PM2 shell command failed: ${pm2Error.message}`);
          // Fall through to systemctl as final fallback
        }
      }

      // Fallback to shell commands for other services
      const cmd = `systemctl ${action} ${service}`;
      logger.debug(`Executing: ${cmd}`);
      await execPromise(cmd, { timeout: 10000, shell: '/bin/bash' });

      logger.info(`Service ${action} succeeded: ${service}`);
      return {
        success: true,
        message: `Service ${service} ${action}ed successfully`,
        service,
        action,
        timestamp: new Date().toISOString(),
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

      return stdout.split('\n').filter((line) => line.trim().length > 0);
    } catch (error) {
      logger.debug(`Failed to get service logs for ${service}: ${error.message}`);
      return [];
    }
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
      timestamp: new Date().toISOString(),
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
      timestamp: new Date().toISOString(),
    };
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
      const ipv4 = addrs.find((a) => a.family === 'IPv4');
      const ipv6 = addrs.find((a) => a.family === 'IPv6');

      result.push({
        name,
        status: name.includes('lo') ? 'loopback' : 'active',
        ipv4: ipv4 ? ipv4.address : null,
        ipv6: ipv6 ? ipv6.address : null,
        mac: addrs[0]?.mac || null,
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
      const ipv4 = addrs.find((a) => a.family === 'IPv4' && !a.internal);
      if (ipv4) {
        localIP = ipv4.address;
        break;
      }
    }

    let externalIP = 'Unable to determine';
    try {
      const { stdout } = await execPromise('curl -s https://api.ipify.org', {
        timeout: 5000,
      }).catch(() => ({ stdout: '' }));
      externalIP = stdout.trim() || 'Unable to determine';
    } catch (error) {
      logger.debug('Failed to get external IP');
    }

    return {
      local: localIP,
      external: externalIP,
      hostname: os.hostname(),
    };
  }

  /**
   * Get network connectivity status - delegates to NetworkDetector service
   * @returns {Promise<Object>} Network status with connectivity info
   * @private
   */
  async getNetworkStatus() {
    return NetworkDetector.getNetworkStatus();
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
        status: 'active',
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
        updated_at: new Date().toISOString(),
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

  async _handleRestartRequest(res) {
    try {
      logger.info('Restart command received from dashboard');

      // Step 1: Explicitly disconnect Discord client to show offline status
      if (this.discordClient) {
        try {
          logger.info('Destroying Discord client connection...');
          await this.discordClient.destroy();
          logger.info('Discord client disconnected successfully');
        } catch (disconnectError) {
          logger.warn(`Failed to disconnect Discord client: ${disconnectError.message}`);
        }
      }

      const result = await this._attemptRestart();
      res.json(result);
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'restarting bot');
      logger.error(`Restart error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: errorResponse.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async _attemptRestart() {
    const serviceName = process.env.SERVICE_NAME || 'aszune-ai-bot';
    const pm2AppName = process.env.name || 'aszune-ai';

    const pm2Result = await this._tryPm2Restart(pm2AppName);
    if (pm2Result) return pm2Result;

    const systemctlResult = await this._trySystemctlRestart(serviceName);
    if (systemctlResult) return systemctlResult;

    const sudoResult = await this._trySystemctlWithSudo(serviceName);
    if (sudoResult) return sudoResult;

    return this._fallbackRestart();
  }

  /**
   * Generic restart command executor to reduce duplication
   * @private
   */
  async _executeRestartCommand(command, logPrefix, successMessage, logLevel = 'info') {
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);
      logger.info(`Attempting ${logPrefix}: ${command}`);
      await execPromise(command, { timeout: 10000 });
      logger.info(successMessage);
      return {
        success: true,
        message: successMessage,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger[logLevel](`${logPrefix} failed: ${error.message}`);
      return null;
    }
  }

  async _tryPm2Restart(pm2AppName) {
    return this._executeRestartCommand(
      `pm2 restart ${pm2AppName}`,
      'PM2 restart',
      `Bot restart initiated via PM2 ${pm2AppName}`,
      'debug'
    );
  }

  async _trySystemctlRestart(serviceName) {
    return this._executeRestartCommand(
      `systemctl restart ${serviceName}`,
      'restart with systemctl',
      `Bot restart initiated via systemctl ${serviceName}`,
      'warn'
    );
  }

  async _trySystemctlWithSudo(serviceName) {
    logger.info('Attempting with sudo...');
    const result = await this._executeRestartCommand(
      `sudo systemctl restart ${serviceName}`,
      'systemctl with sudo',
      'Bot restart initiated via systemctl (with sudo)',
      'warn'
    );
    if (result) logger.info('Bot restart succeeded with sudo');
    return result;
  }

  _fallbackRestart() {
    logger.info('Attempting direct process restart (fallback)...');
    setTimeout(() => {
      logger.info('Executing direct bot restart');
      process.exit(0);
    }, 1000);
    return {
      success: true,
      message: 'Bot restart initiated (fallback mode)',
      timestamp: new Date().toISOString(),
    };
  }

  async _handleGitPullRequest(res) {
    try {
      logger.info('Git pull command received from dashboard');
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);

      try {
        const { stdout } = await execPromise('git pull origin main', {
          cwd: path.join(__dirname, '../../'),
          timeout: 30000,
        });

        logger.info('Git pull completed successfully');
        res.json({
          success: true,
          message: 'Git pull completed successfully',
          output: stdout,
          timestamp: new Date().toISOString(),
        });
      } catch (pullError) {
        // Check for permission errors
        const errorMsg = pullError.message || '';
        const stderrMsg = pullError.stderr || '';

        if (stderrMsg.includes('Permission denied') || errorMsg.includes('EACCES')) {
          logger.error(`Git pull permission denied: ${errorMsg}`);
          res.status(403).json({
            success: false,
            error: 'Permission denied - check file permissions',
            timestamp: new Date().toISOString(),
          });
        } else {
          res.json({
            success: false,
            error: pullError.message,
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'git pull operation');
      res.status(500).json({
        success: false,
        error: errorResponse.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Setup Socket.IO handlers
   */
  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      logger.debug(`Dashboard client connected: ${socket.id}`);

      this._emitMetricsToSocket(socket, 'sending initial metrics');

      socket.on('disconnect', () => {
        logger.debug(`Dashboard client disconnected: ${socket.id}`);
      });

      socket.on('request-metrics', () => {
        this._emitMetricsToSocket(socket, 'sending requested metrics');
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
            error: null,
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
      const validationError = this._validateConfigSaveInput(data);
      if (validationError) {
        if (callback) callback({ error: validationError, saved: false });
        return;
      }

      const { filename, content } = data;
      const configPath = path.join(process.cwd(), filename);

      const traversalError = this._validatePathSafety(configPath, filename);
      if (traversalError) {
        if (callback) callback({ error: traversalError, saved: false });
        return;
      }

      fs.writeFileSync(configPath, content, 'utf-8');
      logger.info(`Config saved: ${filename}`);

      if (callback) {
        callback({
          saved: true,
          filename,
          timestamp: new Date().toISOString(),
          error: null,
        });
      }
    } catch (error) {
      logger.error('Error saving config:', error);
      if (callback) callback({ error: error.message, saved: false });
    }
  }

  /**
   * Validate config save input data
   * @param {Object} data - Input data
   * @returns {string|null} - Error message or null if valid
   * @private
   */
  _validateConfigSaveInput(data) {
    const { filename, content } = data || {};
    if (!filename || content === undefined) {
      return 'Missing filename or content';
    }
    return null;
  }

  /**
   * Validate path safety for file operations
   * @param {string} configPath - Full path to config file
   * @param {string} filename - Original filename for logging
   * @returns {string|null} - Error message or null if safe
   * @private
   */
  _validatePathSafety(configPath, filename) {
    if (!configPath.startsWith(process.cwd())) {
      logger.warn(`Security: Attempted directory traversal save to ${filename}`);
      return 'Access denied: Cannot save files outside project directory';
    }
    return null;
  }

  handleValidateConfig(data, callback) {
    try {
      const { content, fileType = 'env' } = data;
      const validationResult = { valid: true, errors: [], warnings: [] };

      this._performFileValidation(fileType, content, validationResult);
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

  /**
   * Perform file type-specific validation
   * @param {string} fileType - Type of file (env, js, etc.)
   * @param {string} content - File content to validate
   * @param {Object} result - Result object to populate
   * @private
   */
  _performFileValidation(fileType, content, result) {
    if (fileType === 'env') {
      this.validateEnvFile(content, result);
    } else if (fileType === 'js') {
      this.validateJsFile(content, result);
    }
  }

  validateEnvFile(content, result) {
    const validation = validateEnvContent(content);
    result.errors.push(...validation.errors);
    result.warnings.push(...validation.warnings);
    if (!validation.valid) result.valid = false;
  }

  validateJsFile(content, result) {
    const validation = validateJsContent(content);
    result.errors.push(...validation.errors);
    result.warnings.push(...validation.warnings);
    if (!validation.valid) result.valid = false;
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
          logs = logs.filter((log) => log.level === level);
        }

        const limitedLogs = logs.slice(-limit);

        if (callback) {
          callback({
            logs: limitedLogs,
            total: this.allLogs.length,
            filtered: limitedLogs.length,
            timestamp: new Date().toISOString(),
          });
        }
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
            timestamp: new Date().toISOString(),
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

  async handleNetworkStatus(callback) {
    try {
      const hostname = os.hostname();
      const interfaces = await this._buildNetworkInterfaces();
      const localIp = interfaces.find((i) => !i.internal && i.ipv4)?.ipv4 || 'localhost';
      const gatewayResult = await NetworkDetector.detectGateway();
      const externalIp = await this._safeGetExternalIp();
      const connectivityStatus = await NetworkDetector.getNetworkStatus();

      if (callback) {
        callback({
          hostname,
          localIp,
          gateway: gatewayResult.gatewayIp !== 'Not detected' ? gatewayResult.gatewayIp : null,
          gatewayStatus: gatewayResult.reachable,
          externalIp: externalIp || null,
          interfaces,
          connectivity: connectivityStatus,
          timestamp: new Date().toISOString(),
        });
      }
      logger.debug(`Network status retrieved for hostname: ${hostname}`);
    } catch (error) {
      logger.error('Error retrieving network status:', error);
      if (callback) callback({ error: error.message });
    }
  }

  async _buildNetworkInterfaces() {
    return buildNetworkInterfaces();
  }

  async _safeGetExternalIp() {
    try {
      return await this.getExternalIp();
    } catch (error) {
      logger.debug(`Failed to get external IP: ${error.message}`);
      return null;
    }
  }

  async handleNetworkTest(data, callback) {
    try {
      const results = ['=== NETWORK CONNECTIVITY TEST SUITE ===\n'];

      await this._addGatewayTest(results);
      await this._addDnsTests(results);
      await this._addInternetTests(results);
      await this._addConfigurationTests(results);

      results.push('\n=== TEST SUITE COMPLETE ===');

      if (callback) {
        callback({
          success: true,
          message: 'Network test completed',
          results: results.join('\n'),
          timestamp: new Date().toISOString(),
        });
      }
      logger.info('Network test completed successfully');
    } catch (error) {
      logger.error('Network test error:', error);
      if (callback) {
        callback({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  async _addGatewayTest(results) {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    results.push('Test 1: Gateway Connectivity');
    try {
      const gatewayResult = await NetworkDetector.detectGateway();
      if (gatewayResult.gatewayIp && gatewayResult.gatewayIp !== 'Not detected') {
        const pingCmd =
          process.platform === 'win32'
            ? `ping -n 1 ${gatewayResult.gatewayIp}`
            : `ping -c 1 ${gatewayResult.gatewayIp}`;
        await execPromise(pingCmd, { timeout: 3000 });
        results.push(`✓ Gateway (${gatewayResult.gatewayIp}) is reachable\n`);
      } else {
        results.push('✗ Gateway not detected\n');
      }
    } catch (error) {
      results.push(`✗ Gateway ping failed: ${error.message}\n`);
    }
  }

  async _addDnsTests(results) {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    const dns = require('dns').promises;

    results.push('Test 2: DNS Server Detection & Testing');
    try {
      const dnsServers = await this.detectDnsServers();
      results.push(`  Detected DNS Servers: ${dnsServers.join(', ')}`);

      let dnsWorking = false;
      for (const dnsServer of dnsServers) {
        try {
          const pingCmd =
            process.platform === 'win32' ? `ping -n 1 ${dnsServer}` : `ping -c 1 ${dnsServer}`;
          await execPromise(pingCmd, { timeout: 3000 });
          results.push(`  ✓ DNS Server ${dnsServer} is reachable`);
          dnsWorking = true;
        } catch (error) {
          results.push(`  ✗ DNS Server ${dnsServer} not reachable`);
        }
      }

      if (dnsWorking) {
        results.push('  ✓ At least one DNS server is accessible\n');
      } else {
        results.push('  ✗ No DNS servers are reachable\n');
      }
    } catch (error) {
      results.push(`✗ DNS detection failed: ${error.message}\n`);
    }

    results.push('Test 3: DNS Resolution Test');
    try {
      const addresses = await dns.resolve4('google.com');
      results.push(`✓ DNS resolution working (google.com → ${addresses[0]})\n`);
    } catch (error) {
      results.push(`✗ DNS resolution failed: ${error.message}\n`);
    }
  }

  async _addInternetTests(results) {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    results.push('Test 4: Internet Connectivity (8.8.8.8)');
    try {
      const pingCmd = process.platform === 'win32' ? 'ping -n 1 8.8.8.8' : 'ping -c 1 8.8.8.8';
      await execPromise(pingCmd, { timeout: 5000 });
      results.push('✓ Internet reachable (Google DNS)\n');
    } catch (error) {
      results.push(`✗ Internet ping failed: ${error.message}\n`);
    }

    results.push('Test 5: External API Access');
    try {
      const { stdout } = await execPromise(
        'curl -s -o /dev/null -w "%{http_code}" https://api.ipify.org',
        { timeout: 5000 }
      );
      if (stdout.trim() === '200') {
        results.push('✓ External API accessible (api.ipify.org)\n');
      } else {
        results.push(`⚠ API returned HTTP ${stdout.trim()}\n`);
      }
    } catch (error) {
      results.push(`✗ External API test failed: ${error.message}\n`);
    }
  }

  async _addConfigurationTests(results) {
    results.push('Test 6: IP Configuration');
    try {
      const ipAssignment = await this.detectDhcpOrStatic();
      results.push(`✓ IP Assignment Type: ${ipAssignment}\n`);
    } catch (error) {
      results.push(`✗ Could not detect IP assignment: ${error.message}\n`);
    }

    results.push('Test 7: Network Interfaces');
    const interfaces = os.networkInterfaces();
    const activeInterfaces = Object.entries(interfaces)
      .filter(([_name, addrs]) => addrs.some((a) => !a.internal && a.family === 'IPv4'))
      .map(([name]) => name);

    if (activeInterfaces.length > 0) {
      results.push(`✓ Active interfaces: ${activeInterfaces.join(', ')}\n`);
    } else {
      results.push('✗ No active network interfaces found\n');
    }
  }

  /**
   * Reminder management page handlers
   */
  setupReminderHandlers(socket) {
    socket.on('request_reminders', (data, callback) => {
      try {
        const result = processReminderRequest(databaseService, data);
        if (callback) callback(result);
        logger.debug(`Reminders requested: ${result.total} found`);
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

      const reminder = databaseService.createReminder(userId, message, scheduledTime, {
        channelId,
      });

      if (callback) {
        callback({
          created: true,
          reminder,
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(`Reminder created: ${reminder.id} for user ${userId}`);
    } catch (error) {
      logger.error('Error creating reminder:', error);
      if (callback) callback({ error: error.message, created: false });
    }
  }

  /**
   * Validate reminder edit/delete input has required fields
   * @private
   */
  _validateReminderInput(data, requiredFields) {
    for (const field of requiredFields) {
      if (!data[field]) return `Missing required fields: ${requiredFields.join(', ')}`;
    }
    return null;
  }

  /**
   * Find reminder by ID from active reminders
   * @private
   */
  _findReminder(userId, reminderId) {
    const allReminders = databaseService.getActiveReminders(userId);
    return allReminders?.find((r) => r.id === reminderId);
  }

  handleEditReminder(data, callback) {
    try {
      const validationError = this._validateReminderInput(data, ['reminderId', 'userId']);
      if (validationError) {
        if (callback) callback({ error: validationError, updated: false });
        return;
      }

      const { reminderId, userId, message, scheduledTime } = data;
      const reminder = this._findReminder(userId, reminderId);

      if (!reminder) {
        if (callback) callback({ error: `Reminder not found: ${reminderId}`, updated: false });
        return;
      }

      if (message) reminder.message = message;
      if (scheduledTime) reminder.scheduled_time = scheduledTime;

      logger.info(`Reminder ${reminderId} updated`);
      if (callback) callback({ updated: true, reminder, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error editing reminder:', error);
      if (callback) callback({ error: error.message, updated: false });
    }
  }

  handleDeleteReminder(data, callback) {
    try {
      const validationError = this._validateReminderInput(data, ['reminderId']);
      if (validationError) {
        if (callback) callback({ error: validationError, deleted: false });
        return;
      }

      const { reminderId, userId } = data;
      // Allow admin deletion (from dashboard) without user_id check, or with user_id for user-initiated deletes
      let deleted;
      if (userId) {
        deleted = databaseService.deleteReminder(reminderId, userId);
      } else {
        // Admin deletion - delete without user_id check
        const stmt = databaseService.db.prepare('DELETE FROM reminders WHERE id = ?');
        const result = stmt.run(reminderId);
        deleted = result.changes > 0;
      }

      if (!deleted) {
        logger.warn(`Attempted to delete non-existent or already deleted reminder: ${reminderId} for user ${userId || 'admin'}`);
        if (callback)
          callback({
            error: `Reminder not found or already deleted`,
            deleted: false,
            reminderId,
          });
        return;
      }

      logger.info(`Reminder deleted: ${reminderId}`);
      if (callback) callback({ deleted: true, reminderId, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error deleting reminder:', error);
      if (callback) callback({ error: error.message, deleted: false });
    }
  }

  handleFilterReminders(data, callback) {
    try {
      const result = processFilterReminders(databaseService, data);
      if (callback) callback(result);
      logger.debug(`Reminders filtered: ${result.total} results`);
    } catch (error) {
      logger.error('Error filtering reminders:', error);
      if (callback) callback({ error: error.message, reminders: [] });
    }
  }

  /**
   * Service management page handlers
   * Note: getBootEnabledStatus is imported from ./web-dashboard/handlers/serviceHandlers
   */

  /**
   * Build service object with system info
   * @private
   */
  _buildServiceObject(bootEnabled) {
    return buildServiceObject(bootEnabled);
  }

  setupServiceHandlers(socket) {
    // Handle request_services event
    socket.on('request_services', (data, callback) => {
      try {
        getBootEnabledStatus('aszune-bot')
          .then((bootEnabled) => {
            const services = [this._buildServiceObject(bootEnabled)];
            if (callback) {
              callback({
                services,
                total: services.length,
                timestamp: new Date().toISOString(),
              });
            }
            logger.debug(`Services retrieved: ${services.length}`);
          })
          .catch((error) => {
            logger.error('Error getting boot status:', error);
            const services = [this._buildServiceObject(false)];
            if (callback) {
              callback({
                services,
                total: services.length,
                timestamp: new Date().toISOString(),
              });
            }
          });
      } catch (error) {
        logger.error('Error retrieving services:', error);
        if (callback) callback({ error: error.message, services: [] });
      }
    });

    // Handle service_action event
    socket.on('service_action', (data, callback) => {
      this.handleServiceAction(data, callback);
    });

    // Handle quick_service_action event
    socket.on('quick_service_action', (data, callback) => {
      this.handleQuickServiceAction(data, callback);
    });

    // Handle request_discord_status event
    socket.on('request_discord_status', (data, callback) => {
      this.handleDiscordStatus(callback);
    });

    // Handle request_instance_status event
    socket.on('request_instance_status', (data, callback) => {
      this.handleInstanceStatus(callback);
    });

    // Handle request_all_instances event (admin view)
    socket.on('request_all_instances', (data, callback) => {
      this.handleAllInstances(callback);
    });

    // Handle instance_action event (approve/revoke)
    socket.on('instance_action', (data, callback) => {
      this.handleInstanceAction(data, callback);
    });
  }

  /**
   * Handle instance tracking status request
   * @param {Function} callback
   */
  handleInstanceStatus(callback) {
    try {
      const instanceTracker = require('./instance-tracker');
      const status = instanceTracker.getStatus();

      if (callback) {
        callback({
          ...status,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error('Error getting instance status:', error);
      if (callback) {
        callback({
          error: error.message,
          trackingEnabled: false,
          isVerified: false,
        });
      }
    }
  }

  /**
   * Handle all instances request (fetches from tracking server)
   * @param {Function} callback
   */
  async handleAllInstances(callback) {
    try {
      const instanceTracker = require('./instance-tracker');
      const localStatus = instanceTracker.getStatus();
      const myIp = localStatus.locationInfo?.ip || null;

      const serverUrl = process.env.INSTANCE_TRACKING_SERVER || '';
      const adminKey = process.env.TRACKING_ADMIN_KEY || '';

      // If tracking not configured, return empty list gracefully
      if (!serverUrl || !adminKey) {
        return callback({ instances: [], myIp, authorizedIps: [], trackingUnavailable: true });
      }

      // Build authorized IPs list from env + current IP
      const authorizedIps = this._getAuthorizedIps(myIp);

      // Build instances endpoint from beacon URL
      const baseUrl = serverUrl.replace('/api/beacon', '');
      const response = await fetch(`${baseUrl}/api/instances`, {
        headers: { 'x-admin-key': adminKey },
      });

      if (!response.ok) {
        return callback({ instances: [], myIp, authorizedIps, trackingUnavailable: true });
      }

      const instances = await response.json();
      const mapped = instances.map((inst) => ({
        instanceId: inst.instanceId,
        clientName: inst.client?.name || 'Unknown',
        ip: inst.ip,
        location: inst.location ? `${inst.location.city}, ${inst.location.country}` : 'Unknown',
        guilds: inst.client?.guilds || 0,
        online: inst.online,
        revoked: inst.revoked,
        lastHeartbeat: inst.lastHeartbeat,
      }));

      callback({ instances: mapped, myIp, authorizedIps });
    } catch (error) {
      logger.debug('Error fetching all instances (tracking unavailable):', error.message);
      callback({ instances: [], myIp: null, authorizedIps: [], trackingUnavailable: true });
    }
  }

  /**
   * Get list of authorized IPs from environment + current IP
   * @param {string|null} currentIp
   * @returns {string[]}
   * @private
   */
  _getAuthorizedIps(currentIp) {
    const envIps = process.env.AUTHORIZED_IPS || '';
    const ipList = envIps
      .split(',')
      .map((ip) => ip.trim())
      .filter((ip) => ip.length > 0);

    if (currentIp && !ipList.includes(currentIp)) {
      ipList.push(currentIp);
    }

    return ipList;
  }

  /**
   * Handle instance action (approve/revoke)
   * @param {Object} data - { action, instanceId }
   * @param {Function} callback
   */
  async handleInstanceAction(data, callback) {
    try {
      const { action, instanceId } = data;

      if (!instanceId || !['approve', 'revoke'].includes(action)) {
        return callback({ success: false, error: 'Invalid action or instanceId' });
      }

      const serverUrl = process.env.INSTANCE_TRACKING_SERVER || '';
      const adminKey = process.env.TRACKING_ADMIN_KEY || '';

      if (!serverUrl || !adminKey) {
        return callback({ success: false, error: 'Tracking not configured' });
      }

      const baseUrl = serverUrl.replace('/api/beacon', '');
      const endpoint = action === 'approve' ? '/api/approve' : '/api/revoke';

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({ instanceId }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        logger.info(`Instance ${action}d: ${instanceId}`);
        callback({ success: true });
      } else {
        callback({ success: false, error: result.error || 'Action failed' });
      }
    } catch (error) {
      logger.error('Error handling instance action:', error);
      callback({ success: false, error: error.message });
    }
  }

  /**
   * Format uptime from milliseconds
   * @private
   */
  _formatUptime(uptimeMs) {
    const uptimeSeconds = Math.floor(uptimeMs / 1000);
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;

    let result = '';
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0 || hours > 0) result += `${minutes}m `;
    result += `${seconds}s`;
    return result.trim();
  }

  /**
   * Build Discord connected status response
   * @private
   */
  _buildDiscordConnectedResponse() {
    const uptime = this._formatUptime(this.discordClient.uptime || 0);
    return {
      connected: true,
      username: this.discordClient.user.tag,
      id: this.discordClient.user.id,
      uptime,
      guilds: this.discordClient.guilds.cache.size,
      timestamp: new Date().toISOString(),
    };
  }

  async handleDiscordStatus(callback) {
    try {
      if (!this.discordClient) {
        if (callback) callback({ connected: false, error: 'Discord client not initialized' });
        return;
      }

      const isReady = this.discordClient.isReady();
      if (isReady && this.discordClient.user) {
        if (callback) callback(this._buildDiscordConnectedResponse());
      } else {
        if (callback) callback({ connected: false, error: 'Discord bot is not connected' });
      }

      logger.debug(`Discord status: ${isReady ? 'Connected' : 'Disconnected'}`);
    } catch (error) {
      logger.error('Error retrieving Discord status:', error);
      if (callback) callback({ connected: false, error: error.message });
    }
  }

  async executePm2ViaShell(pm2AppName, action) {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    const pm2Command = `pm2 ${action} ${pm2AppName}`;
    logger.debug(`Shell: ${pm2Command}`);

    await execPromise(pm2Command, { timeout: 10000 });
    logger.info(`PM2 shell OK: ${pm2Command}`);
    return `Successfully ${action}ed ${pm2AppName}`;
  }

  async executePm2Command(serviceName, action) {
    try {
      // Map service names to actual PM2 app name
      let pm2AppName = serviceName;
      if (serviceName === 'aszune-ai-bot' || serviceName === 'aszune-ai') {
        pm2AppName = 'aszune-bot'; // Actual PM2 process name
      }

      // Use PM2 shell command directly (daemon may not be accessible from app context)
      logger.debug(`PM2 shell command: ${action} ${pm2AppName}`);
      return await this.executePm2ViaShell(pm2AppName, action);
    } catch (error) {
      logger.error(`PM2 error: ${error.message}`);
      throw new Error(`Failed to execute PM2 command: ${error.message}`);
    }
  }

  /**
   * Get action verb for service action message
   * @private
   */
  _getActionVerb(action) {
    const verbs = { stop: 'stopped', start: 'started', restart: 'restarted' };
    return verbs[action] || action;
  }

  /**
   * Build service action success response
   * @private
   */
  _buildServiceActionResponse(serviceName, action, output) {
    return {
      success: true,
      serviceName,
      action,
      message: `Successfully ${this._getActionVerb(action)} ${serviceName}`,
      timestamp: new Date().toISOString(),
      output,
    };
  }

  async handleServiceAction(data, callback) {
    try {
      const validationError = this._validateServiceActionInput(data);
      if (validationError) {
        if (callback) callback({ error: validationError, success: false });
        return;
      }

      const { serviceName, action } = data;
      logger.info(`Service action requested: ${serviceName} - ${action}`);

      try {
        const output = await this.executePm2Command(serviceName, action);
        if (callback) callback(this._buildServiceActionResponse(serviceName, action, output));
      } catch (execError) {
        logger.error(`PM2 command failed: ${execError.message}`);
        if (callback)
          callback({ error: `Failed to ${action} service: ${execError.message}`, success: false });
      }
    } catch (error) {
      logger.error('Error performing service action:', error);
      if (callback) callback({ error: error.message, success: false });
    }
  }

  /**
   * Validate service action input
   * @param {Object} data - Service action data
   * @returns {string|null} Error message or null if valid
   * @private
   */
  _validateServiceActionInput(data) {
    const { serviceName, action } = data;

    if (!serviceName || !action) {
      return 'Missing required fields: serviceName, action';
    }

    const validActions = ['start', 'stop', 'restart'];
    if (!validActions.includes(action)) {
      return `Invalid action: ${action}. Must be one of: ${validActions.join(', ')}`;
    }

    return null;
  }

  /**
   * Map quick action group to PM2 command
   * @private
   */
  _mapGroupToPm2Command(group) {
    switch (group) {
      case 'restart-all':
        return 'pm2 restart all';
      case 'start-all':
        return 'pm2 start all';
      case 'stop-non-essential':
        // This would stop the bot itself, which would kill the dashboard
        logger.warn('stop-non-essential mapped to restart-all to prevent dashboard shutdown');
        return 'pm2 restart all';
      default:
        throw new Error(`Unknown quick action group: ${group}`);
    }
  }

  async handleQuickServiceAction(data, callback) {
    try {
      const { group } = data;

      const validationError = this._validateQuickServiceActionInput(group);
      if (validationError) {
        if (callback) callback({ error: validationError, success: false });
        return;
      }

      logger.info(`Quick service action: ${group}`);

      try {
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);

        const pm2Command = this._mapGroupToPm2Command(group);
        logger.debug(`Executing PM2 quick action: ${pm2Command}`);
        const { stdout, stderr } = await execPromise(pm2Command);

        if (stderr && !stderr.includes('Use `pm2 show')) {
          logger.warn(`PM2 stderr: ${stderr}`);
        }

        logger.info(`PM2 quick action completed: ${stdout}`);

        if (callback) {
          callback({
            success: true,
            group,
            message: `Quick action '${group}' completed successfully`,
            timestamp: new Date().toISOString(),
            output: stdout,
          });
        }
      } catch (execError) {
        logger.error(`PM2 quick action failed: ${execError.message}`);
        if (callback) {
          callback({
            error: `Failed to execute quick action: ${execError.message}`,
            success: false,
          });
        }
      }
    } catch (error) {
      logger.error('Error performing batch service action:', error);
      if (callback) callback({ error: error.message, success: false });
    }
  }

  /**
   * Validate quick service action input
   * @param {string} group - Action group name
   * @returns {string|null} Error message or null if valid
   * @private
   */
  _validateQuickServiceActionInput(group) {
    if (!group) {
      return 'Missing required field: group';
    }
    return null;
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
    }, 30000); // Update every 30 seconds
  }

  /**
   * Safe collector helper with fallback defaults
   * @private
   */
  async _safeCollectMetric(collector, metricName, fallbackValue) {
    try {
      return await collector();
    } catch (err) {
      logger.warn(`${metricName} error: ${err.message}`);
      return fallbackValue;
    }
  }

  /**
   * Get comprehensive metrics from all services
   * @returns {Promise<Object>} Metrics object
   */
  async getMetrics() {
    try {
      const stats = await this._collectAllMetrics();
      logger.debug('Metrics collected successfully');
      return {
        timestamp: new Date().toISOString(),
        uptime: this.getUptime(),
        cache: stats[0],
        database: stats[1],
        reminders: stats[2],
        system: stats[3],
        resources: stats[4],
        analytics: stats[5],
      };
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'aggregating metrics');
      logger.error(`Metrics aggregation error: ${errorResponse.message}`);
    }
  }

  // eslint-disable-next-line max-lines-per-function
  async _collectAllMetrics() {
    return Promise.all([
      this._safeCollectMetric(() => this.getCacheStats(), 'Cache stats', {
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
        uptimeFormatted: '0s',
      }),
      this._safeCollectMetric(() => this.getDatabaseStats(), 'Database stats', {
        userCount: 0,
        totalMessages: 0,
        reminders: {
          totalReminders: 0,
          activeReminders: 0,
          completedReminders: 0,
          cancelledReminders: 0,
        },
      }),
      this._safeCollectMetric(() => this.getReminderStats(), 'Reminder stats', {
        totalReminders: 0,
        activeReminders: 0,
        completedReminders: 0,
        cancelledReminders: 0,
      }),
      this._safeCollectMetric(() => this.getSystemInfo(), 'System info', {
        platform: 'unknown',
        arch: 'unknown',
        nodeVersion: 'unknown',
        uptime: 0,
        uptimeFormatted: '0s',
        externalIp: 'Not available',
        memory: { usagePercent: 0 },
        cpu: { loadPercent: 0, loadAverage: [0, 0, 0] },
      }),
      this._safeCollectMetric(() => this.getResourceData(), 'Resource data', {
        memory: { status: 'unknown', used: 0, free: 0, percentage: 0 },
        performance: { status: 'unknown', responseTime: 0, load: 'unknown' },
        optimizationTier: 'unknown',
      }),
      this._safeCollectMetric(() => this.getAnalyticsData(), 'Analytics data', {
        summary: {
          totalServers: 0,
          totalUsers: 0,
          successRate: 0,
          errorRate: 0,
          avgResponseTime: 0,
          totalCommands: 0,
        },
        recentErrors: [],
        recommendations: [],
      }),
    ]);
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
      return getEmptyCacheStats();
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
      const totalMessages = databaseService.getTotalMessageCount
        ? databaseService.getTotalMessageCount()
        : 0;

      // Get reminder stats
      const reminderStats = databaseService.getReminderStats();

      return {
        userCount,
        totalMessages,
        reminders: reminderStats,
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
          cancelledReminders: 0,
        },
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
        cancelledReminders: 0,
      };
    }
  }

  /**
   * Get system information
   * @returns {Object} System info
   */
  async getSystemInfo() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const processMemory = process.memoryUsage();

    // Get external IP (cached for 1 hour)
    let externalIp = 'Not available';
    try {
      externalIp = await this.getExternalIp();
    } catch (error) {
      logger.debug(`Failed to get external IP: ${error.message}`);
    }

    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: os.uptime(),
      uptimeFormatted: this.formatUptime(os.uptime() * 1000),
      externalIp: externalIp,
      memory: {
        total: totalMemory,
        free: freeMemory,
        used: usedMemory,
        totalFormatted: this.formatBytes(totalMemory),
        freeFormatted: this.formatBytes(freeMemory),
        usedFormatted: this.formatBytes(usedMemory),
        usagePercent: Math.round((usedMemory / totalMemory) * 100),
      },
      process: {
        pid: process.pid,
        rss: processMemory.rss,
        heapTotal: processMemory.heapTotal,
        heapUsed: processMemory.heapUsed,
        external: processMemory.external,
        rssFormatted: this.formatBytes(processMemory.rss),
        heapTotalFormatted: this.formatBytes(processMemory.heapTotal),
        heapUsedFormatted: this.formatBytes(processMemory.heapUsed),
      },
      cpu: {
        count: os.cpus().length,
        model: os.cpus()[0]?.model || 'Unknown',
        loadAverage: os.loadavg(),
        loadPercent: Math.round((os.loadavg()[0] / os.cpus().length) * 100),
      },
    };
  }

  async getExternalIp() {
    try {
      // Check if cached and still valid (1 hour cache)
      const cacheExpiry = 60 * 60 * 1000; // 1 hour
      if (
        this.externalIpCache.value &&
        this.externalIpCache.timestamp &&
        Date.now() - this.externalIpCache.timestamp < cacheExpiry
      ) {
        return this.externalIpCache.value;
      }

      // Fetch external IP from ipify.org API
      const https = require('https');
      const response = await new Promise((resolve, reject) => {
        https
          .get('https://api.ipify.org?format=json', (res) => {
            let data = '';
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => {
              try {
                const parsed = JSON.parse(data);
                resolve(parsed.ip);
              } catch (e) {
                reject(new Error('Failed to parse IP response'));
              }
            });
          })
          .on('error', reject);
      });

      // Cache the result
      this.externalIpCache.value = response;
      this.externalIpCache.timestamp = Date.now();

      logger.debug(`External IP detected: ${response}`);
      return response;
    } catch (error) {
      logger.warn(`Failed to get external IP from ipify.org: ${error.message}`);
      throw error;
    }
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
          percentage: Math.round(resourceStatus.memory.percentage),
        },
        performance: {
          status: resourceStatus.performance.status,
          responseTime: resourceStatus.performance.responseTime,
          load: resourceStatus.performance.load,
        },
        optimizationTier: resourceStatus.optimizationTier || 'Standard',
      };
    } catch (error) {
      logger.warn(`Failed to get resource data: ${error.message}`);
      return {
        memory: { status: 'unknown', used: 0, free: 0, percentage: 0 },
        performance: { status: 'unknown', responseTime: 0, load: 'unknown' },
        optimizationTier: 'Standard',
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
        const ResourceOptimizer = require('../utils/resource-optimizer');
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
          avgResponseTime: 0,
        },
        recommendations: recommendations.slice(0, 3),
        recentErrors: this.getRecentErrors(10),
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
          avgResponseTime: 0,
        },
        recommendations: ['System monitoring active'],
        recentErrors: this.getRecentErrors(10),
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
        commitUrl = `https://github.com/powerfulqa/aszune-ai-bot/commit/${commitSha}`;
      } catch (e) {
        // Git not available
      }

      const version = packageJson.version || '1.8.0';
      releaseUrl = `https://github.com/powerfulqa/aszune-ai-bot/releases/tag/v${version}`;

      return {
        version,
        commit: commitSha,
        commitUrl,
        releaseUrl,
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.warn(`Failed to get version info: ${error.message}`);
      return {
        version: '1.8.0',
        commit: 'unknown',
        commitUrl: '',
        releaseUrl: 'https://github.com/powerfulqa/aszune-ai-bot/releases',
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
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
            description: this.getTableDescription(tableName),
          });
        } catch (e) {
          logger.debug(`Table ${tableName} not found or error reading: ${e.message}`);
        }
      }

      return {
        tables,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.warn(`Failed to get database schema: ${error.message}`);
      return {
        tables: [],
        timestamp: new Date().toISOString(),
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
      reminders: 'User reminders with scheduling info',
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
    this._validateTableName(tableName);
    const db = this._getDatabase();

    const totalRows = this._getTableRowCount(db, tableName);
    let data = db.prepare(`SELECT * FROM ${tableName} LIMIT ? OFFSET ?`).all(limit, offset);

    // Enrich user_stats with resolved Discord usernames
    if (tableName === 'user_stats' && data?.length > 0) {
      data = await this._enrichUserStats(data);
    }

    return {
      table: tableName,
      totalRows,
      limit,
      offset,
      returnedRows: data?.length || 0,
      columns: this.getTableColumns(tableName),
      data: data || [],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Validate table name to prevent SQL injection
   * @private
   */
  _validateTableName(tableName) {
    const validTables = ['user_stats', 'user_messages', 'conversation_history', 'reminders'];
    if (!validTables.includes(tableName)) {
      throw new Error(`Invalid table: ${tableName}`);
    }
  }

  /**
   * Get database connection or throw
   * @private
   */
  _getDatabase() {
    if (!databaseService.getDb) throw new Error('Database not available');
    const db = databaseService.getDb();
    if (!db) throw new Error('Database connection unavailable');
    return db;
  }

  /**
   * Get total row count for table
   * @private
   */
  _getTableRowCount(db, tableName) {
    const countResult = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
    return countResult?.count || 0;
  }

  /**
   * Enrich user_stats rows with Discord usernames
   * @private
   */
  async _enrichUserStats(data) {
    return Promise.all(
      data.map(async (row) => {
        if (!row.username && this.discordClient) {
          const resolvedUsername = await this.resolveDiscordUsername(row.user_id);
          if (resolvedUsername) return { ...row, username: resolvedUsername };
        }
        return row;
      })
    );
  }

  /**
   * Get table column names
   * @param {string} tableName - Table name
   * @returns {Array<string>} Column names
   * @private
   */
  getTableColumns(tableName) {
    const columns = {
      user_stats: [
        'user_id',
        'username',
        'message_count',
        'total_summaries',
        'total_commands',
        'last_active',
        'first_seen',
      ],
      user_messages: ['id', 'user_id', 'message', 'timestamp'],
      conversation_history: ['id', 'user_id', 'role', 'message', 'timestamp'],
      reminders: ['id', 'user_id', 'message', 'scheduled_time', 'status', 'created_at'],
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
          timestamp: new Date().toISOString(),
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
          timestamp: new Date().toISOString(),
        },
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
        timestamp: new Date().toISOString(),
      });
    } else if (ratio > 0.75) {
      recommendations.push({
        category: 'memory',
        severity: 'warning',
        message: 'Heap memory usage at 75%+',
        action: 'Monitor memory usage closely',
        timestamp: new Date().toISOString(),
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
        timestamp: new Date().toISOString(),
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
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Send standard HTTP response with timestamp
   * @private
   */
  _sendResponse(res, data, statusCode = 200) {
    res.status(statusCode).json({
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send error HTTP response with timestamp
   * @private
   */
  _sendErrorResponse(res, error, context, statusCode = 500) {
    const errorResponse = ErrorHandler.handleError(error, context);
    res.status(statusCode).json({
      error: errorResponse.message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send socket metrics helper to avoid duplication
   * @private
   */
  async _emitMetricsToSocket(socket, context) {
    try {
      const metrics = await this.getMetrics();
      socket.emit('metrics', metrics);
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, context);
      socket.emit('error', { message: errorResponse.message });
    }
  }
}

const webDashboardService = new WebDashboardService();
module.exports = webDashboardService;
module.exports.WebDashboardService = WebDashboardService;
module.exports.default = webDashboardService;
