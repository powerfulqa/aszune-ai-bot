module.exports = {
  collectCoverage: true,
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
  // Add timeout and force exit settings to prevent hanging
  testTimeout: 10000,
  forceExit: true,
  // detectOpenHandles: true, // Disabled since intervals are properly guarded with test env checks
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
  // Configure coverage thresholds - Balanced approach: 60% global (realistic for large codebase with optional features)
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  // Output verbose coverage info
  verbose: true,
};
