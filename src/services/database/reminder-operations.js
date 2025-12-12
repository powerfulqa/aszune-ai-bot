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
    total: total,
    active: 0,
    completed: 0,
    cancelled: 0,
    nextDue: null,
  };

  // Map status counts
  statusResults.forEach((row) => {
    if (row.status === 'active') stats.active = row.count;
    if (row.status === 'completed') stats.completed = row.count;
    if (row.status === 'cancelled') stats.cancelled = row.count;
  });

  // Get next due reminder
  const nextStmt = db.prepare(`
    SELECT id, message, scheduled_time
    FROM reminders
    WHERE status = 'active'
    ORDER BY datetime(scheduled_time) ASC
    LIMIT 1
  `);
  const nextReminder = nextStmt.get();
  if (nextReminder) {
    const scheduledDate = new Date(nextReminder.scheduled_time);
    stats.nextDue = formatDateForDisplay(scheduledDate);
  }

  return stats;
}

function formatDateForDisplay(date) {
  if (!date) return 'None';
  const now = new Date();
  const diffMs = date - now;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) {
    return 'Overdue';
  } else if (diffMs < 3600000) {
    // Less than 1 hour
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes}m`;
  } else if (diffHours < 24) {
    return `${diffHours}h`;
  } else if (diffDays < 7) {
    return `${diffDays}d`;
  } else {
    // Show date in readable format
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
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
};
