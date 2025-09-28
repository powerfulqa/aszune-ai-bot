/**
 * Utility for logging and error handling
 */
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');

class Logger {
  constructor() {
    this.levels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
    };
    // Setup log file path
    this.logDir = path.join(__dirname, '../../logs');
    this.logFile = path.join(this.logDir, 'bot.log');

    // Create log directory if not in test environment
    if (process.env.NODE_ENV !== 'test') {
      this._ensureLogDirectory();
    }
  }

  /**
   * Create log directory if it doesn't exist
   * @private
   */
  async _ensureLogDirectory() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  /**
   * Format a log message with timestamp
   * @param {string} level - Log level
   * @param {string} message - Message to log
   * @returns {string} - Formatted log message
   */
  _formatMessage(level, message) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }

  /**
   * Write log to file if not in test mode
   * @param {string} formattedMessage - Formatted log message
   * @private
   */
  async _writeToFile(formattedMessage) {
    if (process.env.NODE_ENV === 'test') return;

    try {
      // Ensure log directory exists
      await this._ensureLogDirectory();

      // Check if log file needs rotation
      await this._rotateLogFileIfNeeded();

      // Append to log file
      await fs.appendFile(this.logFile, formattedMessage + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Rotate log file if it gets too large
   * @private
   */
  async _rotateLogFileIfNeeded() {
    try {
      const stats = await fs.stat(this.logFile).catch(() => ({ size: 0 }));
      // Default size from config, but use env if available (convert MB to bytes)
      const envMaxSizeMB = parseInt(process.env.PI_LOG_MAX_SIZE_MB, 10);
      const maxSizeMB = !isNaN(envMaxSizeMB) ? envMaxSizeMB : config.LOGGING.DEFAULT_MAX_SIZE_MB;
      const maxSize = maxSizeMB * 1024 * 1024;

      if (stats.size > maxSize) {
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        await fs.rename(this.logFile, `${this.logFile}.${timestamp}`);

        // Remove old log files (keep only configured number most recent)
        const files = await fs.readdir(this.logDir);
        const oldLogs = files
          .filter((f) => f.startsWith('bot.log.') && f !== 'bot.log')
          .sort()
          .reverse()
          .slice(config.LOGGING.MAX_LOG_FILES);

        for (const oldLog of oldLogs) {
          await fs.unlink(path.join(this.logDir, oldLog)).catch(() => {});
        }
      }
    } catch (error) {
      // Fail silently, don't crash if log rotation fails
      console.error('Log rotation failed:', error);
    }
  }

  /**
   * Get the current log level
   * @private
   */
  _getLogLevel() {
    const envLevel = process.env.PI_LOG_LEVEL || 'INFO';
    return this.levels[envLevel] !== undefined ? this.levels[envLevel] : this.levels.INFO;
  }

  /**
   * Log a debug message
   * @param {string} message - Message to log
   * @param {*} data - Additional data to log
   */
  debug(message, ...dataArgs) {
    if (this._getLogLevel() <= this.levels.DEBUG) {
      const formattedMessage = this._formatMessage('DEBUG', message);
      console.log(formattedMessage);

      // Log each data argument
      dataArgs.forEach((data) => {
        if (data !== undefined) console.log(data);
      });

      // Write to file
      this._writeToFile(formattedMessage);
      dataArgs.forEach((data) => {
        if (data !== undefined) {
          try {
            this._writeToFile(JSON.stringify(data));
          } catch (error) {
            // Handle circular references
            this._writeToFile('[Circular Reference]');
          }
        }
      });
    }
  }

  /**
   * Log an info message
   * @param {string} message - Message to log
   * @param {*} data - Additional data to log
   */
  info(message, data) {
    if (this._getLogLevel() <= this.levels.INFO) {
      const formattedMessage = this._formatMessage('INFO', message);
      console.log(formattedMessage);
      if (data) console.log(data);

      // Write to file
      this._writeToFile(formattedMessage);
      if (data) this._writeToFile(JSON.stringify(data));
    }
  }

  /**
   * Log a warning message
   * @param {string} message - Message to log
   * @param {*} data - Additional data to log
   */
  warn(message, data) {
    if (this._getLogLevel() <= this.levels.WARN) {
      const formattedMessage = this._formatMessage('WARN', message);
      console.warn(formattedMessage);
      if (data) console.warn(data);

      // Write to file
      this._writeToFile(formattedMessage);
      if (data) this._writeToFile(JSON.stringify(data));
    }
  }

  /**
   * Log an error message
   * @param {string} message - Message to log
   * @param {Error} error - Error object
   */
  error(message, error) {
    if (this._getLogLevel() <= this.levels.ERROR) {
      const formattedMessage = this._formatMessage('ERROR', message);
      console.error(formattedMessage);

      // Write to file
      this._writeToFile(formattedMessage);

      if (error) {
        let errorDetails;

        if (error.response) {
          // API error with response
          errorDetails = {
            type: 'API Error Response',
            status: error.response.status,
            data: error.response.data,
          };
          console.error('API Error Response:', errorDetails);
        } else if (error.request) {
          // No response received
          errorDetails = {
            type: 'No API Response',
            request: error.request,
          };
          console.error('No response received from API:', error.request);
        } else if (typeof error === 'object' && !error.message && !error.stack) {
          // Simple data object
          console.error(error);
          errorDetails = error;
        } else {
          // General error
          errorDetails = {
            type: 'General Error',
            message: error.message || String(error),
            stack: error.stack,
          };
          console.error('Error:', error.message || error);
          if (error.stack) console.error('Stack:', error.stack);
        }

        // Write error details to file
        this._writeToFile(JSON.stringify(errorDetails, null, 2));
      }
    }
  }

  /**
   * Handle an error and return a user-friendly message
   * @param {Error} error - The error to handle
   * @param {string} context - Context where the error occurred
   * @returns {string} - User-friendly error message
   * @deprecated Use ErrorHandler.handleError() instead for consistent error handling
   */
  handleError(error, context = '') {
    // Import ErrorHandler dynamically to avoid circular dependency
    const { ErrorHandler } = require('./error-handler');
    const errorResponse = ErrorHandler.handleError(error, context);
    return errorResponse.message;
  }
}

module.exports = new Logger();
