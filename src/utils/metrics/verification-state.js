/**
 * Unified Verification State Module
 *
 * Single source of truth for instance verification and authorization state.
 * Used by both instance-tracker and telemetry services to prevent duplicate
 * registrations and inconsistent states.
 *
 * @module utils/metrics/verification-state
 */

const logger = require('../logger');

// Shared state for verification
const _state = {
  instanceId: null,
  isVerified: false,
  isAuthorized: false,
  lastHeartbeat: null,
  registeredBy: null, // 'instance-tracker' or 'telemetry'
};

/**
 * Mark instance as verified
 * @param {string} instanceId - Instance ID from server
 * @param {string} source - 'instance-tracker' or 'telemetry'
 */
function markVerified(instanceId, source = 'unknown') {
  if (_state.isVerified && _state.registeredBy !== source) {
    logger.debug(`Instance already verified by ${_state.registeredBy}, ignoring ${source}`);
    return false;
  }

  _state.instanceId = instanceId;
  _state.isVerified = true;
  _state.registeredBy = source;
  logger.debug(`Instance verified by ${source}: ${instanceId}`);
  return true;
}

/**
 * Mark instance as authorized
 * @param {boolean} authorized - Authorization status
 */
function markAuthorized(authorized) {
  _state.isAuthorized = authorized;
}

/**
 * Mark instance as unverified (revoked)
 */
function markUnverified() {
  _state.isVerified = false;
  _state.isAuthorized = false;
  logger.debug('Instance verification revoked');
}

/**
 * Record heartbeat timestamp
 */
function recordHeartbeat() {
  _state.lastHeartbeat = Date.now();
}

/**
 * Check if instance is verified
 * @returns {boolean}
 */
function isVerified() {
  return _state.isVerified;
}

/**
 * Check if instance is authorized
 * @returns {boolean}
 */
function isAuthorized() {
  return _state.isAuthorized;
}

/**
 * Get instance ID
 * @returns {string|null}
 */
function getInstanceId() {
  return _state.instanceId;
}

/**
 * Get full verification state
 * @returns {Object}
 */
function getState() {
  return { ..._state };
}

/**
 * Check if a specific source has already registered
 * @param {string} source - 'instance-tracker' or 'telemetry'
 * @returns {boolean}
 */
function isRegisteredBy(source) {
  return _state.isVerified && _state.registeredBy === source;
}

/**
 * Reset state (for testing only)
 */
function resetForTests() {
  if (process.env.NODE_ENV !== 'test') {
    return;
  }
  _state.instanceId = null;
  _state.isVerified = false;
  _state.isAuthorized = false;
  _state.lastHeartbeat = null;
  _state.registeredBy = null;
}

module.exports = {
  markVerified,
  markAuthorized,
  markUnverified,
  recordHeartbeat,
  isVerified,
  isAuthorized,
  getInstanceId,
  getState,
  isRegisteredBy,
  resetForTests,
};
