/**
 * Small TTL cache with in-flight de-duplication, for dashboard data that is
 * expensive to collect (metrics, external IP, service status).
 *
 * - Concurrent callers for the same key share one pending fetch, so N open
 *   dashboard tabs (or a broadcast racing a REST request) do the work once.
 * - Falsy values (0, '', false) are valid hits; only a missing entry misses.
 * - Failures propagate and are not cached, unless `errorTtl` is given — then
 *   the failure is remembered briefly so an unreachable upstream isn't hit on
 *   every poll.
 * @module utils/cached
 */

/** @type {Map<string, {value?: *, error?: Error, expires: number}>} */
const store = new Map();

/** @type {Map<string, Promise<*>>} */
const inFlight = new Map();

/**
 * Return the cached value for `key`, or run `fetchFn` and cache its result.
 * @param {string} key - Cache key
 * @param {number} ttlMs - How long a successful result stays fresh
 * @param {Function} fetchFn - Async producer
 * @param {object} [options] - Options
 * @param {number} [options.errorTtl] - Remember a failure for this long (ms)
 * @returns {Promise<*>} Cached or fresh value
 */
async function cached(key, ttlMs, fetchFn, { errorTtl = 0 } = {}) {
  const entry = store.get(key);
  if (entry && entry.expires > Date.now()) {
    if (entry.error) {
      throw entry.error;
    }
    return entry.value;
  }

  if (inFlight.has(key)) {
    return inFlight.get(key);
  }

  const pending = (async () => {
    try {
      const value = await fetchFn();
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    } catch (error) {
      if (errorTtl > 0) {
        store.set(key, { error, expires: Date.now() + errorTtl });
      }
      throw error;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, pending);
  return pending;
}

/**
 * Drop one key (or everything) from the cache.
 * @param {string} [key] - Key to invalidate; omit to clear all
 */
function invalidate(key) {
  if (key === undefined) {
    store.clear();
    return;
  }
  store.delete(key);
}

module.exports = cached;
module.exports.cached = cached;
module.exports.invalidate = invalidate;
module.exports.default = cached;
