# Dashboard API Reference v1.9.0

> **Current REST surface.** The logs, services, config and network REST endpoints were
> removed; the dashboard UI uses Socket.IO events for them (`request_logs`, `clear_logs`,
> `request_services`, `service_action`, `request_config`, `save_config`,
> `request_network_status`, ... see `src/services/web-dashboard/handlers/`). The only
> REST endpoints now are `GET /api/health`, `/api/metrics`, `/api/system`, `/api/version`,
> `/api/database/*`, `/api/recommendations`, `GET /api/reminders`, `POST /api/control/restart`
> and `POST /api/control/git-pull`. Reminders are created, edited and deleted over the socket,
> not REST. Sections below that describe other endpoints are historical.

**Status:** Production Ready | **Version:** v1.9.0 | **Last Updated:** 2025-01-15

## ⚠️ Security Notice

**By default, the dashboard binds to localhost (127.0.0.1) only.** This means it is only accessible
from the local machine. Remote access is disabled by default for security.

### Enabling Remote Access (Advanced)

To enable remote access, set these environment variables:

```bash
# Bind to all interfaces (required for remote access)
DASHBOARD_BIND_HOST=0.0.0.0

# REQUIRED for remote access: Set a secure token
DASHBOARD_TOKEN=your-secure-random-token-here

# Optional: Configure allowed CORS origin
DASHBOARD_CORS_ORIGIN=https://your-domain.com
```

**WARNING:** Never expose the dashboard without token authentication. The dashboard includes service
control and configuration editing capabilities that could be exploited if exposed.

## Base URL

```
http://localhost:3000/api
```

## Authentication

When `DASHBOARD_TOKEN` is set, all API endpoints require Bearer token authentication:

```
Authorization: Bearer <your-token>
```

If `DASHBOARD_TOKEN` is not set, authentication is disabled (safe for localhost-only access).

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

Authentication error (when token auth is enabled):

```json
{
  "error": "Unauthorized - Bearer token required"
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

> Reminders are read-only over REST (`GET /api/reminders`). Creating, editing and deleting a
> reminder goes over the dashboard socket (`create_reminder`, `edit_reminder`, `delete_reminder`),
> which needs `DASHBOARD_TOKEN`, a Discord user ID and a channel ID.

### Using cURL

```bash
# Get logs
curl http://localhost:3000/api/logs?level=ERROR&limit=10

# Get service status
curl http://localhost:3000/api/services

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
```

---

## See Also

- [Feature 1: Log Viewer](../wiki/Dashboard-Feature-1-Log-Viewer.md)
- [Feature 2: Service Management](../wiki/Dashboard-Feature-2-Service-Management.md)
- [Feature 3: Configuration Editor](../wiki/Dashboard-Feature-3-Config-Editor.md)
- [Feature 5: Network Status](../wiki/Dashboard-Feature-5-Network-Status.md)
- [Feature 7: Reminders](../wiki/Dashboard-Feature-7-Reminders.md)
- [v1.9.0 Release Notes](./release-notes/RELEASE-NOTES-v1.9.0.md)
