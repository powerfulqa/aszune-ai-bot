/**
 * Instance Tracker Service
 * Phone-home beacon and license verification system
 *
 * Tracks bot instances for license compliance and provides:
 * - Registration with tracking server
 * - Periodic heartbeats
 * - IP/location tracking
 * - Kill switch for revoked instances
 *
 * @module services/instance-tracker
 */
const logger = require('../../utils/logger');
const { gatherClientInfo, generateInstanceKey } = require('./helpers/client-info');
const { getLocationInfo } = require('./helpers/location');
const { createBeaconPayload, sendBeacon } = require('./helpers/beacon');

// Default endpoint (base64 encoded for obfuscation)
const _defaultEndpoint = 'aHR0cDovL2xvY2FsaG9zdDozMDAxL2FwaS9iZWFjb24=';
const _decodeEndpoint = (s) => Buffer.from(s, 'base64').toString('utf-8');

// Configuration - verification is optional for graceful degradation
const TRACKING_CONFIG = {
  server: process.env.INSTANCE_TRACKING_SERVER || _decodeEndpoint(_defaultEndpoint),
  enabled: true, // Always enabled - do not change
  requireVerification: process.env.REQUIRE_INSTANCE_VERIFICATION !== 'false', // Default true, set env var to 'false' to disable
  heartbeatIntervalMs: 60 * 60 * 1000, // 1 hour
  maxRetries: 3,
  retryDelayMs: 5000,
};

/**
 * Instance Tracker class
 * Manages bot instance registration and heartbeat
 */
class InstanceTracker {
  constructor() {
    this.instanceId = null;
    this.isVerified = false;
    this.isAuthorized = false;
    this.lastHeartbeat = null;
    this.heartbeatTimer = null;
    this.clientInfo = null;
    this.locationInfo = null;
    this.retryCount = 0;
  }

  /**
   * Initialize tracking and verify instance
   * @param {Client} discordClient - Discord.js client
   * @returns {Promise<boolean>} Whether verification succeeded
   */
  async initialize(discordClient) {
    if (!this._isTrackingEnabled()) {
      return this._handleDisabledTracking();
    }

    try {
      await this._gatherInstanceData(discordClient);
      const verified = await this._registerWithServer();
      return this._handleRegistrationResult(verified, discordClient);
    } catch (error) {
      logger.error('Instance tracking initialization failed', { error: error.message });
      return false;
    }
  }

  /**
   * Check if tracking is enabled
   * @returns {boolean}
   * @private
   */
  _isTrackingEnabled() {
    // Always enabled - server config is the only gate
    return TRACKING_CONFIG.server !== null;
  }

  /**
   * Handle case when tracking server is not reachable
   * @returns {boolean}
   * @private
   */
  _handleDisabledTracking() {
    logger.warn('Instance tracking server not configured or reachable');
    // Return false to indicate not verified - bot will run in degraded mode
    return false;
  }

  /**
   * Gather all instance data (client info + location)
   * @param {Client} discordClient
   * @private
   */
  async _gatherInstanceData(discordClient) {
    this.clientInfo = await gatherClientInfo(discordClient);
    this.locationInfo = await getLocationInfo();
  }

  /**
   * Register instance with tracking server
   * @returns {Promise<{verified: boolean, authorized: boolean}>}
   * @private
   */
  async _registerWithServer() {
    const payload = createBeaconPayload('register', {
      client: this.clientInfo,
      location: this.locationInfo,
      instanceKey: generateInstanceKey(),
    });

    const response = await sendBeacon(TRACKING_CONFIG.server, payload, {
      maxRetries: TRACKING_CONFIG.maxRetries,
      retryDelayMs: TRACKING_CONFIG.retryDelayMs,
    });

    if (response?.verified) {
      this.instanceId = response.instanceId;
      this.isVerified = true;
      this.isAuthorized = response.authorized === true;
      return { verified: true, authorized: this.isAuthorized };
    }

    return { verified: false, authorized: false };
  }

  /**
   * Handle registration result
   * @param {{verified: boolean, authorized: boolean}} result
   * @param {Client} discordClient
   * @returns {boolean}
   * @private
   */
  _handleRegistrationResult(result, discordClient) {
    const { verified, authorized } = result;

    if (!verified) {
      logger.warn('Instance verification not available - bot will run in degraded mode');
      return false;
    }

    if (!authorized) {
      logger.error('Instance NOT AUTHORIZED - this instance has not been approved');
      logger.error('Contact the bot owner to authorize this instance');
      logger.error(`Instance ID: ${this.instanceId}`);

      // If verification is required and not authorized, shut down
      if (TRACKING_CONFIG.requireVerification) {
        logger.error('Shutting down - unauthorized instance');
        setTimeout(() => process.exit(1), 3000);
        return false;
      }

      // If verification not required, continue in degraded mode
      logger.warn('Running in degraded mode (unauthorized)');
      return false;
    }

    // Verified and authorized - full operation
    this._startHeartbeat(discordClient);
    logger.info('Instance verified and AUTHORIZED', { instanceId: this.instanceId });
    return true;
  }

  /**
   * Start periodic heartbeat
   * @param {Client} discordClient
   * @private
   */
  _startHeartbeat(discordClient) {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(async () => {
      await this._sendHeartbeat(discordClient);
    }, TRACKING_CONFIG.heartbeatIntervalMs);

    // Send initial heartbeat
    this._sendHeartbeat(discordClient);
  }

  /**
   * Send heartbeat to tracking server
   * @param {Client} discordClient
   * @returns {Promise<boolean>}
   * @private
   */
  async _sendHeartbeat(discordClient) {
    if (!this.isVerified || !this.instanceId) {
      logger.warn('Cannot send heartbeat - instance not verified');
      return false;
    }

    const payload = createBeaconPayload('heartbeat', {
      instanceId: this.instanceId,
      stats: this._getHeartbeatStats(discordClient),
    });

    try {
      const response = await sendBeacon(TRACKING_CONFIG.server, payload);
      this.lastHeartbeat = new Date();

      if (response?.revoked) {
        this._handleRevocation(discordClient, 'Instance has been REVOKED');
        return false;
      }

      if (response?.authorized === false) {
        this._handleRevocation(discordClient, 'Instance authorization has been REVOKED');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Heartbeat failed', { error: error.message });
      return false;
    }
  }

  /**
   * Get stats for heartbeat payload
   * @param {Client} discordClient
   * @returns {Object}
   * @private
   */
  _getHeartbeatStats(discordClient) {
    return {
      guildCount: discordClient?.guilds?.cache?.size || 0,
      userCount: discordClient?.users?.cache?.size || 0,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage().heapUsed,
      status: discordClient?.user?.presence?.status || 'unknown',
    };
  }

  /**
   * Handle instance revocation
   * @param {Client} discordClient
   * @param {string} reason - Reason for revocation
   * @private
   */
  _handleRevocation(discordClient, reason = 'Instance has been revoked') {
    logger.error(`${reason} - shutting down`);
    this.stop();

    if (discordClient) {
      discordClient.destroy();
    }

    setTimeout(() => process.exit(1), 5000);
  }

  /**
   * Get current instance status for dashboard
   * @returns {Object}
   */
  getStatus() {
    return {
      instanceId: this.instanceId,
      isVerified: this.isVerified,
      isAuthorized: this.isAuthorized,
      lastHeartbeat: this.lastHeartbeat,
      clientInfo: this.clientInfo,
      locationInfo: this.locationInfo,
      trackingEnabled: TRACKING_CONFIG.enabled,
      trackingServer: TRACKING_CONFIG.server ? '[configured]' : null,
    };
  }

  /**
   * Stop tracking (for graceful shutdown)
   */
  stop() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    logger.debug('Instance tracker stopped');
  }

  /**
   * Check if verification is required
   * @returns {boolean}
   */
  isVerificationRequired() {
    return TRACKING_CONFIG.requireVerification;
  }
}

module.exports = new InstanceTracker();
