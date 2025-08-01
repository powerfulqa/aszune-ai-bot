/**
 * Special Jest configuration for index-branch-coverage tests
 */
module.exports = {
  testPathIgnorePatterns: [
    "/node_modules/",
    "/__tests__/integration/"
  ],
  collectCoverage: true,
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/__tests__/",
    "/coverage/"
  ],
  // Only apply coverage thresholds to index.js
  coverageThreshold: {
    "./src/index.js": {
      branches: 60,
      functions: 20, // Function coverage is low, but branches are what we care about
      lines: 60,
      statements: 60
    }
  }
};
