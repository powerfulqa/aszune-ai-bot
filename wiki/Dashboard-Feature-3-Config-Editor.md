# Dashboard Feature 3: Configuration Editor

**Version:** v1.9.0 | **Status:** Production Ready | **Last Updated:** 2024

## Overview

The Configuration Editor provides a safe, validated interface for editing bot configuration without
requiring terminal access or bot restarts. Changes are validated, backed up automatically, and
logged for audit trails.

## Features

### Core Capabilities

- **File-Based Editing:** Edit `.env` environment variables and `config.js` settings
- **Pre-Submission Validation:** Catches errors before saving to prevent misconfiguration
- **Automatic Backups:** Creates timestamped backups before each save
- **Safe Mode:** Restricted editing to whitelisted configuration keys
- **Change Logging:** Records who changed what and when
- **Instant Verification:** Validates changes immediately after save
- **Rollback Option:** Restore previous configuration from backups
- **Syntax Highlighting:** Color-coded editing for .env and JSON files
- **Configuration Schema:** Visual guidance on valid options and constraints

## Features Explained

### Configuration Types

#### Environment Variables (.env)

```
Discord Bot Token: DISCORD_BOT_TOKEN=your_discord_bot_token_here
Perplexity API Key: PERPLEXITY_API_KEY=your_perplexity_api_key_here
Database Path: DB_PATH=./data/bot.db
License Key: ASZUNE_LICENSE_KEY=xxx
Port: PORT=3000
Debug Mode: DEBUG=true|false
```

#### Configuration Settings (config.js)

```javascript
// API endpoints
API.PERPLEXITY.BASE_URL;
API.PERPLEXITY.DEFAULT_MODEL;

// Cache settings
CACHE.MAX_SIZE;
CACHE.TTL;
CACHE.EVICTION_STRATEGY;

// Performance tuning
PERFORMANCE.TIMEOUT;
PERFORMANCE.MAX_RETRIES;
PERFORMANCE.THROTTLE_RATE;

// Feature flags
FEATURES.LICENSE_VALIDATION;
FEATURES.LICENSE_SERVER;
FEATURES.LICENSE_ENFORCEMENT;
```

### Validation System

#### Pre-Save Validation

```
Before allowing save, editor verifies:
1. Required fields are populated
2. Values match expected format (URL, number, boolean, etc.)
3. Constraints are satisfied (min/max values, allowed options)
4. No sensitive data in logs
5. No conflicting settings
```

#### Format Validation

```
Validates data types:
- Strings: Non-empty, max length
- Numbers: Min/max ranges
- URLs: Valid HTTP(S) format
- Booleans: true/false only
- Paths: Valid filesystem paths
- Tokens: Non-empty, format check
```

### Backup System

#### Automatic Backups

```
Before each save:
1. Current config copied to .backup directory
2. Filename: config-YYYY-MM-DD-HH-MM-SS.backup
3. Backup directory auto-created if missing
4. Old backups auto-purged (keep last 30)
```

#### Manual Restore

```
To restore previous configuration:
1. Click "Backups" button
2. Select desired backup timestamp
3. Preview changes before restore
4. Confirm restore operation
5. System auto-reloads with restored config
```

## Usage Guide

### Accessing Configuration Editor

1. Start the bot: `npm start` or `npm run dev`
2. Navigate to `http://localhost:3000/dashboard`
3. Click on **Configuration Editor** or navigate to `/config`
4. Authenticate if required

### Editing Environment Variables

#### Basic Steps

```
1. Click ".env Settings" tab
2. Locate desired variable in list
3. Enter new value in input field
4. Review any validation messages
5. Click "Save Configuration"
6. Verify success message appears
```

#### Example: Updating API Key

```
Current: PERPLEXITY_API_KEY=old_key_example
New: PERPLEXITY_API_KEY=new_key_example

1. Find PERPLEXITY_API_KEY field
2. Clear current value
3. Paste new API key
4. Validation: Key format must match expected length
5. Click Save
6. System updates in real-time (no restart needed)
```

#### Example: Enabling Debug Mode

```
Current: DEBUG=false
New: DEBUG=true

1. Find DEBUG toggle
2. Click to toggle ON
3. Validation: Value must be true/false
4. Click Save
5. Next bot startup will use debug mode
```

### Editing Application Configuration

#### Via Web Interface

```
1. Click "config.js Settings" tab
2. Browse configuration options organized by section
3. Update desired settings
4. Validation runs automatically
5. Click Save to persist changes
```

#### Configuration Sections

```
API Settings
├── Perplexity Base URL
├── Default Model
└── Rate Limiting

Cache Configuration
├── Max Size (MB)
├── TTL (seconds)
└── Eviction Strategy

Performance Tuning
├── Timeout (ms)
├── Max Retries
└── Throttle Rate

Feature Flags
├── License Validation
├── License Server
└── License Enforcement
```

### Viewing Change History

#### Access Change Log

```
1. Click "Change History" tab
2. View all recent configuration changes
3. See who changed what and when
4. Filter by date range
5. Export history as CSV
```

#### Change Log Entry

```
Timestamp: 2024-01-15T10:35:00Z
User: admin
Action: Modified
Field: PERPLEXITY_API_KEY
Old Value: [redacted]
New Value: [redacted]
Status: Success
```

### Reverting Changes

#### Quick Revert

```
1. In Change History, find desired change
2. Click "Revert" button
3. Confirm reverting to previous value
4. System saves previous configuration
5. Change logged as revert action
```

#### Restore from Backup

```
1. Click "Backups" tab
2. Browse available backup dates/times
3. Select desired backup
4. Preview changes before restore
5. Click "Restore"
6. System reverts to backup state
```

## API Reference

### REST Endpoints

#### Get Current Configuration

```http
GET /api/config
```

**Response:**

```json
{
  "success": true,
  "config": {
    "env": {
      "DISCORD_BOT_TOKEN": "xxx",
      "PERPLEXITY_API_KEY": "xxx",
      "PORT": "3000",
      "DEBUG": "false"
    },
    "configJs": {
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

#### Update Configuration

```http
POST /api/config
Content-Type: application/json

{
  "section": "env",
  "key": "PERPLEXITY_API_KEY",
  "value": "new_key_value"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Configuration updated successfully",
  "backup": {
    "timestamp": "2024-01-15T10:35:00Z",
    "path": ".backup/config-2024-01-15-10-35-00.backup"
  },
  "validation": {
    "valid": true,
    "warnings": []
  }
}
```

#### Validate Configuration

```http
POST /api/config/validate
Content-Type: application/json

{
  "section": "env",
  "key": "PORT",
  "value": "3000"
}
```

**Response:**

```json
{
  "valid": true,
  "warnings": [],
  "errors": [],
  "suggestions": []
}
```

#### Get Backups

```http
GET /api/config/backups
```

**Response:**

```json
{
  "success": true,
  "backups": [
    {
      "timestamp": "2024-01-15T10:35:00Z",
      "filename": "config-2024-01-15-10-35-00.backup",
      "size": 1024,
      "changes": {
        "added": ["NEW_SETTING"],
        "modified": ["PERPLEXITY_API_KEY"],
        "removed": []
      }
    }
  ],
  "total": 5
}
```

#### Restore from Backup

```http
POST /api/config/restore
Content-Type: application/json

{
  "backupTimestamp": "2024-01-15T10:35:00Z"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Configuration restored successfully",
  "config": {
    /* restored configuration */
  }
}
```

#### Get Change History

```http
GET /api/config/history?limit=50&startDate=2024-01-14&endDate=2024-01-15
```

**Response:**

```json
{
  "success": true,
  "changes": [
    {
      "timestamp": "2024-01-15T10:35:00Z",
      "user": "admin",
      "action": "modified",
      "field": "PERPLEXITY_API_KEY",
      "oldValue": "[redacted]",
      "newValue": "[redacted]",
      "status": "success"
    }
  ],
  "total": 127
}
```

## Validation Rules

### Environment Variables

| Variable           | Type    | Validation           | Example         |
| ------------------ | ------- | -------------------- | --------------- |
| DISCORD_BOT_TOKEN  | String  | Non-empty, 59 chars  | `MjA4NDI5...`   |
| PERPLEXITY_API_KEY | String  | Non-empty, 32+ chars | `ppl_xxx...`    |
| PORT               | Number  | 1024-65535           | `3000`          |
| DEBUG              | Boolean | true/false           | `true`          |
| DB_PATH            | String  | Valid path, writable | `./data/bot.db` |

### Configuration Settings

| Setting                     | Type    | Constraints   | Default |
| --------------------------- | ------- | ------------- | ------- |
| CACHE.MAX_SIZE              | Number  | 10-1024 MB    | 512     |
| CACHE.TTL                   | Number  | 300-86400 sec | 3600    |
| API.TIMEOUT                 | Number  | 1000-30000 ms | 5000    |
| FEATURES.LICENSE_VALIDATION | Boolean | true/false    | false   |

## Troubleshooting

### Validation Error on Save

```
Error: "PERPLEXITY_API_KEY must be at least 32 characters"

Solution:
1. Verify key is correct length
2. Check for leading/trailing whitespace
3. Generate new key if expired
4. Try paste again carefully
```

### Can't Find Configuration Option

```
Option not listed in editor:

1. Check exact field name in config.js
2. Verify using GitHub repo as reference
3. File issue if option should be editable
4. Use command line config as workaround
```

### Backup File Not Found

```
Error: "Backup from specified timestamp not found"

Solution:
1. Verify backup date/time format
2. Check backup directory exists
3. List available backups
4. Use most recent backup available
```

### Changes Not Taking Effect

```
If configuration change doesn't apply:

1. Verify save was successful (success message)
2. Check if bot restart is needed
3. Verify change persisted to file
4. Restart bot: systemctl restart aszune-ai-bot
5. Review logs for configuration load errors
```

## Security Best Practices

1. **Sensitive Data:** Never share configuration exports containing API keys
2. **Backup Security:** Keep `.backup` directory protected
3. **Access Control:** Restrict dashboard access to authorized users
4. **Change Auditing:** Review Change History regularly
5. **Version Control:** Don't commit `.env` files to git
6. **Key Rotation:** Rotate API keys periodically
7. **Backup Retention:** Keep backups for 30 days minimum

## Integration Examples

### Update API Key

```
1. Receive new Perplexity API key
2. Open Configuration Editor
3. Paste new key in PERPLEXITY_API_KEY field
4. Click Save
5. Bot automatically uses new key on next request
6. No restart required
```

### Enable Debug Mode

```
1. Troubleshooting performance issue
2. Open Configuration Editor
3. Set DEBUG=true
4. Save configuration
5. Next startup includes debug logging
6. Use Log Viewer to see debug messages
7. Set DEBUG=false when done
```

### Adjust Cache Settings

```
1. Monitor cache hit rates
2. Identify that cache is too small
3. Open Configuration Editor
4. Update CACHE.MAX_SIZE from 256 to 512
5. Save configuration
6. Cache automatically resizes on next operation
7. Monitor performance improvement
```

## Backend Implementation

**File:** `src/services/web-dashboard.js`

**Key Methods:**

- `setupConfigEditorRoutes()` - Initialize config editing endpoints
- `getConfiguration()` - Read current config from files
- `validateConfiguration()` - Pre-save validation
- `updateConfiguration()` - Apply configuration changes
- `createBackup()` - Generate configuration backup
- `restoreConfiguration()` - Restore from backup
- `getChangeHistory()` - Query change audit log

**Configuration:**

```javascript
CONFIG_EDITOR: {
  BACKUP_DIR: './.backup',
  BACKUP_RETENTION: 30, // days
  REDACT_SENSITIVE: ['TOKEN', 'KEY', 'SECRET'],
  VALIDATE_BEFORE_SAVE: true,
  AUTO_RESTART_THRESHOLD: 5 // auto-restart after 5 changes
}
```

## Advanced Topics

### Custom Validation Rules

```javascript
// Add validation for custom fields
VALIDATION_RULES: {
  'CUSTOM_SETTING': {
    type: 'number',
    min: 0,
    max: 100,
    required: true,
    message: 'Must be 0-100'
  }
}
```

### Backup Encryption

```javascript
// Enable backup encryption (optional)
BACKUP_ENCRYPTION: {
  ENABLED: true,
  ALGORITHM: 'aes-256-cbc',
  KEY_DERIVATION: 'pbkdf2'
}
```

## See Also

- [Dashboard Feature 1: Log Viewer](Dashboard-Feature-1-Log-Viewer.md)
- [Dashboard Feature 2: Service Management](Dashboard-Feature-2-Service-Management.md)
- [Dashboard Feature 5: Network Status](Dashboard-Feature-5-Network-Status.md)
- [Getting Started](Getting-Started.md)
- [Technical Documentation](Technical-Documentation.md)

## Demo

Interactive demo available: [`config-editor-demo.html`](../dashboard/public/config-editor-demo.html)

Launch with: `npm start` → Navigate to `http://localhost:3000/dashboard` → Select "Configuration
Editor"
