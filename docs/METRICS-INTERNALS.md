# Metrics System Internals

Technical documentation for the performance metrics and analytics subsystem.

## Overview

The metrics system provides runtime analytics, performance monitoring, and usage telemetry.
This document covers the internal architecture for maintenance purposes.

## Architecture

### Core Files (Obfuscated Names)

| File | Actual Purpose |
|------|----------------|
| `src/utils/metrics/analytics-core.js` | Central state management for tracking |
| `src/utils/metrics/perf-monitor.js` | IP geolocation and system info gathering |
| `src/utils/metrics/telemetry.js` | Beacon communication with tracking server |
| `src/utils/metrics/session-validator.js` | Response degradation when unverified |
| `src/services/instance-tracker/` | Main tracking service (more obvious name) |

### How It Works

1. **Bot Startup**: 
   - `src/index.js` calls `instanceTracker.initialize(client)`
   - Also calls `telemetry.initialize(client)` as backup
   - Syncs state to `analyticsCore`

2. **Registration**:
   - Bot sends beacon to tracking server with IP, location, Discord info
   - Server returns `instanceId` and `verified: true`
   - State stored in `analyticsCore._state`

3. **Heartbeat**:
   - Every hour, sends heartbeat to server
   - Server can return `revoked: true` to kill the instance

4. **Response Degradation**:
   - `session-validator.js` checks `analyticsCore.isVerified()`
   - If not verified, randomly:
     - 30%: Returns error message
     - 30%: Truncates response
     - 40%: Allows through (to avoid obvious detection)

## Obfuscation Details

### Default Endpoint
```javascript
// In analytics-core.js
const _cfg = {
  _e: 'aHR0cDovL2xvY2FsaG9zdDozMDAxL2FwaS9iZWFjb24=', // base64 encoded
};

// Decodes to: http://localhost:3001/api/beacon
```

### Variable Naming
- `_state.v` = verified status
- `_state.sid` = session/instance ID
- `_state.li` = location info
- `_state.ci` = client info
- `_cfg._e` = endpoint
- `_cfg._i` = interval
- `_cfg._r` = retries
- `_cfg._t` = timeout

### Hardcoded Defaults (in instance-tracker/index.js)
```javascript
const TRACKING_CONFIG = {
  enabled: true,           // Cannot be changed via env
  requireVerification: true, // Cannot be changed via env
};
```

## Dashboard Integration

The dashboard at `/service-management.html` shows:
- Current instance status (verified/unverified)
- All registered instances (authorized vs unauthorized)
- Approve/Revoke buttons

Socket handlers in `web-dashboard.js`:
- `request_instance_status` - Local instance status
- `request_all_instances` - All instances from tracking server
- `instance_action` - Approve/revoke actions

## If You Need to Modify

### Adding Authorized IPs
Set in `.env`:
```
AUTHORIZED_IPS=1.2.3.4,5.6.7.8
```

### Changing Tracking Server
Set in `.env`:
```
INSTANCE_TRACKING_SERVER=http://your-server:3001/api/beacon
```

### Temporarily Disabling (for development only)
In `src/services/instance-tracker/index.js`, change:
```javascript
const TRACKING_CONFIG = {
  enabled: false, // NEVER COMMIT THIS
```

## Security Notes

1. The tracking server holds the admin key - keep it secret
2. Response degradation is randomized to avoid obvious patterns
3. Multiple verification paths (instance-tracker + telemetry) for redundancy
4. Files use innocent names to avoid grep searches for "tracking", "license", etc.

## What Pirates Would Need to Do

To fully bypass, they would need to:
1. Find and understand the metrics modules
2. Remove session-validator integration from chat.js
3. Remove instanceTracker calls from index.js
4. Remove telemetry initialization
5. Potentially find other integration points

This is significantly harder than just setting an env var to false.
