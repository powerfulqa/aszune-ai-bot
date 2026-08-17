/**
 * Config Socket Handlers for Web Dashboard
 * Handles configuration-related socket events
 * @module web-dashboard/handlers/configHandlers
 */

const fsPromises = require('fs').promises;
const path = require('path');
const logger = require('../../../utils/logger');
const { sendError, sendSaveError, sendValidationError } = require('./callbackHelpers');
const { validateEnvContent, validateJsContent } = require('../../../utils/config-validators');

// Only these files may be read or written through the dashboard. Without this
// allowlist the handlers accept any path under cwd, which allows overwriting
// source files (remote code execution) and reading arbitrary files.
const READABLE_FILES = ['.env', 'config.js', '.env.example'];
const WRITABLE_FILES = ['.env', 'config.js'];

// Placeholder shown to the dashboard in place of a secret value. A save that
// still carries this sentinel is treated as "leave the secret unchanged".
const SECRET_MASK = '********';

// Env keys whose values must never be sent to the browser.
const SECRET_KEY_PATTERN = /(TOKEN|KEY|SECRET|PASSWORD|PASSPHRASE|CREDENTIAL)/i;

/**
 * Register config-related socket event handlers
 * @param {Socket} socket - Socket.IO socket instance
 * @param {WebDashboardService} _dashboard - Dashboard service instance (unused, for API consistency)
 */
function registerConfigHandlers(socket, _dashboard, options = {}) {
  const { allowWrite = true } = options;

  socket.on('request_config', async (data, callback) => {
    await handleRequestConfig(data, callback);
  });

  socket.on('validate_config', (data, callback) => {
    handleValidateConfig(data, callback);
  });

  // save_config mutates files on disk; only register it when writes are allowed
  if (allowWrite) {
    socket.on('save_config', async (data, callback) => {
      await handleSaveConfig(data, callback);
    });
  }
}

/**
 * Handle config file request
 * @param {Object} data - Request data with filename
 * @param {Function} callback - Response callback
 */
async function handleRequestConfig(data, callback) {
  try {
    const filename = data?.filename || '.env';

    // Security: only allow reading known config files
    if (!READABLE_FILES.includes(filename)) {
      logger.warn(`Security: Rejected config read for non-allowlisted file "${filename}"`);
      sendError(callback, `Access denied: ${filename} is not a readable config file`);
      return;
    }

    const configPath = path.join(process.cwd(), filename);

    // Defense in depth: reject anything that resolves outside cwd
    if (!configPath.startsWith(process.cwd())) {
      logger.warn(`Security: Attempted directory traversal access to ${filename}`);
      sendError(callback, 'Access denied: Cannot access files outside project directory');
      return;
    }

    // Check if file exists
    try {
      await fsPromises.access(configPath);
    } catch {
      logger.warn(`Config file not found: ${configPath}`);
      sendError(callback, `File not found: ${filename}`, { content: '' });
      return;
    }

    // Read file content, masking any secret values before sending to the browser
    const rawContent = await fsPromises.readFile(configPath, 'utf-8');
    const content = maskSecrets(filename, rawContent);
    const fileInfo = await fsPromises.stat(configPath);

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
async function handleSaveConfig(data, callback) {
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

    // Create backup if file exists, and restore any masked secrets from the
    // current file so an edited-in-browser copy can't blank out real secrets
    let contentToWrite = content;
    try {
      await fsPromises.access(configPath);
      const existing = await fsPromises.readFile(configPath, 'utf-8');
      contentToWrite = restoreMaskedSecrets(filename, content, existing);
      const backupPath = `${configPath}.backup.${Date.now()}`;
      await fsPromises.copyFile(configPath, backupPath);
      logger.info(`Config backup created: ${backupPath}`);
    } catch {
      // File doesn't exist yet, no backup/restore needed
    }

    // Write new content
    await fsPromises.writeFile(configPath, contentToWrite, 'utf-8');

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
  if (!WRITABLE_FILES.includes(filename)) {
    logger.warn(`Security: Rejected config save for non-allowlisted file "${filename}"`);
    return `Access denied: ${filename} cannot be modified`;
  }
  return null;
}

/**
 * Replace secret values in .env content with a mask placeholder so raw
 * credentials are never sent to the browser.
 * @param {string} filename - File being read
 * @param {string} content - Raw file content
 * @returns {string} Content with secret values masked
 */
function maskSecrets(filename, content) {
  if (filename !== '.env' || typeof content !== 'string') {
    return content;
  }
  return content
    .split('\n')
    .map((line) => {
      const match = line.match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(.*)$/);
      if (!match) return line;
      const [, indent, key, sep, value] = match;
      if (value.trim() && SECRET_KEY_PATTERN.test(key)) {
        return `${indent}${key}${sep}${SECRET_MASK}`;
      }
      return line;
    })
    .join('\n');
}

/**
 * Restore masked secret values from the existing file so a save that still
 * carries the mask placeholder keeps the real credential intact.
 * @param {string} filename - File being written
 * @param {string} newContent - Content submitted from the browser
 * @param {string} existingContent - Current on-disk content
 * @returns {string} Content with masked values restored
 */
function restoreMaskedSecrets(filename, newContent, existingContent) {
  if (filename !== '.env' || typeof newContent !== 'string') {
    return newContent;
  }

  const existingValues = new Map();
  for (const line of existingContent.split('\n')) {
    const match = line.match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(.*)$/);
    if (match) existingValues.set(match[2], match[4]);
  }

  return newContent
    .split('\n')
    .map((line) => {
      const match = line.match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(.*)$/);
      if (!match) return line;
      const [, indent, key, sep, value] = match;
      if (value.trim() === SECRET_MASK && existingValues.has(key)) {
        return `${indent}${key}${sep}${existingValues.get(key)}`;
      }
      return line;
    })
    .join('\n');
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
  maskSecrets,
  restoreMaskedSecrets,
  READABLE_FILES,
  WRITABLE_FILES,
  SECRET_MASK,
};
