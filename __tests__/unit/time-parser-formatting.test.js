/**
 * TimeParser Tests - Formatting Methods
 * Tests for relative time formatting helpers
 */

const timeParser = require('../../src/utils/time-parser');

describe('TimeParser - Formatting', () => {
  describe('_formatWeeks', () => {
    it('should format exactly 1 week', () => {
      expect(timeParser._formatWeeks(7)).toBe('in 1 week');
    });

    it('should format 1 week with remaining days', () => {
      expect(timeParser._formatWeeks(8)).toBe('in 1 week and 1 day');
      expect(timeParser._formatWeeks(10)).toBe('in 1 week and 3 days');
    });

    it('should format multiple weeks without remaining days', () => {
      expect(timeParser._formatWeeks(14)).toBe('in 2 weeks');
      expect(timeParser._formatWeeks(21)).toBe('in 3 weeks');
    });

    it('should format multiple weeks with remaining days', () => {
      expect(timeParser._formatWeeks(15)).toBe('in 2 weeks and 1 day');
      expect(timeParser._formatWeeks(17)).toBe('in 2 weeks and 3 days');
    });
  });

  describe('_formatMonths', () => {
    it('should format exactly 1 month', () => {
      expect(timeParser._formatMonths(30)).toBe('in 1 month');
    });

    it('should format 1 month with remaining days', () => {
      expect(timeParser._formatMonths(31)).toBe('in 1 month and 1 day');
      expect(timeParser._formatMonths(35)).toBe('in 1 month and 5 days');
    });

    it('should format multiple months without remaining days', () => {
      expect(timeParser._formatMonths(60)).toBe('in 2 months');
      expect(timeParser._formatMonths(90)).toBe('in 3 months');
    });

    it('should format multiple months with remaining days', () => {
      expect(timeParser._formatMonths(61)).toBe('in 2 months and 1 day');
      expect(timeParser._formatMonths(65)).toBe('in 2 months and 5 days');
    });
  });

  describe('_formatYears', () => {
    it('should format exactly 1 year', () => {
      expect(timeParser._formatYears(365)).toBe('in 1 year');
    });

    it('should format 1 year with remaining months', () => {
      expect(timeParser._formatYears(395)).toBe('in 1 year and 1 month');
      expect(timeParser._formatYears(455)).toBe('in 1 year and 3 months');
    });

    it('should format multiple years without remaining months', () => {
      expect(timeParser._formatYears(730)).toBe('in 2 years');
    });

    it('should format multiple years with remaining months', () => {
      expect(timeParser._formatYears(760)).toBe('in 2 years and 1 month');
      expect(timeParser._formatYears(820)).toBe('in 2 years and 3 months');
    });
  });

  describe('_formatTimeDiff', () => {
    it('should format seconds', () => {
      expect(timeParser._formatTimeDiff(1, 0, 0, 0)).toBe('in 1 second');
      expect(timeParser._formatTimeDiff(30, 0, 0, 0)).toBe('in 30 seconds');
      expect(timeParser._formatTimeDiff(59, 0, 0, 0)).toBe('in 59 seconds');
    });

    it('should format minutes', () => {
      expect(timeParser._formatTimeDiff(60, 1, 0, 0)).toBe('in 1 minute');
      expect(timeParser._formatTimeDiff(1800, 30, 0, 0)).toBe('in 30 minutes');
    });

    it('should format hours', () => {
      expect(timeParser._formatTimeDiff(3600, 60, 1, 0)).toBe('in 1 hour');
      expect(timeParser._formatTimeDiff(43200, 720, 12, 0)).toBe('in 12 hours');
    });

    it('should format days', () => {
      expect(timeParser._formatTimeDiff(86400, 1440, 24, 1)).toBe('tomorrow');
      expect(timeParser._formatTimeDiff(259200, 4320, 72, 3)).toBe('in 3 days');
    });

    it('should format weeks', () => {
      expect(timeParser._formatTimeDiff(604800, 10080, 168, 7)).toBe('in 1 week');
      expect(timeParser._formatTimeDiff(1209600, 20160, 336, 14)).toBe('in 2 weeks');
    });

    it('should format months', () => {
      expect(timeParser._formatTimeDiff(2592000, 43200, 720, 30)).toBe('in 1 month');
    });

    it('should format years', () => {
      expect(timeParser._formatTimeDiff(31536000, 525600, 8760, 365)).toBe('in 1 year');
    });
  });

  describe('getRelativeTime', () => {
    it('should return relative time for future date', () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now
      const result = timeParser.getRelativeTime(futureDate, now);
      expect(result).toBe('in 5 minutes');
    });

    it('should return "tomorrow" for next day', () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const result = timeParser.getRelativeTime(tomorrow, now);
      expect(result).toBe('tomorrow');
    });

    it('should handle default reference time', () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      const result = timeParser.getRelativeTime(futureDate);
      expect(result).toBe('in 1 hour');
    });

    it('should format seconds correctly', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 30 * 1000); // 30 seconds
      const result = timeParser.getRelativeTime(future, now);
      expect(result).toBe('in 30 seconds');
    });

    it('should format weeks correctly', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days
      const result = timeParser.getRelativeTime(future, now);
      expect(result).toBe('in 2 weeks');
    });

    it('should format months correctly', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days
      const result = timeParser.getRelativeTime(future, now);
      expect(result).toBe('in 2 months');
    });

    it('should format years correctly', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 400 * 24 * 60 * 60 * 1000); // 400 days
      const result = timeParser.getRelativeTime(future, now);
      expect(result).toContain('year');
    });
  });
});
