# Dashboard Feature 2: Service Status & Management

**Version:** v1.10.0 | **Status:** Production Ready | **Last Updated:** 2025

## Overview

The Service Status & Management interface provides real-time monitoring and control of core bot
services. It integrates with systemd to enable start/stop/restart operations and tracks service
health metrics.

## Features

### Core Capabilities

- **Real-Time Service Status:** Monitor status of all core services (perplexity, cache, database,
  reminders)
- **Systemd Integration:** Direct interaction with systemd service manager
- **Service Control:** Start, stop, and restart individual services from dashboard
- **Uptime Tracking:** Historical uptime metrics with availability percentages
- **Health Checks:** Automated health verification for each service
- **Performance Metrics:** CPU and memory usage per service
- **Restart Confirmation:** Safety prompts prevent accidental service downtime
- **Status History:** Track service state changes over time
- **Auto-Recovery:** Detect and report failed services

## Features Explained

### Service Status Display

Each service shows:

- **Current Status:** RUNNING, STOPPED, ERROR
- **Uptime:** Time since last start (hours:minutes:seconds format)
- **Availability:** Percentage uptime over last 24 hours
- **CPU Usage:** Percent of CPU currently consuming
- **Memory Usage:** Megabytes of RAM in use
- **Last Restart:** Timestamp of most recent restart

### Service Control Operations

#### Start Service

```
Click "Start" button on stopped service
- Confirms service is not already running
- Initiates systemd start command
- Updates status immediately
- Records timestamp for audit trail
```

#### Stop Service

```
Click "Stop" button on running service
- Shows confirmation prompt
- Warns about potential disruption
- Executes systemd stop command
- Updates status immediately
```

#### Restart Service

```
Click "Restart" button on any service
- Shows confirmation with expected downtime
- Gracefully stops service
- Waits for clean shutdown
- Automatically restarts service
- Verifies health after restart
```

## Usage Guide

### Accessing Service Management

1. Start the bot: `npm start` or `npm run dev`
2. Navigate to `http://localhost:3000/dashboard`
3. Click on **Service Status & Management** or navigate to `/services`

### Instance Tracking

The Services page includes an Instance Tracking section:

- **Authorized Instances** and **Unauthorized Instances** lists
- Approve/revoke actions (requires tracking server configured)

Tracking server configuration:

```env
INSTANCE_TRACKING_SERVER=http://localhost:3001/api/beacon
TRACKING_ADMIN_KEY=your_strong_admin_key
```

### Monitoring Service Health

#### Daily Health Checks

```
At start of day:
1. Check all services are "RUNNING"
2. Verify availability is > 95%
3. Note any services recently restarted
4. Review error logs for failed services
```

#### Responding to Service Failures

```
If service shows ERROR status:
1. Click "View Logs" to see error details
2. Try "Restart" first
3. If still ERROR, check system resources
4. See Troubleshooting section
```

#### Performance Optimization

```
If service has high resource usage:
1. Check current memory/CPU metrics
2. Click service name for details
3. Review recent activity logs
4. Consider service restart during low-traffic period
```

## API Reference

### REST Endpoints

#### Get Service Status

```http
GET /api/services
```

**Response:**

```json
{
  "success": true,
  "services": [
    {
      "name": "perplexity",
      "status": "RUNNING",
      "uptime": "42h 15m 30s",
      "availability": 99.2,
      "cpuUsage": 2.5,
      "memoryUsage": 145,
      "lastRestart": "2024-01-13T08:30:00Z",
      "health": "healthy"
    },
    {
      "name": "cache",
      "status": "RUNNING",
      "uptime": "42h 15m 30s",
      "availability": 99.9,
      "cpuUsage": 1.2,
      "memoryUsage": 234,
      "lastRestart": "2024-01-13T08:30:00Z",
      "health": "healthy"
    }
  ]
}
```

#### Get Individual Service Status

```http
GET /api/services/:serviceName
```

**Response:**

```json
{
  "success": true,
  "service": {
    "name": "perplexity",
    "status": "RUNNING",
    "uptime": "42h 15m 30s",
    "availability": 99.2,
    "cpuUsage": 2.5,
    "memoryUsage": 145,
    "lastRestart": "2024-01-13T08:30:00Z",
    "health": "healthy",
    "metrics": {
      "restartCount": 0,
      "errorCount": 0,
      "totalRequests": 12847,
      "averageResponseTime": 1250
    }
  }
}
```

#### Start Service

```http
POST /api/services/:serviceName/start
```

**Response:**

```json
{
  "success": true,
  "message": "Service 'perplexity' started successfully",
  "service": {
    "name": "perplexity",
    "status": "RUNNING",
    "uptime": "0s",
    "health": "healthy"
  }
}
```

#### Stop Service

```http
POST /api/services/:serviceName/stop
```

**Response:**

```json
{
  "success": true,
  "message": "Service 'perplexity' stopped successfully",
  "service": {
    "name": "perplexity",
    "status": "STOPPED",
    "uptime": null,
    "health": "offline"
  }
}
```

#### Restart Service

```http
POST /api/services/:serviceName/restart
```

**Response:**

```json
{
  "success": true,
  "message": "Service 'perplexity' restarted successfully",
  "service": {
    "name": "perplexity",
    "status": "RUNNING",
    "uptime": "0s",
    "health": "healthy",
    "restartTime": "2024-01-15T10:35:00Z"
  }
}
```

### Service Status Codes

| Status   | Meaning                      | Action                 |
| -------- | ---------------------------- | ---------------------- |
| RUNNING  | Service is active            | Monitor performance    |
| STOPPED  | Service is inactive          | Start if needed        |
| ERROR    | Service crashed or unhealthy | Restart or investigate |
| STARTING | Service is initializing      | Wait 5-10 seconds      |
| STOPPING | Service is shutting down     | Wait for completion    |

## Service Descriptions

### Perplexity Service

- **Purpose:** Handles AI API requests to Perplexity
- **Critical:** Yes - required for chat functionality
- **Typical CPU:** 2-5% when idle, 10-20% when processing
- **Typical Memory:** 100-200 MB

### Cache Service

- **Purpose:** Manages response caching and memory optimization
- **Critical:** No - bot works without cache but slower
- **Typical CPU:** 1-3% when idle
- **Typical Memory:** 150-300 MB

### Database Service

- **Purpose:** Handles SQLite persistence operations
- **Critical:** No - conversation history optional but recommended
- **Typical CPU:** 1-2% when idle
- **Typical Memory:** 50-100 MB

### Reminders Service

- **Purpose:** Manages scheduled reminders
- **Critical:** No - optional feature
- **Typical CPU:** <1% when idle
- **Typical Memory:** 30-80 MB

## Troubleshooting

### Service Won't Start

```
1. Check system resources: Is system out of memory?
2. View logs: Click "View Logs" for error details
3. Manual restart: Open terminal, run `systemctl start aszune-ai-bot`
4. System update: Restart entire bot system
```

### Service Running But Unhealthy

```
1. Click service for metrics details
2. Check if CPU/memory unusually high
3. Review recent logs for errors
4. Try service restart
5. If persists, file bug report with logs
```

### High Resource Usage

```
If service using excessive resources:
1. Note timestamp and service name
2. Export logs from that time period
3. Identify what triggered high usage
4. File issue with performance logs
5. Consider upgrading system resources
```

### Cannot Connect to Systemd

```
If restart button shows "Permission denied":
1. Verify bot is running as user with systemd access
2. Check systemd service configuration
3. Manually restart bot process
4. File issue if persists
```

## Integration Examples

### Daily Health Monitoring

```
1. Open dashboard each morning
2. Check all services show RUNNING
3. Verify availability > 95%
4. Note any services restarted overnight
5. Review ERROR logs if available
```

### Performance Trending

```
1. Access dashboard at same time daily
2. Screenshot service metrics
3. Track CPU/memory trends over week
4. Identify peak usage times
5. Plan maintenance during low usage
```

### Automated Recovery

```
Set up monitoring:
1. Check service health every 5 minutes
2. If service DOWN > 5 mins, auto-restart
3. Log all restart events
4. Alert on repeated failures
5. Escalate if >3 failures in 1 hour
```

## Backend Implementation

**File:** `src/services/web-dashboard.js`

**Key Methods:**

- `setupServiceManagementRoutes()` - Initialize service management endpoints
- `getServiceStatus()` - Query systemd for current service state
- `startService()` - Execute systemd start command
- `stopService()` - Execute systemd stop command
- `restartService()` - Execute systemd restart command
- `trackServiceMetrics()` - Collect CPU/memory metrics
- `calculateUptime()` - Compute service uptime statistics

**Configuration:**

```javascript
SERVICE_MANAGEMENT: {
  UPDATE_INTERVAL: 5000, // 5 seconds
  HEALTH_CHECK_INTERVAL: 30000, // 30 seconds
  SERVICES: ['perplexity', 'cache', 'database', 'reminders'],
  SYSTEMD_TIMEOUT: 10000 // 10 seconds
}
```

## Best Practices

1. **Regular Checks:** Monitor services daily
2. **Planned Restarts:** Restart services during maintenance windows
3. **Log Review:** Check logs after any service restart
4. **Resource Monitoring:** Track resource usage trends
5. **Alert Setup:** Configure alerts for service failures
6. **Documentation:** Keep notes of restarts and issues
7. **Testing:** Verify service recovery procedures regularly

## Advanced Topics

### Systemd Integration

```bash
# View service status manually
systemctl status aszune-ai-bot

# Restart manually
systemctl restart aszune-ai-bot

# View recent logs
journalctl -u aszune-ai-bot -n 50
```

### Resource Limits

```javascript
// Configure resource limits per service
LIMITS: {
  MAX_CPU_PERCENT: 80,
  MAX_MEMORY_MB: 512,
  AUTO_RESTART_ON_ERROR: true
}
```

## See Also

- [Dashboard Feature 1: Log Viewer](Dashboard-Feature-1-Log-Viewer.md)
- [Dashboard Feature 3: Configuration Editor](Dashboard-Feature-3-Config-Editor.md)
- [Dashboard Feature 5: Network Status](Dashboard-Feature-5-Network-Status.md)
- [Technical Documentation](Technical-Documentation.md)
- [Deployment Guide](Deployment-Guide.md)

## Implementation

Dashboard page: `dashboard/public/service-management.html`
