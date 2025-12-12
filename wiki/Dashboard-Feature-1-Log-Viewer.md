# Dashboard Feature 1: Real-Time Log Viewer

**Version:** v1.9.0 | **Status:** Production Ready | **Last Updated:** 2024

## Overview

The Real-Time Log Viewer is a powerful web-based tool for streaming, filtering, and analyzing bot
logs in real-time. It provides enterprise-grade logging capabilities with advanced search,
filtering, and export functionality.

## Features

### Core Capabilities

- **Live Log Streaming:** WebSocket-based real-time log tail with automatic updates
- **Multi-Level Filtering:** Filter by severity level (ERROR, WARN, INFO, DEBUG)
- **Service-Based Filtering:** View logs from specific services (chat, perplexity, cache, database,
  reminders, etc.)
- **Timestamp Range Filtering:** Select specific time ranges for analysis
- **Full-Text Search:** Search across log messages and service names
- **Syntax Highlighting:** Color-coded severity levels for quick visual scanning
- **Export Functionality:** Download filtered logs as CSV or JSON for external analysis
- **Memory Efficient:** Maintains only last 10,000 log entries to prevent memory bloat
- **Auto-Scrolling:** Automatically scrolls to latest entries (with pause for readability)

## Usage Guide

### Accessing the Log Viewer

1. Start the bot with dashboard enabled: `npm start` or `npm run dev`
2. Navigate to `http://localhost:3000/dashboard`
3. Click on **Real-Time Log Viewer** or navigate to `/logs`

### Filtering Logs

#### By Severity Level

```
Click severity badges: ERROR | WARN | INFO | DEBUG
- ERROR (Red): Critical errors and failures
- WARN (Yellow): Warnings and non-fatal issues
- INFO (Blue): General informational messages
- DEBUG (Gray): Debug messages for development
```

#### By Service Name

```
Enter service name in filter field:
- chat: Chat message handling logs
- perplexity: AI API interaction logs
- cache: Cache operation logs
- database: SQLite database operation logs
- reminders: Reminder scheduling logs
- api: Web API request logs
```

#### By Time Range

```
Select start and end timestamps:
- Last 1 hour (default)
- Last 24 hours
- Custom date/time range
```

### Searching Logs

```
Use full-text search to find:
- Error messages: "connection timeout"
- Specific users: "user#12345"
- API endpoints: "/api/logs"
- Stack traces: "TypeError", "ReferenceError"
```

### Export Logs

#### Export as CSV

```
Click "Export as CSV" button
File format:
  timestamp,severity,service,message
  2024-01-15T10:30:45.123Z,ERROR,perplexity,"API timeout: 5000ms"
```

#### Export as JSON

```
Click "Export as JSON" button
File format:
{
  "logs": [
    {
      "timestamp": "2024-01-15T10:30:45.123Z",
      "severity": "ERROR",
      "service": "perplexity",
      "message": "API timeout: 5000ms"
    }
  ],
  "exportedAt": "2024-01-15T10:35:00.000Z",
  "totalEntries": 1527
}
```

## API Reference

### WebSocket Connection

**Endpoint:** `ws://localhost:3000/ws/logs` **Authentication:** None (local dashboard)

### Message Format

```javascript
// Client → Server: Subscribe to logs
{
  type: "subscribe",
  filters: {
    severity: ["ERROR", "WARN"],
    service: "perplexity",
    startTime: "2024-01-15T10:00:00Z",
    endTime: "2024-01-15T11:00:00Z"
  }
}

// Server → Client: Log entry
{
  type: "log",
  data: {
    timestamp: "2024-01-15T10:30:45.123Z",
    severity: "ERROR",
    service: "perplexity",
    message: "API timeout: 5000ms",
    metadata: { duration: 5000, retries: 3 }
  }
}
```

### REST Endpoints

#### Get Recent Logs

```http
GET /api/logs?limit=100&severity=ERROR&service=perplexity
```

**Response:**

```json
{
  "success": true,
  "logs": [
    {
      "timestamp": "2024-01-15T10:30:45.123Z",
      "severity": "ERROR",
      "service": "perplexity",
      "message": "API timeout: 5000ms"
    }
  ],
  "total": 1527,
  "limit": 100
}
```

#### Export Logs

```http
POST /api/logs/export
Content-Type: application/json

{
  "format": "csv",
  "severity": ["ERROR", "WARN"],
  "service": "perplexity",
  "startTime": "2024-01-15T10:00:00Z",
  "endTime": "2024-01-15T11:00:00Z"
}
```

## Troubleshooting

### Logs Not Appearing

1. Verify bot is running: `npm start`
2. Check dashboard is accessible: `http://localhost:3000/dashboard`
3. Verify WebSocket connection in browser DevTools (F12 → Network → WS)
4. Check bot console for connection errors

### Performance Issues

- If viewer is slow, reduce time range selection
- Export logs to local file for bulk analysis
- Clear browser cache (Ctrl+Shift+Delete)

### Export Not Working

- Verify file system permissions (write access to temp directory)
- Check browser console for JavaScript errors (F12)
- Try exporting smaller log ranges

## Integration Examples

### Monitor Production Issues

```
1. Filter by severity: ERROR
2. Filter by service: perplexity
3. Search for: "API error"
4. Export last 24 hours
5. Analyze patterns to identify recurring issues
```

### Debug User Issues

```
1. Get user ID from Discord
2. Search for user ID in logs
3. Filter by time when issue occurred
4. Export relevant logs for analysis
```

### Performance Analysis

```
1. Filter by service: cache
2. Search for: "miss rate"
3. Analyze hit rate trends
4. Identify optimization opportunities
```

## Backend Implementation

**File:** `src/services/web-dashboard.js`

**Key Methods:**

- `setupLogViewerRoutes()` - Initialize log viewer endpoints
- `streamLogs()` - WebSocket log streaming handler
- `filterLogs()` - Apply filters to log entries
- `exportLogs()` - Generate CSV/JSON exports
- `pruneLogs()` - Maintain memory by pruning old entries

**Configuration:**

```javascript
LOG_VIEWER: {
  MAX_ENTRIES: 10000,
  EXPORT_FORMAT: ['csv', 'json'],
  TIMESTAMP_FORMAT: 'ISO',
  AUTO_PRUNE_INTERVAL: 3600000 // 1 hour
}
```

## Best Practices

1. **Regular Monitoring:** Check logs daily for ERROR entries
2. **Archive Important Logs:** Export critical logs for historical analysis
3. **Set Alerts:** Monitor specific error patterns for early detection
4. **Optimize Filters:** Use specific service names to reduce noise
5. **Performance:** Don't keep viewer open for extended periods with high-volume logging

## See Also

- [Dashboard Feature 2: Service Management](Dashboard-Feature-2-Service-Management.md)
- [Dashboard Feature 3: Configuration Editor](Dashboard-Feature-3-Config-Editor.md)
- [Technical Documentation](Technical-Documentation.md)
- [Troubleshooting Guide](Troubleshooting.md)

## Demo

Interactive page: [`logs-viewer.html`](../dashboard/public/logs-viewer.html)

Launch with: `npm start` → Navigate to `http://localhost:3000/dashboard` → Select "Real-Time Log
Viewer"
