module.exports = {
  collectCoverage: true,
  coverageDirectory: "coverage",
  testEnvironment: "node",
  collectCoverageFrom: [
    "**/*.js",
    "!**/node_modules/**",
    "!**/__tests__/**",
    "!**/coverage/**"
  ]
};
