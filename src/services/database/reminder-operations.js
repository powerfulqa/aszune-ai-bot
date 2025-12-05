const { getRemindersWithFilter } = require('../../utils/db-query-helpers');

function normalizeScheduledTime(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

function createReminder(db, { userId, message, scheduledTime, timezone, channelId, serverId }) {
  const stmt = db.prepare(`
    INSERT INTO reminders (user_id, message, scheduled_time, timezone, channel_id, server_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    userId,
    message,
    normalizeScheduledTime(scheduledTime),
    timezone,
    channelId,
    serverId
  );

  const selectStmt = db.prepare('SELECT * FROM reminders WHERE id = ?');
  return selectStmt.get(result.lastInsertRowid);
}

function getReminder(db, reminderId) {
  const stmt = db.prepare('SELECT * FROM reminders WHERE id = ?');
  return stmt.get(reminderId);
}

function getActiveReminders(db, userId = null) {
  return getRemindersWithFilter(
    db,
    userId,
    "status = 'active' AND datetime(scheduled_time) > datetime('now')",
    'scheduled_time ASC'
  );
}

function getAllReminders(db, userId = null) {
  return getRemindersWithFilter(db, userId, '', 'scheduled_time DESC');
}

function getDueReminders(db) {
  const stmt = db.prepare(`
    SELECT * FROM reminders
    WHERE status = 'active' AND datetime(scheduled_time) <= datetime('now')
    ORDER BY scheduled_time ASC
  `);
  return stmt.all();
}

function completeReminder(db, reminderId) {
  const stmt = db.prepare(`
    UPDATE reminders SET status = 'completed' WHERE id = ?
  `);
  const result = stmt.run(reminderId);
  return result.changes > 0;
}

function cancelReminder(db, reminderId, userId) {
  const stmt = db.prepare(`
    UPDATE reminders SET status = 'cancelled'
    WHERE id = ? AND user_id = ? AND status = 'active'
  `);
  const result = stmt.run(reminderId, userId);
  return result.changes > 0;
}

function getUserReminders(db, userId, includeCompleted = false) {
  if (includeCompleted) {
    const stmt = db.prepare(`
      SELECT * FROM reminders
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `);
    return stmt.all(userId);
  }

  const stmt = db.prepare(`
    SELECT * FROM reminders
    WHERE user_id = ? AND status = 'active'
    ORDER BY datetime(scheduled_time) ASC
  `);
  return stmt.all(userId);
}

function deleteReminder(db, reminderId, userId) {
  const stmt = db.prepare(`
    DELETE FROM reminders WHERE id = ? AND user_id = ?
  `);
  const result = stmt.run(reminderId, userId);
  return result.changes > 0;
}

function getUserReminderCount(db, userId) {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM reminders
    WHERE user_id = ? AND status = 'active'
  `);
  const result = stmt.get(userId);
  return result ? result.count : 0;
}

function getReminderStats(db) {
  const totalStmt = db.prepare('SELECT COUNT(*) as count FROM reminders');
  const total = totalStmt.get().count;

  const statusStmt = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM reminders
    GROUP BY status
  `);
  const statusResults = statusStmt.all();

  const stats = {
    totalReminders: total,
    activeReminders: 0,
    completedReminders: 0,
    cancelledReminders: 0,
  };

  mapStatusCounts(statusResults, stats);
  return stats;
}

function getDefaultReminderStats() {
  return {
    totalReminders: 0,
    activeReminders: 0,
    completedReminders: 0,
    cancelledReminders: 0,
  };
}

function mapStatusCounts(statusResults, stats) {
  statusResults.forEach((row) => {
    if (row.status === 'active') stats.activeReminders = row.count;
    if (row.status === 'completed') stats.completedReminders = row.count;
    if (row.status === 'cancelled') stats.cancelledReminders = row.count;
  });
}

module.exports = {
  createReminder,
  getReminder,
  getActiveReminders,
  getAllReminders,
  getDueReminders,
  completeReminder,
  cancelReminder,
  getUserReminders,
  deleteReminder,
  getUserReminderCount,
  getReminderStats,
  getDefaultReminderStats,
  _test: {
    mapStatusCounts,
  },
};
