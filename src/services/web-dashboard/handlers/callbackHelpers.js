/**
 * Callback Helper Utilities for Web Dashboard Socket Handlers
 * Reduces code duplication by providing standardized callback response functions
 * @module web-dashboard/handlers/callbackHelpers
 */

/**
 * Send error response via callback if callback exists
 * @param {Function|null} callback - Socket callback function
 * @param {string} errorMessage - Error message to send
 * @param {Object} [defaults={}] - Default values to include in error response
 * @returns {void}
 */
function sendError(callback, errorMessage, defaults = {}) {
  if (callback) {
    callback({ error: errorMessage, ...defaults });
  }
}

/**
 * Send success response via callback if callback exists
 * @param {Function|null} callback - Socket callback function
 * @param {Object} data - Data to send in response
 * @returns {void}
 */
function sendSuccess(callback, data) {
  if (callback) {
    callback(data);
  }
}

/**
 * Send error response with 'success: false' flag
 * @param {Function|null} callback - Socket callback function
 * @param {string} errorMessage - Error message to send
 * @param {Object} [extraData={}] - Additional data to include
 * @returns {void}
 */
function sendOperationError(callback, errorMessage, extraData = {}) {
  sendError(callback, errorMessage, { success: false, ...extraData });
}

/**
 * Send error response with empty array default
 * @param {Function|null} callback - Socket callback function
 * @param {string} errorMessage - Error message to send
 * @param {string} arrayKey - Key name for the empty array
 * @returns {void}
 */
function sendErrorWithEmptyArray(callback, errorMessage, arrayKey) {
  sendError(callback, errorMessage, { [arrayKey]: [] });
}

/**
 * Send error response with 'created: false' flag
 * @param {Function|null} callback - Socket callback function
 * @param {string} errorMessage - Error message to send
 * @returns {void}
 */
function sendCreateError(callback, errorMessage) {
  sendError(callback, errorMessage, { created: false });
}

/**
 * Send error response with 'updated: false' flag
 * @param {Function|null} callback - Socket callback function
 * @param {string} errorMessage - Error message to send
 * @returns {void}
 */
function sendUpdateError(callback, errorMessage) {
  sendError(callback, errorMessage, { updated: false });
}

/**
 * Send error response with 'deleted: false' flag
 * @param {Function|null} callback - Socket callback function
 * @param {string} errorMessage - Error message to send
 * @returns {void}
 */
function sendDeleteError(callback, errorMessage) {
  sendError(callback, errorMessage, { deleted: false });
}

/**
 * Send error response with 'saved: false' flag
 * @param {Function|null} callback - Socket callback function
 * @param {string} errorMessage - Error message to send
 * @returns {void}
 */
function sendSaveError(callback, errorMessage) {
  sendError(callback, errorMessage, { saved: false });
}

/**
 * Send error response with 'valid: false' flag
 * @param {Function|null} callback - Socket callback function
 * @param {string} errorMessage - Error message to send
 * @returns {void}
 */
function sendValidationError(callback, errorMessage) {
  sendError(callback, errorMessage, { valid: false });
}

/**
 * Send error response with 'cleared: false' flag
 * @param {Function|null} callback - Socket callback function
 * @param {string} errorMessage - Error message to send
 * @returns {void}
 */
function sendClearError(callback, errorMessage) {
  sendError(callback, errorMessage, { cleared: false });
}

/**
 * Send error response with 'connected: false' flag
 * @param {Function|null} callback - Socket callback function
 * @param {string} errorMessage - Error message to send
 * @returns {void}
 */
function sendConnectionError(callback, errorMessage) {
  sendError(callback, errorMessage, { connected: false });
}

module.exports = {
  sendError,
  sendSuccess,
  sendOperationError,
  sendErrorWithEmptyArray,
  sendCreateError,
  sendUpdateError,
  sendDeleteError,
  sendSaveError,
  sendValidationError,
  sendClearError,
  sendConnectionError,
};
