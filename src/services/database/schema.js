const logger = require('../../utils/logger');

const tableCreators = [
  createUserStatsTable,
  createConversationHistoryTable,
  createCommandUsageTable,
  createPerformanceMetricsTable,
  createErrorLogsTable,
  createServerAnalyticsTable,
  createBotUptimeTable,
  createUserMessagesTable,
  createRemindersTable,
];

function initializeTables(db) {
  tableCreators.forEach((creator) => creator(db));
}

function runMigrations(db) {
  try {
    const userStatsInfo = db.prepare('PRAGMA table_info(user_stats)').all();
    // Safely check if userStatsInfo exists and has data before checking columns
    const hasUsernameColumn =
      userStatsInfo && Array.isArray(userStatsInfo) && userStatsInfo.some((col) => col.name === 'username');

    if (!hasUsernameColumn) {
      logger.info('Running migration: Adding username column to user_stats table');
      db.exec(`
        ALTER TABLE user_stats ADD COLUMN username TEXT;
      `);
      logger.info('Migration completed: username column added to user_stats');
    }
  } catch (error) {
    logger.warn(`Database migration warning (non-critical): ${error.message}`);
  }
}

function createIndexes(db) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_messages_user_id_timestamp ON user_messages (user_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_conversation_history_user_id ON conversation_history (user_id);
    CREATE INDEX IF NOT EXISTS idx_command_usage_user_id_timestamp ON command_usage (user_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_command_usage_command_name ON command_usage (command_name);
    CREATE INDEX IF NOT EXISTS idx_performance_metrics_type_timestamp ON performance_metrics (metric_type, timestamp);
    CREATE INDEX IF NOT EXISTS idx_error_logs_type_timestamp ON error_logs (error_type, timestamp);
    CREATE INDEX IF NOT EXISTS idx_server_analytics_server_metric ON server_analytics (server_id, metric_type);
    CREATE INDEX IF NOT EXISTS idx_bot_uptime_event_timestamp ON bot_uptime (event_type, timestamp);
    CREATE INDEX IF NOT EXISTS idx_reminders_user_id_status ON reminders (user_id, status);
    CREATE INDEX IF NOT EXISTS idx_reminders_scheduled_time ON reminders (scheduled_time);
  `);
}

function ensureTriggers(db) {
  db.exec(`
    DROP TRIGGER IF EXISTS limit_conversation_history;
    CREATE TRIGGER limit_conversation_history
    AFTER INSERT ON conversation_history
    BEGIN
      DELETE FROM conversation_history WHERE user_id = NEW.user_id AND id NOT IN (
        SELECT id FROM conversation_history WHERE user_id = NEW.user_id ORDER BY timestamp DESC LIMIT 20
      );
    END;
  `);

  db.exec(`
    DROP TRIGGER IF EXISTS limit_user_messages;
    CREATE TRIGGER limit_user_messages
    AFTER INSERT ON user_messages
    BEGIN
      DELETE FROM user_messages WHERE user_id = NEW.user_id AND id NOT IN (
        SELECT id FROM user_messages WHERE user_id = NEW.user_id ORDER BY timestamp DESC LIMIT 20
      );
    END;
  `);
}

function createUserStatsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id TEXT PRIMARY KEY,
      message_count INTEGER DEFAULT 0,
      last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
      first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_summaries INTEGER DEFAULT 0,
      total_commands INTEGER DEFAULT 0,
      preferences TEXT DEFAULT '{}',
      username TEXT
    )
  `);
}

function createConversationHistoryTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      message TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      message_length INTEGER DEFAULT 0,
      response_time_ms INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES user_stats (user_id) ON DELETE CASCADE
    );
  `);
}

function createCommandUsageTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS command_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      command_name TEXT NOT NULL,
      server_id TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      success BOOLEAN DEFAULT 1,
      response_time_ms INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES user_stats (user_id) ON DELETE CASCADE
    )
  `);
}

function createPerformanceMetricsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS performance_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric_type TEXT NOT NULL,
      value REAL NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT DEFAULT '{}'
    )
  `);
}

function createErrorLogsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS error_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      error_type TEXT NOT NULL,
      error_message TEXT NOT NULL,
      user_id TEXT,
      command_name TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      stack_trace TEXT,
      resolved BOOLEAN DEFAULT 0
    )
  `);
}

function createServerAnalyticsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS server_analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id TEXT NOT NULL,
      metric_type TEXT NOT NULL,
      value INTEGER NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      date_only TEXT GENERATED ALWAYS AS (DATE(timestamp)) STORED,
      UNIQUE(server_id, metric_type, date_only)
    )
  `);
}

function createBotUptimeTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bot_uptime (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL CHECK(event_type IN ('start', 'stop', 'restart')),
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      uptime_seconds INTEGER DEFAULT 0,
      reason TEXT
    )
  `);
}

function createUserMessagesTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES user_stats (user_id) ON DELETE CASCADE
    );
  `);
}

function createRemindersTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      message TEXT NOT NULL,
      scheduled_time DATETIME NOT NULL,
      timezone TEXT DEFAULT 'UTC',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
      channel_id TEXT,
      server_id TEXT,
      FOREIGN KEY (user_id) REFERENCES user_stats (user_id) ON DELETE CASCADE
    );
  `);
}

module.exports = {
  initializeTables,
  createIndexes,
  ensureTriggers,
  runMigrations,
  _test: {
    tableCreators,
  },
};
