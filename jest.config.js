module.exports = {
  collectCoverage: true,
  coverageDirectory: "coverage",
  testEnvironment: "node",
  collectCoverageFrom: [
    "**/*.js",
    "!**/node_modules/**",
    "!**/__tests__/**",
    "!**/coverage/**",
    "!ecosystem.config.js", // Exclude config files that are not code
    "!index copy.js"        // Exclude backup or unused files
  ],
  // Add this to ensure coverage is reported for files not required in tests
  coverageProvider: "v8"
};
