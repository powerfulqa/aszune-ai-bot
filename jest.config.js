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
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Apply consistent thresholds to all service files
    "src/services/*.js": {
      branches: 67,
      functions: 80,
      lines: 78,
      statements: 78
    },
    // Allow slightly lower thresholds for utility files
    "src/utils/*.js": {
      branches: 65,
      functions: 70,
      lines: 75,
      statements: 75
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
  ],
  testMatch: [
    "**/__tests__/**/*.test.js?(x)",
    "**/?(*.)+(spec|test).js?(x)"
  ]
};
