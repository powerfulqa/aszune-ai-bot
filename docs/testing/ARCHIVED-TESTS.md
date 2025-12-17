# Archived / Removed Tests

This document records test files that were removed from Jest discovery because they were placeholders (or permanently skipped) and only added noise to CI output.

## Removed from Jest discovery

### Archived index branch coverage suites

The following files were permanently skipped (archived) and replaced by the index critical coverage tests:

- `__tests__/unit/index-branch-coverage-core.test.js`
- `__tests__/unit/index-branch-coverage-events.test.js`
- `__tests__/unit/index-branch-coverage-functions.test.js`

Rationale: these were placeholder suites that stayed as `describe.skip(...)` due to historical Jest module mocking edge cases.

### Placeholder production optimisation suite

- `__tests__/unit/index.production-optimizations.test.js`

Rationale: this was a placeholder (`it.skip`) and did not validate behaviour.

### Placeholder boot error-branch suite

- `__tests__/unit/index-critical-coverage.boot.test.js`

Rationale: the file contained only skipped tests; leaving it in-place produced “skipped” noise without adding signal.

## Notes

- Restart behaviour is now exercised via runnable unit tests in `__tests__/unit/services/web-dashboard.test.js`.
- Where behaviour is covered via other suites (or integration/runtime validation), we prefer removing placeholder skipped tests rather than keeping them as `it.skip(...)`.
