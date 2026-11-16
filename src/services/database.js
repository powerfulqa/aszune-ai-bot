const path = require('path');
const logger = require('../utils/logger');

let Database;
try {
  Database = require('better-sqlite3');
} catch (error) {
  // The bot runs without it (history, stats and reminders are then off), but
  // say so: a native module that no longer loads after a Node upgrade would
  // otherwise look like an empty database.
  Database = null;
  logger.error(`better-sqlite3 failed to load, database features are disabled: ${error.message}`);
}

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
    // WAL appends to one log file instead of creating and deleting a rollback
    // journal for every write, which matters on SD-card storage. synchronous
    // stays FULL so a power cut cannot lose a committed reminder. Copy
    // bot.db-wal and bot.db-shm along with bot.db when backing up a running bot.
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = FULL');
    this.initTables();
    // Several rows are written per chat message and nothing reads them back
    // beyond the dashboard table view; keep a week.
    this.db.exec("DELETE FROM performance_metrics WHERE timestamp < datetime('now', '-7 days')");
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
      throw new Error(`${errorContext}: ${error.message}`, { cause: error });
    }
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
        throw new Error(`Failed to initialize database: ${error.message}`, { cause: error });
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
      throw new Error(`Failed to initialize database tables: ${error.message}`, { cause: error });
    }
  }

  // Stats methods
  getUserStats(userId) {
    return this._executeSqlStrict((db) => {
      const stats = userOperations.getUserStats(db, userId);
      return stats || { ...this._getDefaultStats('user'), user_id: userId };
    }, `Failed to get user stats for ${userId}`);
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

  updateReminder(reminderId, userId, changes) {
    return this._executeSqlStrict(
      (db) => reminderOperations.updateReminder(db, reminderId, userId, changes),
      `Failed to update reminder ${reminderId}`
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
        throw new Error(`Failed to close database: ${error.message}`, { cause: error });
      }
    }
  }
}

const databaseService = new DatabaseService();
module.exports = databaseService;
module.exports.DatabaseService = DatabaseService;
module.exports.default = databaseService;
