/**
 * Beacon Helper
 * Handles communication with the tracking server
 *
 * @module services/instance-tracker/helpers/beacon
 */
const logger = require('../../../utils/logger');

const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Create beacon payload
 * @param {string} action - 'register' or 'heartbeat'
 * @param {Object} data - Payload data
 * @returns {Object} Complete payload
 */
function createBeaconPayload(action, data) {
  return {
    action,
    timestamp: new Date().toISOString(),
    ...data,
  };
}

/**
 * Send beacon to tracking server
 * @param {string} serverUrl - Tracking server URL
 * @param {Object} payload - Request payload
 * @param {Object} options - Request options
 * @returns {Promise<Object|null>} Response data or null
 */
async function sendBeacon(serverUrl, payload, options = {}) {
  const { maxRetries = 1, retryDelayMs = 5000 } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await attemptSendBeacon(serverUrl, payload);

    if (result.success) {
      return result.data;
    }

    if (attempt < maxRetries) {
      logger.info('Beacon failed, retrying', { attempt, maxRetries });
      await sleep(retryDelayMs * attempt);
    }
  }

  logger.error('Beacon failed after all retries', { maxRetries });
  return null;
}

/**
 * Single attempt to send beacon
 * @param {string} serverUrl
 * @param {Object} payload
 * @returns {Promise<Object>} Result with success flag and data
 */
async function attemptSendBeacon(serverUrl, payload) {
  try {
    const response = await fetchWithTimeout(serverUrl, payload);

    if (!response.ok) {
      logger.warn('Beacon request failed', { status: response.status });
      return { success: false, data: null };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    logBeaconError(error);
    return { success: false, data: null };
  }
}

/**
 * Fetch with timeout and proper headers
 * @param {string} url
 * @param {Object} payload
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    return await fetch(url, {
      method: 'POST',
      headers: buildHeaders(payload),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Build request headers
 * @param {Object} payload
 * @returns {Object}
 */
function buildHeaders(payload) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Bot-Version': '1.10.0',
  };

  if (payload.instanceKey) {
    headers['X-Instance-Key'] = payload.instanceKey;
  }

  if (payload.instanceId) {
    headers['X-Instance-Id'] = payload.instanceId;
  }

  return headers;
}

/**
 * Log beacon error with appropriate message
 * @param {Error} error
 */
function logBeaconError(error) {
  if (error.name === 'AbortError') {
    logger.debug('Beacon request timed out - tracking server may be unavailable');
  } else if (error.message && error.message.includes('fetch failed')) {
    logger.debug('Beacon request failed - tracking server connection refused');
  } else {
    logger.debug('Beacon request failed', { error: error.message });
  }
}

/**
 * Sleep helper
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  createBeaconPayload,
  sendBeacon,
  buildHeaders,
};
