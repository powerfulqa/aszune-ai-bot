/**
 * Security Monitor - Enhanced input validation and threat detection
 * Provides enterprise-grade security monitoring features for user input
 */

class SecurityMonitor {
  /**
   * Validates user input against security threats
   * @param {string} content - Message content to validate
   * @param {string} userId - User ID for logging purposes
   * @returns {Object} - Validation results with issues and risk level
   */
  static validateInput(content, userId = null) {
    if (!content || typeof content !== 'string') {
      return {
        isValid: true,
        issues: [],
        riskLevel: 'low'
      };
    }
    
    const issues = [];
    
    // Check for XSS patterns
    if (SecurityMonitor._detectXSSPatterns(content)) {
      issues.push('potential_xss');
    }
    
    // Check for SQL injection
    if (SecurityMonitor._detectSQLInjection(content)) {
      issues.push('sql_injection');
    }
    
    // Check for command injection
    if (SecurityMonitor._detectCommandInjection(content)) {
      issues.push('command_injection');
    }
    
    const riskLevel = issues.length > 0 ? 'high' : 'low';
    const isValid = issues.length === 0;
    
    if (!isValid && userId) {
      const logger = require('./logger');
      logger.warn(`Security violations detected for user ${userId}:`, issues);
    }
    
    return {
      isValid,
      issues,
      riskLevel
    };
  }
  
  /**
   * Detects XSS patterns in content
   * @param {string} content - Content to analyze
   * @returns {boolean} - True if XSS patterns found
   * @private
   */
  static _detectXSSPatterns(content) {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/i,
      /on\w+\s*=/i, // Event handlers like onload=
      /<iframe/i,
      /eval\s*\(/i
    ];
    
    return xssPatterns.some(pattern => pattern.test(content));
  }
  
  /**
   * Detects SQL injection patterns in content
   * @param {string} content - Content to analyze
   * @returns {boolean} - True if SQL injection patterns found
   * @private
   */
  static _detectSQLInjection(content) {
    const sqlPatterns = [
      /('|(\\'))+.*(\\')?\s*(;|(\\';))\s*--.*/i, // SQL comments
      /(union\s+select|drop\s+table|insert\s+into|delete\s+from)/i,
      /'\s*(or|and)\s*'?\d+/i, // Basic SQL injection
      /'\s*;\s*(drop|delete|insert|update)/i
    ];
    
    return sqlPatterns.some(pattern => pattern.test(content));
  }
  
  /**
   * Detects command injection patterns in content
   * @param {string} content - Content to analyze
   * @returns {boolean} - True if command injection patterns found
   * @private
   */
  static _detectCommandInjection(content) {
    const commandPatterns = [
      /;\s*(rm|del|format|shutdown|reboot)/i,
      /&&\s*(cat|type|more|less)/i,
      /\|\s*(nc|netcat|wget|curl)/i,
      /`.*`/, // Backticks
      /\$\(.*\)/ // Command substitution
    ];
    
    return commandPatterns.some(pattern => pattern.test(content));
  }
  
  /**
   * Analyzes message for security threats
   * @param {Object} message - Discord message object
   * @returns {Object} - Threat analysis results
   */
  static analyzeSecurityThreats(message) {
    if (!message || typeof message !== 'object') {
      throw new Error('Invalid message object');
    }
    
    const content = message.content || '';
    
    if (!content) {
      return {
        threatLevel: 'low',
        threats: [],
        riskScore: 0,
        recommendations: []
      };
    }
    
    const threatAnalysis = SecurityMonitor._analyzeThreatPatterns(content);
    const threatLevel = SecurityMonitor._calculateThreatLevel(threatAnalysis.score);
    const recommendations = SecurityMonitor._generateRecommendations(threatLevel, threatAnalysis.threats);
    
    return {
      threatLevel,
      threats: threatAnalysis.threats,
      riskScore: threatAnalysis.score,
      recommendations
    };
  }
  
  /**
   * Analyzes content for threat patterns
   * @param {string} content - Content to analyze
   * @returns {Object} - Threat analysis results
   * @private
   */
  static _analyzeThreatPatterns(content) {
    let threatScore = 0;
    const threats = [];
    
    // Check for XSS attempts
    if (SecurityMonitor._detectXSSPatterns(content)) {
      threats.push('xss_attempt');
      threatScore += 80;
    }
    
    // Check for SQL patterns (medium risk)
    if (/(\bselect\b.*\bfrom\b|\bwhere\b.*=)/i.test(content)) {
      threats.push('sql_pattern');
      threatScore += 50;
    }
    
    // Check for command injection
    if (SecurityMonitor._detectCommandInjection(content)) {
      threats.push('command_injection');
      threatScore += 70;
    }
    
    if ((content.match(SecurityMonitor.MENTION_REGEX) || []).length > 5) {
      threats.push('excessive_mentions');
      threatScore += 20;
    }
    
    if (/(.)\1{30,}/.test(content)) {
      threats.push('spam_pattern');
      threatScore += 15;
    }
    
    if (content.length > 3000) {
      threats.push('excessive_length');
      threatScore += 10;
    }
    
    return { threats, score: threatScore };
  }
  
  /**
   * Calculates threat level based on score
   * @param {number} threatScore - Calculated threat score
   * @returns {string} - Threat level
   * @private
   */
  static _calculateThreatLevel(threatScore) {
    if (threatScore >= 70) {
      return 'high';
    } else if (threatScore >= 30) {
      return 'medium';  
    } else if (threatScore > 0) {
      return 'low';
    }
    return 'low';
  }
  
  /**
   * Generates security recommendations based on threat analysis
   * @param {string} threatLevel - Calculated threat level
   * @param {Array} threats - Array of detected threats
   * @returns {Array} - Security recommendations
   * @private
   */
  static _generateRecommendations(threatLevel, threats) {
    const recommendations = [];
    
    if (threatLevel === 'high') {
      recommendations.push('Block message and warn user');
    } else if (threatLevel === 'medium') {
      recommendations.push('Flag for review');
    }
    
    if (threats.includes('xss_attempt')) {
      recommendations.push('XSS attack detected');
    }
    
    if (threats.includes('sql_pattern')) {
      recommendations.push('SQL pattern detected');
    }
    
    return recommendations;
  }
  
  /**
   * Logs security events for monitoring
   * @param {Object} event - Security event details
   */
  static logSecurityEvent(event) {
    if (!event || typeof event !== 'object') {
      throw new Error('Invalid security event');
    }
    
    if (!event.type || !event.level) {
      throw new Error('Security event must have type and level');
    }
    
    const logger = require('./logger');
    const logData = {
      level: event.level,
      userId: event.userId,
      details: event.details,
      timestamp: new Date().toISOString()
    };
    
    const logMessage = `Security Event: ${event.type}`;
    
    if (event.level === 'error') {
      logger.error(logMessage, logData);
    } else if (event.level === 'warn') {
      logger.warn(logMessage, logData);
    } else {
      logger.info(logMessage, logData);
    }
  }
}

// Pre-compiled regex for better performance
SecurityMonitor.MENTION_REGEX = /@/g;

module.exports = SecurityMonitor;
module.exports.SecurityMonitor = SecurityMonitor;
module.exports.default = SecurityMonitor;