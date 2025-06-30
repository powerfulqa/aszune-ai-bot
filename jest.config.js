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
  // Use the Jest setup file
  setupFilesAfterEnv: ['./jest.setup.js'],
  // Use v8 coverage provider for better reporting
  coverageProvider: "v8",
  // Configure coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 90,
      statements: 90
    },
    "src/services/cache.js": {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },
  // Output verbose coverage info
  verbose: true,
  // Configure JUnit reporter with enhanced settings
  reporters: [
    "default",
    ["jest-junit", {
      outputDirectory: "./test-results",
      outputName: "junit.xml",
      classNameTemplate: "{classname}",
      titleTemplate: "{classname} {title}",
      ancestorSeparator: " ",
      usePathForSuiteName: "true"
    }]
  ]
};
