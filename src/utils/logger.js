/**
 * Utility for logging and error handling
 */
class Logger {
  constructor() {
    this.levels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
    };
    
    // Set log level based on environment
    this.logLevel = process.env.NODE_ENV === 'production' 
      ? this.levels.INFO 
      : this.levels.DEBUG;
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
   * Log a debug message
   * @param {string} message - Message to log
   * @param {*} data - Additional data to log
   */
  debug(message, data) {
    if (this.logLevel <= this.levels.DEBUG) {
      console.log(this._formatMessage('DEBUG', message));
      if (data) console.log(data);
    }
  }
  
  /**
   * Log an info message
   * @param {string} message - Message to log
   * @param {*} data - Additional data to log
   */
  info(message, data) {
    if (this.logLevel <= this.levels.INFO) {
      console.log(this._formatMessage('INFO', message));
      if (data) console.log(data);
    }
  }
  
  /**
   * Log a warning message
   * @param {string} message - Message to log
   * @param {*} data - Additional data to log
   */
  warn(message, data) {
    if (this.logLevel <= this.levels.WARN) {
      console.warn(this._formatMessage('WARN', message));
      if (data) console.warn(data);
    }
  }
  
  /**
   * Log an error message
   * @param {string} message - Message to log
   * @param {Error} error - Error object
   */
  error(message, error) {
    if (this.logLevel <= this.levels.ERROR) {
      console.error(this._formatMessage('ERROR', message));
      
      if (error) {
        if (error.response) {
          // API error with response
          console.error('API Error Response:', {
            status: error.response.status,
            data: error.response.data,
          });
        } else if (error.request) {
          // No response received
          console.error('No response received from API:', error.request);
        } else {
          // General error
          console.error('Error:', error.message || error);
          if (error.stack) console.error('Stack:', error.stack);
        }
      }
    }
  }
  
  /**
   * Handle an error and return a user-friendly message
   * @param {Error} error - The error to handle
   * @param {string} context - Context where the error occurred
   * @returns {string} - User-friendly error message
   */
  handleError(error, context = '') {
    let userMessage = 'There was an error processing your request. Please try again later.';
    
    // Log the error
    this.error(`Error in ${context}:`, error);
    
    // Customize message based on error type
    if (error.message.includes('429')) {
      userMessage = 'The service is currently busy. Please try again in a few moments.';
    } else if (error.message.includes('401') || error.message.includes('403')) {
      userMessage = 'Authentication error. Please contact an administrator.';
    } else if (error.message.includes('504') || error.message.includes('timeout')) {
      userMessage = 'The request timed out. Please try again with a shorter message.';
    }
    
    return userMessage;
  }
}

module.exports = new Logger();
