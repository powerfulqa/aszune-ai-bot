/**
 * Time Ago Utility Tests
 * Tests the shared time-ago formatting utility
 */

jest.useFakeTimers();

const { getTimeAgo, formatUnit } = require('../../../src/utils/time-ago');

describe('Time Ago Utility', () => {
  describe('formatUnit', () => {
    it('should format singular unit correctly', () => {
      expect(formatUnit(1, 'year')).toBe('1 year ago');
    });

    it('should format plural unit correctly', () => {
      expect(formatUnit(2, 'year')).toBe('2 years ago');
    });

    it('should handle zero correctly', () => {
      expect(formatUnit(0, 'minute')).toBe('0 minutes ago');
    });
  });

  describe('getTimeAgo', () => {
    it('should format years correctly', () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      expect(getTimeAgo(twoYearsAgo)).toBe('2 years ago');
    });

    it('should format single year correctly', () => {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      expect(getTimeAgo(oneYearAgo)).toBe('1 year ago');
    });

    it('should format months correctly', () => {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      expect(getTimeAgo(threeMonthsAgo)).toBe('3 months ago');
    });

    it('should format days correctly', () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      expect(getTimeAgo(fiveDaysAgo)).toBe('5 days ago');
    });

    it('should format hours correctly', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(getTimeAgo(twoHoursAgo)).toBe('2 hours ago');
    });

    it('should format minutes correctly', () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      expect(getTimeAgo(tenMinutesAgo)).toBe('10 minutes ago');
    });

    it('should handle singular month', () => {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      expect(getTimeAgo(oneMonthAgo)).toBe('1 month ago');
    });

    it('should handle singular day', () => {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      expect(getTimeAgo(oneDayAgo)).toBe('1 day ago');
    });

    it('should handle singular hour', () => {
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
      expect(getTimeAgo(oneHourAgo)).toBe('1 hour ago');
    });

    it('should handle singular minute', () => {
      const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);
      expect(getTimeAgo(oneMinuteAgo)).toBe('1 minute ago');
    });
  });
});
