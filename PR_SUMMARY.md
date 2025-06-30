# Cache Service Improvements

This PR addresses all the Codecov AI review suggestions to improve the cache service and overall project quality.

## Changes

### Configuration Improvements
- Made cache save interval configurable through environment variables with environment-specific defaults
- Added different default cache sizes based on environment (production, development, test)
- Updated configuration to be centralized in `config.js` file
- Added specific LRU thresholds based on environment

### Error Handling
- Created custom error types in `src/utils/errors.js` for better error handling
- Updated cache service to use these custom error types
- Improved error reporting with detailed error contexts

### Performance Optimizations
- Added in-memory LRU cache to reduce disk reads for frequent cache hits
- Optimized similarity function for large caches:
  - Added early rejection based on string length ratios
  - Implemented optimized intersection calculation
  - Added sampling for very large token sets
  - Removed common stop words from similarity calculation

### Async/Await Support
- Refactored cache initialization to use async/await
- Added async versions of file operations
- Maintained backward compatibility with sync methods

### Testing Improvements
- Added property-based tests using `fast-check` for hash and similarity functions
- Updated Jest configuration with consistent coverage thresholds across service files
- Added npm scripts for property testing and linting

### Package and Workflow
- Updated repository URL to git+https format for better compatibility
- Added husky for pre-commit hooks
- Updated Codecov dependency to v4
- Added ESLint and lint-staged for better code quality
- Added security audit npm scripts with different levels for dev vs production

## How to Test
1. Run tests with property-based testing: `npm run test:property`
2. Test the cache service with different environment variables:
   ```
   ASZUNE_CACHE_SAVE_INTERVAL_MS=60000 npm run start
   ```
3. Check memory usage improvements with large caches

## Follow-up Tasks
- Consider adding more property-based tests for other critical components
- Implement CI workflow improvements from Codecov AI suggestions
