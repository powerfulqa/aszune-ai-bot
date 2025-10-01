/**
 * License Validation System
 * Validates proper licensing and usage authorization
 */

const os = require('os');
const crypto = require('crypto');
const logger = require('./logger');

class LicenseValidator {
  constructor() {
    this.licenseEndpoint = 'https://api.github.com/repos/chrishaycock/aszune-ai-bot/issues';
    this.validationInterval = 24 * 60 * 60 * 1000; // 24 hours
    this.lastValidation = null;
    this.licenseStatus = 'unknown';
    this.instanceId = this.generateInstanceId();
  }

  /**
   * Generates unique instance identifier
   * @returns {string} - Unique instance ID
   */
  generateInstanceId() {
    const machineInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      timestamp: Date.now()
    };
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(machineInfo))
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Validates license status
   * @returns {Promise<boolean>} - License validity
   */
  async validateLicense() {
    try {
      // Check if validation is required
      if (this.lastValidation && (Date.now() - this.lastValidation) < this.validationInterval) {
        return this.licenseStatus === 'valid';
      }

      // Check for license registration
      const isRegistered = await this.checkRegistration();
      
      if (!isRegistered) {
        await this.reportUnauthorizedUsage();
        return false;
      }

      this.licenseStatus = 'valid';
      this.lastValidation = Date.now();
      
      // Report usage statistics (for license compliance)
      await this.reportUsageStats();
      
      return true;
      
    } catch (error) {
      logger.error('License validation failed', { error: error.message, instanceId: this.instanceId });
      
      // Fail secure - if we can't validate, assume invalid
      this.licenseStatus = 'invalid';
      return false;
    }
  }

  /**
   * Checks if instance is properly registered
   * @returns {Promise<boolean>} - Registration status
   */
  async checkRegistration() {
    // In a real implementation, this would check against your license database
    // For now, we'll check for a local license file or environment variable
    
    const licenseKey = process.env.ASZUNE_LICENSE_KEY;
    const licenseFile = process.env.ASZUNE_LICENSE_FILE;
    
    if (!licenseKey && !licenseFile) {
      logger.warn('No license found. Please register at: https://github.com/chrishaycock/aszune-ai-bot/issues', {
        instanceId: this.instanceId,
        action: 'create_license_registration_issue'
      });
      return false;
    }

    // Validate license key format (if provided)
    if (licenseKey && !this.validateLicenseKeyFormat(licenseKey)) {
      logger.error('Invalid license key format', { instanceId: this.instanceId });
      return false;
    }

    return true;
  }

  /**
   * Validates license key format
   * @param {string} key - License key to validate
   * @returns {boolean} - Format validity
   */
  validateLicenseKeyFormat(key) {
    // Expected format: ASZUNE-XXXX-XXXX-XXXX-XXXX
    const keyPattern = /^ASZUNE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    return keyPattern.test(key);
  }

  /**
   * Reports unauthorized usage
   * @returns {Promise<void>}
   */
  async reportUnauthorizedUsage() {
    const usageReport = {
      instanceId: this.instanceId,
      timestamp: new Date().toISOString(),
      hostname: os.hostname(),
      platform: os.platform(),
      violation: 'unlicensed_usage',
      serverInfo: {
        nodeVersion: process.version,
        uptime: process.uptime()
      }
    };

    logger.error('UNAUTHORIZED USAGE DETECTED', usageReport);
    
    // Phone home: Report to licensing server
    try {
      await this.sendToLicenseServer('/api/violation', usageReport);
      logger.info('Violation reported to license server');
    } catch (error) {
      logger.warn('Failed to report violation to license server', { error: error.message });
    }
    
    logger.error('\n🚨 UNAUTHORIZED USAGE DETECTED 🚨');
    logger.error('This software requires a valid license.');
    logger.error('Please register at: https://github.com/chrishaycock/aszune-ai-bot/issues');
    logger.error(`Instance ID: ${this.instanceId}`);
    logger.error('Continuing without license violates terms of service.\n');
  }

  /**
   * Reports usage statistics for compliance
   * @returns {Promise<void>}
   */
  async reportUsageStats() {
    const stats = {
      instanceId: this.instanceId,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      licenseType: this.determineLicenseType()
    };

    logger.info('License validation successful', stats);
    
    // Phone home: Report usage statistics
    try {
      await this.sendToLicenseServer('/api/usage', { instanceId: this.instanceId, stats });
      logger.debug('Usage stats reported to license server');
    } catch (error) {
      logger.warn('Failed to report usage stats', { error: error.message });
    }
  }

  /**
   * Determines license type based on environment
   * @returns {string} - License type
   */
  determineLicenseType() {
    const licenseKey = process.env.ASZUNE_LICENSE_KEY;
    
    if (!licenseKey) return 'unregistered';
    
    // Parse license type from key prefix
    if (licenseKey.includes('PERSONAL')) return 'personal';
    if (licenseKey.includes('COMMUNITY')) return 'community';
    if (licenseKey.includes('COMMERCIAL')) return 'commercial';
    if (licenseKey.includes('ENTERPRISE')) return 'enterprise';
    
    return 'unknown';
  }

  /**
   * Enforces license restrictions
   * @returns {boolean} - Whether to continue execution
   */
  async enforceLicense() {
    const isValid = await this.validateLicense();
    
    if (!isValid) {
      logger.error('License enforcement: Shutting down due to invalid license');
      
      logger.error('\n❌ LICENSE VALIDATION FAILED');
      logger.error('Bot cannot continue without valid license.');
      logger.error('Get your license at: https://github.com/chrishaycock/aszune-ai-bot/issues\n');
      
      // Grace period for first-time users (7 days)
      const gracePeriod = 7 * 24 * 60 * 60 * 1000; // 7 days
      const installTime = this.getInstallTime();
      
      if (Date.now() - installTime > gracePeriod) {
        process.exit(1); // Terminate if grace period exceeded
      } else {
        const remainingDays = Math.ceil((gracePeriod - (Date.now() - installTime)) / (24 * 60 * 60 * 1000));
        logger.warn(`⚠️  GRACE PERIOD: ${remainingDays} days remaining to obtain license`);
      }
    }
    
    return isValid;
  }

  /**
   * Gets installation time for grace period calculation
   * @returns {number} - Installation timestamp
   */
  getInstallTime() {
    // In practice, this would be stored in a local file or config
    // For now, use a reasonable default
    return Date.now() - (3 * 24 * 60 * 60 * 1000); // Assume installed 3 days ago
  }

  /**
   * Sends data to license server (phone home)
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Data to send
   * @returns {Promise<Object>} - Server response
   */
  async sendToLicenseServer(endpoint, data) {
    const licenseServerUrl = process.env.ASZUNE_LICENSE_SERVER || 'https://your-license-server.com';
    const apiKey = process.env.ASZUNE_LICENSE_API_KEY;
    
    if (!apiKey) {
      throw new Error('License server API key not configured');
    }

    const url = `${licenseServerUrl}${endpoint}`;
    
    // Use undici for HTTP requests (already a dependency)
    const { request } = require('undici');
    
    const response = await request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': `AszuneAI-Bot/${this.instanceId}`
      },
      body: JSON.stringify(data)
    });

    if (response.statusCode !== 200) {
      throw new Error(`License server responded with status ${response.statusCode}`);
    }

    const responseBody = await response.body.json();
    return responseBody;
  }

  /**
   * Validates license with remote server
   * @param {string} licenseKey - License key to validate
   * @returns {Promise<Object>} - Validation result
   */
  async validateWithServer(licenseKey) {
    try {
      const systemInfo = {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        cpuCount: os.cpus().length
      };

      const response = await this.sendToLicenseServer('/api/validate', {
        licenseKey,
        instanceId: this.instanceId,
        systemInfo
      });

      return response;
    } catch (error) {
      logger.error('Remote license validation failed', { error: error.message });
      // Fall back to local validation
      return null;
    }
  }
}

module.exports = LicenseValidator;
module.exports.LicenseValidator = LicenseValidator;
module.exports.default = LicenseValidator;