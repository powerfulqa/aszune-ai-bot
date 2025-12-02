let chrono;
try {
  chrono = require('chrono-node');
} catch (error) {
  // Graceful fallback when chrono-node is not available
  chrono = null;
}

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
   * Parse natural language time expression and return scheduled time
   * @param {string} timeExpression - Natural language time expression
   * @param {string} userTimezone - User's timezone (default: UTC)
   * @returns {Object} - { scheduledTime: Date, timezone: string, originalExpression: string }
   */
  parseTimeExpression(timeExpression, userTimezone = 'UTC') {
    // Check if chrono-node is available, use fallback if not
    if (!chrono) {
      return this.parseBasicTimeExpression(timeExpression, userTimezone);
    }

    try {
      // Parse the time expression using chrono
      const results = chrono.parse(timeExpression, new Date(), { forwardDate: true });

      if (results.length === 0) {
        throw new Error(
          'Unable to parse time expression. Try formats like "in 5 minutes", "tomorrow at 3pm", "next Monday 2:30 PM"'
        );
      }

      // Use the first (most likely) result
      const result = results[0];
      const scheduledTime = result.date();

      // Determine timezone
      let timezone = userTimezone;

      // Check if timezone was specified in the expression
      const timezoneMatch = timeExpression.match(
        /\b(UTC|EST|EDT|CST|CDT|MST|MDT|PST|PDT|GMT|BST|CET|CEST|JST|KST|IST|AEDT|AEST)\b/i
      );
      if (timezoneMatch) {
        timezone = timezoneMatch[1].toUpperCase();
      }

      // Validate the scheduled time is in the future
      if (scheduledTime <= new Date()) {
        throw new Error('Scheduled time must be in the future');
      }

      return {
        scheduledTime,
        timezone,
        originalExpression: timeExpression,
        parsedText: result.text,
      };
    } catch (error) {
      throw new Error(`Time parsing failed: ${error.message}`);
    }
  }

  /**
   * Convert timezone-aware time to UTC for storage
   * @param {Date} localTime - Time in local timezone
   * @param {string} timezone - Timezone identifier
   * @returns {Date} - UTC time
   */
  convertToUTC(localTime, timezone) {
    const offset = this.timezoneOffsets[timezone.toUpperCase()] || 0;
    const utcTime = new Date(localTime.getTime() - offset * 60 * 60 * 1000);
    return utcTime;
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
    // Time unit definitions with thresholds and formatters
    const timeUnits = [
      { max: 60, value: diffSeconds, format: (v) => (v <= 1 ? 'in 1 second' : `in ${v} seconds`) },
      { max: 60, value: diffMinutes, format: (v) => (v === 1 ? 'in 1 minute' : `in ${v} minutes`) },
      { max: 24, value: diffHours, format: (v) => (v === 1 ? 'in 1 hour' : `in ${v} hours`) },
      { max: 7, value: diffDays, format: (v) => (v === 1 ? 'tomorrow' : `in ${v} days`) },
      { max: 30, value: diffDays, format: (v) => this._formatWeeks(v) },
      { max: 365, value: diffDays, format: (v) => this._formatMonths(v) },
    ];

    // Check time units in order (seconds -> minutes -> hours -> days -> weeks -> months)
    if (diffSeconds < 60) return timeUnits[0].format(diffSeconds);
    if (diffMinutes < 60) return timeUnits[1].format(diffMinutes);
    if (diffHours < 24) return timeUnits[2].format(diffHours);
    if (diffDays < 7) return timeUnits[3].format(diffDays);
    if (diffDays < 30) return timeUnits[4].format(diffDays);
    if (diffDays < 365) return timeUnits[5].format(diffDays);

    return this._formatYears(diffDays);
  }

  getRelativeTime(targetTime, referenceTime = new Date()) {
    const diffMs = targetTime.getTime() - referenceTime.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    return this._formatTimeDiff(diffSeconds, diffMinutes, diffHours, diffDays);
  }

  /**
   * Validate timezone
   * @param {string} timezone - Timezone to validate
   * @returns {boolean} - Whether timezone is valid
   */
  isValidTimezone(timezone) {
    return timezone.toUpperCase() in this.timezoneOffsets;
  }

  /**
   * Get list of supported timezones
   * @returns {string[]} - Array of supported timezone codes
   */
  getSupportedTimezones() {
    return Object.keys(this.timezoneOffsets);
  }

  /**
   * Fallback parser for basic time expressions when chrono-node is unavailable
   * @param {string} timeExpression - Simple time expression
   * @param {string} userTimezone - User's timezone
   * @returns {Object} - Parsed time result
   */
  parseBasicTimeExpression(timeExpression, userTimezone = 'UTC') {
    const now = new Date();
    let scheduledTime = null;

    // Try to parse ISO format (YYYY-MM-DD HH:MM:SS)
    const isoMatch = timeExpression.match(/(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2}(?::\d{2})?)/);
    if (isoMatch) {
      scheduledTime = new Date(`${isoMatch[1]}T${isoMatch[2]}`);
    }

    // Try to parse relative time (e.g., "in 30 minutes", "in 2 hours")
    const relativeMatch = timeExpression.match(/in\s+(\d+)\s+(minute|hour|day)s?/i);
    if (relativeMatch && !scheduledTime) {
      const amount = parseInt(relativeMatch[1]);
      const unit = relativeMatch[2].toLowerCase();

      scheduledTime = new Date(now);
      if (unit === 'minute') {
        scheduledTime.setMinutes(scheduledTime.getMinutes() + amount);
      } else if (unit === 'hour') {
        scheduledTime.setHours(scheduledTime.getHours() + amount);
      } else if (unit === 'day') {
        scheduledTime.setDate(scheduledTime.getDate() + amount);
      }
    }

    if (!scheduledTime || scheduledTime <= now) {
      throw new Error(
        'Unable to parse time expression. Try "YYYY-MM-DD HH:MM:SS" or "in X minutes/hours/days"'
      );
    }

    return {
      scheduledTime,
      timezone: userTimezone,
      originalExpression: timeExpression,
      parsedText: timeExpression,
      fallbackUsed: true,
    };
  }
}

const timeParser = new TimeParser();
module.exports = timeParser;
module.exports.TimeParser = TimeParser;
module.exports.default = timeParser;
