# Dashboard API Reference v1.9.0

**Status:** Production Ready | **Version:** v1.9.0 | **Last Updated:** 2025-01-15

## Base URL

```
http://localhost:3000/api
```

## Authentication

All API endpoints are currently unauthenticated (local dashboard). For production deployments with
remote access, implement authentication headers:

```
Authorization: Bearer <token>
```

## Response Format

All responses follow a standard JSON format:

```json
{
  "success": true,
  "data": {},
  "message": "Optional message",
  "timestamp": "2024-01-15T10:35:00Z"
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-15T10:35:00Z"
}
```

---

## Feature 1: Log Viewer API

### GET /logs

Retrieve recent logs with optional filtering and search.

**Query Parameters:**

- `level` (string): Log level filter - ALL, DEBUG, INFO, WARN, ERROR (default: ALL)
- `service` (string): Filter by service name
- `search` (string): Full-text search query
- `limit` (number): Max entries to return (default: 100, max: 1000)
- `offset` (number): Pagination offset (default: 0)
- `startTime` (ISO string): Start of time range
- `endTime` (ISO string): End of time range

**Example Request:**

```http
GET /logs?level=ERROR&service=perplexity&limit=50 HTTP/1.1
Host: localhost:3000
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "timestamp": "2024-01-15T10:30:45.123Z",
        "level": "ERROR",
        "service": "perplexity",
        "message": "API request failed: timeout",
        "metadata": { "retries": 3, "duration": 5000 }
      }
    ],
    "total": 1527,
    "limit": 50,
    "offset": 0
  }
}
```

### POST /logs/export

Export logs in specified format.

**Request Body:**

```json
{
  "format": "csv",
  "level": "ERROR",
  "service": "perplexity",
  "startTime": "2024-01-15T00:00:00Z",
  "endTime": "2024-01-15T23:59:59Z"
}
```

**Valid Formats:** csv, json

**Response:** Binary file download

---

## Feature 2: Service Management API

### GET /services

Get status of all services.

**Example Response:**

```json
{
  "success": true,
  "data": {
    "services": [
      {
        "name": "perplexity",
        "status": "RUNNING",
        "uptime": "42h 15m 30s",
        "availability": 99.2,
        "cpuUsage": 2.5,
        "memoryUsage": 145,
        "lastRestart": "2024-01-13T08:30:00Z",
        "health": "healthy",
        "restartCount": 0,
        "errorCount": 0
      }
    ]
  }
}
```

### GET /services/:name

Get specific service details.

**Parameters:**

- `name` (string): Service name (perplexity, cache, database, reminders)

**Example Request:**

```http
GET /services/cache HTTP/1.1
Host: localhost:3000
```

### POST /services/:name/start

Start a stopped service.

**Parameters:**

- `name` (string): Service name

**Request Body:** (empty)

**Example Response:**

```json
{
  "success": true,
  "data": {
    "service": {
      "name": "cache",
      "status": "RUNNING",
      "uptime": "0s"
    }
  },
  "message": "Service 'cache' started successfully"
}
```

### POST /services/:name/stop

Stop a running service.

**Example Response:**

```json
{
  "success": true,
  "message": "Service 'cache' stopped successfully"
}
```

### POST /services/:name/restart

Restart a service.

**Example Response:**

```json
{
  "success": true,
  "data": {
    "service": {
      "name": "cache",
      "status": "RUNNING",
      "uptime": "0s",
      "restartTime": "2024-01-15T10:35:00Z"
    }
  },
  "message": "Service 'cache' restarted successfully"
}
```

---

## Feature 3: Configuration API

### GET /config

Get current configuration.

**Query Parameters:**

- `section` (string): Optional - 'env' or 'config' (default: both)

**Example Response:**

```json
{
  "success": true,
  "data": {
    "env": {
      "DISCORD_BOT_TOKEN": "[redacted]",
      "PERPLEXITY_API_KEY": "[redacted]",
      "PORT": "3000",
      "DEBUG": "false"
    },
    "config": {
      "API": {
        "PERPLEXITY": {
          "BASE_URL": "https://api.perplexity.ai",
          "DEFAULT_MODEL": "sonar"
        }
      }
    },
    "lastModified": "2024-01-15T10:30:00Z"
  }
}
```

### POST /config

Update configuration value.

**Request Body:**

```json
{
  "section": "env",
  "key": "DEBUG",
  "value": "true"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "backup": {
      "timestamp": "2024-01-15T10:35:00Z",
      "path": ".backup/config-2024-01-15-10-35-00.backup"
    },
    "validation": {
      "valid": true,
      "warnings": []
    }
  },
  "message": "Configuration updated successfully"
}
```

### POST /config/validate

Validate configuration before saving.

**Request Body:**

```json
{
  "section": "env",
  "key": "PORT",
  "value": "3000"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "valid": true,
    "warnings": [],
    "errors": [],
    "suggestions": []
  }
}
```

### GET /config/backups

List available configuration backups.

**Response:**

```json
{
  "success": true,
  "data": {
    "backups": [
      {
        "timestamp": "2024-01-15T10:35:00Z",
        "filename": "config-2024-01-15-10-35-00.backup",
        "size": 1024,
        "changes": {
          "modified": ["DEBUG"],
          "added": [],
          "removed": []
        }
      }
    ],
    "total": 5
  }
}
```

### POST /config/restore

Restore from backup.

**Request Body:**

```json
{
  "backupTimestamp": "2024-01-15T10:35:00Z"
}
```

### GET /config/history

Get configuration change history.

**Query Parameters:**

- `limit` (number): Max entries (default: 50)
- `startDate` (ISO string): Start date
- `endDate` (ISO string): End date

**Response:**

```json
{
  "success": true,
  "data": {
    "changes": [
      {
        "timestamp": "2024-01-15T10:35:00Z",
        "user": "admin",
        "action": "modified",
        "field": "DEBUG",
        "oldValue": "false",
        "newValue": "true",
        "status": "success"
      }
    ],
    "total": 127
  }
}
```

---

## Feature 5: Network Status API

### GET /network/status

Get current network status.

**Response:**

```json
{
  "success": true,
  "data": {
    "connectivity": {
      "status": "connected",
      "publicIp": "203.0.113.42",
      "publicIpv6": "2001:db8::1",
      "geolocation": {
        "country": "US",
        "region": "California"
      }
    },
    "interfaces": [
      {
        "name": "eth0",
        "status": "UP",
        "ip": "192.168.1.100",
        "mac": "b8:27:eb:ab:cd:ef",
        "speed": 1000,
        "rxBytes": 2684354560,
        "txBytes": 1288490240
      }
    ]
  }
}
```

### GET /network/connectivity

Get detailed connectivity test results.

**Response:**

```json
{
  "success": true,
  "data": {
    "connected": true,
    "endpoints": [
      {
        "host": "8.8.8.8",
        "name": "Google DNS",
        "reachable": true,
        "latency": 15,
        "packetLoss": 0
      }
    ],
    "overallStatus": "healthy"
  }
}
```

### GET /network/interfaces/:name

Get specific interface details.

**Parameters:**

- `name` (string): Interface name (eth0, wlan0, etc.)

### GET /network/ping/:host

Perform ping test.

**Parameters:**

- `host` (string): Host to ping

**Response:**

```json
{
  "success": true,
  "data": {
    "statistics": {
      "sent": 4,
      "received": 4,
      "loss": 0,
      "minTime": 12,
      "maxTime": 18,
      "avgTime": 15
    }
  }
}
```

### GET /network/dns

Check DNS functionality.

**Response:**

```json
{
  "success": true,
  "data": {
    "servers": ["8.8.8.8", "1.1.1.1"],
    "tests": [
      {
        "domain": "github.com",
        "resolved": "140.82.113.4",
        "resolutionTime": 10,
        "status": "success"
      }
    ]
  }
}
```

---

## Feature 7: Reminder Management API

### GET /reminders

Get all reminders.

**Query Parameters:**

- `status` (string): Filter by status - active, paused, disabled
- `type` (string): Filter by type - one-time, recurring
- `limit` (number): Max entries (default: 50)

**Response:**

```json
{
  "success": true,
  "data": {
    "reminders": [
      {
        "id": "rem_123abc",
        "message": "Team meeting",
        "nextExecution": "2024-01-20T14:00:00Z",
        "type": "recurring",
        "recurrence": "daily",
        "status": "active",
        "createdAt": "2024-01-15T08:30:00Z"
      }
    ],
    "total": 5,
    "active": 3,
    "paused": 2
  }
}
```

### GET /reminders/:id

Get reminder details.

**Response:**

```json
{
  "success": true,
  "data": {
    "reminder": {
      "id": "rem_123abc",
      "message": "Team meeting",
      "scheduledTime": "14:00",
      "timezone": "America/New_York",
      "type": "recurring",
      "recurrence": "weekly",
      "status": "active",
      "executionHistory": [
        {
          "executedAt": "2024-01-19T18:00:00Z",
          "status": "success"
        }
      ]
    }
  }
}
```

### POST /reminders

Create new reminder.

**Request Body:**

```json
{
  "message": "Team meeting",
  "type": "one-time",
  "scheduledTime": "2024-01-20T14:00:00Z",
  "timezone": "America/New_York",
  "channel": "general"
}
```

### PUT /reminders/:id

Update reminder.

**Request Body:**

```json
{
  "message": "Updated meeting",
  "scheduledTime": "15:00",
  "status": "active"
}
```

### DELETE /reminders/:id

Delete reminder.

**Response:**

```json
{
  "success": true,
  "message": "Reminder deleted successfully"
}
```

### POST /reminders/:id/pause

Pause reminder.

**Response:**

```json
{
  "success": true,
  "data": {
    "reminder": {
      "id": "rem_123abc",
      "status": "paused"
    }
  }
}
```

### POST /reminders/:id/resume

Resume reminder.

**Response:**

```json
{
  "success": true,
  "data": {
    "reminder": {
      "id": "rem_123abc",
      "status": "active"
    }
  }
}
```

### GET /reminders/:id/history

Get reminder execution history.

**Query Parameters:**

- `limit` (number): Max entries (default: 50)

---

## WebSocket Endpoints

### ws://localhost:3000/ws/logs

Real-time log stream.

**Subscribe Message:**

```json
{
  "type": "subscribe",
  "filters": {
    "level": "ALL",
    "service": "perplexity"
  }
}
```

**Data Message:**

```json
{
  "type": "log",
  "data": {
    "timestamp": "2024-01-15T10:30:45.123Z",
    "level": "INFO",
    "service": "perplexity",
    "message": "API request successful"
  }
}
```

### ws://localhost:3000/ws/network

Real-time network updates (every 5 seconds).

**Data Message:**

```json
{
  "type": "network_update",
  "data": {
    "connectivity": "connected",
    "latency": 45,
    "publicIp": "203.0.113.42"
  }
}
```

---

## Error Codes

| Code             | HTTP | Description                |
| ---------------- | ---- | -------------------------- |
| SUCCESS          | 200  | Request successful         |
| INVALID_REQUEST  | 400  | Invalid request parameters |
| UNAUTHORIZED     | 401  | Authentication required    |
| FORBIDDEN        | 403  | Insufficient permissions   |
| NOT_FOUND        | 404  | Resource not found         |
| VALIDATION_ERROR | 422  | Validation failed          |
| INTERNAL_ERROR   | 500  | Server error               |

---

## Rate Limiting

No rate limiting currently enforced. For production, implement:

- 100 requests per minute for dashboard users
- 1000 requests per minute for service-to-service API calls
- WebSocket connections limited to 10 per client

---

## Testing API

### Using cURL

```bash
# Get logs
curl http://localhost:3000/api/logs?level=ERROR&limit=10

# Get service status
curl http://localhost:3000/api/services

# Create reminder
curl -X POST http://localhost:3000/api/reminders \
  -H "Content-Type: application/json" \
  -d '{"message":"Test","type":"one-time","scheduledTime":"2024-01-20T14:00:00Z"}'
```

### Using Postman

1. Import the API collection from
   [dashboard/postman-collection.json](../dashboard/postman-collection.json)
2. Set base URL: `http://localhost:3000/api`
3. Run requests and review responses

### Using JavaScript/Fetch

```javascript
// Get logs
const response = await fetch('http://localhost:3000/api/logs?level=ERROR');
const data = await response.json();
console.log(data.data.logs);

// Create reminder
const reminderResponse = await fetch('http://localhost:3000/api/reminders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Test reminder',
    type: 'one-time',
    scheduledTime: '2024-01-20T14:00:00Z',
  }),
});
const reminderData = await reminderResponse.json();
console.log(reminderData.data.reminder);
```

---

## See Also

- [Feature 1: Log Viewer](../wiki/Dashboard-Feature-1-Log-Viewer.md)
- [Feature 2: Service Management](../wiki/Dashboard-Feature-2-Service-Management.md)
- [Feature 3: Configuration Editor](../wiki/Dashboard-Feature-3-Config-Editor.md)
- [Feature 5: Network Status](../wiki/Dashboard-Feature-5-Network-Status.md)
- [Feature 7: Reminders](../wiki/Dashboard-Feature-7-Reminders.md)
- [v1.9.0 Release Notes](./RELEASE-NOTES-v1.9.0.md)
