# Release Notes - v1.9.0 - Enhanced Dashboard Experience

**Release Date**: November 2025  
**Status**: 🚀 Production Ready  
**Backward Compatibility**: ✅ Fully compatible with v1.8.x

---

## 🎯 Overview

v1.9.0 delivers a **significantly improved web-based dashboard system** with 5 major interactive
features, providing comprehensive system monitoring, service management, and operational control
directly from the browser. All dashboard pages now feature a unified header with version info, Git
Pull button, Restart control, and an intelligent navigation bar that automatically hides the current
page's link.

---

## Note on Dashboard Page Filenames

These v1.9.0 release notes reference the original `*-demo.html` dashboard pages. In later releases,
they were renamed to the non-demo pages:

- `logs-viewer-demo.html` → `logs-viewer.html`
- `service-management-demo.html` → `service-management.html`
- `config-editor-demo.html` → `config-editor.html`
- `network-status-demo.html` → `network-status.html`
- `reminder-management-demo.html` → `reminder-management.html`

## ✨ New Features

### 1. 📊 Real-Time Log Viewer

**Feature Status:** Complete with Live Streaming

View, filter, search, and export application logs in real-time through an interactive dashboard
interface.

**Capabilities:**

- Live log streaming via Socket.io with pause/resume controls
- Filter by log level (ALL, DEBUG, INFO, WARN, ERROR)
- Full-text search across all logs
- Export logs as CSV or JSON
- Automatic log buffering (500 most recent logs)
- Color-coded log levels for quick identification
- Real-time statistics (total logs, error count, warning count)

**API Endpoints:**

```
GET  /api/logs?level=ALL&limit=100&offset=0&search=query
GET  /api/logs/export?format=json&level=ALL
```

**Backend Methods:**

- `setupLogViewerRoutes()` - Route initialization
- `setupGetLogsRoute()` - GET /api/logs handler
- `setupExportLogsRoute()` - Export handler
- `getFilteredLogs(level, limit, offset)` - Filter logs
- `searchLogs(keyword, limit)` - Search functionality
- `exportLogsAsCSV(res, logs)` - CSV export
- `exportLogsAsJSON(res, logs)` - JSON export

**Dashboard Page:** `dashboard/public/logs-viewer.html`

---

### 2. 🔧 Service Status & Management

**Feature Status:** Complete with systemd Integration

Manage systemd services directly from the dashboard with real-time status monitoring.

**Capabilities:**

- View service status, uptime, and resource usage
- Start/stop/restart services with immediate feedback
- View service logs via journalctl
- Display auto-restart configuration
- Monitor multiple critical services (bot, nginx, postgresql)
- Service enable/disable on boot status

**API Endpoints:**

```
GET  /api/services
POST /api/services/:action (start|stop|restart)
GET  /api/services/:service/logs?lines=50
```

**Backend Methods:**

- `setupServiceManagementRoutes()` - Route initialization
- `setupGetServicesRoute()` - GET /api/services
- `setupManageServiceRoute()` - POST /api/services/:action
- `setupGetServiceLogsRoute()` - GET service logs
- `getServiceStatus()` - Query systemctl status
- `getServiceUptime(service)` - Calculate uptime
- `isServiceEnabled(service)` - Check boot status
- `manageService(action, service)` - Execute systemctl action
- `getServiceLogs(service, lines)` - Retrieve journalctl logs

**Dashboard Page:** `dashboard/public/service-management.html`

**Supported Services:**

- `aszune-ai-bot` - Main Discord bot service
- `nginx` - Web server
- `postgresql` - Database server

---

### 3. ⚙️ Configuration Editor

**Feature Status:** Complete with Safety Features

Safely edit configuration files with validation, automatic backups, and diff preview.

**Capabilities:**

- View and edit .env and config.js files
- Whitelist protection (only approved files editable)
- Syntax validation before save
- Automatic timestamped backups
- Path traversal attack prevention
- Diff viewer to preview changes
- CSV and JSON export options
- Read-only access to .env.example

**API Endpoints:**

```
GET  /api/config/:file
POST /api/config/:file
POST /api/config/:file/validate
```

**Backend Methods:**

- `setupConfigEditorRoutes()` - Route initialization
- `setupGetConfigRoute()` - GET /api/config/:file
- `setupUpdateConfigRoute()` - POST /api/config/:file
- `setupValidateConfigRoute()` - POST /api/config/:file/validate
- `readConfigFile(filename)` - Safe file read with whitelist
- `updateConfigFile(filename, content, createBackup)` - Safe write with backup
- `validateConfigFile(filename, content)` - Syntax validation

**Allowed Files:**

- `.env` (read/write)
- `config.js` (read/write)
- `.env.example` (read-only)

**Validation Features:**

- .env format validation (KEY=VALUE pairs)
- Detection of empty required keys
- JavaScript syntax checking for config.js
- Warning system for incomplete configuration

**Dashboard Page:** `dashboard/public/config-editor.html`

---

### 4. 🌐 Network & Connectivity Status

**Feature Status:** Complete with Real-Time Monitoring

Monitor network interfaces, IP addresses, and connectivity in real-time.

**Capabilities:**

- Display local and external IP addresses
- List all network interfaces with status
- IPv4 and IPv6 support
- Connectivity checks (DNS, gateway, internet)
- Latency measurement via ping
- Bandwidth usage monitoring
- MAC address display
- Network interface type detection

**API Endpoints:**

```
GET /api/network/interfaces
GET /api/network/ip
GET /api/network/status
```

**Backend Methods:**

- `setupNetworkRoutes()` - Route initialization
- `setupGetNetworkInterfacesRoute()` - GET /api/network/interfaces
- `setupGetIPAddressesRoute()` - GET /api/network/ip
- `setupGetNetworkStatusRoute()` - GET /api/network/status
- `getNetworkInterfaces()` - List interfaces
- `getIPAddresses()` - Get local and external IPs
- `getNetworkStatus()` - Check connectivity

**Connectivity Checks:**

- Internet reachability (ping 8.8.8.8)
- DNS resolution (ping 1.1.1.1)
- Gateway reachability (ping local gateway)
- Network interface status

**Dashboard Page:** `dashboard/public/network-status.html`

---

### 5. ⏰ Reminder Management Interface

**Feature Status:** Complete with CRUD Operations

Create, view, edit, and delete reminders with persistent storage and scheduling.

**Capabilities:**

- Create new reminders with custom messages and schedules
- View all active and completed reminders
- Edit existing reminders
- Delete reminders
- Filter reminders by status (active, completed)
- View reminder history and recent activity
- Support for multiple reminder types (general, important, follow-up, maintenance)
- Automatic reminder triggering at scheduled time

**API Endpoints:**

```
GET    /api/reminders?status=all|active|completed
POST   /api/reminders
PUT    /api/reminders/:id
DELETE /api/reminders/:id
```

**Backend Methods:**

- `setupReminderRoutes()` - Route initialization
- `setupGetRemindersRoute()` - GET /api/reminders
- `setupCreateReminderRoute()` - POST /api/reminders
- `setupUpdateReminderRoute()` - PUT /api/reminders/:id
- `setupDeleteReminderRoute()` - DELETE /api/reminders/:id
- `getReminders(status)` - Query by status
- `createReminder(message, scheduledTime, userId, reminderType)` - Create new
- `updateReminder(id, message, scheduledTime)` - Modify existing
- `deleteReminder(id)` - Remove reminder

**Reminder Types:**

- `general` - Standard reminder
- `important` - High priority
- `follow-up` - Requires follow-up
- `maintenance` - System maintenance task

**Dashboard Page:** `dashboard/public/reminder-management.html`

---

## 🎨 UI/UX Enhancements in v1.9.0

### Unified Dashboard Header

All 9 dashboard pages now feature a consistent header with:

- **Aszune AI Bot Dashboard** title
- **Version Display** with commit SHA reference
- **Control Buttons**:
  - ⬇️ Git Pull - Pull latest changes from GitHub
  - 🔄 Restart - Restart the bot service
- **Connection Status** indicator with live polling

**Affected Pages:**

- `index.html` - Main dashboard
- `logs-viewer.html` - Log viewer
- `service-management.html` - Service management
- `config-editor.html` - Configuration editor
- `network-status.html` - Network status
- `reminder-management.html` - Reminder management
- `commands.html` - Commands reference
- `database.html` - Database viewer
- `error-logs.html` - Error log archive

### Smart Navigation Bar

Sticky navigation bar with intelligent page-aware link hiding:

- **Current Page Auto-Hide**: When visiting a dashboard page, that page's link automatically hides
  from the navbar
- **Filename-Based Detection**: Reliable filename matching that works across file:// and http://
  protocols
- **9 Navigation Items**:
  - 📊 Dashboard (main system metrics)
  - 📋 Log Viewer (real-time logs)
  - 🔧 Services (service management)
  - ⚙️ Config (configuration editor)
  - 🌐 Network (connectivity status)
  - ⏰ Reminders (reminder management)
  - 🎮 Commands (slash command reference)
  - � Database (data viewer)
  - ⚠️ Errors (error log archive)

**Implementation Details:**

```javascript
// Simple, reliable filename matching
const currentPage = window.location.pathname.split('/').pop();
document.querySelectorAll('.navbar-item').forEach((link) => {
  const linkHref = link.getAttribute('href');
  if (linkHref === currentPage) {
    link.style.display = 'none';
  }
});
```

### Accessibility Improvements

**Network Status Page Contrast Fix**:

- **Issue**: Light gray text (#e0e0e0) difficult to read on light backgrounds
- **Solution**: Added `.connectivity-label` CSS class with dark color (#2c3e50)
- **Affected Labels**: Overall Status, Internet, DNS, Gateway
- **Impact**: Significantly improved readability for status indicators

**CSS Enhancement**:

```css
.connectivity-label {
  color: #2c3e50; /* Dark blue-gray - high contrast */
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.4px;
}
```

---

## �🔧 Technical Improvements

### Code Quality

- ✅ Resolved Feature 2 lint violations by splitting `setupLogViewerRoutes()` and
  `setupServiceManagementRoutes()` into sub-methods
- ✅ All new feature code meets quality thresholds (methods ≤50 lines, functions ≤50 lines)
- ✅ Maintained error handling contracts throughout
- ✅ Full error isolation for database operations
- ✅ Fixed navbar link hiding with robust filename-based detection

### Service Architecture

- Added `setupNetworkRoutes()` to dashboard route initialization
- Added `setupReminderRoutes()` to dashboard route initialization
- Integrated with existing database service for reminder persistence
- Socket.io support for real-time log streaming
- systemctl integration for service management
- Child process execution with timeout protection
- Unified header and navbar system across all pages

### Error Handling

- Database errors logged but don't break conversation flow
- All service failures isolated with meaningful error messages
- Graceful fallbacks for system command failures
- Proper error responses on API endpoints
- Safe URL parsing for navbar link detection

### Testing

- 5 complete demo HTML interfaces for feature validation
- All endpoints tested via demo UI
- Error scenarios covered in demos
- Real-time functionality demonstrated
- Navbar link hiding tested across all 9 pages
- Accessibility contrast verified

### Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

---

## 📊 API Summary

### Total New Endpoints: 15

**Log Viewer (2 endpoints)**

- GET /api/logs
- GET /api/logs/export

**Service Management (3 endpoints)**

- GET /api/services
- POST /api/services/:action
- GET /api/services/:service/logs

**Configuration Editor (3 endpoints)**

- GET /api/config/:file
- POST /api/config/:file
- POST /api/config/:file/validate

**Network Connectivity (3 endpoints)**

- GET /api/network/interfaces
- GET /api/network/ip
- GET /api/network/status

**Reminder Management (4 endpoints)**

- GET /api/reminders
- POST /api/reminders
- PUT /api/reminders/:id
- DELETE /api/reminders/:id

---

## 📁 Files Added/Modified

### Dashboard Pages

- `dashboard/public/logs-viewer.html`
- `dashboard/public/service-management.html`
- `dashboard/public/config-editor.html`
- `dashboard/public/network-status.html`
- `dashboard/public/reminder-management.html`

### Modified Files

- `src/services/web-dashboard.js` - Added 40+ new methods and routes
- `package.json` - Version bumped to 1.9.0

### Documentation Files (Updated)

- `README.md` - Updated feature list and API documentation
- `docs/` folder - Comprehensive feature documentation
- `wiki/` - User guides for each feature

---

## 🐛 Known Issues

### Pre-existing Lint Violations (Out of Scope)

- `setupControlRoutes()` - 110 lines (exceeds 50-line threshold)
- `/api/control/git-pull` handler - 51 lines (exceeds 50-line threshold)
- These are scheduled for v1.10.0 refactoring

---

## 📈 Performance Impact

### Memory

- Log buffer: ~5 MB for 500 most recent logs
- Network interfaces: <1 MB
- Reminder timers: <100 KB per 100 active reminders
- Overall: Minimal impact on Raspberry Pi deployments

### CPU

- Log filtering: <1% on typical workloads
- Service status checks: <1% per request (cached between polls)
- Network connectivity tests: Configurable intervals
- Overall: No noticeable performance degradation

### Disk

- Configuration backups: Automatic, timestamped, retained as needed
- Log rotation: Handled by existing logger service
- Database: Reminder persistence with SQLite

---

## ✅ Testing Status

### Features Tested

- ✅ Log viewer filtering and export
- ✅ Service management (start/stop/restart)
- ✅ Configuration validation and backup
- ✅ Network interface detection
- ✅ Reminder CRUD operations

### Demo Coverage

- ✅ 5 complete interactive demos
- ✅ API endpoint examples in each demo
- ✅ Sample data for real-world testing
- ✅ Error handling scenarios

### Deployment Ready

- ✅ Backward compatible
- ✅ No database schema changes required
- ✅ Optional feature - fully functional without

---

## 🚀 Upgrade Path

### From v1.8.x

1. Update to v1.9.0
2. No migration needed
3. New routes automatically available
4. Demo files available in `dashboard/public/`

### Rollback

Simply revert to v1.8.x - no permanent changes to data structures.

---

## 📝 Contributing

For bug reports or feature requests related to v1.9.0 features, please open an issue with:

- Feature name (e.g., "Log Viewer", "Service Management")
- Reproduction steps
- Expected vs actual behavior
- Environment (Raspberry Pi model if applicable)

---

## 📜 License

Same as main project - See LICENSE file for details.

---

## 🙏 Acknowledgments

Dashboard v1.9.0 improvements build on v1.8.x foundation with focus on:

- Real-time monitoring capabilities
- System management accessibility
- Safe configuration editing
- Network visibility
- Reminder-driven workflows

**Version:** 1.9.0  
**Release Date:** November 17, 2025  
**Next Review:** v1.10.0 planning
