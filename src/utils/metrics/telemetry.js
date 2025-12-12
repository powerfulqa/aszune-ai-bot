/**
 * Telemetry Service - Usage statistics reporting
 * Sends anonymous usage data for product improvement
 *
 * @module utils/metrics/telemetry
 */

const http = require('http');
const https = require('https');
const analyticsCore = require('./analytics-core');
const perfMonitor = require('./perf-monitor');

let _heartbeatTimer = null;
let _retryCount = 0;

/**
 * Build telemetry payload
 * @param {string} action
 * @param {Object} extra
 * @returns {Object}
 */
function buildPayload(action, extra = {}) {
  const state = analyticsCore.getMetricsState();
  return {
    action,
    instanceKey: analyticsCore.generateSessionId(),
    instanceId: state.sid,
    client: state.ci,
    location: state.li,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

/**
 * Send telemetry to endpoint
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
async function sendTelemetry(payload) {
  const config = analyticsCore.getConfig();
  const endpoint = config.endpoint;

  if (!endpoint) {
    return { success: false, error: 'No endpoint configured' };
  }

  return new Promise((resolve) => {
    try {
      const url = new URL(endpoint);
      const protocol = url.protocol === 'https:' ? https : http;
      const data = JSON.stringify(payload);

      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        timeout: config.timeout,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'User-Agent': 'AszuneBot/1.0',
        },
      };

      const req = protocol.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const result = JSON.parse(body);
            resolve({ success: true, data: result });
          } catch {
            resolve({ success: false, error: 'Invalid response' });
          }
        });
      });

      req.on('error', (err) => resolve({ success: false, error: err.message }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Timeout' });
      });

      req.write(data);
      req.end();
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
}

/**
 * Register with telemetry service
 * @returns {Promise<boolean>}
 */
async function register() {
  const payload = buildPayload('register');
  const result = await sendTelemetry(payload);

  if (result.success && result.data?.instanceId) {
    analyticsCore.markVerified(result.data.instanceId);
    _retryCount = 0;
    return true;
  }

  _retryCount++;
  return false;
}

/**
 * Send heartbeat
 * @returns {Promise<boolean>}
 */
async function heartbeat() {
  const state = analyticsCore.getMetricsState();
  if (!state.sid) return false;

  const payload = buildPayload('heartbeat', {
    stats: { uptime: process.uptime() },
  });

  const result = await sendTelemetry(payload);

  if (result.success) {
    // Check for revocation
    if (result.data?.revoked === true) {
      analyticsCore.markUnverified();
      return false;
    }
    analyticsCore.updateState({ hb: Date.now() });
    return true;
  }

  return false;
}

/**
 * Start heartbeat timer
 */
function startHeartbeat() {
  if (_heartbeatTimer) return;

  const config = analyticsCore.getConfig();
  _heartbeatTimer = setInterval(async () => {
    const success = await heartbeat();
    if (!success && analyticsCore.isVerified()) {
      // Lost verification, try to re-register
      await register();
    }
  }, config.interval);
}

/**
 * Stop heartbeat timer
 */
function stopHeartbeat() {
  if (_heartbeatTimer) {
    clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
  }
}

/**
 * Initialize telemetry
 * @param {Object} client - Discord client
 * @returns {Promise<boolean>}
 */
async function initialize(client) {
  try {
    await perfMonitor.captureEnvironment(client);
    
    // Skip registration if instance-tracker already verified
    // This prevents duplicate instance registrations
    const instanceTracker = require('../../services/instance-tracker');
    if (instanceTracker.isVerified) {
      // Use the same instance ID from the main tracker
      const status = instanceTracker.getStatus();
      if (status.instanceId) {
        analyticsCore.markVerified(status.instanceId);
        startHeartbeat();
        return true;
      }
    }
    
    // Only register if main tracker didn't
    const success = await register();

    if (success) {
      startHeartbeat();
    }

    return success;
  } catch {
    return false;
  }
}

/**
 * Shutdown telemetry
 */
async function shutdown() {
  stopHeartbeat();

  // Send final beacon
  if (analyticsCore.isVerified()) {
    await sendTelemetry(buildPayload('shutdown'));
  }
}

module.exports = {
  initialize,
  shutdown,
  register,
  heartbeat,
  startHeartbeat,
  stopHeartbeat,
  buildPayload,
  sendTelemetry,
};
