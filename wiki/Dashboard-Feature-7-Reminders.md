# Dashboard Feature 7: Reminder Management Interface

**Version:** v1.9.0 | **Status:** Production Ready | **Last Updated:** 2024

## Overview

The Reminder Management Interface provides a comprehensive web-based interface for managing
scheduled reminders. Create, view, edit, and delete reminders with persistent SQLite storage and
automatic recovery.

## Features

### Core Capabilities

- **CRUD Operations:** Create, read, update, and delete reminders through intuitive UI
- **Persistent Storage:** All reminders stored in SQLite with automatic backup
- **Flexible Scheduling:** Support for various time formats and intervals
- **Statistics Summary:** Displays totals plus `nextDue` (next scheduled reminder; null when none)
- **History Tracking:** View past reminder notifications and execution history
- **Edit Existing:** Modify reminder times, messages, and status without deleting
- **Recurring Reminders:** Set reminders that repeat daily, weekly, or custom intervals
- **Natural Language Support:** Parse human-readable time formats
- **Discord Integration:** Reminders sent to configured Discord channels
- **Automatic Recovery:** System recovers pending reminders on bot restart
- **Timezone Support:** Schedule reminders in different timezones

## Features Explained

### Reminder Types

#### One-Time Reminders

```
Set reminder for specific date/time:
- Date: January 20, 2024
- Time: 3:00 PM
- Message: "Team meeting in 1 hour"
- Triggers once at specified time
- Automatically cleaned up after execution
```

#### Daily Reminders

```
Set reminder that repeats each day:
- Time: 9:00 AM every day
- Message: "Start morning standup"
- Continues until disabled or deleted
- Execution time same every day
```

#### Weekly Reminders

```
Set reminder for specific day/time each week:
- Day: Monday, Wednesday, Friday
- Time: 10:00 AM
- Message: "Team sync meeting"
- Repeats every specified week
```

#### Custom Interval Reminders

```
Set reminder to repeat at custom intervals:
- Every 2 hours: Regular status checks
- Every 30 minutes: Periodic backups
- Every 7 days: Weekly reviews
- Flexible scheduling for any interval
```

### Reminder Lifecycle

#### Creation

```
1. User fills out reminder form in dashboard
2. System validates input
3. Reminder stored in database
4. Confirmation message shown
5. Reminder activated and ready to trigger
```

#### Execution

```
1. Bot checks for due reminders every 60 seconds
2. When reminder time arrives, notification triggers
3. Reminder message sent to configured Discord channel
4. Execution logged with timestamp
5. One-time reminders deleted (recurring continue)
```

#### History

```
Track all reminder executions:
- Date and time executed
- Message content
- Discord channel sent to
- Status (success/failed)
- Any error messages
```

## Usage Guide

### Accessing Reminder Dashboard

1. Start the bot: `npm start` or `npm run dev`
2. Navigate to `http://localhost:3000/dashboard`
3. Click on **Reminder Management Interface** or navigate to `/reminders`

### Creating a Reminder

#### Basic Steps

```
1. Click "Create New Reminder" button
2. Enter reminder message
3. Select date and time
4. Choose reminder type (one-time, daily, weekly, etc.)
5. Optional: Set repeat interval
6. Click "Create Reminder"
7. Confirmation message appears
```

#### Example: One-Time Reminder

```
Message: "Doctor appointment"
Date: January 20, 2024
Time: 3:00 PM
Type: One-time
Timezone: America/New_York

Result: Reminder triggered at 3:00 PM on Jan 20
```

#### Example: Daily Reminder

```
Message: "Time to backup important files"
Time: 11:00 PM
Type: Daily
Timezone: America/Los_Angeles

Result: Reminder triggers every day at 11:00 PM local time
```

#### Example: Weekly Reminder

```
Message: "Weekly project review meeting"
Days: Monday, Wednesday, Friday
Time: 2:00 PM
Type: Weekly
Timezone: UTC

Result: Reminder triggers at 2:00 PM on M/W/F
```

### Viewing Reminders

#### All Reminders List

```
Shows all active reminders:
- Message content
- Next execution time
- Reminder type (one-time, daily, etc.)
- Status (active, paused, disabled)
- Edit/Delete buttons

Sortable by:
- Next execution date
- Reminder type
- Status
- Creation date
```

#### Reminder Details

```
Click reminder to see full details:
- Complete message
- Recurrence pattern
- Timezone
- Creation date
- Last execution date
- Execution history (last 10 runs)
- Edit/Delete options
```

### Editing Reminders

#### Modify Existing Reminder

```
1. Click reminder in list
2. Click "Edit" button
3. Update message, time, or recurrence
4. Click "Save Changes"
5. Confirmation shows changes applied
6. Reminder continues with updated settings
```

#### Example: Update Meeting Time

```
Current: Monday 2:00 PM → Friday 3:00 PM
1. Click reminder
2. Change day from Monday to Friday
3. Change time to 3:00 PM
4. Save changes
5. Next reminder: Friday 3:00 PM
```

#### Example: Extend Reminder Period

```
Current: Repeats for 30 days → Continue indefinitely
1. Click reminder
2. Select "No end date" instead of "30 days"
3. Save changes
4. Reminder continues indefinitely
```

### Deleting Reminders

#### Remove Single Reminder

```
1. Find reminder in list
2. Click "Delete" button
3. Confirm deletion
4. Reminder removed from system
5. History data retained for reference
```

#### Delete Multiple Reminders

```
1. Select checkboxes for reminders to delete
2. Click "Delete Selected" button
3. Confirm deletion
4. All selected reminders removed
```

### Viewing Execution History

#### Recent Executions

```
View when reminders were triggered:
- Date and time executed
- Message sent
- Channel where sent
- Status (success/failed)
- Any error messages

Sort by:
- Most recent first
- Oldest first
- By reminder type
```

#### History Analysis

```
Analyze reminder performance:
- Total reminders created
- Most frequently used types
- Failed execution count
- Average response time
- Execution trends
```

## API Reference

### REST Endpoints

#### Get All Reminders

```http
GET /api/reminders
```

**Response:**

```json
{
  "success": true,
  "reminders": [
    {
      "id": "rem_123abc",
      "message": "Team meeting",
      "nextExecution": "2024-01-20T14:00:00Z",
      "type": "recurring",
      "recurrence": "daily",
      "status": "active",
      "createdAt": "2024-01-15T08:30:00Z",
      "lastExecution": "2024-01-19T14:00:00Z"
    }
  ],
  "total": 5,
  "active": 3,
  "paused": 2
}
```

#### Get Reminder Details

```http
GET /api/reminders/:id
```

**Response:**

```json
{
  "success": true,
  "reminder": {
    "id": "rem_123abc",
    "message": "Team meeting",
    "scheduledTime": "14:00",
    "scheduledDays": ["monday", "wednesday", "friday"],
    "timezone": "America/New_York",
    "type": "recurring",
    "recurrence": "weekly",
    "status": "active",
    "createdAt": "2024-01-15T08:30:00Z",
    "updatedAt": "2024-01-15T08:30:00Z",
    "lastExecution": "2024-01-19T18:00:00Z",
    "nextExecution": "2024-01-22T18:00:00Z",
    "executionHistory": [
      {
        "executedAt": "2024-01-19T18:00:00Z",
        "status": "success",
        "channel": "announcements"
      }
    ]
  }
}
```

#### Create Reminder

```http
POST /api/reminders
Content-Type: application/json

{
  "message": "Team meeting reminder",
  "type": "one-time",
  "scheduledTime": "2024-01-20T14:00:00Z",
  "timezone": "America/New_York",
  "channel": "general"
}
```

**Response:**

```json
{
  "success": true,
  "reminder": {
    "id": "rem_456def",
    "message": "Team meeting reminder",
    "nextExecution": "2024-01-20T18:00:00Z",
    "type": "one-time",
    "status": "active",
    "createdAt": "2024-01-15T09:00:00Z"
  }
}
```

#### Create Recurring Reminder

```http
POST /api/reminders
Content-Type: application/json

{
  "message": "Daily standup at 9 AM",
  "type": "recurring",
  "recurrence": "daily",
  "scheduledTime": "09:00",
  "timezone": "UTC",
  "channel": "general"
}
```

#### Update Reminder

```http
PUT /api/reminders/:id
Content-Type: application/json

{
  "message": "Updated meeting reminder",
  "scheduledTime": "15:00",
  "status": "active"
}
```

**Response:**

```json
{
  "success": true,
  "reminder": {
    "id": "rem_123abc",
    "message": "Updated meeting reminder",
    "scheduledTime": "15:00",
    "status": "active",
    "updatedAt": "2024-01-15T09:15:00Z"
  }
}
```

#### Delete Reminder

```http
DELETE /api/reminders/:id
```

**Response:**

```json
{
  "success": true,
  "message": "Reminder deleted successfully",
  "deletedAt": "2024-01-15T09:20:00Z"
}
```

#### Get Execution History

```http
GET /api/reminders/:id/history?limit=50
```

**Response:**

```json
{
  "success": true,
  "history": [
    {
      "executedAt": "2024-01-19T14:00:00Z",
      "status": "success",
      "channel": "general",
      "message": "Team meeting"
    }
  ],
  "total": 42,
  "limit": 50
}
```

#### Pause Reminder

```http
POST /api/reminders/:id/pause
```

**Response:**

```json
{
  "success": true,
  "reminder": {
    "id": "rem_123abc",
    "status": "paused",
    "pausedAt": "2024-01-15T09:25:00Z"
  }
}
```

#### Resume Reminder

```http
POST /api/reminders/:id/resume
```

**Response:**

```json
{
  "success": true,
  "reminder": {
    "id": "rem_123abc",
    "status": "active",
    "resumedAt": "2024-01-15T09:30:00Z"
  }
}
```

## Reminder Scheduling

### Time Format Support

```
Natural language parsing:
- "tomorrow at 2pm"
- "next monday 3:00 PM"
- "in 2 hours"
- "daily at 9am"
- "every 30 minutes"
- "january 20 at 3:15 pm"
- "2024-01-20 14:00:00"
- "14:00 UTC"
```

### Recurrence Patterns

```
Supported patterns:
- once: Single execution
- hourly: Every hour
- daily: Every day
- weekly: Specific days each week
- biweekly: Every 2 weeks
- monthly: Same day each month
- quarterly: Every 3 months
- yearly: Same date annually
- custom: Any interval in minutes
```

### Timezone Support

```
Valid timezones:
- UTC
- America/New_York
- America/Los_Angeles
- Europe/London
- Europe/Paris
- Asia/Tokyo
- Australia/Sydney
- Pacific/Auckland

Set with: "timezone": "America/New_York"
```

## Troubleshooting

### Reminder Not Triggering

```
Steps to diagnose:
1. Verify bot is running
2. Check reminder status is "active" (not paused)
3. Verify next execution time is in future
4. Check Discord channel is configured
5. Verify bot has permissions to send messages
6. Review logs for execution errors
7. Try creating new test reminder
```

### Can't Create Reminder

```
If creation fails:
1. Verify message is not empty
2. Check time format is valid
3. Verify timezone exists
4. Check if date is in past
5. Try simpler time format
6. Review error message for details
```

### Reminder Executes at Wrong Time

```
If timing is off:
1. Verify timezone is correct
2. Check system time is accurate
3. Verify reminder time format matches timezone
4. Account for daylight saving time changes
5. Check bot uptime (restarts reset timers)
```

### Execution History Missing

```
If history not showing:
1. Verify reminder actually executed
2. Check Discord channel for message
3. Review bot logs for execution record
4. Try refreshing dashboard page
5. Verify database connectivity
```

## Integration Examples

### Daily Team Standup

```
Message: "@team Daily standup at 9 AM"
Type: Recurring (daily)
Time: 9:00 AM
Timezone: America/New_York
Channel: #general

Result: Reminder triggers every day at 9 AM
```

### Weekly Backup Reminder

```
Message: "Remember to backup files!"
Type: Recurring (weekly)
Days: Friday
Time: 5:00 PM
Timezone: UTC
Channel: #admin

Result: Reminder triggers every Friday at 5 PM
```

### One-Time Event Reminder

```
Message: "Conference keynote starting in 30 minutes"
Type: One-time
Date: January 20, 2024
Time: 9:30 AM
Timezone: America/Los_Angeles
Channel: #events

Result: Reminder triggers once at specified time
```

### Medication Reminder (Raspberry Pi)

```
Message: "Take medication"
Type: Recurring (every 8 hours)
Times: 8 AM, 4 PM, 12 AM
Timezone: Local
Channel: Personal DMs

Result: Reminder triggers 3x daily at specified times
```

## Backend Implementation

**File:** `src/services/web-dashboard.js` & `src/services/reminder-service.js`

**Key Methods:**

- `setupReminderRoutes()` - Initialize reminder endpoints
- `createReminder()` - Add new reminder to database
- `updateReminder()` - Modify existing reminder
- `deleteReminder()` - Remove reminder
- `getReminders()` - Query all reminders
- `getExecutionHistory()` - Retrieve past executions
- `checkAndExecuteReminders()` - Main scheduler loop
- `pauseReminder()` / `resumeReminder()` - Pause/resume operations

**Database Schema:**

```sql
CREATE TABLE reminders (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  type TEXT,
  recurrence TEXT,
  scheduled_time TEXT,
  timezone TEXT,
  status TEXT,
  channel TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  next_execution TIMESTAMP,
  last_execution TIMESTAMP
);

CREATE TABLE reminder_history (
  id INTEGER PRIMARY KEY,
  reminder_id TEXT,
  executed_at TIMESTAMP,
  status TEXT,
  message TEXT,
  FOREIGN KEY (reminder_id) REFERENCES reminders(id)
);
```

**Configuration:**

```javascript
REMINDERS: {
  CHECK_INTERVAL: 60000, // 60 seconds
  DEFAULT_TIMEZONE: 'UTC',
  MAX_REMINDERS: 1000,
  HISTORY_RETENTION: 2592000000, // 30 days
  AUTO_RECOVER_ON_STARTUP: true
}
```

## Best Practices

1. **Use Clear Messages:** Write descriptive reminder text
2. **Set Appropriate Times:** Avoid late-night/early-morning reminders
3. **Review Regularly:** Check reminder list monthly
4. **Clean Up Old Reminders:** Delete reminders that are no longer needed
5. **Test Before Production:** Create test reminder before critical ones
6. **Set Timezone Correctly:** Verify timezone matches your location
7. **Document Important Reminders:** Note why reminders are scheduled
8. **Archive History:** Export history for important reminders

## Advanced Topics

### Custom Recurrence Logic

```javascript
// Define complex recurring patterns
RECURRENCE: {
  "business_days": "monday-friday at 9am",
  "weekend_only": "saturday,sunday at 10am",
  "on_call_schedule": "rotate every 2 weeks"
}
```

### Reminder Escalation

```javascript
// Escalate reminders if not acknowledged
ESCALATION: {
  enabled: true,
  levels: [
    { delay: 0, method: 'message' },
    { delay: 300000, method: 'mention' }, // 5 mins
    { delay: 900000, method: 'alert' }    // 15 mins
  ]
}
```

### Integration with Other Services

```javascript
// Send reminders to multiple channels
INTEGRATIONS: {
  discord: true,
  email: false,
  sms: false,
  webhook: false
}
```

## See Also

- [Dashboard Feature 1: Log Viewer](Dashboard-Feature-1-Log-Viewer.md)
- [Dashboard Feature 2: Service Management](Dashboard-Feature-2-Service-Management.md)
- [Dashboard Feature 5: Network Status](Dashboard-Feature-5-Network-Status.md)
- [Command Reference](Command-Reference.md)
- [Technical Documentation](Technical-Documentation.md)

## Demo

Interactive demo available:
[`reminder-management.html`](../dashboard/public/reminder-management.html)

Launch with: `npm start` → Navigate to `http://localhost:3000/dashboard` → Select "Reminder
Management Interface"
