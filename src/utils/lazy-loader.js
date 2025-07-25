/**
 * Utility for lazy loading modules to avoid circular dependencies
 * and reduce initial memory usage
 */

/**
 * Creates a lazy loader function that only requires the module when called
 * @param {Function} importFn - Function that imports the module
 * @returns {Function} - Function that returns the imported module when called
 */
function lazyLoad(importFn) {
  let module;
  return function() {
    if (!module) {
      module = importFn();
    }
    return module;
  };
}

module.exports = { lazyLoad };
