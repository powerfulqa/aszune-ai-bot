const chrono = require('chrono-node');

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
   * Get relative time description
   * @param {Date} targetTime - Target time
   * @param {Date} referenceTime - Reference time (default: now)
   * @returns {string} - Relative time description
   */
  getRelativeTime(targetTime, referenceTime = new Date()) {
    const diffMs = targetTime.getTime() - referenceTime.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
      return diffSeconds <= 1 ? 'in 1 second' : `in ${diffSeconds} seconds`;
    } else if (diffMinutes < 60) {
      return diffMinutes === 1 ? 'in 1 minute' : `in ${diffMinutes} minutes`;
    } else if (diffHours < 24) {
      return diffHours === 1 ? 'in 1 hour' : `in ${diffHours} hours`;
    } else if (diffDays < 7) {
      return diffDays === 1 ? 'tomorrow' : `in ${diffDays} days`;
    } else {
      return targetTime.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
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
}

const timeParser = new TimeParser();
module.exports = timeParser;
module.exports.TimeParser = TimeParser;
module.exports.default = timeParser;
