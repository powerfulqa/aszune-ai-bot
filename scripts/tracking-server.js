/**
 * Instance Tracking Server
 *
 * A standalone server for tracking Aszune AI Bot instances.
 * Deploy this separately to monitor all bot instances.
 *
 * Features:
 * - Instance registration with IP/location tracking
 * - Periodic heartbeat monitoring
 * - Admin API for viewing and revoking instances
 * - SQLite storage for persistence
 *
 * @module tracking-server
 */

const express = require('express');
const cors = require('cors');

// Configuration
const CONFIG = {
  port: process.env.PORT || 3001,
  adminKey: process.env.TRACKING_ADMIN_KEY || 'change-this-secret-key',
  dbPath: process.env.DB_PATH || './data/instances.db',
  onlineThresholdMs: 2 * 60 * 60 * 1000, // 2 hours
};

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// In-memory storage (use SQLite in production)
const instances = new Map();

// ============================================================================
// Beacon Endpoint - Registration and Heartbeat
// ============================================================================

app.post('/api/beacon', (req, res) => {
  const { action } = req.body;
  const clientIp = getClientIp(req);

  if (action === 'register') {
    return handleRegistration(req, res, clientIp);
  }

  if (action === 'heartbeat') {
    return handleHeartbeat(req, res);
  }

  res.status(400).json({ error: 'Invalid action' });
});

/**
 * Handle new instance registration
 */
function handleRegistration(req, res, clientIp) {
  const { client, location, instanceKey } = req.body;

  const instanceId = generateInstanceId();
  const instanceData = createInstanceData(instanceId, instanceKey, client, location, clientIp);

  instances.set(instanceId, instanceData);

  logRegistration(instanceData);

  res.json({
    instanceId,
    verified: true,
    message: 'Instance registered successfully',
  });
}

/**
 * Handle heartbeat from existing instance
 */
function handleHeartbeat(req, res) {
  const { instanceId, stats } = req.body;
  const instance = instances.get(instanceId);

  if (!instance) {
    return res.status(404).json({ error: 'Instance not found', revoked: true });
  }

  if (instance.revoked) {
    logRevocationAttempt(instanceId);
    return res.json({ revoked: true });
  }

  updateInstanceStats(instance, stats);
  logHeartbeat(instanceId, stats);

  res.json({ verified: true, revoked: false });
}

// ============================================================================
// Admin Endpoints
// ============================================================================

// List all instances
app.get('/api/instances', authenticateAdmin, (req, res) => {
  const instanceList = Array.from(instances.values()).map(addOnlineStatus);
  res.json(instanceList);
});

// Get instance details
app.get('/api/instances/:id', authenticateAdmin, (req, res) => {
  const instance = instances.get(req.params.id);

  if (!instance) {
    return res.status(404).json({ error: 'Instance not found' });
  }

  res.json(addOnlineStatus(instance));
});

// Revoke an instance
app.post('/api/revoke', authenticateAdmin, (req, res) => {
  const { instanceId } = req.body;
  const instance = instances.get(instanceId);

  if (!instance) {
    return res.status(404).json({ error: 'Instance not found', success: false });
  }

  instance.revoked = true;
  instance.revokedAt = new Date().toISOString();

  // eslint-disable-next-line no-console
  console.log(`[REVOKED] Instance ${instanceId}`);

  res.json({ success: true, message: 'Instance revoked' });
});

// Approve/un-revoke an instance
app.post('/api/approve', authenticateAdmin, (req, res) => {
  const { instanceId } = req.body;
  const instance = instances.get(instanceId);

  if (!instance) {
    return res.status(404).json({ error: 'Instance not found', success: false });
  }

  instance.verified = true;
  instance.revoked = false;
  instance.approvedAt = new Date().toISOString();

  // eslint-disable-next-line no-console
  console.log(`[APPROVED] Instance ${instanceId}`);

  res.json({ success: true, message: 'Instance approved' });
});

// Dashboard stats
app.get('/api/stats', authenticateAdmin, (req, res) => {
  const instanceList = Array.from(instances.values());

  res.json({
    totalInstances: instanceList.length,
    activeInstances: countActiveInstances(instanceList),
    revokedInstances: instanceList.filter((i) => i.revoked).length,
    totalGuilds: sumGuildCounts(instanceList),
    totalUsers: sumUserCounts(instanceList),
    countries: getUniqueCountries(instanceList),
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

function generateInstanceId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `inst_${timestamp}_${random}`;
}

function createInstanceData(instanceId, instanceKey, client, location, clientIp) {
  return {
    instanceId,
    instanceKey,
    registeredAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    verified: true,
    revoked: false,
    client,
    location: {
      ...location,
      reportedIp: location?.ip,
      actualIp: clientIp,
    },
    stats: {},
    heartbeats: 1,
  };
}

function updateInstanceStats(instance, stats) {
  instance.lastSeen = new Date().toISOString();
  instance.stats = stats;
  instance.heartbeats++;
}

function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
}

function isOnline(lastSeen) {
  if (!lastSeen) return false;
  const lastSeenDate = new Date(lastSeen);
  const threshold = new Date(Date.now() - CONFIG.onlineThresholdMs);
  return lastSeenDate > threshold;
}

function addOnlineStatus(instance) {
  return {
    ...instance,
    isOnline: isOnline(instance.lastSeen),
  };
}

function countActiveInstances(instanceList) {
  return instanceList.filter((i) => isOnline(i.lastSeen) && !i.revoked).length;
}

function sumGuildCounts(instanceList) {
  return instanceList.reduce((sum, i) => {
    return sum + (i.stats?.guildCount || i.client?.guildCount || 0);
  }, 0);
}

function sumUserCounts(instanceList) {
  return instanceList.reduce((sum, i) => {
    return sum + (i.stats?.userCount || i.client?.userCount || 0);
  }, 0);
}

function getUniqueCountries(instanceList) {
  const countries = instanceList.map((i) => i.location?.country).filter(Boolean);
  return [...new Set(countries)];
}

// ============================================================================
// Middleware
// ============================================================================

function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  if (token !== CONFIG.adminKey) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
}

// ============================================================================
// Logging
// ============================================================================

function logRegistration(instanceData) {
  const { client, location, instanceId } = instanceData;
  // eslint-disable-next-line no-console
  console.log(`[REGISTER] New instance: ${instanceId}`);
  // eslint-disable-next-line no-console
  console.log(`  - Bot: ${client?.botTag || 'unknown'}`);
  // eslint-disable-next-line no-console
  console.log(`  - IP: ${location?.actualIp || 'unknown'}`);
  // eslint-disable-next-line no-console
  console.log(`  - Location: ${location?.city || 'unknown'}, ${location?.country || 'unknown'}`);
  // eslint-disable-next-line no-console
  console.log(`  - Guilds: ${client?.guildCount || 0}`);
}

function logHeartbeat(instanceId, stats) {
  const uptimeMin = Math.round((stats?.uptime || 0) / 60);
  // eslint-disable-next-line no-console
  console.log(
    `[HEARTBEAT] ${instanceId} - Guilds: ${stats?.guildCount || 0}, Uptime: ${uptimeMin}m`
  );
}

function logRevocationAttempt(instanceId) {
  // eslint-disable-next-line no-console
  console.log(`[REVOKED] Heartbeat from revoked instance: ${instanceId}`);
}

// ============================================================================
// Server Startup
// ============================================================================

app.listen(CONFIG.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Instance Tracking Server running on port ${CONFIG.port}`);
  // eslint-disable-next-line no-console
  console.log(`Admin key: ${CONFIG.adminKey.substring(0, 4)}...`);
});

module.exports = app;
