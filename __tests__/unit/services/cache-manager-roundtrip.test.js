jest.mock('../../../src/utils/logger');

// Uses the real EnhancedCache on purpose: with it mocked, a size limit that
// rejected every entry went unnoticed.
const { CacheManager } = require('../../../src/services/cache-manager');

describe('CacheManager with the real cache', () => {
  it('stores a full-length answer and returns it for the same history', async () => {
    const cacheManager = new CacheManager();
    const history = [{ role: 'user', content: 'What is the best class in WoW?' }];
    const answer = 'x'.repeat(3000);

    await cacheManager.trySaveToCache(history, answer);

    expect(await cacheManager.tryGetFromCache(history)).toBe(answer);
    expect(cacheManager.getStats().entryCount).toBe(1);
  });
});
