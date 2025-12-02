const logger = require('../../utils/logger');

const schemaAttempts = [
  {
    sql: 'INSERT OR IGNORE INTO user_stats (user_id, message_count, last_active, first_seen, total_summaries, total_commands, preferences, username) VALUES (?, 0, ?, ?, 0, 0, \'{}\', ?)',
    params: (userId, now, username) => [userId, now, now, username],
  },
  {
    sql: 'INSERT OR IGNORE INTO user_stats (user_id, message_count, last_active, first_seen, total_summaries, total_commands, preferences) VALUES (?, 0, ?, ?, 0, 0, \'{}\')',
    params: (userId, now) => [userId, now, now],
  },
  {
    sql: 'INSERT OR IGNORE INTO user_stats (user_id, message_count, last_active, total_summaries, total_commands, preferences) VALUES (?, 0, ?, 0, 0, \'{}\')',
    params: (userId, now) => [userId, now],
  },
  {
    sql: 'INSERT OR IGNORE INTO user_stats (user_id) VALUES (?)',
    params: (userId) => [userId],
  },
];

function getUserStats(db, userId) {
  const stmt = db.prepare('SELECT * FROM user_stats WHERE user_id = ?');
  return stmt.get(userId);
}

function upsertUserStats(db, userId, updates) {
  const stmt = db.prepare(`
    INSERT INTO user_stats (
      user_id, message_count, last_active, first_seen, total_summaries, total_commands, preferences, username
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      message_count = COALESCE(user_stats.message_count, 0) + ?,
      last_active = ?,
      total_summaries = COALESCE(user_stats.total_summaries, 0) + ?,
      total_commands = COALESCE(user_stats.total_commands, 0) + ?,
      username = COALESCE(?, user_stats.username)
  `);

  stmt.run(
    userId,
    updates.message_count || 0,
    updates.last_active || new Date().toISOString(),
    new Date().toISOString(),
    updates.total_summaries || 0,
    updates.total_commands || 0,
    '{}',
    updates.username || null,
    updates.message_count || 0,
    updates.last_active || new Date().toISOString(),
    updates.total_summaries || 0,
    updates.total_commands || 0,
    updates.username || null
  );
}

function updateUsername(db, userId, username) {
  db.prepare('UPDATE user_stats SET username = ? WHERE user_id = ?').run(username, userId);
}

function ensureUserExists(db, userId, username = null) {
  const now = new Date().toISOString();
  let success = false;

  try {
    for (const attempt of schemaAttempts) {
      try {
        const stmt = db.prepare(attempt.sql);
        stmt.run(...attempt.params(userId, now, username));
        success = true;
        break;
      } catch (columnError) {
        continue;
      }
    }

    if (!success) {
      logger.warn(`All schema attempts failed for user ${userId}`);
    }
  } catch (error) {
    logger.warn(`Failed to ensure user exists ${userId}: ${error.message}`);
  }
}

function addUserMessage(db, { userId, message, responseTimeMs }) {
  db.prepare('INSERT INTO user_messages (user_id, message) VALUES (?, ?)').run(userId, message);
  db.prepare(
    'INSERT INTO conversation_history (user_id, message, role, message_length, response_time_ms) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, message, 'user', message.length, responseTimeMs);
}

function addBotResponse(db, { userId, response, responseTimeMs }) {
  db.prepare('INSERT INTO user_messages (user_id, message) VALUES (?, ?)').run(
    userId,
    `[BOT] ${response}`
  );
  db.prepare(
    'INSERT INTO conversation_history (user_id, message, role, message_length, response_time_ms) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, response, 'assistant', response.length, responseTimeMs);
}

function getConversationHistory(db, userId, limit) {
  const stmt = db.prepare(`
    SELECT message, role, timestamp, message_length, response_time_ms FROM conversation_history
    WHERE user_id = ? ORDER BY timestamp ASC LIMIT ?
  `);
  return stmt.all(userId, limit).map((row) => ({
    message: row.message,
    role: row.role,
    timestamp: row.timestamp,
    message_length: row.message_length,
    response_time_ms: row.response_time_ms,
  }));
}

module.exports = {
  getUserStats,
  upsertUserStats,
  updateUsername,
  ensureUserExists,
  addUserMessage,
  addBotResponse,
  getConversationHistory,
};
