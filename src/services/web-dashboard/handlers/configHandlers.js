/**
 * Config Socket Handlers for Web Dashboard
 * Handles configuration-related socket events
 * @module web-dashboard/handlers/configHandlers
 */

const fs = require('fs');
const path = require('path');
const logger = require('../../../utils/logger');
const { sendError, sendSaveError, sendValidationError } = require('./callbackHelpers');
const { validateEnvContent, validateJsContent } = require('../../../utils/config-validators');

/**
 * Register config-related socket event handlers
 * @param {Socket} socket - Socket.IO socket instance
 * @param {WebDashboardService} _dashboard - Dashboard service instance (unused, for API consistency)
 */
function registerConfigHandlers(socket, _dashboard) {
  socket.on('request_config', (data, callback) => {
    handleRequestConfig(data, callback);
  });

  socket.on('save_config', (data, callback) => {
    handleSaveConfig(data, callback);
  });

  socket.on('validate_config', (data, callback) => {
    handleValidateConfig(data, callback);
  });
}

/**
 * Handle config file request
 * @param {Object} data - Request data with filename
 * @param {Function} callback - Response callback
 */
function handleRequestConfig(data, callback) {
  try {
    const filename = data?.filename || '.env';
    const configPath = path.join(process.cwd(), filename);

    // Security: prevent directory traversal
    if (!configPath.startsWith(process.cwd())) {
      const error = new Error('Access denied: Cannot access files outside project directory');
      logger.warn(`Security: Attempted directory traversal access to ${filename}`);
      sendError(callback, error.message);
      return;
    }

    // Check if file exists
    if (!fs.existsSync(configPath)) {
      const error = new Error(`File not found: ${filename}`);
      logger.warn(`Config file not found: ${configPath}`);
      sendError(callback, error.message, { content: '' });
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
    sendError(callback, error.message);
  }
}

/**
 * Handle config file save
 * @param {Object} data - Save data with filename and content
 * @param {Function} callback - Response callback
 */
function handleSaveConfig(data, callback) {
  try {
    const validationError = validateConfigSaveInput(data);
    if (validationError) {
      sendSaveError(callback, validationError);
      return;
    }

    const { filename, content } = data;
    const configPath = path.join(process.cwd(), filename);

    // Security: prevent directory traversal
    const pathError = validatePathSafety(configPath, filename);
    if (pathError) {
      sendSaveError(callback, pathError);
      return;
    }

    // Create backup if file exists
    if (fs.existsSync(configPath)) {
      const backupPath = `${configPath}.backup.${Date.now()}`;
      fs.copyFileSync(configPath, backupPath);
      logger.info(`Config backup created: ${backupPath}`);
    }

    // Write new content
    fs.writeFileSync(configPath, content, 'utf-8');

    if (callback) {
      callback({
        saved: true,
        filename,
        timestamp: new Date().toISOString(),
      });
    }

    logger.info(`Config saved: ${filename}`);
  } catch (error) {
    logger.error('Error saving config:', error);
    sendSaveError(callback, error.message);
  }
}

/**
 * Validate config save input data
 * @param {Object} data - Input data
 * @returns {string|null} Error message or null if valid
 */
function validateConfigSaveInput(data) {
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
 * @returns {string|null} Error message or null if safe
 */
function validatePathSafety(configPath, filename) {
  if (!configPath.startsWith(process.cwd())) {
    logger.warn(`Security: Attempted directory traversal save to ${filename}`);
    return 'Access denied: Cannot save files outside project directory';
  }
  return null;
}

/**
 * Handle config validation request
 * @param {Object} data - Validation data with content and fileType
 * @param {Function} callback - Response callback
 */
function handleValidateConfig(data, callback) {
  try {
    const { content, fileType = 'env' } = data;
    const validationResult = { valid: true, errors: [], warnings: [] };

    performFileValidation(fileType, content, validationResult);
    validationResult.timestamp = new Date().toISOString();

    if (callback) {
      callback(validationResult);
    }

    logger.debug(`Config validation complete: ${validationResult.valid ? 'valid' : 'invalid'}`);
  } catch (error) {
    logger.error('Error validating config:', error);
    sendValidationError(callback, error.message);
  }
}

/**
 * Perform file type-specific validation
 * @param {string} fileType - Type of file (env, js, etc.)
 * @param {string} content - File content to validate
 * @param {Object} result - Result object to populate
 */
function performFileValidation(fileType, content, result) {
  if (fileType === 'env') {
    validateEnvFile(content, result);
  } else if (fileType === 'js') {
    validateJsFile(content, result);
  }
}

/**
 * Validate .env file content using shared utility
 * @param {string} content - File content
 * @param {Object} result - Result object to populate
 */
function validateEnvFile(content, result) {
  const validation = validateEnvContent(content);
  result.errors.push(...validation.errors);
  result.warnings.push(...validation.warnings);
  if (!validation.valid) result.valid = false;
}

/**
 * Validate JavaScript file content using shared utility
 * @param {string} content - File content
 * @param {Object} result - Result object to populate
 */
function validateJsFile(content, result) {
  const validation = validateJsContent(content);
  result.errors.push(...validation.errors);
  result.warnings.push(...validation.warnings);
  if (!validation.valid) result.valid = false;
}

module.exports = {
  registerConfigHandlers,
  handleRequestConfig,
  handleSaveConfig,
  handleValidateConfig,
  validateConfigSaveInput,
  validatePathSafety,
  performFileValidation,
  validateEnvFile,
  validateJsFile,
};
