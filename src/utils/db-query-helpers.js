/**
 * Database Query Helper Utilities
 *
 * Provides common patterns for database operations to reduce code duplication.
 * Following QLTY.sh standards for zero tolerance on copy-paste code.
 */

/**
 * Get reminders with optional user filter
 * @param {Object} db - Database instance
 * @param {string|null} userId - Optional user ID to filter by
 * @param {string} whereClause - Additional WHERE clause conditions
 * @param {string} orderBy - ORDER BY clause
 * @returns {Array} Reminder records
 */
function getRemindersWithFilter(db, userId, whereClause = '', orderBy = 'scheduled_time DESC') {
  const hasUserId = userId !== null && userId !== undefined;
  const userClause = hasUserId ? 'user_id = ?' : '1=1';
  const fullWhereClause = whereClause ? `${userClause} AND ${whereClause}` : userClause;

  const sql = `
    SELECT * FROM reminders
    WHERE ${fullWhereClause}
    ORDER BY ${orderBy}
  `;

  const stmt = db.prepare(sql);
  return hasUserId ? stmt.all(userId) : stmt.all();
}

module.exports = {
  getRemindersWithFilter,
};
