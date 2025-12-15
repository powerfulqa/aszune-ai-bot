/**
 * Instance Tracking Server
 *
 * A standalone server for tracking Aszune AI Bot instances.
 * Deploy this separately to monitor all bot instances.
 *
 * Features:
 * - Instance registration with IP/location tracking
 * - Authorization control - new instances must be approved
 * - Periodic heartbeat monitoring
 * - Admin API for viewing, approving, and revoking instances
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
  // Auto-authorize first instance (your Pi) or instances from same IP
  autoAuthorizeFirstInstance: true,
  autoAuthorizeSameIp: true,
};

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// In-memory storage (use SQLite in production)
const instances = new Map();
// Set of authorized IPs (populated from first authorized instance)
const authorizedIps = new Set();

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
 * New instances are NOT authorized by default (unless auto-authorize rules apply)
 */
function handleRegistration(req, res, clientIp) {
  const { client, location, instanceKey } = req.body;

  // Check if this is a returning instance (same instanceKey)
  const existingInstance = findInstanceByKey(instanceKey);
  if (existingInstance) {
    // Update existing instance
    existingInstance.lastSeen = new Date().toISOString();
    existingInstance.client = client;
    existingInstance.location = {
      ...location,
      reportedIp: location?.ip,
      actualIp: clientIp,
    };

    logReturningInstance(existingInstance);

    return res.json({
      instanceId: existingInstance.instanceId,
      verified: true,
      authorized: existingInstance.authorized && !existingInstance.revoked,
      message: existingInstance.authorized
        ? 'Instance authorized'
        : 'Instance pending authorization',
    });
  }

  const instanceId = generateInstanceId();

  // Determine if this instance should be auto-authorized
  const shouldAutoAuthorize = determineAutoAuthorization(clientIp);

  const instanceData = createInstanceData({
    instanceId,
    instanceKey,
    client,
    location,
    clientIp,
    authorized: shouldAutoAuthorize,
  });

  instances.set(instanceId, instanceData);

  // If auto-authorized, add this IP to authorized IPs
  if (shouldAutoAuthorize) {
    authorizedIps.add(clientIp);
  }

  logRegistration(instanceData);

  res.json({
    instanceId,
    verified: true,
    authorized: shouldAutoAuthorize,
    message: shouldAutoAuthorize
      ? 'Instance authorized'
      : 'Instance registered - pending authorization',
  });
}

/**
 * Find instance by instanceKey (for returning instances)
 */
function findInstanceByKey(instanceKey) {
  if (!instanceKey) return null;
  for (const instance of instances.values()) {
    if (instance.instanceKey === instanceKey) {
      return instance;
    }
  }
  return null;
}

/**
 * Determine if an instance should be auto-authorized
 */
function determineAutoAuthorization(clientIp) {
  // Auto-authorize first instance
  if (CONFIG.autoAuthorizeFirstInstance && instances.size === 0) {
    // eslint-disable-next-line no-console
    console.log(`[AUTO-AUTH] First instance - auto-authorizing`);
    return true;
  }

  // Auto-authorize instances from same IP as an authorized instance
  if (CONFIG.autoAuthorizeSameIp && authorizedIps.has(clientIp)) {
    // eslint-disable-next-line no-console
    console.log(`[AUTO-AUTH] Same IP as authorized instance - auto-authorizing`);
    return true;
  }

  return false;
}

/**
 * Handle heartbeat from existing instance
 */
function handleHeartbeat(req, res) {
  const { instanceId, stats } = req.body;
  const instance = instances.get(instanceId);

  if (!instance) {
    return res.status(404).json({ error: 'Instance not found', revoked: true, authorized: false });
  }

  if (instance.revoked) {
    logRevocationAttempt(instanceId);
    return res.json({ revoked: true, authorized: false });
  }

  if (!instance.authorized) {
    return res.json({ verified: true, revoked: false, authorized: false });
  }

  updateInstanceStats(instance, stats);
  logHeartbeat(instanceId, stats);

  res.json({ verified: true, revoked: false, authorized: true });
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
  instance.authorized = false;
  instance.revokedAt = new Date().toISOString();

  // eslint-disable-next-line no-console
  console.log(`[REVOKED] Instance ${instanceId}`);

  res.json({ success: true, message: 'Instance revoked' });
});

// Approve/authorize an instance
app.post('/api/approve', authenticateAdmin, (req, res) => {
  const { instanceId } = req.body;
  const instance = instances.get(instanceId);

  if (!instance) {
    return res.status(404).json({ error: 'Instance not found', success: false });
  }

  instance.authorized = true;
  instance.revoked = false;
  instance.approvedAt = new Date().toISOString();

  // Add this IP to authorized IPs for future auto-authorization
  if (instance.location?.actualIp) {
    authorizedIps.add(instance.location.actualIp);
  }

  // eslint-disable-next-line no-console
  console.log(`[APPROVED] Instance ${instanceId}`);

  res.json({ success: true, message: 'Instance approved and authorized' });
});

// Dashboard stats
app.get('/api/stats', authenticateAdmin, (req, res) => {
  const instanceList = Array.from(instances.values());

  res.json({
    totalInstances: instanceList.length,
    activeInstances: countActiveInstances(instanceList),
    authorizedInstances: instanceList.filter((i) => i.authorized && !i.revoked).length,
    unauthorizedInstances: instanceList.filter((i) => !i.authorized || i.revoked).length,
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

function createInstanceData({
  instanceId,
  instanceKey,
  client,
  location,
  clientIp,
  authorized = false,
}) {
  return {
    instanceId,
    instanceKey,
    registeredAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    verified: true,
    authorized,
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
  const { client, location, instanceId, authorized } = instanceData;
  const authStatus = authorized ? '✓ AUTHORIZED' : '⚠ PENDING';
  // eslint-disable-next-line no-console
  console.log(`[REGISTER] New instance: ${instanceId} [${authStatus}]`);
  // eslint-disable-next-line no-console
  console.log(`  - Bot: ${client?.botTag || 'unknown'}`);
  // eslint-disable-next-line no-console
  console.log(`  - IP: ${location?.actualIp || 'unknown'}`);
  // eslint-disable-next-line no-console
  console.log(`  - Location: ${location?.city || 'unknown'}, ${location?.country || 'unknown'}`);
  // eslint-disable-next-line no-console
  console.log(`  - Guilds: ${client?.guildCount || 0}`);
}

function logReturningInstance(instanceData) {
  const { instanceId, authorized, revoked } = instanceData;
  const status = revoked ? '🚫 REVOKED' : authorized ? '✓ AUTHORIZED' : '⚠ PENDING';
  // eslint-disable-next-line no-console
  console.log(`[RETURNING] Instance reconnected: ${instanceId} [${status}]`);
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
