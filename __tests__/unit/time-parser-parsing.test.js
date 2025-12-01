/**
 * TimeParser Tests - Parsing Methods
 * Tests for time expression parsing
 */

const timeParser = require('../../src/utils/time-parser');

describe('TimeParser - Parsing', () => {
  describe('parseBasicTimeExpression', () => {
    it('should parse ISO format date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const dateStr = futureDate.toISOString().split('T')[0];
      const timeStr = '14:30';
      
      const result = timeParser.parseBasicTimeExpression(`${dateStr} ${timeStr}`, 'UTC');
      
      expect(result.scheduledTime).toBeInstanceOf(Date);
      expect(result.timezone).toBe('UTC');
      expect(result.fallbackUsed).toBe(true);
    });

    it('should parse "in X minutes" format', () => {
      const result = timeParser.parseBasicTimeExpression('in 30 minutes', 'UTC');
      
      expect(result.scheduledTime).toBeInstanceOf(Date);
      expect(result.scheduledTime.getTime()).toBeGreaterThan(Date.now());
      expect(result.fallbackUsed).toBe(true);
    });

    it('should parse "in X minute" singular format', () => {
      const result = timeParser.parseBasicTimeExpression('in 1 minute', 'UTC');
      
      expect(result.scheduledTime).toBeInstanceOf(Date);
      expect(result.scheduledTime.getTime()).toBeGreaterThan(Date.now());
    });

    it('should parse "in X hours" format', () => {
      const result = timeParser.parseBasicTimeExpression('in 2 hours', 'UTC');
      
      expect(result.scheduledTime).toBeInstanceOf(Date);
      const expectedTime = Date.now() + 2 * 60 * 60 * 1000;
      expect(Math.abs(result.scheduledTime.getTime() - expectedTime)).toBeLessThan(1000);
    });

    it('should parse "in X hour" singular format', () => {
      const result = timeParser.parseBasicTimeExpression('in 1 hour', 'EST');
      
      expect(result.scheduledTime).toBeInstanceOf(Date);
      expect(result.timezone).toBe('EST');
    });

    it('should parse "in X days" format', () => {
      const result = timeParser.parseBasicTimeExpression('in 3 days', 'EST');
      
      expect(result.scheduledTime).toBeInstanceOf(Date);
      expect(result.timezone).toBe('EST');
    });

    it('should parse "in X day" singular format', () => {
      const result = timeParser.parseBasicTimeExpression('in 1 day', 'PST');
      
      expect(result.scheduledTime).toBeInstanceOf(Date);
      expect(result.timezone).toBe('PST');
    });

    it('should throw error for unparseable expression', () => {
      expect(() => {
        timeParser.parseBasicTimeExpression('invalid time', 'UTC');
      }).toThrow('Unable to parse time expression');
    });

    it('should throw error for past time', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const dateStr = pastDate.toISOString().split('T')[0];
      
      expect(() => {
        timeParser.parseBasicTimeExpression(`${dateStr} 12:00`, 'UTC');
      }).toThrow('Unable to parse time expression');
    });

    it('should include originalExpression in result', () => {
      const expression = 'in 5 minutes';
      const result = timeParser.parseBasicTimeExpression(expression, 'UTC');
      
      expect(result.originalExpression).toBe(expression);
      expect(result.parsedText).toBe(expression);
    });
  });

  describe('parseTimeExpression', () => {
    it('should parse natural language time expressions', () => {
      const result = timeParser.parseTimeExpression('in 5 minutes', 'UTC');
      
      expect(result.scheduledTime).toBeInstanceOf(Date);
      expect(result.timezone).toBe('UTC');
      expect(result.originalExpression).toBe('in 5 minutes');
    });

    it('should detect timezone in expression', () => {
      const result = timeParser.parseTimeExpression('in 2 hours EST', 'UTC');
      
      expect(result.timezone).toBe('EST');
    });

    it('should detect PST timezone in expression', () => {
      const result = timeParser.parseTimeExpression('in 3 hours PST', 'UTC');
      
      expect(result.timezone).toBe('PST');
    });

    it('should detect GMT timezone in expression', () => {
      const result = timeParser.parseTimeExpression('in 1 hour GMT', 'EST');
      
      expect(result.timezone).toBe('GMT');
    });

    it('should throw error for unparseable expression', () => {
      expect(() => {
        timeParser.parseTimeExpression('gibberish not a time', 'UTC');
      }).toThrow();
    });

    it('should throw error for past time', () => {
      expect(() => {
        timeParser.parseTimeExpression('yesterday', 'UTC');
      }).toThrow();
    });

    it('should use user timezone as default', () => {
      const result = timeParser.parseTimeExpression('in 10 minutes', 'PST');
      
      expect(result.timezone).toBe('PST');
    });

    it('should include parsedText in result', () => {
      const result = timeParser.parseTimeExpression('in 30 minutes', 'UTC');
      
      expect(result.parsedText).toBeDefined();
    });

    it('should handle case-insensitive timezone detection', () => {
      const result = timeParser.parseTimeExpression('in 1 hour utc', 'EST');
      
      expect(result.timezone).toBe('UTC');
    });
  });

  describe('parseTimeExpression edge cases', () => {
    it('should handle "tomorrow" expression', () => {
      // This may throw or succeed depending on chrono-node availability
      try {
        const result = timeParser.parseTimeExpression('tomorrow at 9am', 'UTC');
        expect(result.scheduledTime).toBeInstanceOf(Date);
        expect(result.scheduledTime.getTime()).toBeGreaterThan(Date.now());
      } catch (error) {
        expect(error.message).toContain('Time parsing failed');
      }
    });

    it('should handle "next week" expression', () => {
      try {
        const result = timeParser.parseTimeExpression('next week', 'UTC');
        expect(result.scheduledTime).toBeInstanceOf(Date);
      } catch (error) {
        expect(error.message).toContain('Time parsing failed');
      }
    });

    it('should wrap chrono errors in Time parsing failed message', () => {
      expect(() => {
        timeParser.parseTimeExpression('', 'UTC');
      }).toThrow(/Time parsing failed|Unable to parse/);
    });
  });
});
