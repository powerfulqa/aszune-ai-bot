/**
 * Cache Pruner mock for testing
 */

const cachePrunerMock = {
  pruneCache: jest.fn().mockResolvedValue(),
  getStatus: jest.fn().mockReturnValue({
    lastPruneTime: Date.now(),
    nextPruneTime: Date.now() + 1800000,
    maxCacheEntries: 100,
    prunePercentage: 0.2
  })
};

module.exports = cachePrunerMock;
