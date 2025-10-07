let Database;
try {
  Database = require('better-sqlite3');
} catch (error) {
  // Graceful fallback for tests or when better-sqlite3 is not installed
  Database = null;
}
const path = require('path');
const logger = require('../utils/logger');

class DatabaseService {
  constructor() {
    this.dbPath = null;
    this.db = null;
    this.isDisabled = !Database;
  }

  getDb() {
    if (this.isDisabled) {
      // Return a mock database for tests or when better-sqlite3 is unavailable
      return {
        prepare: () => ({
          get: () => null,
          all: () => [],
          run: () => ({}),
        }),
        exec: () => ({}),
        close: () => ({}),
      };
    }

    if (!this.db) {
      if (!this.dbPath) {
        // Access config inside getDb to avoid circular deps and ensure test mocks work
        const config = require('../config/config');
        this.dbPath = path.resolve(config.DB_PATH || './data/bot.db');
      }
      try {
        this.db = new Database(this.dbPath);
        // Disable WAL mode to ensure immediate data persistence
        this.db.pragma('journal_mode = DELETE');
        this.db.pragma('synchronous = FULL');
        this.initTables();
      } catch (error) {
        throw new Error(`Failed to initialize database: ${error.message}`);
      }
    }
    return this.db;
  }

  initTables() {
    if (this.isDisabled) return;

    const db = this.getDb();
    try {
      this._createUserStatsTable(db);
      this._createConversationHistoryTable(db);
      this._createCommandUsageTable(db);
      this._createPerformanceMetricsTable(db);
      this._createErrorLogsTable(db);
      this._createServerAnalyticsTable(db);
      this._createBotUptimeTable(db);
      this._createUserMessagesTable(db);
      this._createRemindersTable(db);
      this._createIndexes(db);
      this._ensureTriggers(db); // Ensure triggers are created after all tables
    } catch (error) {
      throw new Error(`Failed to initialize database tables: ${error.message}`);
    }
  }

  _createUserStatsTable(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_stats (
        user_id TEXT PRIMARY KEY,
        message_count INTEGER DEFAULT 0,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
        first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_summaries INTEGER DEFAULT 0,
        total_commands INTEGER DEFAULT 0,
        preferences TEXT DEFAULT '{}'
      )
    `);
  }

  _createConversationHistoryTable(db) {
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

  _createCommandUsageTable(db) {
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

  _createPerformanceMetricsTable(db) {
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

  _createErrorLogsTable(db) {
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

  _createServerAnalyticsTable(db) {
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

  _createBotUptimeTable(db) {
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

  _createUserMessagesTable(db) {
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

  _createRemindersTable(db) {
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

  _createIndexes(db) {
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

  _ensureTriggers(db) {
    if (this.isDisabled) return;

    try {
      // Ensure conversation_history trigger exists with correct limit
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

      // Ensure user_messages trigger exists with correct limit
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
    } catch (error) {
      throw new Error(`Failed to ensure triggers: ${error.message}`);
    }
  }

  // Stats methods
  getUserStats(userId) {
    try {
      const db = this.getDb();
      const stmt = db.prepare('SELECT * FROM user_stats WHERE user_id = ?');
      return (
        stmt.get(userId) || {
          user_id: userId,
          message_count: 0,
          last_active: null,
          first_seen: null,
          total_summaries: 0,
          total_commands: 0,
          preferences: '{}',
        }
      );
    } catch (error) {
      if (this.isDisabled) {
        return {
          user_id: userId,
          message_count: 0,
          last_active: null,
          first_seen: null,
          total_summaries: 0,
          total_commands: 0,
          preferences: '{}',
        };
      }
      throw new Error(`Failed to get user stats for ${userId}: ${error.message}`);
    }
  }

  // Analytics methods
  trackCommandUsage(userId, commandName, serverId = null, success = true, responseTimeMs = 0) {
    try {
      if (this.isDisabled) return;

      const db = this.getDb();
      this.ensureUserExists(userId);

      const stmt = db.prepare(`
        INSERT INTO command_usage (user_id, command_name, server_id, success, response_time_ms)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(userId, commandName, serverId, success ? 1 : 0, responseTimeMs);

      // Update user stats
      this.updateUserStats(userId, { total_commands: 1 });
    } catch (error) {
      if (this.isDisabled) return;
      logger.warn(`Failed to track command usage: ${error.message}`);
    }
  }

  getCommandUsageStats(days = 7) {
    try {
      if (this.isDisabled) return { totalCommands: 0, commandBreakdown: [], successRate: 100 };

      const db = this.getDb();
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      // Get total commands
      const totalStmt = db.prepare(`
        SELECT COUNT(*) as total FROM command_usage WHERE timestamp >= ?
      `);
      const total = totalStmt.get(cutoffDate).total;

      // Get command breakdown
      const breakdownStmt = db.prepare(`
        SELECT command_name, COUNT(*) as count
        FROM command_usage
        WHERE timestamp >= ?
        GROUP BY command_name
        ORDER BY count DESC
        LIMIT 10
      `);
      const breakdown = breakdownStmt.all(cutoffDate);

      // Get success rate
      const successStmt = db.prepare(`
        SELECT
          COUNT(CASE WHEN success = 1 THEN 1 END) as successful,
          COUNT(*) as total
        FROM command_usage WHERE timestamp >= ?
      `);
      const successData = successStmt.get(cutoffDate);
      const successRate =
        successData.total > 0 ? (successData.successful / successData.total) * 100 : 100;

      return {
        totalCommands: total,
        commandBreakdown: breakdown,
        successRate: Math.round(successRate * 100) / 100,
      };
    } catch (error) {
      if (this.isDisabled) return { totalCommands: 0, commandBreakdown: [], successRate: 100 };
      logger.warn(`Failed to get command usage stats: ${error.message}`);
      return { totalCommands: 0, commandBreakdown: [], successRate: 100 };
    }
  }

  logPerformanceMetric(metricType, value, metadata = {}) {
    try {
      if (this.isDisabled) return;

      const db = this.getDb();
      const stmt = db.prepare(`
        INSERT INTO performance_metrics (metric_type, value, metadata)
        VALUES (?, ?, ?)
      `);
      stmt.run(metricType, value, JSON.stringify(metadata));
    } catch (error) {
      if (this.isDisabled) return;
      logger.warn(`Failed to log performance metric: ${error.message}`);
    }
  }

  getPerformanceMetrics(metricType, hours = 24) {
    try {
      if (this.isDisabled) return [];

      const db = this.getDb();
      const stmt = db.prepare(`
        SELECT value, timestamp, metadata
        FROM performance_metrics
        WHERE metric_type = ? AND timestamp >= datetime('now', '-${hours} hours')
        ORDER BY timestamp DESC
      `);
      return stmt.all(metricType);
    } catch (error) {
      if (this.isDisabled) return [];
      logger.warn(`Failed to get performance metrics: ${error.message}`);
      return [];
    }
  }

  logError(errorType, errorMessage, userId = null, commandName = null, stackTrace = null) {
    try {
      if (this.isDisabled) return;

      const db = this.getDb();
      const stmt = db.prepare(`
        INSERT INTO error_logs (error_type, error_message, user_id, command_name, stack_trace)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(errorType, errorMessage, userId, commandName, stackTrace);
    } catch (error) {
      if (this.isDisabled) return;
      logger.warn(`Failed to log error: ${error.message}`);
    }
  }

  getErrorStats(days = 7) {
    try {
      if (this.isDisabled) return { totalErrors: 0, errorBreakdown: [], resolvedCount: 0 };

      const db = this.getDb();
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      // Get total errors
      const totalStmt = db.prepare(`
        SELECT COUNT(*) as total FROM error_logs WHERE timestamp >= ?
      `);
      const total = totalStmt.get(cutoffDate).total;

      // Get error breakdown
      const breakdownStmt = db.prepare(`
        SELECT error_type, COUNT(*) as count
        FROM error_logs
        WHERE timestamp >= ?
        GROUP BY error_type
        ORDER BY count DESC
        LIMIT 10
      `);
      const breakdown = breakdownStmt.all(cutoffDate);

      // Get resolved count
      const resolvedStmt = db.prepare(`
        SELECT COUNT(*) as resolved FROM error_logs WHERE resolved = 1 AND timestamp >= ?
      `);
      const resolved = resolvedStmt.get(cutoffDate).resolved;

      return {
        totalErrors: total,
        errorBreakdown: breakdown,
        resolvedCount: resolved,
      };
    } catch (error) {
      if (this.isDisabled) return { totalErrors: 0, errorBreakdown: [], resolvedCount: 0 };
      logger.warn(`Failed to get error stats: ${error.message}`);
      return { totalErrors: 0, errorBreakdown: [], resolvedCount: 0 };
    }
  }

  trackServerMetric(serverId, metricType, value) {
    try {
      if (this.isDisabled) return;

      const db = this.getDb();
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO server_analytics (server_id, metric_type, value, timestamp)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(serverId, metricType, value, new Date().toISOString());
    } catch (error) {
      if (this.isDisabled) return;
      logger.warn(`Failed to track server metric: ${error.message}`);
    }
  }

  getServerAnalytics(serverId, days = 30) {
    try {
      if (this.isDisabled) return [];

      const db = this.getDb();
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const stmt = db.prepare(`
        SELECT server_id, metric_type, value, timestamp
        FROM server_analytics
        WHERE server_id = ? AND timestamp >= ?
        ORDER BY timestamp DESC
      `);
      return stmt.all(serverId, cutoffDate);
    } catch (error) {
      if (this.isDisabled) return [];
      logger.warn(`Failed to get server analytics: ${error.message}`);
      return [];
    }
  }

  logBotEvent(eventType, uptimeSeconds = 0, reason = null) {
    try {
      if (this.isDisabled) return;

      const db = this.getDb();
      const stmt = db.prepare(`
        INSERT INTO bot_uptime (event_type, uptime_seconds, reason)
        VALUES (?, ?, ?)
      `);
      stmt.run(eventType, uptimeSeconds, reason);
    } catch (error) {
      if (this.isDisabled) return;
      logger.warn(`Failed to log bot event: ${error.message}`);
    }
  }

  getUptimeStats() {
    try {
      if (this.isDisabled) return { totalUptime: 0, totalDowntime: 0, restartCount: 0 };

      const db = this.getDb();

      // Get uptime totals
      const uptimeStmt = db.prepare(`
        SELECT SUM(uptime_seconds) as total_uptime FROM bot_uptime WHERE event_type = 'stop'
      `);
      const uptime = uptimeStmt.get().total_uptime || 0;

      // Get restart count
      const restartStmt = db.prepare(`
        SELECT COUNT(*) as restarts FROM bot_uptime WHERE event_type = 'restart'
      `);
      const restarts = restartStmt.get().restarts;

      // Calculate downtime (time between stops and starts)
      const downtimeStmt = db.prepare(`
        SELECT
          strftime('%s', timestamp) as timestamp_unix
        FROM bot_uptime
        WHERE event_type IN ('start', 'stop')
        ORDER BY timestamp DESC
        LIMIT 20
      `);
      const events = downtimeStmt.all();

      let downtime = 0;
      for (let i = 0; i < events.length - 1; i += 2) {
        if (events[i].timestamp_unix && events[i + 1]?.timestamp_unix) {
          downtime += events[i].timestamp_unix - events[i + 1].timestamp_unix;
        }
      }

      return {
        totalUptime: uptime,
        totalDowntime: Math.max(0, downtime),
        restartCount: restarts,
      };
    } catch (error) {
      if (this.isDisabled) return { totalUptime: 0, totalDowntime: 0, restartCount: 0 };
      logger.warn(`Failed to get uptime stats: ${error.message}`);
      return { totalUptime: 0, totalDowntime: 0, restartCount: 0 };
    }
  }

  // Enhanced user stats methods
  updateUserStats(userId, updates) {
    try {
      if (this.isDisabled) return;

      const db = this.getDb();

      // Atomic upsert to avoid race conditions
      const upsertStmt = db.prepare(`
        INSERT INTO user_stats (
          user_id, message_count, last_active, first_seen, total_summaries, total_commands, preferences
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          message_count = COALESCE(user_stats.message_count, 0) + ?,
          last_active = ?,
          total_summaries = COALESCE(user_stats.total_summaries, 0) + ?,
          total_commands = COALESCE(user_stats.total_commands, 0) + ?
      `);

      upsertStmt.run(
        userId,
        updates.message_count || 0,
        updates.last_active || new Date().toISOString(),
        new Date().toISOString(),
        updates.total_summaries || 0,
        updates.total_commands || 0,
        '{}',
        // UPDATE parameters
        updates.message_count || 0,
        updates.last_active || new Date().toISOString(),
        updates.total_summaries || 0,
        updates.total_commands || 0
      );
    } catch (error) {
      if (this.isDisabled) return;
      throw new Error(`Failed to update user stats for ${userId}: ${error.message}`);
    }
  }

  // Legacy methods for backward compatibility with tests
  getUserMessages(userId, limit = 10) {
    try {
      if (this.isDisabled) return [];

      const db = this.getDb();
      const stmt = db.prepare(`
        SELECT message FROM user_messages
        WHERE user_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `);
      const rows = stmt.all(userId, limit);
      return rows.map((row) => row.message);
    } catch (error) {
      if (this.isDisabled) return [];
      logger.warn(`Failed to get user messages for ${userId}: ${error.message}`);
      return [];
    }
  }

  addUserMessage(userId, message, responseTimeMs = 0) {
    try {
      if (this.isDisabled) return;

      const db = this.getDb();
      this.ensureUserExists(userId);

      // Add to legacy user_messages table
      const legacyStmt = db.prepare(`
        INSERT INTO user_messages (user_id, message)
        VALUES (?, ?)
      `);
      legacyStmt.run(userId, message);

      // Add to conversation_history table
      const conversationStmt = db.prepare(`
        INSERT INTO conversation_history (user_id, message, role, message_length, response_time_ms)
        VALUES (?, ?, 'user', ?, ?)
      `);
      conversationStmt.run(userId, message, message.length, responseTimeMs);

      // Update user stats
      this.updateUserStats(userId, { message_count: 1 });
    } catch (error) {
      if (this.isDisabled) return;
      throw new Error(`Failed to add user message for ${userId}: ${error.message}`);
    }
  }

  addBotResponse(userId, response, responseTimeMs = 0) {
    try {
      if (this.isDisabled) return;

      const db = this.getDb();
      this.ensureUserExists(userId);

      // Add to legacy user_messages table with [BOT] prefix
      const legacyStmt = db.prepare(`
        INSERT INTO user_messages (user_id, message)
        VALUES (?, ?)
      `);
      legacyStmt.run(userId, `[BOT] ${response}`);

      // Add to conversation_history table
      const conversationStmt = db.prepare(`
        INSERT INTO conversation_history (user_id, message, role, message_length, response_time_ms)
        VALUES (?, ?, 'assistant', ?, ?)
      `);
      conversationStmt.run(userId, response, response.length, responseTimeMs);
    } catch (error) {
      if (this.isDisabled) return;
      throw new Error(`Failed to add bot response for ${userId}: ${error.message}`);
    }
  }

  getConversationHistory(userId, limit = null) {
    try {
      if (this.isDisabled) return [];

      // Access config inside function to prevent circular dependencies
      const config = require('../config/config');
      const defaultLimit = limit || config.DATABASE_CONVERSATION_LIMIT || 20;

      const db = this.getDb();
      const stmt = db.prepare(`
        SELECT message, role, timestamp, message_length, response_time_ms
        FROM conversation_history
        WHERE user_id = ?
        ORDER BY timestamp ASC
        LIMIT ?
      `);
      const rows = stmt.all(userId, defaultLimit);
      return rows.map((row) => ({
        message: row.message,
        role: row.role,
        timestamp: row.timestamp,
        message_length: row.message_length,
        response_time_ms: row.response_time_ms,
      }));
    } catch (error) {
      if (this.isDisabled) return [];
      logger.warn(`Failed to get conversation history for ${userId}: ${error.message}`);
      return [];
    }
  }

  ensureUserExists(userId) {
    try {
      if (this.isDisabled) return;

      const db = this.getDb();
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO user_stats (user_id, message_count, last_active, first_seen, total_summaries, total_commands, preferences)
        VALUES (?, 0, ?, ?, 0, 0, '{}')
      `);
      const now = new Date().toISOString();
      stmt.run(userId, now, now);
    } catch (error) {
      if (this.isDisabled) return;
      logger.warn(`Failed to ensure user exists ${userId}: ${error.message}`);
    }
  }

  // Data export functionality
  exportUserData(userId) {
    try {
      if (this.isDisabled) return null;

      const exportData = {
        userId,
        exportDate: new Date().toISOString(),
        userStats: this.getUserStats(userId),
        conversationHistory: this.getConversationHistory(userId, 1000), // Last 1000 messages
        commandUsage: this._getUserCommandHistory(userId),
        errorLogs: this._getUserErrorHistory(userId),
      };

      return exportData;
    } catch (error) {
      if (this.isDisabled) return null;
      logger.warn(`Failed to export user data for ${userId}: ${error.message}`);
      return null;
    }
  }

  _getUserCommandHistory(userId, limit = 100) {
    try {
      if (this.isDisabled) return [];

      const db = this.getDb();
      const stmt = db.prepare(`
        SELECT command_name, server_id, timestamp, success, response_time_ms
        FROM command_usage
        WHERE user_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `);
      return stmt.all(userId, limit);
    } catch (error) {
      if (this.isDisabled) return [];
      return [];
    }
  }

  _getUserErrorHistory(userId, limit = 50) {
    try {
      if (this.isDisabled) return [];

      const db = this.getDb();
      const stmt = db.prepare(`
        SELECT error_type, error_message, command_name, timestamp
        FROM error_logs
        WHERE user_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `);
      return stmt.all(userId, limit);
    } catch (error) {
      if (this.isDisabled) return [];
      return [];
    }
  }

  clearUserData(userId) {
    try {
      if (this.isDisabled) return;

      const db = this.getDb();
      db.prepare('DELETE FROM user_stats WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM user_messages WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM conversation_history WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM command_usage WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM error_logs WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM reminders WHERE user_id = ?').run(userId);
    } catch (error) {
      if (this.isDisabled) return;
      throw new Error(`Failed to clear user data for ${userId}: ${error.message}`);
    }
  }

  // Clear only conversation data while preserving user stats
  clearUserConversationData(userId) {
    try {
      if (this.isDisabled) return;

      const db = this.getDb();
      // Clear conversation data but keep user stats
      db.prepare('DELETE FROM user_messages WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM conversation_history WHERE user_id = ?').run(userId);
    } catch (error) {
      if (this.isDisabled) return;
      throw new Error(`Failed to clear conversation data for ${userId}: ${error.message}`);
    }
  }

  // Test cleanup methods
  clearAllData() {
    try {
      if (this.isDisabled) return;

      const db = this.getDb();
      db.prepare('DELETE FROM user_stats').run();
      db.prepare('DELETE FROM user_messages').run();
      db.prepare('DELETE FROM conversation_history').run();
      db.prepare('DELETE FROM command_usage').run();
      db.prepare('DELETE FROM performance_metrics').run();
      db.prepare('DELETE FROM error_logs').run();
      db.prepare('DELETE FROM server_analytics').run();
      db.prepare('DELETE FROM bot_uptime').run();
      db.prepare('DELETE FROM reminders').run();
    } catch (error) {
      if (this.isDisabled) return;
      throw new Error(`Failed to clear all data: ${error.message}`);
    }
  }

  // Reminder management methods
  createReminder(
    userId,
    message,
    scheduledTime,
    timezone = 'UTC',
    channelId = null,
    serverId = null
  ) {
    try {
      if (this.isDisabled) return null;

      const db = this.getDb();
      this.ensureUserExists(userId);

      const stmt = db.prepare(`
        INSERT INTO reminders (user_id, message, scheduled_time, timezone, channel_id, server_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        userId,
        message,
        scheduledTime instanceof Date ? scheduledTime.toISOString() : scheduledTime,
        timezone,
        channelId,
        serverId
      );

      // Return the complete reminder object for test compatibility
      const selectStmt = db.prepare('SELECT * FROM reminders WHERE id = ?');
      return selectStmt.get(result.lastInsertRowid);
    } catch (error) {
      if (this.isDisabled) return null;
      throw new Error(`Failed to create reminder for ${userId}: ${error.message}`);
    }
  }

  getReminder(reminderId) {
    try {
      if (this.isDisabled) return null;

      const db = this.getDb();
      const stmt = db.prepare('SELECT * FROM reminders WHERE id = ?');
      return stmt.get(reminderId);
    } catch (error) {
      if (this.isDisabled) return null;
      logger.warn(`Failed to get reminder ${reminderId}: ${error.message}`);
      return null;
    }
  }

  getActiveReminders(userId = null) {
    try {
      if (this.isDisabled) return [];

      const db = this.getDb();
      let stmt;

      if (userId) {
        stmt = db.prepare(`
          SELECT * FROM reminders
          WHERE user_id = ? AND status = 'active' AND datetime(scheduled_time) > datetime('now')
          ORDER BY scheduled_time ASC
        `);
        return stmt.all(userId);
      } else {
        stmt = db.prepare(`
          SELECT * FROM reminders
          WHERE status = 'active' AND datetime(scheduled_time) > datetime('now')
          ORDER BY scheduled_time ASC
        `);
        return stmt.all();
      }
    } catch (error) {
      if (this.isDisabled) return [];
      logger.warn(`Failed to get active reminders: ${error.message}`);
      return [];
    }
  }

  getDueReminders() {
    try {
      if (this.isDisabled) return [];

      const db = this.getDb();
      const stmt = db.prepare(`
        SELECT * FROM reminders
        WHERE status = 'active' AND datetime(scheduled_time) <= datetime('now')
        ORDER BY scheduled_time ASC
      `);
      return stmt.all();
    } catch (error) {
      if (this.isDisabled) return [];
      logger.warn(`Failed to get due reminders: ${error.message}`);
      return [];
    }
  }

  completeReminder(reminderId) {
    try {
      if (this.isDisabled) return false;

      const db = this.getDb();
      const stmt = db.prepare(`
        UPDATE reminders SET status = 'completed' WHERE id = ?
      `);
      const result = stmt.run(reminderId);
      return result.changes > 0;
    } catch (error) {
      if (this.isDisabled) return false;
      logger.warn(`Failed to complete reminder ${reminderId}: ${error.message}`);
      return false;
    }
  }

  cancelReminder(reminderId, userId) {
    try {
      if (this.isDisabled) return false;

      const db = this.getDb();
      const stmt = db.prepare(`
        UPDATE reminders SET status = 'cancelled'
        WHERE id = ? AND user_id = ? AND status = 'active'
      `);
      const result = stmt.run(reminderId, userId);
      return result.changes > 0;
    } catch (error) {
      if (this.isDisabled) return false;
      logger.warn(`Failed to cancel reminder ${reminderId}: ${error.message}`);
      return false;
    }
  }

  getUserReminders(userId, includeCompleted = false) {
    try {
      if (this.isDisabled) return [];

      const db = this.getDb();
      let stmt;

      if (includeCompleted) {
        stmt = db.prepare(`
          SELECT * FROM reminders
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT 50
        `);
      } else {
        stmt = db.prepare(`
          SELECT * FROM reminders
          WHERE user_id = ? AND status = 'active'
          ORDER BY datetime(scheduled_time) ASC
        `);
      }

      return stmt.all(userId);
    } catch (error) {
      if (this.isDisabled) return [];
      logger.warn(`Failed to get reminders for user ${userId}: ${error.message}`);
      return [];
    }
  }

  deleteReminder(reminderId, userId) {
    try {
      if (this.isDisabled) return false;

      const db = this.getDb();
      const stmt = db.prepare(`
        DELETE FROM reminders WHERE id = ? AND user_id = ?
      `);
      const result = stmt.run(reminderId, userId);
      return result.changes > 0;
    } catch (error) {
      if (this.isDisabled) return false;
      logger.warn(`Failed to delete reminder ${reminderId}: ${error.message}`);
      return false;
    }
  }

  close() {
    if (this.db && !this.isDisabled) {
      try {
        this.db.close();
        this.db = null;
      } catch (error) {
        throw new Error(`Failed to close database: ${error.message}`);
      }
    }
  }
}

const databaseService = new DatabaseService();
module.exports = databaseService;
module.exports.DatabaseService = DatabaseService;
module.exports.default = databaseService;
