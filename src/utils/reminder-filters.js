/**
 * Reminder Filter Utilities
 *
 * Provides common patterns for filtering reminders
 * to reduce code duplication in web-dashboard.js and reminderHandlers.js.
 */

/**
 * Apply status filter to reminders array
 * @param {Array} reminders - Array of reminder objects
 * @param {string|null} status - Status to filter by ('completed', 'active', or null)
 * @returns {Array} Filtered reminders
 */
function filterByStatus(reminders, status) {
  if (!status) return reminders;

  if (status === 'completed') {
    return reminders.filter((r) => r.status === 'completed');
  } else if (status === 'active') {
    return reminders.filter((r) => r.status === 'active' || r.status === 'pending');
  }

  // For specific status values, filter exactly
  return reminders.filter((r) => r.status === status);
}

/**
 * Apply search text filter to reminders array
 * @param {Array} reminders - Array of reminder objects
 * @param {string|null} searchText - Search text to filter by
 * @returns {Array} Filtered reminders
 */
function filterBySearchText(reminders, searchText) {
  if (!searchText) return reminders;

  const searchLower = searchText.toLowerCase();
  return reminders.filter((r) => r.message.toLowerCase().includes(searchLower));
}

/**
 * Apply multiple filters to reminders array
 * @param {Array} reminders - Array of reminder objects
 * @param {Object} filters - Filter options
 * @param {string|null} filters.status - Status filter
 * @param {string|null} filters.searchText - Search text filter
 * @returns {Array} Filtered reminders
 */
function applyFilters(reminders, filters = {}) {
  const { status = null, searchText = null } = filters;

  let result = reminders;
  result = filterByStatus(result, status);
  result = filterBySearchText(result, searchText);

  return result;
}

/**
 * Process reminder request with filters - shared handler logic
 * Reduces duplication between web-dashboard.js and reminderHandlers.js
 * @param {Object} databaseService - Database service instance
 * @param {Object} data - Request data with userId and status
 * @returns {Object} Processed result with reminders and stats
 */
function processReminderRequest(databaseService, data) {
  const { userId = null, status = null } = data || {};

  // Get ALL reminders from database (not just future active ones)
  let reminders = databaseService.getAllReminders(userId);

  // Apply status filter if requested using shared utility
  reminders = filterByStatus(reminders, status);

  const stats = databaseService.getReminderStats();

  return {
    reminders: reminders || [],
    stats,
    total: reminders?.length || 0,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Process filter reminders request - shared handler logic
 * Reduces duplication between web-dashboard.js and reminderHandlers.js
 * @param {Object} databaseService - Database service instance
 * @param {Object} data - Filter data with userId, status, searchText
 * @returns {Object} Processed result with filtered reminders
 */
function processFilterReminders(databaseService, data) {
  const { userId = null, status = null, searchText = null } = data || {};

  let reminders = databaseService.getActiveReminders(userId);

  // Use shared filter utilities
  reminders = filterByStatus(reminders, status);
  reminders = filterBySearchText(reminders, searchText);

  return {
    reminders: reminders || [],
    total: reminders?.length || 0,
    filters: { userId, status, searchText },
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  filterByStatus,
  filterBySearchText,
  applyFilters,
  processReminderRequest,
  processFilterReminders,
};
