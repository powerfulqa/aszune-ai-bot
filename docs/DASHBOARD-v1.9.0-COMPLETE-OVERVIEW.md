# Dashboard v1.9.0 Complete Overview

**Status:** Production Ready | **Version:** v1.9.0 | **Release Date:** 2025-01-15

## Table of Contents

1. [Quick Start](#quick-start)
2. [Feature Overview](#feature-overview)
3. [Architecture](#architecture)
4. [Security](#security)
5. [Performance](#performance)
6. [Deployment](#deployment)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Accessing the Dashboard

1. **Start the Bot:**

   ```bash
   npm start
   ```

2. **Open Dashboard:**
   - URL: `http://localhost:3000/dashboard`
   - Default Port: 3000
   - No authentication required for local access

3. **Available Features:**
   - Real-Time Log Viewer
   - Service Status & Management
   - Configuration Editor
   - Network & Connectivity Status
   - Reminder Management Interface

### Key Navigation

From the main dashboard menu, select any feature:

```
┌─────────────────────────────────────┐
│  Aszune AI Bot Dashboard v1.9.0     │
├─────────────────────────────────────┤
│ 1. Real-Time Log Viewer             │
│ 2. Service Status & Management      │
│ 3. Configuration Editor             │
│ 4. Network & Connectivity Status    │
│ 5. Reminder Management Interface    │
└─────────────────────────────────────┘
```

---

## Feature Overview

### 📋 Feature 1: Real-Time Log Viewer

**Purpose:** Monitor and analyze bot logs in real-time

**Key Capabilities:**

- Live WebSocket-based log streaming
- Multi-level filtering (DEBUG, INFO, WARN, ERROR)
- Service-based filtering
- Full-text search with highlighting
- Export as CSV or JSON
- Auto-scrolling with pause controls
- Memory-efficient (10K entries max)

**Typical Use Cases:**

- Debug issues in production
- Monitor error rates
- Track service performance
- Analyze user interactions
- Create audit trails

**Demo:** `dashboard/public/logs-viewer-demo.html` **Wiki:**
[Dashboard-Feature-1-Log-Viewer.md](../wiki/Dashboard-Feature-1-Log-Viewer.md)

---

### 🔧 Feature 2: Service Status & Management

**Purpose:** Monitor and control bot services with systemd integration

**Key Capabilities:**

- Real-time service status monitoring
- Start/stop/restart services
- Uptime tracking and availability metrics
- Health check results
- CPU and memory usage per service
- Service restart confirmation
- Historical uptime data

**Typical Use Cases:**

- Daily health checks
- Emergency service restarts
- Performance monitoring
- Maintenance scheduling
- Availability trending

**Demo:** `dashboard/public/service-management-demo.html` **Wiki:**
[Dashboard-Feature-2-Service-Management.md](../wiki/Dashboard-Feature-2-Service-Management.md)

---

### ⚙️ Feature 3: Configuration Editor

**Purpose:** Safely edit bot configuration without restarting

**Key Capabilities:**

- Edit .env variables
- Edit config.js settings
- Pre-save validation
- Automatic backups
- Change history tracking
- Rollback to previous configs
- Syntax highlighting

**Typical Use Cases:**

- Update API keys
- Enable/disable features
- Adjust performance settings
- Change database paths
- Modify cache settings

**Demo:** `dashboard/public/config-editor-demo.html` **Wiki:**
[Dashboard-Feature-3-Config-Editor.md](../wiki/Dashboard-Feature-3-Config-Editor.md)

---

### 🌐 Feature 5: Network & Connectivity Status

**Purpose:** Monitor network interfaces and connectivity health

**Key Capabilities:**

- Display all network interfaces
- Public IP detection
- Connectivity tests to multiple endpoints
- Latency and packet loss metrics
- WiFi signal strength (if applicable)
- DNS functionality checks
- Bandwidth monitoring

**Typical Use Cases:**

- Verify internet connectivity
- Diagnose slow performance
- Monitor WiFi quality
- Track bandwidth usage
- Identify ISP issues

**Demo:** `dashboard/public/network-status-demo.html` **Wiki:**
[Dashboard-Feature-5-Network-Status.md](../wiki/Dashboard-Feature-5-Network-Status.md)

---

### ⏰ Feature 7: Reminder Management Interface

**Purpose:** Create, view, edit, and manage scheduled reminders

**Key Capabilities:**

- Web-based CRUD operations
- Flexible scheduling (one-time, daily, weekly, custom)
- Persistent SQLite storage
- Execution history tracking
- Pause/resume reminders
- Natural language time support
- Timezone support

**Typical Use Cases:**

- Schedule team meetings
- Set daily tasks
- Create recurring reminders
- Track reminder history
- Manage alert notifications

**Demo:** `dashboard/public/reminder-management-demo.html` **Wiki:**
[Dashboard-Feature-7-Reminders.md](../wiki/Dashboard-Feature-7-Reminders.md)

---

## Architecture

### Component Stack

```
┌─────────────────────────────────────┐
│      Frontend (HTML/JS)             │
│  - Dashboard UI (Vue/React)         │
│  - Real-time updates (WebSocket)    │
│  - Interactive controls             │
└─────────────┬───────────────────────┘
              │
┌─────────────┴───────────────────────┐
│      Web Server (Express.js)        │
│  - REST API endpoints               │
│  - WebSocket handlers               │
│  - Static file serving              │
└─────────────┬───────────────────────┘
              │
┌─────────────┴───────────────────────┐
│    Dashboard Service Layer          │
│  - setupLogViewerRoutes()           │
│  - setupServiceManagementRoutes()   │
│  - setupConfigEditorRoutes()        │
│  - setupNetworkRoutes()             │
│  - setupReminderRoutes()            │
└─────────────┬───────────────────────┘
              │
┌─────────────┴───────────────────────┐
│    Core Services                    │
│  - Chat Service                     │
│  - Perplexity Service               │
│  - Cache Manager                    │
│  - Database Service                 │
│  - Reminder Service                 │
└─────────────────────────────────────┘
```

### Data Flow

```
User Action (UI)
    ↓
HTTP Request / WebSocket Message
    ↓
Express Route Handler
    ↓
Service Method
    ↓
Core Service
    ↓
External API / Database / File System
    ↓
Response Data
    ↓
JSON Response
    ↓
Real-time UI Update
```

### File Structure

```
src/
├── services/
│   ├── web-dashboard.js          # Main dashboard routes
│   ├── perplexity-secure.js      # AI API service
│   ├── cache-manager.js          # Cache operations
│   ├── database.js               # SQLite persistence
│   └── reminder-service.js       # Reminder scheduling
├── utils/
│   ├── logger.js                 # Logging system
│   └── error-handler.js          # Error management
└── config/
    └── config.js                 # Configuration management

dashboard/
├── public/
│   ├── logs-viewer-demo.html
│   ├── service-management-demo.html
│   ├── config-editor-demo.html
│   ├── network-status-demo.html
│   └── reminder-management-demo.html
└── styles/
    └── dashboard.css             # Dashboard styling
```

---

## Security

### Authentication & Authorization

**Current Status:** Unauthenticated (local dashboard only)

**For Production Deployments:**

1. Implement JWT token authentication
2. Add role-based access control (RBAC)
3. Use HTTPS/TLS encryption
4. Add rate limiting
5. Implement CORS restrictions

### Data Protection

**Sensitive Information:**

- API keys are redacted in logs and exports
- Passwords never displayed in configuration editor
- Database credentials protected
- Token values masked in UI

**Backup Security:**

- Backups stored in `.backup/` directory
- Apply file permissions to protect sensitive data
- Rotate backups automatically (30-day retention)

### API Security

**Validation:**

- Input validation on all endpoints
- Request size limits
- Parameter type checking
- Sanitization of user inputs

**Rate Limiting (Recommended):**

```javascript
{
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
  message: 'Too many requests'
}
```

---

## Performance

### Optimization Tips

#### Dashboard Performance

- Limit log entries to last 10,000
- Paginate result sets (50-100 items per page)
- Use WebSocket for real-time updates instead of polling
- Cache frequently accessed data (services status, config)
- Compress export files before download

#### Server Performance

- Use connection pooling for database
- Implement caching layer for expensive operations
- Use worker threads for long-running tasks
- Monitor memory usage and enable garbage collection
- Optimize network requests (batch where possible)

#### Network Performance

- Minimize WebSocket payload size
- Compress responses with gzip
- Use HTTP/2 for multiplexing
- Enable browser caching for static assets
- Use CDN for media files

### Monitoring

**Key Metrics to Track:**

- API response times
- WebSocket connection count
- Memory usage trend
- CPU utilization
- Disk I/O operations
- Database query times
- Cache hit rate

**Recommended Tools:**

- Application Performance Monitoring (APM)
- System resource monitoring
- Network traffic analysis
- Database query profiling

---

## Deployment

### Local Development

```bash
# Install dependencies
npm install

# Start bot with dashboard
npm start

# Access dashboard
http://localhost:3000/dashboard
```

### Production Deployment

#### Prerequisites

- Node.js 16+ installed
- MongoDB or SQLite for persistence
- systemd or process manager (PM2)
- SSL certificate (for HTTPS)
- Reverse proxy (nginx, Apache)

#### Steps

1. **Install & Configure**

   ```bash
   npm install
   npm run build
   cp .env.example .env
   # Edit .env with production values
   ```

2. **Start with Process Manager**

   ```bash
   npm install -g pm2
   pm2 start src/index.js --name "aszune-ai-bot"
   pm2 startup
   pm2 save
   ```

3. **Configure Reverse Proxy (nginx)**

   ```nginx
   server {
     listen 443 ssl;
     server_name bot.example.com;

     ssl_certificate /path/to/cert.pem;
     ssl_certificate_key /path/to/key.pem;

     location / {
       proxy_pass http://localhost:3000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
     }
   }
   ```

4. **Enable Auto-Updates**
   ```bash
   git clone <repo>
   # Add to crontab for daily pulls
   0 0 * * * cd /path/to/bot && git pull && npm install && pm2 restart aszune-ai-bot
   ```

### Raspberry Pi Deployment

For optimized Raspberry Pi deployment:

```bash
# Use optimized startup script
./start-pi-optimized.sh

# Or manually
NODE_ENV=production \
NODE_OPTIONS=--max-old-space-size=256 \
npm start
```

**Pi-Specific Configuration:**

```javascript
{
  MEMORY_LIMIT: 256,        // MB
  MAX_LOG_ENTRIES: 5000,    // Reduce from 10K
  CACHE_MAX_SIZE: 64,       // MB
  DB_WAL_CHECKPOINT: 5000,  // ms
  REDUCE_LOG_OUTPUT: true
}
```

---

## Troubleshooting

### Dashboard Not Loading

**Symptoms:** 404 or connection refused

**Solutions:**

1. Verify bot is running: `npm start`
2. Check port 3000 is not blocked: `lsof -i :3000`
3. Verify URL is correct: `http://localhost:3000/dashboard`
4. Check browser console for errors (F12)
5. Clear browser cache (Ctrl+Shift+Delete)

### WebSocket Connection Issues

**Symptoms:** Log viewer not updating, real-time features not working

**Solutions:**

1. Verify WebSocket port (default 3000)
2. Check firewall rules
3. Clear browser cache
4. Try different browser
5. Disable browser extensions
6. Check browser console for specific errors

### API Endpoint Returns 500 Error

**Symptoms:** API calls fail with Internal Server Error

**Solutions:**

1. Check bot logs: Use Log Viewer feature
2. Verify endpoint URL is correct
3. Check request parameters
4. Verify database connectivity
5. Review error message in response
6. Check system resources (memory, disk)

### Services Status Shows ERROR

**Symptoms:** Service shows "ERROR" or "UNHEALTHY"

**Solutions:**

1. Try restart from dashboard
2. Check logs for specific error
3. Verify service dependencies
4. Check system resources
5. Review recent configuration changes
6. Manually restart if needed: `systemctl restart aszune-ai-bot`

### High Memory Usage

**Symptoms:** Dashboard shows increasing memory usage

**Solutions:**

1. Check log buffering size (reduce if needed)
2. Enable garbage collection: `--expose-gc` flag
3. Reduce cache size in configuration
4. Limit log retention period
5. Archive old logs to file
6. Restart bot to reclaim memory

### Configuration Changes Not Taking Effect

**Symptoms:** Updated config appears saved but behavior unchanged

**Solutions:**

1. Verify save was successful (success message shown)
2. Check if bot restart required
3. Verify changes were written to file
4. Check file permissions
5. Manually restart bot if needed
6. Review logs for load errors

### Network Status Shows Disconnected

**Symptoms:** Network connectivity shows ERROR

**Solutions:**

1. Verify internet connection
2. Check DNS configuration
3. Test with manual ping (terminal)
4. Review firewall rules
5. Check if ISP blocking ports
6. Try alternate DNS servers

---

## Integration Examples

### Example 1: Daily Health Check Script

```javascript
// Check dashboard health every morning
const checkHealth = async () => {
  const services = await fetch('http://localhost:3000/api/services');
  const data = await services.json();

  if (!data.success) {
    console.error('Health check failed');
    return;
  }

  const unhealthy = data.data.services.filter((s) => s.health !== 'healthy');
  if (unhealthy.length > 0) {
    console.warn('Unhealthy services:', unhealthy);
    // Send alert
  }
};

// Schedule daily at 8am
const schedule = require('node-schedule');
schedule.scheduleJob('0 8 * * *', checkHealth);
```

### Example 2: Automated Log Analysis

```javascript
// Analyze errors from yesterday
const analyzeLogs = async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const logs = await fetch(
    `http://localhost:3000/api/logs?level=ERROR&startTime=${yesterday.toISOString()}`
  );
  const data = await logs.json();

  console.log(`Found ${data.data.logs.length} errors`);

  // Export for analysis
  const export_res = await fetch('http://localhost:3000/api/logs/export', {
    method: 'POST',
    body: JSON.stringify({
      format: 'json',
      level: 'ERROR',
      startTime: yesterday.toISOString(),
    }),
  });
};
```

### Example 3: Reminder Creation Automation

```javascript
// Create recurring reminders for team
const createTeamReminders = async () => {
  const reminders = [
    {
      message: 'Daily standup at 9am',
      type: 'recurring',
      recurrence: 'daily',
      scheduledTime: '09:00',
      timezone: 'America/New_York',
    },
    {
      message: 'Weekly review on Friday',
      type: 'recurring',
      recurrence: 'weekly',
      scheduledTime: '17:00',
      timezone: 'America/New_York',
    },
  ];

  for (const reminder of reminders) {
    await fetch('http://localhost:3000/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reminder),
    });
  }
};
```

---

## Documentation Links

- **Quick Start:** [Getting Started](../wiki/Getting-Started.md)
- **API Reference:** [DASHBOARD-API-REFERENCE-v1.9.0.md](./DASHBOARD-API-REFERENCE-v1.9.0.md)
- **Feature Guides:**
  - [Log Viewer](../wiki/Dashboard-Feature-1-Log-Viewer.md)
  - [Service Management](../wiki/Dashboard-Feature-2-Service-Management.md)
  - [Config Editor](../wiki/Dashboard-Feature-3-Config-Editor.md)
  - [Network Status](../wiki/Dashboard-Feature-5-Network-Status.md)
  - [Reminders](../wiki/Dashboard-Feature-7-Reminders.md)
- **Release Notes:** [RELEASE-NOTES-v1.9.0.md](./RELEASE-NOTES-v1.9.0.md)
- **Technical Docs:** [Technical-Documentation.md](../wiki/Technical-Documentation.md)

---

## Support & Feedback

For issues, questions, or feature requests:

1. Check [Troubleshooting](#troubleshooting) section
2. Review relevant wiki article
3. Check bot logs via Log Viewer
4. File issue on GitHub:
   [github.com/powerfulqa/aszune-ai-bot/issues](https://github.com/powerfulqa/aszune-ai-bot/issues)
5. Contact maintainers

---

**Version:** v1.9.0 | **Last Updated:** 2025-01-15 | **Status:** Production Ready
