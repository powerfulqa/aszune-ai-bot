/**
 * SecurityMonitor Threat Analysis Tests
 * Separated from main test file to reduce complexity
 */

const SecurityMonitor = require('../../../src/utils/security-monitor');

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('SecurityMonitor - Threat Analysis', () => {
  let logger;

  beforeEach(() => {
    logger = require('../../../src/utils/logger');
    jest.clearAllMocks();
  });

  describe('analyzeSecurityThreats', () => {
    it('should analyze low-risk message', () => {
      const message = {
        content: 'Hello world',
        author: { id: 'user123' },
        channel: { id: 'channel456' },
      };

      const result = SecurityMonitor.analyzeSecurityThreats(message);

      expect(result).toEqual({
        threatLevel: 'low',
        threats: [],
        riskScore: 0,
        recommendations: [],
      });
    });

    it('should analyze high-risk message with XSS', () => {
      const message = {
        content: '<script>document.location="http://evil.com"</script>',
        author: { id: 'user123' },
        channel: { id: 'channel456' },
      };

      const result = SecurityMonitor.analyzeSecurityThreats(message);

      expect(result.threatLevel).toBe('high');
      expect(result.threats).toContain('xss_attempt');
      expect(result.riskScore).toBeGreaterThan(70);
      expect(result.recommendations).toContain('Block message and warn user');
    });

    it('should analyze medium-risk message with suspicious patterns', () => {
      const message = {
        content: 'SELECT * FROM users WHERE password = "admin"',
        author: { id: 'user123' },
        channel: { id: 'channel456' },
      };

      const result = SecurityMonitor.analyzeSecurityThreats(message);

      expect(result.threatLevel).toBe('medium');
      expect(result.threats).toContain('sql_pattern');
      expect(result.riskScore).toBeGreaterThan(30);
      expect(result.riskScore).toBeLessThan(70);
    });

    it('should handle message without content', () => {
      const message = {
        author: { id: 'user123' },
        channel: { id: 'channel456' },
      };

      const result = SecurityMonitor.analyzeSecurityThreats(message);

      expect(result).toEqual({
        threatLevel: 'low',
        threats: [],
        riskScore: 0,
        recommendations: [],
      });
    });

    it('should handle malformed message object', () => {
      expect(() => {
        SecurityMonitor.analyzeSecurityThreats(null);
      }).toThrow('Invalid message object');
    });
  });

  describe('logSecurityEvent', () => {
    it('should log low-level security event', () => {
      const event = {
        type: 'input_validation',
        level: 'info',
        userId: 'user123',
        details: { input: 'safe input' },
      };

      SecurityMonitor.logSecurityEvent(event);

      expect(logger.info).toHaveBeenCalledWith('Security Event: input_validation', {
        level: 'info',
        userId: 'user123',
        details: { input: 'safe input' },
        timestamp: expect.any(String),
      });
    });

    it('should log high-level security event', () => {
      const event = {
        type: 'threat_detected',
        level: 'error',
        userId: 'user123',
        details: { threat: 'xss_attempt', input: '<script>alert(1)</script>' },
      };

      SecurityMonitor.logSecurityEvent(event);

      expect(logger.error).toHaveBeenCalledWith('Security Event: threat_detected', {
        level: 'error',
        userId: 'user123',
        details: { threat: 'xss_attempt', input: '<script>alert(1)</script>' },
        timestamp: expect.any(String),
      });
    });

    it('should handle missing event details', () => {
      const event = {
        type: 'unknown_event',
        level: 'warn',
      };

      SecurityMonitor.logSecurityEvent(event);

      expect(logger.warn).toHaveBeenCalledWith('Security Event: unknown_event', {
        level: 'warn',
        timestamp: expect.any(String),
      });
    });

    it('should throw error for invalid event', () => {
      expect(() => {
        SecurityMonitor.logSecurityEvent(null);
      }).toThrow('Invalid security event');
    });

    it('should throw error for event without type', () => {
      expect(() => {
        SecurityMonitor.logSecurityEvent({ level: 'info' });
      }).toThrow('Security event must have type and level');
    });

    it('should throw error for event without level', () => {
      expect(() => {
        SecurityMonitor.logSecurityEvent({ type: 'test' });
      }).toThrow('Security event must have type and level');
    });
  });
});
