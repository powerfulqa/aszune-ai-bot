/**
 * Jest configuration for critical files coverage enforcement
 * Adds per-file thresholds for the most critical files on top of the global gate
 */
module.exports = {
  // Extend from main configuration
  ...require('../jest.config.js'),

  // Override rootDir to point to project root instead of config folder
  rootDir: '../',

  // Per-file gates for the files that can take the whole bot down. Each is set
  // about two points under the measured value (2026-11-16), so they catch a
  // regression in that file even when the global figure hardly moves. Raise
  // them when coverage rises; do not lower them to make a build pass.
  coverageThreshold: {
    // This run measures the global figure about two points lower than the main
    // config does (82.9% statements, 81.6% functions on 2026-11-16), so its
    // floor is set against its own numbers. The main gate is jest.config.js.
    global: { branches: 86, functions: 88, lines: 88, statements: 88 },
    './src/index.js': { branches: 82, functions: 98, lines: 76, statements: 76 },
    './src/config/config.js': { branches: 90, functions: 100, lines: 96, statements: 96 },
    './src/commands/index.js': { branches: 83, functions: 93, lines: 92, statements: 92 },
    './src/services/perplexity-secure.js': {
      branches: 82,
      functions: 94,
      lines: 92,
      statements: 92,
    },
    './src/services/chat.js': { branches: 92, functions: 98, lines: 91, statements: 91 },
    './src/utils/logger.js': { branches: 91, functions: 93, lines: 96, statements: 96 },
    './src/utils/error-handler.js': { branches: 90, functions: 100, lines: 95, statements: 95 },
    './src/utils/conversation.js': { branches: 84, functions: 98, lines: 90, statements: 90 },
    './src/services/database.js': { branches: 95, functions: 79, lines: 89, statements: 89 },
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
  ],

  // Generate detailed coverage reports
  coverageReporters: ['text', 'text-summary', 'html', 'lcov', 'json-summary'],
};
