/**
 * TimeParser Tests - Core Methods
 * Tests for timezone conversion
 */

const timeParser = require('../../src/utils/time-parser');
const { TimeParser } = require('../../src/utils/time-parser');

describe('TimeParser - Core', () => {
  describe('constructor', () => {
    it('should create a new TimeParser instance', () => {
      const parser = new TimeParser();
      expect(parser).toBeInstanceOf(TimeParser);
      expect(parser.timezoneOffsets).toBeDefined();
    });

    it('should have all common timezone offsets', () => {
      const parser = new TimeParser();
      expect(parser.timezoneOffsets.UTC).toBe(0);
      expect(parser.timezoneOffsets.EST).toBe(-5);
      expect(parser.timezoneOffsets.PST).toBe(-8);
      expect(parser.timezoneOffsets.GMT).toBe(0);
      expect(parser.timezoneOffsets.JST).toBe(9);
    });
  });

  describe('convertFromUTC', () => {
    it('should convert UTC time to EST', () => {
      const utcTime = new Date('2024-01-15T17:00:00Z');
      const localTime = timeParser.convertFromUTC(utcTime, 'EST');
      expect(localTime.getTime()).toBe(utcTime.getTime() - 5 * 60 * 60 * 1000);
    });

    it('should convert UTC time to JST', () => {
      const utcTime = new Date('2024-01-15T12:00:00Z');
      const localTime = timeParser.convertFromUTC(utcTime, 'JST');
      expect(localTime.getTime()).toBe(utcTime.getTime() + 9 * 60 * 60 * 1000);
    });

    it('should handle IST with fractional offset', () => {
      const utcTime = new Date('2024-01-15T12:00:00Z');
      const localTime = timeParser.convertFromUTC(utcTime, 'IST');
      expect(localTime.getTime()).toBe(utcTime.getTime() + 5.5 * 60 * 60 * 1000);
    });
  });

  describe('getTimezoneName', () => {
    it('should return IANA timezone for EST', () => {
      expect(timeParser.getTimezoneName('EST')).toBe('America/New_York');
    });

    it('should return IANA timezone for PST', () => {
      expect(timeParser.getTimezoneName('PST')).toBe('America/Los_Angeles');
    });

    it('should return IANA timezone for JST', () => {
      expect(timeParser.getTimezoneName('JST')).toBe('Asia/Tokyo');
    });

    it('should return UTC for unknown timezone', () => {
      expect(timeParser.getTimezoneName('UNKNOWN')).toBe('UTC');
    });

    it('should handle case-insensitive input', () => {
      expect(timeParser.getTimezoneName('est')).toBe('America/New_York');
      expect(timeParser.getTimezoneName('pst')).toBe('America/Los_Angeles');
    });
  });

  describe('formatTime', () => {
    it('should format time for display', () => {
      const time = new Date('2024-01-15T12:30:00Z');
      const formatted = timeParser.formatTime(time, 'UTC');
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });

    it('should use UTC as default timezone', () => {
      const time = new Date('2024-01-15T12:30:00Z');
      const formatted = timeParser.formatTime(time);
      expect(typeof formatted).toBe('string');
    });
  });

  describe('module exports', () => {
    it('should export singleton instance', () => {
      expect(timeParser).toBeInstanceOf(TimeParser);
    });

    it('should export TimeParser class', () => {
      expect(TimeParser).toBeDefined();
      expect(new TimeParser()).toBeInstanceOf(TimeParser);
    });

    it('should export default property', () => {
      const mod = require('../../src/utils/time-parser');
      expect(mod.default).toBeDefined();
      expect(typeof mod.default.formatTime).toBe('function');
      expect(typeof mod.default.getRelativeTime).toBe('function');
    });
  });
});
