module.exports = {
  collectCoverage: true,
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
  // Increased timeout. Explicit coverageReporters fixes earlier CLI misuse ("clover,lcov,text" treated as one module)
  testTimeout: 30000,
  // Only force-exit when explicitly requested (prefer fixing open handles instead)
  forceExit: process.env.JEST_FORCE_EXIT === 'true',
  // Detect open handles to help debug hanging tests (enable with DEBUG_JEST_HANDLES=true)
  detectOpenHandles: process.env.DEBUG_JEST_HANDLES === 'true',
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
  // Use 50% of available CPUs for better parallelization (CI uses --maxWorkers override)
  maxWorkers: '50%',
  collectCoverageFrom: [
    'src/**/*.js',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/coverage/**',
    '!**/logs/**',
    '!**/data/**',
    '!ecosystem.config.js',
    '!jest.setup.js',
    '!src/utils/enhanced-conversation-context.js',
  ],
  // Define pattern for test files to exclude helper files
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  // Explicitly exclude our mock helpers file and other problematic files
  testPathIgnorePatterns: [
    '/__mocks__/discord.js',
    '/__mocks__/discord.mock.module.js',
    '/__mocks__/loggerMock.js',
    '/__tests__/__mocks__/discord.test.js',
    '/__tests__/__mocks__/discord.mock.test.js',
    '/__tests__/__mocks__/loggerMock.test.js',
    '/__tests__/utils/undici-mock.js',
    '/__tests__/utils/undici-mock-helpers.js',
    '/__tests__/utils/undici-mock-helpers.test.ignore.js',
    '/node_modules/',
    '/bot-shutdown.test.js/',
    '/__tests__/unit/.*[.]test[.]setup[.]js',
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
  // Configure coverage thresholds - 70% to prevent regression
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  // Output verbose coverage info
  verbose: true,
};
