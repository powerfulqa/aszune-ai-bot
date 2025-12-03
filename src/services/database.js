let Database;
try {
  Database = require('better-sqlite3');
} catch (error) {
  // Graceful fallback for tests or when better-sqlite3 is not installed
  Database = null;
}
const path = require('path');
const logger = require('../utils/logger');
const schema = require('./database/schema');
const reminderOperations = require('./database/reminder-operations');
const userOperations = require('./database/user-operations');

class DatabaseService {
  constructor() {
    this.dbPath = null;
    this.db = null;
    this.isDisabled = !Database;
  }

  /**
   * Get mock database for disabled/test scenarios
   * @private
   */
  _getMockDatabase() {
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

  /**
   * Initialize database connection
   * @private
   */
  _initializeDatabase() {
    if (!this.dbPath) {
      const config = require('../config/config');
      this.dbPath = path.resolve(config.DB_PATH || './data/bot.db');
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = DELETE');
    this.db.pragma('synchronous = FULL');
    this.initTables();
  }

  /**
   * Execute database operation with error handling
   * @private
   */
  _executeSql(operation, defaultValue = null) {
    try {
      if (this.isDisabled) return defaultValue;
      return operation(this.getDb());
    } catch (error) {
      logger.warn(`Database operation error: ${error.message}`);
      return defaultValue;
    }
  }

  /**
   * Execute database operation and throw on error
   * @private
   */
  _executeSqlStrict(operation, errorContext) {
    try {
      if (this.isDisabled) return null;
      return operation(this.getDb());
    } catch (error) {
      throw new Error(`${errorContext}: ${error.message}`);
    }
  }

  /**
   * Generic data clearing for tables
   * @private
   */
  _clearTableData(tableNames) {
    return this._executeSql((db) => {
      const tables = Array.isArray(tableNames) ? tableNames : [tableNames];
      tables.forEach((table) => {
        db.prepare(`DELETE FROM ${table}`).run();
      });
    });
  }

  /**
   * Get default return value for stats
   * @private
   */
  _getDefaultStats(statsType) {
    const defaults = {
      user: {
        user_id: null,
        message_count: 0,
        last_active: null,
        first_seen: null,
        total_summaries: 0,
        total_commands: 0,
        preferences: '{}',
        username: null,
      },
      commands: { totalCommands: 0, commandBreakdown: [], successRate: 100 },
      uptime: { totalUptime: 0, totalDowntime: 0, restartCount: 0 },
      analytics: [],
      metrics: [],
    };
    return defaults[statsType] || null;
  }

  getDb() {
    if (this.isDisabled) {
      return this._getMockDatabase();
    }

    if (!this.db) {
      try {
        this._initializeDatabase();
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
      schema.initializeTables(db);
      schema.createIndexes(db);
      schema.ensureTriggers(db);
      schema.runMigrations(db);
    } catch (error) {
      throw new Error(`Failed to initialize database tables: ${error.message}`);
    }
  }

  // Stats methods
  getUserStats(userId) {
    return this._executeSqlStrict((db) => {
      const stats = userOperations.getUserStats(db, userId);
      return stats || { ...this._getDefaultStats('user'), user_id: userId };
    }, `Failed to get user stats for ${userId}`);
  }

  // Analytics methods
  trackCommandUsage(userId, commandName, serverId = null, success = true, responseTimeMs = 0) {
    return this._executeSql((db) => {
      this.ensureUserExists(userId);
      db.prepare(
        `
        INSERT INTO command_usage (user_id, command_name, server_id, success, response_time_ms)
        VALUES (?, ?, ?, ?, ?)
      `
      ).run(userId, commandName, serverId, success ? 1 : 0, responseTimeMs);
      this.updateUserStats(userId, { total_commands: 1 });
    });
  }

  getCommandUsageStats(days = 7) {
    return this._executeSql((db) => {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const total = db
        .prepare('SELECT COUNT(*) as total FROM command_usage WHERE timestamp >= ?')
        .get(cutoffDate).total;
      const breakdown = db
        .prepare(
          `
          SELECT command_name, COUNT(*) as count FROM command_usage WHERE timestamp >= ? 
          GROUP BY command_name ORDER BY count DESC LIMIT 10
        `
        )
        .all(cutoffDate);

      const successData = db
        .prepare(
          `
          SELECT COUNT(CASE WHEN success = 1 THEN 1 END) as successful, COUNT(*) as total 
          FROM command_usage WHERE timestamp >= ?
        `
        )
        .get(cutoffDate);

      const successRate =
        successData.total > 0
          ? Math.round((successData.successful / successData.total) * 10000) / 100
          : 100;

      return { totalCommands: total, commandBreakdown: breakdown, successRate };
    }, this._getDefaultStats('commands'));
  }

  logPerformanceMetric(metricType, value, metadata = {}) {
    return this._executeSql((db) => {
      db.prepare(
        `
        INSERT INTO performance_metrics (metric_type, value, metadata)
        VALUES (?, ?, ?)
      `
      ).run(metricType, value, JSON.stringify(metadata));
    });
  }

  getPerformanceMetrics(metricType, hours = 24) {
    return this._executeSql(
      (db) =>
        db
          .prepare(
            `
        SELECT value, timestamp, metadata
        FROM performance_metrics
        WHERE metric_type = ? AND timestamp >= datetime('now', '-${hours} hours')
        ORDER BY timestamp DESC
      `
          )
          .all(metricType),
      []
    );
  }

  logError(errorType, errorMessage, userId = null, commandName = null, stackTrace = null) {
    return this._executeSql((db) => {
      db.prepare(
        `
        INSERT INTO error_logs (error_type, error_message, user_id, command_name, stack_trace)
        VALUES (?, ?, ?, ?, ?)
      `
      ).run(errorType, errorMessage, userId, commandName, stackTrace);
    });
  }

  getErrorStats(days = 7) {
    return this._executeSql(
      (db) => {
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const total = db
          .prepare('SELECT COUNT(*) as total FROM error_logs WHERE timestamp >= ?')
          .get(cutoffDate).total;
        const breakdown = db
          .prepare(
            `
        SELECT error_type, COUNT(*) as count FROM error_logs WHERE timestamp >= ? GROUP BY error_type ORDER BY count DESC LIMIT 10
      `
          )
          .all(cutoffDate);
        const resolved = db
          .prepare(
            'SELECT COUNT(*) as resolved FROM error_logs WHERE resolved = 1 AND timestamp >= ?'
          )
          .get(cutoffDate).resolved;
        return { totalErrors: total, errorBreakdown: breakdown, resolvedCount: resolved };
      },
      { totalErrors: 0, errorBreakdown: [], resolvedCount: 0 }
    );
  }

  trackServerMetric(serverId, metricType, value) {
    return this._executeSql((db) => {
      db.prepare(
        `
        INSERT OR REPLACE INTO server_analytics (server_id, metric_type, value, timestamp)
        VALUES (?, ?, ?, ?)
      `
      ).run(serverId, metricType, value, new Date().toISOString());
    });
  }

  getServerAnalytics(serverId, days = 30) {
    return this._executeSql((db) => {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      return db
        .prepare(
          `
          SELECT server_id, metric_type, value, timestamp FROM server_analytics
          WHERE server_id = ? AND timestamp >= ? ORDER BY timestamp DESC
        `
        )
        .all(serverId, cutoffDate);
    }, []);
  }

  logBotEvent(eventType, uptimeSeconds = 0, reason = null) {
    return this._executeSql((db) => {
      db.prepare(
        `
        INSERT INTO bot_uptime (event_type, uptime_seconds, reason)
        VALUES (?, ?, ?)
      `
      ).run(eventType, uptimeSeconds, reason);
    });
  }

  getUptimeStats() {
    return this._executeSql(
      (db) => {
        const uptime =
          db
            .prepare(
              'SELECT SUM(uptime_seconds) as total_uptime FROM bot_uptime WHERE event_type = ?'
            )
            .get('stop').total_uptime || 0;
        const restarts = db
          .prepare('SELECT COUNT(*) as restarts FROM bot_uptime WHERE event_type = ?')
          .get('restart').restarts;
        const events = db
          .prepare(
            `
        SELECT strftime('%s', timestamp) as timestamp_unix FROM bot_uptime
        WHERE event_type IN ('start', 'stop') ORDER BY timestamp DESC LIMIT 20
      `
          )
          .all();
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
      },
      { totalUptime: 0, totalDowntime: 0, restartCount: 0 }
    );
  }

  // Enhanced user stats methods
  updateUserStats(userId, updates) {
    return this._executeSqlStrict(
      (db) => userOperations.upsertUserStats(db, userId, updates),
      `Failed to update user stats for ${userId}`
    );
  }

  updateUsername(userId, username) {
    return this._executeSql((db) => userOperations.updateUsername(db, userId, username));
  }

  getUserMessages(userId, limit = 10) {
    return this._executeSql((db) => {
      const rows = db
        .prepare(
          'SELECT message FROM user_messages WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?'
        )
        .all(userId, limit);
      return rows.map((row) => row.message);
    }, []);
  }

  addUserMessage(userId, message, responseTimeMs = 0, username = null) {
    return this._executeSqlStrict((db) => {
      userOperations.ensureUserExists(db, userId, username);
      if (username) userOperations.updateUsername(db, userId, username);
      userOperations.addUserMessage(db, { userId, message, responseTimeMs });
      this.updateUserStats(userId, { message_count: 1 });
    }, `Failed to add user message for ${userId}`);
  }

  addBotResponse(userId, response, responseTimeMs = 0) {
    return this._executeSql((db) => {
      userOperations.ensureUserExists(db, userId);
      userOperations.addBotResponse(db, { userId, response, responseTimeMs });
    });
  }

  getConversationHistory(userId, limit = null) {
    return this._executeSql((db) => {
      const config = require('../config/config');
      const defaultLimit = limit || config.DATABASE_CONVERSATION_LIMIT || 20;
      return userOperations.getConversationHistory(db, userId, defaultLimit);
    }, []);
  }

  ensureUserExists(userId, username = null) {
    if (this.isDisabled) return;

    const db = this.getDb();
    userOperations.ensureUserExists(db, userId, username);
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
    return this._executeSqlStrict((db) => {
      const tables = [
        'user_stats',
        'user_messages',
        'conversation_history',
        'command_usage',
        'error_logs',
        'reminders',
      ];
      tables.forEach((table) => {
        db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
      });
    }, `Failed to clear user data for ${userId}`);
  }

  clearUserConversationData(userId) {
    return this._executeSql((db) => {
      db.prepare('DELETE FROM user_messages WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM conversation_history WHERE user_id = ?').run(userId);
    });
  }

  clearAllData() {
    return this._executeSql(() => {
      this._clearTableData([
        'user_stats',
        'user_messages',
        'conversation_history',
        'command_usage',
        'performance_metrics',
        'error_logs',
        'server_analytics',
        'bot_uptime',
        'reminders',
      ]);
    });
  }

  // Reminder management methods
  /**
   * Create a reminder
   * @param {string} userId - User ID
   * @param {string} message - Reminder message
   * @param {Date|string} scheduledTime - When to trigger the reminder
   * @param {Object} [options={}] - Additional options
   * @param {string} [options.timezone='UTC'] - Timezone
   * @param {string} [options.channelId=null] - Channel ID
   * @param {string} [options.serverId=null] - Server ID
   * @returns {Object} Created reminder
   */
  createReminder(userId, message, scheduledTime, options = {}) {
    const { timezone = 'UTC', channelId = null, serverId = null } = options;
    return this._executeSqlStrict((db) => {
      userOperations.ensureUserExists(db, userId);
      return reminderOperations.createReminder(db, {
        userId,
        message,
        scheduledTime,
        timezone,
        channelId,
        serverId,
      });
    }, `Failed to create reminder for ${userId}`);
  }

  getReminder(reminderId) {
    return this._executeSql((db) => reminderOperations.getReminder(db, reminderId), null);
  }

  getActiveReminders(userId = null) {
    return this._executeSql((db) => reminderOperations.getActiveReminders(db, userId), []);
  }

  getAllReminders(userId = null) {
    return this._executeSql((db) => reminderOperations.getAllReminders(db, userId), []);
  }

  getDueReminders() {
    return this._executeSql((db) => reminderOperations.getDueReminders(db), []);
  }

  completeReminder(reminderId) {
    return this._executeSql((db) => reminderOperations.completeReminder(db, reminderId), false);
  }

  cancelReminder(reminderId, userId) {
    return this._executeSql(
      (db) => reminderOperations.cancelReminder(db, reminderId, userId),
      false
    );
  }

  getUserReminders(userId, includeCompleted = false) {
    return this._executeSql(
      (db) => reminderOperations.getUserReminders(db, userId, includeCompleted),
      []
    );
  }

  deleteReminder(reminderId, userId) {
    return this._executeSql(
      (db) => reminderOperations.deleteReminder(db, reminderId, userId),
      false
    );
  }

  /**
   * Get reminder count for a specific user
   * @param {string} userId - User ID
   * @returns {number} Number of active reminders for the user
   */
  getUserReminderCount(userId) {
    return this._executeSql((db) => reminderOperations.getUserReminderCount(db, userId), 0);
  }

  /**
   * Get overall reminder statistics
   * @returns {Object} Reminder statistics
   */
  getReminderStats() {
    return this._executeSql(
      (db) => reminderOperations.getReminderStats(db),
      reminderOperations.getDefaultReminderStats()
    );
  }

  /**
   * Expose default reminder stats for legacy tests
   */
  _getDefaultReminderStats() {
    return reminderOperations.getDefaultReminderStats();
  }

  _mapStatusCounts(statusResults, stats) {
    reminderOperations._test.mapStatusCounts(statusResults, stats);
  }

  /**
   * Get total user count
   * @returns {number} Total number of users
   */
  getUserCount() {
    try {
      if (this.isDisabled) return 0;

      const db = this.getDb();
      const stmt = db.prepare('SELECT COUNT(*) as count FROM user_stats');
      const result = stmt.get();
      return result ? result.count : 0;
    } catch (error) {
      if (this.isDisabled) return 0;
      logger.warn(`Failed to get user count: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get total message count across all conversations
   * @returns {number} Total number of messages
   */
  getTotalMessageCount() {
    try {
      if (this.isDisabled) return 0;

      const db = this.getDb();
      const stmt = db.prepare('SELECT COUNT(*) as count FROM conversation_history');
      const result = stmt.get();
      return result ? result.count : 0;
    } catch (error) {
      if (this.isDisabled) return 0;
      logger.warn(`Failed to get total message count: ${error.message}`);
      return 0;
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
