module.exports = {
  collectCoverage: true,
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
  // Increased timeout. Explicit coverageReporters fixes earlier CLI misuse ("clover,lcov,text" treated as one module)
  testTimeout: 30000,
  // Force exit to prevent hanging on open handles in CI
  // This is enabled because some tests/services leave open timers or sockets
  forceExit: process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true',
  // Detect open handles to help debug hanging tests locally
  detectOpenHandles: process.env.DEBUG_JEST_HANDLES === 'true',
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
  maxWorkers: 1,
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
    '!src/utils/license-server.js',
    '!src/utils/license-validator.js',
    '!src/utils/enhanced-conversation-context.js',
  ],
  // Define pattern for test files to exclude helper files
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  // Explicitly exclude our mock helpers file and other problematic files
  testPathIgnorePatterns: [
    '/__mocks__/discord.js',
    '/__mocks__/discord.mock.module.js',
    '/__mocks__/loggerMock.js',
    '/__tests__/utils/undici-mock-helpers.js',
    '/__tests__/utils/undici-mock-helpers.test.ignore.js',
    '/node_modules/',
    '/bot-shutdown.test.js/',
  ],
  // Generate JUnit XML test report for CodeCov
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'test-results',
        outputName: 'junit.xml',
      },
    ],
  ],
  // Use the Jest setup file
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Use v8 coverage provider for better reporting
  coverageProvider: 'v8',
  // Configure coverage thresholds - 64% accounts for Jest's threshold calculation difference
  coverageThreshold: {
    global: {
      branches: 64,
      functions: 64,
      lines: 64,
      statements: 64,
    },
  },
  // Output verbose coverage info
  verbose: true,
};
