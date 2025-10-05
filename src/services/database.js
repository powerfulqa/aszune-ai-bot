let Database;
try {
  Database = require('better-sqlite3');
} catch (error) {
  // Graceful fallback for tests or when better-sqlite3 is not installed
  Database = null;
}
const path = require('path');

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
      // User stats table
      db.exec(`
        CREATE TABLE IF NOT EXISTS user_stats (
          user_id TEXT PRIMARY KEY,
          message_count INTEGER DEFAULT 0,
          last_active DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Conversation history table (with foreign key and proper indexing)
      db.exec(`
        CREATE TABLE IF NOT EXISTS conversation_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          message TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES user_stats (user_id) ON DELETE CASCADE
        )
      `);

      // User messages table (with proper indexing and constraints)
      db.exec(`
        CREATE TABLE IF NOT EXISTS user_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          message TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES user_stats (user_id) ON DELETE CASCADE
        );
        CREATE TRIGGER IF NOT EXISTS limit_user_messages
        AFTER INSERT ON user_messages
        BEGIN
          DELETE FROM user_messages WHERE user_id = NEW.user_id AND id NOT IN (
            SELECT id FROM user_messages WHERE user_id = NEW.user_id ORDER BY timestamp DESC LIMIT 10
          );
        END;
      `);

      // Create indexes for performance optimization
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_user_messages_user_id_timestamp ON user_messages (user_id, timestamp);
        CREATE INDEX IF NOT EXISTS idx_conversation_history_user_id ON conversation_history (user_id);
      `);
    } catch (error) {
      throw new Error(`Failed to initialize database tables: ${error.message}`);
    }
  }

  // Stats methods
  getUserStats(userId) {
    try {
      const db = this.getDb();
      const stmt = db.prepare('SELECT * FROM user_stats WHERE user_id = ?');
      return stmt.get(userId) || { user_id: userId, message_count: 0, last_active: null };
    } catch (error) {
      if (this.isDisabled) {
        return { user_id: userId, message_count: 0, last_active: null };
      }
      throw new Error(`Failed to get user stats for ${userId}: ${error.message}`);
    }
  }

  updateUserStats(userId, updates) {
    try {
      if (this.isDisabled) return;

      const db = this.getDb();

      // Get existing stats
      const existing = this.getUserStats(userId);

      // Calculate new values
      const newMessageCount = existing.message_count + (updates.message_count || 0);
      const newLastActive = updates.last_active || new Date().toISOString();

      // Insert or update
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO user_stats (user_id, message_count, last_active)
        VALUES (?, ?, ?)
      `);
      stmt.run(userId, newMessageCount, newLastActive);
    } catch (error) {
      if (this.isDisabled) return;
      throw new Error(`Failed to update user stats for ${userId}: ${error.message}`);
    }
  }

  // Messages methods
  getUserMessages(userId, limit = 10) {
    try {
      const db = this.getDb();
      const stmt = db.prepare(
        'SELECT message FROM user_messages WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?'
      );
      return stmt.all(userId, limit).map((row) => row.message);
    } catch (error) {
      if (this.isDisabled) return [];
      throw new Error(`Failed to get user messages for ${userId}: ${error.message}`);
    }
  }

  ensureUserExists(userId) {
    if (this.isDisabled) return;

    try {
      const db = this.getDb();

      // Check if user exists, if not create them
      const checkStmt = db.prepare('SELECT user_id FROM user_stats WHERE user_id = ?');
      const existingUser = checkStmt.get(userId);

      if (!existingUser) {
        const insertStmt = db.prepare(`
          INSERT OR IGNORE INTO user_stats 
          (user_id, message_count, last_active) 
          VALUES (?, 0, ?)
        `);
        const now = new Date().toISOString();
        insertStmt.run(userId, now);
      }
    } catch (error) {
      if (this.isDisabled) return;
      // Don't throw error, just log warning as this is a helper method
      console.warn(`Failed to ensure user exists for ${userId}: ${error.message}`);
    }
  }

  addUserMessage(userId, message) {
    try {
      if (this.isDisabled) return;

      const db = this.getDb();

      // Ensure user exists first for foreign key constraint
      this.ensureUserExists(userId);

      // Add to conversation history with proper role
      const conversationStmt = db.prepare(
        'INSERT INTO conversation_history (user_id, message, role, timestamp) VALUES (?, ?, ?, ?)'
      );
      conversationStmt.run(userId, message, 'user', new Date().toISOString());

      // Also add to user_messages for backward compatibility
      const stmt = db.prepare(
        'INSERT INTO user_messages (user_id, message, timestamp) VALUES (?, ?, ?)'
      );
      stmt.run(userId, message, new Date().toISOString());
    } catch (error) {
      if (this.isDisabled) return;
      throw new Error(`Failed to add user message for ${userId}: ${error.message}`);
    }
  }

  addBotResponse(userId, response) {
    try {
      if (this.isDisabled) return;

      const db = this.getDb();

      // Ensure user exists first for foreign key constraint
      this.ensureUserExists(userId);

      // Add to conversation history with proper role
      const conversationStmt = db.prepare(
        'INSERT INTO conversation_history (user_id, message, role, timestamp) VALUES (?, ?, ?, ?)'
      );
      conversationStmt.run(userId, response, 'assistant', new Date().toISOString());

      // Store bot responses with role prefix for backward compatibility
      const stmt = db.prepare(
        'INSERT INTO user_messages (user_id, message, timestamp) VALUES (?, ?, ?)'
      );
      stmt.run(userId, `[BOT] ${response}`, new Date().toISOString());
    } catch (error) {
      if (this.isDisabled) return;
      throw new Error(`Failed to add bot response for ${userId}: ${error.message}`);
    }
  }

  getConversationHistory(userId, limit = 20) {
    try {
      if (this.isDisabled) return [];

      const db = this.getDb();
      const stmt = db.prepare(
        'SELECT message, role, timestamp FROM conversation_history WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?'
      );
      return stmt.all(userId, limit).reverse(); // Return in chronological order
    } catch (error) {
      if (this.isDisabled) return [];
      throw new Error(`Failed to get conversation history for ${userId}: ${error.message}`);
    }
  }

  clearUserData(userId) {
    try {
      if (this.isDisabled) return;

      const db = this.getDb();
      db.prepare('DELETE FROM user_stats WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM user_messages WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM conversation_history WHERE user_id = ?').run(userId);
    } catch (error) {
      if (this.isDisabled) return;
      throw new Error(`Failed to clear user data for ${userId}: ${error.message}`);
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
    } catch (error) {
      if (this.isDisabled) return;
      throw new Error(`Failed to clear all data: ${error.message}`);
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
