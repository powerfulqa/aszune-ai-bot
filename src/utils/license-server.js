/**
 * License Server - Handles license validation and usage tracking
 * This is a simple Express server to manage licensing
 */

const express = require('express');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class LicenseServer {
  constructor(port = 3001) {
    this.app = express();
    this.port = port;
    this.licenseDB = new Map();
    this.usageStats = new Map();
    this.violationReports = [];

    this.setupMiddleware();
    this.setupRoutes();
    this.loadLicenseDatabase();
  }

  setupMiddleware() {
    this.app.use(express.json());

    // CORS for browser access
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization'
      );
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      next();
    });

    // API Key validation with timing-safe comparison
    this.app.use('/api', (req, res, next) => {
      const apiKey = req.headers.authorization;
      const envApiKey = process.env.LICENSE_SERVER_API_KEY;

      // Ensure both the provided API key and the expected API key are defined and non-empty strings
      if (typeof apiKey !== 'string' || !apiKey || typeof envApiKey !== 'string' || !envApiKey) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const expectedKey = `Bearer ${envApiKey}`;

      // Use timing-safe comparison to prevent timing attacks
      const apiKeyBuffer = Buffer.from(apiKey, 'utf8');
      const expectedKeyBuffer = Buffer.from(expectedKey, 'utf8');

      if (
        apiKeyBuffer.length !== expectedKeyBuffer.length ||
        !crypto.timingSafeEqual(apiKeyBuffer, expectedKeyBuffer)
      ) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      next();
    });
  }

  setupRoutes() {
    this._setupHealthRoute();
    this._setupValidationRoute();
    this._setupUsageRoute();
    this._setupViolationRoute();
    this._setupDashboardRoute();
  }

  _setupHealthRoute() {
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        activeLicenses: this.licenseDB.size,
        violations: this.violationReports.length,
      });
    });
  }

  _setupValidationRoute() {
    this.app.post('/api/validate', async (req, res) => {
      try {
        const { licenseKey, instanceId, systemInfo } = req.body;
        const validation = await this.validateLicense(licenseKey, instanceId, systemInfo);
        res.json(validation);
      } catch (error) {
        logger.error('License validation error:', error);
        res.status(500).json({ error: 'Validation failed' });
      }
    });
  }

  _setupUsageRoute() {
    this.app.post('/api/usage', async (req, res) => {
      try {
        const { instanceId, stats } = req.body;
        await this.recordUsage(instanceId, stats);
        res.json({ success: true, timestamp: new Date().toISOString() });
      } catch (error) {
        logger.error('Usage reporting error:', error);
        res.status(500).json({ error: 'Reporting failed' });
      }
    });
  }

  _setupViolationRoute() {
    this.app.post('/api/violation', async (req, res) => {
      try {
        const violationReport = {
          ...req.body,
          reportedAt: new Date().toISOString(),
          id: crypto.randomUUID(),
        };

        this.violationReports.push(violationReport);
        await this.saveViolationReport(violationReport);
        logger.error('🚨 VIOLATION REPORTED:', violationReport);

        res.json({ success: true, reportId: violationReport.id });
      } catch (error) {
        logger.error('Violation reporting error:', error);
        res.status(500).json({ error: 'Reporting failed' });
      }
    });
  }

  _setupDashboardRoute() {
    this.app.get('/dashboard', (req, res) => {
      const dashboardData = {
        totalLicenses: this.licenseDB.size,
        activeInstances: this.usageStats.size,
        violations: this.violationReports.length,
        recentActivity: this.getRecentActivity(),
        licenseBreakdown: this.getLicenseBreakdown(),
        topViolations: this.violationReports.slice(-10),
      };

      const html = this.generateDashboardHTML(dashboardData);
      res.send(html);
    });

    // API: Get all usage stats
    this.app.get('/api/stats', (req, res) => {
      const stats = Array.from(this.usageStats.entries()).map(([instanceId, data]) => ({
        instanceId,
        ...data,
      }));

      res.json({
        totalInstances: stats.length,
        licenses: Array.from(this.licenseDB.values()),
        usage: stats,
        violations: this.violationReports,
      });
    });
  }

  async validateLicense(licenseKey, instanceId, _systemInfo) {
    if (!licenseKey) {
      return {
        valid: false,
        reason: 'No license key provided',
        gracePeriod: true,
        graceDays: 7,
      };
    }

    const license = this.licenseDB.get(licenseKey);

    if (!license) {
      return {
        valid: false,
        reason: 'Invalid license key',
        gracePeriod: false,
      };
    }

    // Check license status
    if (license.status !== 'active') {
      return {
        valid: false,
        reason: `License is ${license.status}`,
        gracePeriod: false,
      };
    }

    // Update last seen
    license.lastSeen = new Date().toISOString();
    license.instanceId = instanceId;

    return {
      valid: true,
      licenseType: license.type,
      allowedServers: license.allowedServers,
      expiresAt: license.expiresAt,
      features: license.features,
    };
  }

  async recordUsage(instanceId, stats) {
    const usageRecord = {
      instanceId,
      timestamp: new Date().toISOString(),
      ...stats,
    };

    this.usageStats.set(instanceId, usageRecord);

    // Log for monitoring
    logger.info(`📊 Usage reported: ${instanceId} (${stats.licenseType})`);
  }

  async saveViolationReport(report) {
    const filename = `violation-${report.id}-${Date.now()}.json`;
    const filepath = path.join(__dirname, '../../data/violations', filename);

    try {
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    } catch (error) {
      logger.error('Failed to save violation report:', error);
    }
  }

  async loadLicenseDatabase() {
    // Load existing licenses from file or database
    try {
      const licensePath = path.join(__dirname, '../../data/licenses.json');
      const data = await fs.readFile(licensePath, 'utf8');
      const licenses = JSON.parse(data);

      for (const license of licenses) {
        this.licenseDB.set(license.key, license);
      }

      logger.info(`📄 Loaded ${licenses.length} licenses from database`);
    } catch (error) {
      logger.info('📄 No existing license database found, starting fresh');

      // Create sample licenses for testing
      this.createSampleLicenses();
    }
  }

  createSampleLicenses() {
    const sampleLicenses = [
      {
        key: 'ASZUNE-PERS-0001-TEST-KEY1',
        type: 'personal',
        status: 'active',
        allowedServers: 1,
        owner: 'test@example.com',
        createdAt: new Date().toISOString(),
        expiresAt: null,
        features: ['basic_analytics', 'performance_dashboard'],
      },
      {
        key: 'ASZUNE-COMM-0001-TEST-KEY2',
        type: 'community',
        status: 'active',
        allowedServers: 3,
        owner: 'community@example.com',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        features: ['basic_analytics', 'performance_dashboard', 'email_support'],
      },
    ];

    for (const license of sampleLicenses) {
      this.licenseDB.set(license.key, license);
    }

    logger.info('📄 Created sample licenses for testing');
  }

  getRecentActivity() {
    return Array.from(this.usageStats.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);
  }

  getLicenseBreakdown() {
    const breakdown = { personal: 0, community: 0, commercial: 0, enterprise: 0 };

    for (const license of this.licenseDB.values()) {
      breakdown[license.type] = (breakdown[license.type] || 0) + 1;
    }

    return breakdown;
  }

  generateDashboardHTML(data) {
    const head = this._generateDashboardHead();
    const header = this._generateDashboardHeader();
    const stats = this._generateDashboardStats(data);
    const sections = this._generateDashboardSections(data);
    const footer = this._generateDashboardFooter();

    return `<!DOCTYPE html><html>${head}<body>${header}${stats}${sections}${footer}</body></html>`;
  }

  _generateDashboardHead() {
    return `
<head>
    <title>Aszune AI Bot - License Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: white; padding: 20px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .violations { background: #e74c3c; color: white; }
        .licenses { background: #27ae60; color: white; }
        .active { background: #3498db; color: white; }
        .section { background: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .violation-item { background: #ffeaa7; padding: 10px; margin: 5px 0; border-radius: 3px; border-left: 4px solid #e17055; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }
    </style>
</head>`;
  }

  _generateDashboardHeader() {
    return `
    <div class="header">
        <h1>🚀 Aszune AI Bot - License Management Dashboard</h1>
        <p>Real-time monitoring of license usage and violations</p>
    </div>`;
  }

  _generateDashboardStats(data) {
    return `
    <div class="stats">
        <div class="stat-card licenses">
            <h3>Total Licenses</h3>
            <h2>${data.totalLicenses}</h2>
        </div>
        <div class="stat-card active">
            <h3>Active Instances</h3>
            <h2>${data.activeInstances}</h2>
        </div>
        <div class="stat-card violations">
            <h3>Violations Detected</h3>
            <h2>${data.violations}</h2>
        </div>
    </div>`;
  }

  _generateDashboardSections(data) {
    return `
    <div class="section">
        <h2>📊 License Breakdown</h2>
        <pre>${JSON.stringify(data.licenseBreakdown, null, 2)}</pre>
    </div>

    <div class="section">
        <h2>🚨 Recent Violations</h2>
        ${data.topViolations
          .map(
            (v) => `
            <div class="violation-item">
                <strong>Instance:</strong> ${v.instanceId}<br>
                <strong>Time:</strong> ${v.reportedAt}<br>
                <strong>Type:</strong> ${v.violation}<br>
                <strong>Host:</strong> ${v.hostname}
            </div>
        `
          )
          .join('')}
    </div>

    <div class="section">
        <h2>📈 Recent Activity</h2>
        <pre>${JSON.stringify(data.recentActivity, null, 2)}</pre>
    </div>`;
  }

  _generateDashboardFooter() {
    return `
    <script>
        // Auto-refresh every 30 seconds
        setTimeout(() => location.reload(), 30000);
    </script>`;
  }

  start() {
    // Get config inside method to avoid circular dependencies
    const config = require('../config/config');

    // Ensure FEATURES property exists (for backward compatibility and tests)
    if (!config.FEATURES) {
      logger.info('🔐 License server disabled (no FEATURES config)');
      return null;
    }

    // Check if license server feature is enabled
    if (!config.FEATURES.LICENSE_SERVER && !config.FEATURES.DEVELOPMENT_MODE) {
      logger.info('🔐 License server disabled via feature flag');
      return null;
    }

    this.app.listen(this.port, () => {
      logger.info(`🖥️  License server running on http://localhost:${this.port}`);
      logger.info(`📊 Dashboard available at http://localhost:${this.port}/dashboard`);
      logger.info('🔐 API key required for /api endpoints');
    });
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new LicenseServer();
  server.start();
}

module.exports = LicenseServer;
