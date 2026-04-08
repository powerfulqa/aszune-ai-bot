/**
 * Time ago formatting utility
 * Shared utility for human-readable relative time formatting
 *
 * @module utils/time-ago
 */

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Format a unit with proper pluralisation
 * @param {number} value - The numeric value
 * @param {string} unit - The unit name (singular)
 * @returns {string} Formatted string with proper plural
 */
function formatUnit(value, unit) {
  return `${value} ${unit}${value !== 1 ? 's' : ''} ago`;
}

/**
 * Format time ago string from a date
 * @param {Date} date - Date to format
 * @returns {string} Formatted time ago string (e.g., "2 years ago", "5 minutes ago")
 */
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / MS_PER_DAY);

  // Use calendar-aware year calculation
  let diffYears = now.getFullYear() - date.getFullYear();
  if (
    now.getMonth() < date.getMonth() ||
    (now.getMonth() === date.getMonth() && now.getDate() < date.getDate())
  ) {
    diffYears--;
  }
  if (diffYears > 0) return formatUnit(diffYears, 'year');

  // Use calendar-aware month calculation
  let diffMonths =
    (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
  if (now.getDate() < date.getDate()) diffMonths--;
  if (diffMonths > 0) return formatUnit(diffMonths, 'month');

  if (diffDays > 0) return formatUnit(diffDays, 'day');

  const diffHours = Math.floor(diffMs / MS_PER_HOUR);
  if (diffHours > 0) return formatUnit(diffHours, 'hour');

  const diffMinutes = Math.floor(diffMs / MS_PER_MINUTE);
  return formatUnit(diffMinutes, 'minute');
}

module.exports = {
  getTimeAgo,
  formatUnit,
};
