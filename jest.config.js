module.exports = {
  collectCoverage: true,
  coverageDirectory: "coverage",
  testEnvironment: "node",
  collectCoverageFrom: [
    "src/**/*.js",
    "!**/node_modules/**",
    "!**/__tests__/**",
    "!**/coverage/**",
    "!**/logs/**",    "!**/data/**",
    "!ecosystem.config.js",
    "!jest.setup.js"
  ],
  // Define pattern for test files to exclude helper files
  testMatch: [
    "**/__tests__/**/*.[jt]s?(x)",
    "**/?(*.)+(spec|test).[jt]s?(x)"
  ],
  // Explicitly exclude our mock helpers file
  testPathIgnorePatterns: [
    "/node_modules/",
    "/__tests__/utils/undici-mock-helpers.js"
  ],
  // Generate JUnit XML test report for CodeCov
  reporters: [
    "default",
    ["jest-junit", {
      outputDirectory: "test-results",
      outputName: "junit.xml"
    }]
  ],
  // Use the Jest setup file
  setupFilesAfterEnv: ['./jest.setup.js'],
  // Use v8 coverage provider for better reporting
  coverageProvider: "v8",
  // Configure coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  // Output verbose coverage info
  verbose: true
};
