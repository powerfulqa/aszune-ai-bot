# Dashboard API Reference v1.9.0

> **Current REST surface.** The logs, services, config and network REST endpoints were removed; the
> dashboard UI uses Socket.IO events for them (`request_logs`, `clear_logs`, `request_services`,
> `service_action`, `request_config`, `save_config`, `request_network_status`, ... see
> `src/services/web-dashboard/handlers/`). The only REST endpoints now are `GET /api/health`,
> `/api/metrics`, `/api/system`, `/api/version`, `/api/database/*`, `/api/database-schema`,
> `/api/recommendations`, `GET /api/reminders`, `POST /api/control/restart` and
> `POST /api/control/git-pull`. Reminders are created, edited and deleted over the socket, not REST.

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

If `DASHBOARD_TOKEN` is not set, the dashboard is read-only and answers only on a loopback bind:
`POST /api/control/*` and every socket event that changes something are refused.

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

## Testing API

> Reminders are read-only over REST (`GET /api/reminders`). Creating, editing and deleting a
> reminder goes over the dashboard socket (`create_reminder`, `edit_reminder`, `delete_reminder`),
> which needs `DASHBOARD_TOKEN`, a Discord user ID and a channel ID.

### Using cURL

```bash
# Health check
curl http://localhost:3000/api/health

# Reminder list (read-only)
curl -H "Authorization: Bearer $DASHBOARD_TOKEN" http://localhost:3000/api/reminders
```

---

## See Also

- [Feature 1: Log Viewer](../wiki/Dashboard-Feature-1-Log-Viewer.md)
- [Feature 2: Service Management](../wiki/Dashboard-Feature-2-Service-Management.md)
- [Feature 3: Configuration Editor](../wiki/Dashboard-Feature-3-Config-Editor.md)
- [Feature 5: Network Status](../wiki/Dashboard-Feature-5-Network-Status.md)
- [Feature 7: Reminders](../wiki/Dashboard-Feature-7-Reminders.md)
- [v1.9.0 Release Notes](./release-notes/RELEASE-NOTES-v1.9.0.md)
