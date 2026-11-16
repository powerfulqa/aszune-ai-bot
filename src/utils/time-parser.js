class TimeParser {
  constructor() {
    this.timezoneOffsets = {
      UTC: 0,
      EST: -5,
      EDT: -4,
      CST: -6,
      CDT: -5,
      MST: -7,
      MDT: -6,
      PST: -8,
      PDT: -7,
      GMT: 0,
      BST: 1,
      CET: 1,
      CEST: 2,
      JST: 9,
      KST: 9,
      IST: 5.5,
      AEDT: 11,
      AEST: 10,
    };
  }

  /**
   * Convert UTC time to local timezone for display
   * @param {Date} utcTime - UTC time
   * @param {string} timezone - Target timezone
   * @returns {Date} - Local time
   */
  convertFromUTC(utcTime, timezone) {
    const offset = this.timezoneOffsets[timezone.toUpperCase()] || 0;
    const localTime = new Date(utcTime.getTime() + offset * 60 * 60 * 1000);
    return localTime;
  }

  /**
   * Format time for display
   * @param {Date} time - Time to format
   * @param {string} timezone - Timezone for display
   * @returns {string} - Formatted time string
   */
  formatTime(time, timezone = 'UTC') {
    const localTime = this.convertFromUTC(time, timezone);

    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: this.getTimezoneName(timezone),
    };

    return localTime.toLocaleString('en-US', options);
  }

  /**
   * Get IANA timezone name from our simplified timezone codes
   * @param {string} timezone - Our timezone code
   * @returns {string} - IANA timezone name
   */
  getTimezoneName(timezone) {
    const timezoneMap = {
      UTC: 'UTC',
      EST: 'America/New_York',
      EDT: 'America/New_York',
      CST: 'America/Chicago',
      CDT: 'America/Chicago',
      MST: 'America/Denver',
      MDT: 'America/Denver',
      PST: 'America/Los_Angeles',
      PDT: 'America/Los_Angeles',
      GMT: 'Europe/London',
      BST: 'Europe/London',
      CET: 'Europe/Paris',
      CEST: 'Europe/Paris',
      JST: 'Asia/Tokyo',
      KST: 'Asia/Seoul',
      IST: 'Asia/Kolkata',
      AEDT: 'Australia/Sydney',
      AEST: 'Australia/Sydney',
    };

    return timezoneMap[timezone.toUpperCase()] || 'UTC';
  }

  /**
   * Get relative time description for weeks
   * @param {number} diffDays - Difference in days
   * @returns {string} - Weeks description
   */
  _formatWeeks(diffDays) {
    const weeks = Math.floor(diffDays / 7);
    const remainingDays = diffDays % 7;

    if (weeks === 1 && remainingDays === 0) return 'in 1 week';
    if (weeks === 1)
      return `in 1 week and ${remainingDays} ${remainingDays === 1 ? 'day' : 'days'}`;
    if (remainingDays === 0) return `in ${weeks} weeks`;
    return `in ${weeks} weeks and ${remainingDays} ${remainingDays === 1 ? 'day' : 'days'}`;
  }

  /**
   * Get relative time description for months
   * @param {number} diffDays - Difference in days
   * @returns {string} - Months description
   */
  _formatMonths(diffDays) {
    const months = Math.floor(diffDays / 30);
    const remainingDays = diffDays % 30;

    if (months === 1 && remainingDays === 0) return 'in 1 month';
    if (months === 1)
      return `in 1 month and ${remainingDays} ${remainingDays === 1 ? 'day' : 'days'}`;
    if (remainingDays === 0) return `in ${months} months`;
    return `in ${months} months and ${remainingDays} ${remainingDays === 1 ? 'day' : 'days'}`;
  }

  /**
   * Get relative time description for years
   * @param {number} diffDays - Difference in days
   * @returns {string} - Years description
   */
  _formatYears(diffDays) {
    const years = Math.floor(diffDays / 365);
    const remainingDays = diffDays % 365;
    const months = Math.floor(remainingDays / 30);

    if (years === 1 && months === 0) return 'in 1 year';
    if (years === 1) return `in 1 year and ${months} ${months === 1 ? 'month' : 'months'}`;
    if (months === 0) return `in ${years} years`;
    return `in ${years} years and ${months} ${months === 1 ? 'month' : 'months'}`;
  }

  /**
   * Get relative time description
   * @param {Date} targetTime - Target time
   * @param {Date} referenceTime - Reference time (default: now)
   * @returns {string} - Relative time description
   */
  /**
   * Format time difference into a relative time string
   * Uses lookup table pattern to reduce cognitive complexity
   * @private
   */
  _formatTimeDiff(diffSeconds, diffMinutes, diffHours, diffDays) {
    // Define time thresholds and their formatters
    const thresholds = [
      { check: () => diffSeconds < 60, format: () => this._formatSeconds(diffSeconds) },
      { check: () => diffMinutes < 60, format: () => this._formatMinutes(diffMinutes) },
      { check: () => diffHours < 24, format: () => this._formatHours(diffHours) },
      { check: () => diffDays < 7, format: () => this._formatDays(diffDays) },
      { check: () => diffDays < 30, format: () => this._formatWeeks(diffDays) },
      { check: () => diffDays < 365, format: () => this._formatMonths(diffDays) },
    ];

    // Find and apply the first matching threshold
    const match = thresholds.find((t) => t.check());
    return match ? match.format() : this._formatYears(diffDays);
  }

  /**
   * Format seconds into relative time string
   * @private
   */
  _formatSeconds(seconds) {
    return seconds <= 1 ? 'in 1 second' : `in ${seconds} seconds`;
  }

  /**
   * Format minutes into relative time string
   * @private
   */
  _formatMinutes(minutes) {
    return minutes === 1 ? 'in 1 minute' : `in ${minutes} minutes`;
  }

  /**
   * Format hours into relative time string
   * @private
   */
  _formatHours(hours) {
    return hours === 1 ? 'in 1 hour' : `in ${hours} hours`;
  }

  /**
   * Format days into relative time string
   * @private
   */
  _formatDays(days) {
    return days === 1 ? 'tomorrow' : `in ${days} days`;
  }

  getRelativeTime(targetTime, referenceTime = new Date()) {
    const diffMs = targetTime.getTime() - referenceTime.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    return this._formatTimeDiff(diffSeconds, diffMinutes, diffHours, diffDays);
  }
}

const timeParser = new TimeParser();
module.exports = timeParser;
module.exports.TimeParser = TimeParser;
module.exports.default = timeParser;
