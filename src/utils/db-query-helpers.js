/**
 * Database Query Helper Utilities
 *
 * Provides common patterns for database operations to reduce code duplication.
 * Following QLTY.sh standards for zero tolerance on copy-paste code.
 */

const logger = require('./logger');

/**
 * Execute a database query safely with proper error handling
 * @param {Function} getDb - Function that returns the database instance
 * @param {boolean} isDisabled - Whether the database is disabled
 * @param {Function} queryFn - Function that performs the actual query
 * @param {*} defaultValue - Default value to return on failure
 * @param {string} operation - Description of the operation for logging
 * @returns {*} Query result or default value
 */
function executeSafeQuery(getDb, isDisabled, queryFn, defaultValue, operation = 'database query') {
  try {
    if (isDisabled) return defaultValue;

    const db = getDb();
    return queryFn(db);
  } catch (error) {
    logger.debug(`${operation} failed: ${error.message}`);
    return defaultValue;
  }
}

/**
 * Create and execute a parameterized SELECT query with LIMIT
 * @param {Object} db - Database instance
 * @param {string} sql - SQL query string
 * @param {Array} params - Query parameters
 * @param {boolean} single - Whether to return single result (get) or all results
 * @returns {Object|Array} Query result(s)
 */
function executeParameterizedQuery(db, sql, params, single = false) {
  const stmt = db.prepare(sql);
  return single ? stmt.get(...params) : stmt.all(...params);
}

/**
 * User history query options
 * @typedef {Object} UserHistoryOptions
 * @property {Function} getDb - Function that returns the database instance
 * @property {boolean} isDisabled - Whether the database is disabled
 * @property {string} tableName - Table name to query
 * @property {string} columns - Columns to select
 * @property {string} userId - User ID to filter by
 * @property {number} limit - Maximum records to return
 * @property {string} [orderBy='timestamp'] - Column to order by (DESC)
 */

/**
 * Get user history records with configurable query
 * Used for command history, error history, etc.
 * @param {UserHistoryOptions} options - Query configuration options
 * @returns {Array} History records
 */
function getUserHistory(options) {
  const { getDb, isDisabled, tableName, columns, userId, limit, orderBy = 'timestamp' } = options;
  return executeSafeQuery(
    getDb,
    isDisabled,
    (db) => {
      const sql = `
        SELECT ${columns}
        FROM ${tableName}
        WHERE user_id = ?
        ORDER BY ${orderBy} DESC
        LIMIT ?
      `;
      return executeParameterizedQuery(db, sql, [userId, limit], false);
    },
    [],
    `get ${tableName} history`
  );
}

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
  executeSafeQuery,
  executeParameterizedQuery,
  getUserHistory,
  getRemindersWithFilter,
};
