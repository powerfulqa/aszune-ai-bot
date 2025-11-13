# Database Integration Documentation

## Overview

The Aszune AI Bot now includes comprehensive SQLite database integration for persistent data
storage. This enables conversation history persistence, user analytics tracking, and enhanced user
experience through data continuity across bot restarts.

## Database Architecture

### Database Service (`src/services/database.js`)

The `DatabaseService` class provides a clean, robust interface for all database operations:

- **Automatic Initialization**: Database and tables are created automatically on first use
- **Graceful Fallback**: If SQLite is unavailable, the service provides mock implementations
- **Error Handling**: Comprehensive error handling with logging for all operations
- **Resource Management**: Proper connection management with cleanup methods

### Database Schema

#### User Statistics Table (`user_stats`)

```sql
CREATE TABLE user_stats (
    user_id TEXT PRIMARY KEY,
    message_count INTEGER DEFAULT 0,
    last_active TEXT,
    username TEXT
);
```

**Enhanced Features (v1.8.0):**

- **Username Storage**: Stores human-readable Discord usernames alongside numeric user IDs
- **Analytics Enhancement**: Enables richer user identification and analytics capabilities
- **Privacy Safe**: Usernames are stored for analytics purposes only and can change
- **Backward Compatible**: Nullable column with graceful fallback for existing databases

#### Conversation History Table (`conversation_history`)

```sql
CREATE TABLE conversation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    message TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user_stats (user_id) ON DELETE CASCADE
);
```

**Enhanced Features (v1.7.0):**

- **Role Separation**: Distinguishes between 'user' and 'assistant' messages
- **Foreign Key Constraints**: Ensures data integrity with cascading deletes
- **Performance Indexes**: Optimized for conversation retrieval by user and timestamp

#### Automatic Cleanup Trigger

- Maintains maximum 10 messages per user
- Automatically removes oldest messages when limit exceeded
- Preserves conversation flow while managing storage

## Key Features

### 1. Conversation Persistence

- **User Messages**: All user messages are stored with timestamps
- **Bot Responses**: Bot replies are stored with `[BOT]` prefix for identification
- **Role-Based Storage**: Enhanced conversation_history table separates user/assistant messages
- **History Reconstruction**: `getConversationHistory()` retrieves chronologically ordered
  conversations
- **History Loading**: Recent conversation history is loaded when conversation manager history is
  sparse
- **Seamless Integration**: Works transparently with existing conversation management
- **Data Integrity**: Foreign key constraints ensure conversation records are linked to valid users

### 2. User Analytics

- **Message Counting**: Tracks total messages per user
- **Activity Timestamps**: Records last activity time for each user
- **Engagement Metrics**: Foundation for future analytics dashboard features

### 3. Data Management

- **Individual Cleanup**: `clearUserData(userId)` removes all data for a specific user
- **Bulk Operations**: `clearAllData()` removes all data from all tables
- **Safe Operations**: All operations include error handling and logging

## Configuration

### Environment Variables

```env
# Optional: Custom database path (defaults to ./data/bot.db)
DB_PATH=./custom/path/bot.db
```

### Default Configuration

- **Location**: `./data/bot.db`
- **Auto-creation**: Database file and directory created automatically
- **Permissions**: Standard file permissions (0o644 for files, 0o755 for directories)

## API Reference

### DatabaseService Methods

#### Core Operations

- `getDb()`: Gets database instance (creates if needed)
- `close()`: Closes database connection
- `initTables()`: Creates database tables and triggers

#### User Statistics

- `getUserStats(userId)`: Gets user statistics (returns defaults if not found)
- `updateUserStats(userId, updates)`: Updates user statistics

#### Message History

- `getUserMessages(userId, limit = 10)`: Gets user messages (most recent first)
- `addUserMessage(userId, message)`: Adds user message to history and conversation_history table
- `addBotResponse(userId, response)`: Adds bot response with `[BOT]` prefix to both tables
- `getConversationHistory(userId, limit = 20)`: Gets complete conversation with role separation
- `ensureUserExists(userId)`: Ensures user exists in user_stats (handles foreign keys)

#### Data Management

- `clearUserData(userId)`: Removes all data for specific user
- `clearAllData()`: Removes all data from all tables

## Integration Points

### Chat Service Integration

```javascript
// Store user message
databaseService.addUserMessage(userId, messageContent);

// Update user statistics
databaseService.updateUserStats(userId, {
  message_count: 1,
  last_active: new Date().toISOString(),
});

// Load conversation history when needed
const recentMessages = databaseService.getUserMessages(userId, 5);
```

### Error Handling

```javascript
try {
  databaseService.addUserMessage(userId, messageContent);
} catch (dbError) {
  logger.warn('Database operation failed:', dbError.message);
  // Continue processing even if database fails
}
```

## Testing

### Test Coverage

- **122 comprehensive tests** covering all database operations across 6 modular test files
- **Integration tests** with actual SQLite database
- **Error scenario testing** for graceful failure handling
- **Mock implementations** for other test suites
- **Modular test architecture** with separate files for different concerns

### Key Test Areas

- Database initialization and table creation
- User statistics operations (CRUD)
- Message history management with limits
- Conversation history with role separation
- Reminder system integration
- Analytics and performance metrics
- Data cleanup and bulk operations
- Connection management and error handling

### Test File Structure

```
__tests__/unit/services/
├── database.test.js           # Legacy comprehensive tests (53 tests)
├── database-basic.test.js     # Basic operations (4 tests)
├── database-users.test.js     # User management (7 tests)
├── database-conversations.test.js # Conversation operations (6 tests)
├── database-reminders.test.js # Reminder functionality (8 tests)
└── database-analytics.test.js # Analytics operations (18 tests)
```

### Running Database Tests

```bash
# Run all database tests
npm test -- --testPathPattern="database"

# Run specific database test suite
npx jest __tests__/unit/services/database-analytics.test.js

# Run with coverage
npm test -- --testPathPattern="database" --coverage
```

## Performance Considerations

### Optimization Features

- **Message Limits**: Automatic cleanup maintains 10 messages per user maximum
- **Batch Operations**: Efficient bulk operations for data management
- **Connection Reuse**: Single connection per service instance
- **Lazy Loading**: Database initialized only when first accessed

### Raspberry Pi Compatibility

- **Low Memory**: Optimized for resource-constrained environments
- **File I/O**: Efficient SQLite operations suitable for SD card storage
- **Error Resilience**: Graceful handling of storage issues

## Migration & Deployment

### New Installations

- Database is created automatically on first run
- No manual setup required
- Compatible with existing configuration

### Existing Installations

- Seamlessly integrates with existing bots
- No data migration required (starts fresh)
- Backwards compatible with all existing features

### Production Deployment

- Database file should be included in backup strategies
- `data/` directory should be persistent across deployments
- Monitor disk space usage for high-traffic servers

## Troubleshooting

### Common Issues

#### Database File Permissions

```bash
# Ensure proper permissions
chmod 644 data/bot.db
chmod 755 data/
```

#### SQLite Not Available

- Service automatically provides fallback mock implementations
- Bot continues normal operation without persistence
- Check logs for "better-sqlite3" installation issues

#### Database Corruption

```javascript
// Manual cleanup if needed
databaseService.clearAllData();
```

### Debug Mode

```env
# Enable detailed database logging
DEBUG=database
```

## Future Enhancements

### Planned Features

- **Advanced Analytics**: Detailed user engagement metrics
- **Export Capabilities**: Data export for backup and analysis
- **Migration Tools**: Database schema versioning and migrations
- **Performance Metrics**: Query performance monitoring

### Extension Points

- **Custom Schemas**: Additional tables for plugin data
- **Backup Integration**: Automated backup scheduling
- **Replication**: Multi-instance data synchronization
- **Analytics Dashboard**: Web interface for data visualization

## Security Considerations

### Data Protection

- **Local Storage**: All data stored locally (no external services)
- **Access Control**: Database access limited to bot process
- **Privacy**: User data can be cleared on request
- **Compliance**: Foundation for GDPR compliance features

### Best Practices

- Regular backups of database file
- Monitor database growth in high-traffic servers
- Implement data retention policies as needed
- Use environment variables for sensitive configuration
