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

module.exports = {
  filterByStatus,
  filterBySearchText,
  applyFilters,
};
