/**
 * Jest configuration for critical files coverage enforcement
 * This configuration enforces 80%+ coverage on the most critical files
 * following QLTY guidelines and aszuneai.mdc standards
 */
module.exports = {
  // Extend from main configuration
  ...require('./jest.config.js'),
  
  // Override coverage thresholds for critical files
  coverageThreshold: {
    // Global thresholds (maintain existing standards)
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
    
    // Critical Files - MUST maintain 80%+ coverage for build to pass
    // These are the most important files that could break the entire application
    
    // 🎯 Tier 1: Core Critical Files (Main Entry & Configuration)
    './src/index.js': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/config/config.js': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    
    // 🎯 Tier 2: Service Layer Critical Files  
    './src/commands/index.js': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/services/perplexity-secure.js': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/services/chat.js': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    
    // 🎯 Tier 3: Utility Layer Critical Files
    './src/utils/logger.js': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/utils/error-handler.js': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/utils/conversation.js': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  
  // Enhanced reporting for critical coverage failures
  verbose: true,
  
  // Ensure we collect coverage from all critical files
  collectCoverageFrom: [
    'src/**/*.js',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/coverage/**',
    '!**/logs/**',
    '!**/data/**',
    '!ecosystem.config.js',
    '!jest.setup.js',
    '!src/services/perplexity.js',
    '!src/services/perplexity-improved.js',
  ],
  
  // Generate detailed coverage reports
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json-summary',
  ],
  
};