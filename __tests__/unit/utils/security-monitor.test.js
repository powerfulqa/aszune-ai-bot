/**
 * SecurityMonitor Tests - Comprehensive test suite for security monitoring
 * Tests follow exact assertion patterns as required by existing codebase
 */

const SecurityMonitor = require('../../../src/utils/security-monitor');

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('SecurityMonitor - Input Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateInput', () => {
    it('should return valid for safe input', () => {
      const input = 'Hello, how are you today?';
      const result = SecurityMonitor.validateInput(input);

      expect(result).toEqual({
        isValid: true,
        issues: [],
        riskLevel: 'low',
      });
    });

    it('should detect XSS attempts', () => {
      const input = '<script>alert("xss")</script>';
      const result = SecurityMonitor.validateInput(input);

      expect(result).toEqual({
        isValid: false,
        issues: ['potential_xss'],
        riskLevel: 'high',
      });
    });

    it('should detect SQL injection attempts', () => {
      const input = '\'; DROP TABLE users; --';
      const result = SecurityMonitor.validateInput(input);

      expect(result).toEqual({
        isValid: false,
        issues: ['sql_injection'],
        riskLevel: 'high',
      });
    });

    it('should detect command injection attempts', () => {
      const input = 'test; rm -rf /';
      const result = SecurityMonitor.validateInput(input);

      expect(result).toEqual({
        isValid: false,
        issues: ['command_injection'],
        riskLevel: 'high',
      });
    });

    it('should detect multiple security issues', () => {
      const input = '<script>alert(1)</script>; DROP TABLE test;';
      const result = SecurityMonitor.validateInput(input);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('potential_xss');
      expect(result.issues).toContain('sql_injection');
      expect(result.riskLevel).toBe('high');
    });

    it('should handle empty input', () => {
      const result = SecurityMonitor.validateInput('');

      expect(result).toEqual({
        isValid: true,
        issues: [],
        riskLevel: 'low',
      });
    });

    it('should handle null input', () => {
      const result = SecurityMonitor.validateInput(null);

      expect(result).toEqual({
        isValid: true,
        issues: [],
        riskLevel: 'low',
      });
    });

    it('should handle undefined input', () => {
      const result = SecurityMonitor.validateInput(undefined);

      expect(result).toEqual({
        isValid: true,
        issues: [],
        riskLevel: 'low',
      });
    });
  });

  describe('_detectXSSPatterns', () => {
    it('should detect script tags', () => {
      const patterns = SecurityMonitor._detectXSSPatterns('<script>alert(1)</script>');
      expect(patterns).toBe(true);
    });

    it('should detect javascript protocol', () => {
      const patterns = SecurityMonitor._detectXSSPatterns('javascript:alert(1)');
      expect(patterns).toBe(true);
    });

    it('should detect onload attribute', () => {
      const patterns = SecurityMonitor._detectXSSPatterns('<img onload="alert(1)">');
      expect(patterns).toBe(true);
    });

    it('should not detect safe content', () => {
      const patterns = SecurityMonitor._detectXSSPatterns('Hello world, this is safe content');
      expect(patterns).toBe(false);
    });
  });

  describe('_detectSQLInjection', () => {
    it('should detect DROP TABLE', () => {
      const patterns = SecurityMonitor._detectSQLInjection('DROP TABLE users');
      expect(patterns).toBe(true);
    });

    it('should detect UNION SELECT', () => {
      const patterns = SecurityMonitor._detectSQLInjection('\' UNION SELECT * FROM passwords --');
      expect(patterns).toBe(true);
    });

    it('should detect SQL comments', () => {
      const patterns = SecurityMonitor._detectSQLInjection('test\'; --');
      expect(patterns).toBe(true);
    });

    it('should not detect safe SQL-like content', () => {
      const patterns = SecurityMonitor._detectSQLInjection('I want to select the best option');
      expect(patterns).toBe(false);
    });
  });

  describe('_detectCommandInjection', () => {
    it('should detect dangerous commands', () => {
      const patterns = SecurityMonitor._detectCommandInjection('test; rm -rf /');
      expect(patterns).toBe(true);
    });

    it('should detect command chaining', () => {
      const patterns = SecurityMonitor._detectCommandInjection('echo hello && cat /etc/passwd');
      expect(patterns).toBe(true);
    });

    it('should not detect safe content', () => {
      const patterns = SecurityMonitor._detectCommandInjection(
        'This is normal text with some & symbols'
      );
      expect(patterns).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle errors in validateInput gracefully', () => {
      // Mock a function to throw an error
      const originalDetectXSS = SecurityMonitor._detectXSSPatterns;
      SecurityMonitor._detectXSSPatterns = jest.fn(() => {
        throw new Error('Test error');
      });

      expect(() => {
        SecurityMonitor.validateInput('test input');
      }).toThrow('Test error');

      // Restore original function
      SecurityMonitor._detectXSSPatterns = originalDetectXSS;
    });

    it('should handle errors in analyzeSecurityThreats gracefully', () => {
      const message = {
        content: 'test',
        author: { id: 'user123' },
        channel: { id: 'channel456' },
      };

      // Mock a function to throw an error
      const originalAnalyzeThreatPatterns = SecurityMonitor._analyzeThreatPatterns;
      SecurityMonitor._analyzeThreatPatterns = jest.fn(() => {
        throw new Error('Analysis error');
      });

      expect(() => {
        SecurityMonitor.analyzeSecurityThreats(message);
      }).toThrow('Analysis error');

      // Restore original function
      SecurityMonitor._analyzeThreatPatterns = originalAnalyzeThreatPatterns;
    });
  });
});
