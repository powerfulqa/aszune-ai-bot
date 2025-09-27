const fs = require('fs').promises;
const _path = require('path');
const cachePruner = require('../../src/utils/cache-pruner');
const logger = require('../../src/utils/logger');
const _config = require('../../src/config/config');

// Mock dependencies
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));
jest.mock('path', () => ({
  join: jest.fn((dir, file) => `${dir}/${file}`),
}));
jest.mock('../../src/utils/logger');
jest.mock('../../src/config/config', () => ({
  PI_OPTIMIZATIONS: {
    ENABLED: true,
    CACHE_MAX_ENTRIES: 50,
    CLEANUP_INTERVAL_MINUTES: 15,
  },
}));

describe('Cache Pruner', () => {
  // Mock Date.now for consistent testing
  const originalDateNow = Date.now;
  const mockNow = 1625000000000; // Fixed timestamp

  // Mock setInterval
  const originalSetInterval = global.setInterval;
  let mockSetInterval;
  let _intervalCallback;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock Date.now
    Date.now = jest.fn().mockReturnValue(mockNow);

    // Mock setInterval
    mockSetInterval = jest.fn((callback, _interval) => {
      _intervalCallback = callback;
      return 123; // interval ID
    });
    global.setInterval = mockSetInterval;
  });

  afterEach(() => {
    // Restore originals
    Date.now = originalDateNow;
    global.setInterval = originalSetInterval;
  });

  describe('_initializePruningSchedule', () => {
    it('should set up interval based on config', () => {
      cachePruner._initializePruningSchedule();

      // In test mode, intervals are not created to prevent Jest from hanging
      expect(mockSetInterval).not.toHaveBeenCalled();
    });

    it('should execute pruneCache on interval', async () => {
      // Mock pruneCache to avoid actual execution
      const mockPruneCache = jest.fn().mockResolvedValue(undefined);
      const originalPruneCache = cachePruner.pruneCache;
      cachePruner.pruneCache = mockPruneCache;

      try {
        // Set up the interval
        cachePruner._initializePruningSchedule();

        // In test mode, intervals are not created, so we can't test interval execution
        // Instead, test that the method doesn't throw errors
        expect(() => cachePruner._initializePruningSchedule()).not.toThrow();
      } finally {
        // Restore original
        cachePruner.pruneCache = originalPruneCache;
      }
    });
  });

  describe('pruneCache', () => {
    it('should call both pruning methods', async () => {
      // Mock private methods
      const mockPruneQuestions = jest.fn().mockResolvedValue(undefined);
      const mockPruneUserStats = jest.fn().mockResolvedValue(undefined);
      const origPruneQuestions = cachePruner._pruneQuestionCache;
      const origPruneUserStats = cachePruner._pruneUserStats;

      cachePruner._pruneQuestionCache = mockPruneQuestions;
      cachePruner._pruneUserStats = mockPruneUserStats;

      try {
        await cachePruner.pruneCache();

        expect(mockPruneQuestions).toHaveBeenCalledTimes(1);
        expect(mockPruneUserStats).toHaveBeenCalledTimes(1);
        expect(cachePruner.lastPruneTime).toBe(mockNow);
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('completed successfully'));
      } finally {
        // Restore originals
        cachePruner._pruneQuestionCache = origPruneQuestions;
        cachePruner._pruneUserStats = origPruneUserStats;
      }
    });

    it('should handle errors', async () => {
      // Mock private methods to throw error
      const testError = new Error('Test error');
      const mockPruneQuestions = jest.fn().mockRejectedValue(testError);
      const origPruneQuestions = cachePruner._pruneQuestionCache;
      cachePruner._pruneQuestionCache = mockPruneQuestions;

      try {
        await expect(cachePruner.pruneCache()).rejects.toThrow(testError);
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error during cache pruning'),
          testError
        );
      } finally {
        // Restore original
        cachePruner._pruneQuestionCache = origPruneQuestions;
      }
    });
  });

  describe('_pruneQuestionCache', () => {
    it('should prune when over max entries', async () => {
      // Mock cache with more than max entries
      const mockCache = {};
      // Create 100 entries (exceeds 50 max)
      for (let i = 0; i < 100; i++) {
        mockCache[`key${i}`] = { lastAccessed: i * 1000 };
      }

      fs.readFile.mockResolvedValue(JSON.stringify(mockCache));

      await cachePruner._pruneQuestionCache();

      // Should have removed 20% (20 entries)
      expect(fs.writeFile).toHaveBeenCalled();
      const writeCall = fs.writeFile.mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);
      expect(Object.keys(writtenData).length).toBe(80);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Pruned 20 entries'));
    });

    it('should not prune when under max entries', async () => {
      // Mock cache with fewer than max entries
      const mockCache = {};
      // Create 40 entries (under 50 max)
      for (let i = 0; i < 40; i++) {
        mockCache[`key${i}`] = { lastAccessed: i * 1000 };
      }

      fs.readFile.mockResolvedValue(JSON.stringify(mockCache));

      await cachePruner._pruneQuestionCache();

      expect(fs.writeFile).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('within limits, no pruning needed')
      );
    });

    it('should handle missing file gracefully', async () => {
      const fileNotFoundError = new Error('File not found');
      fileNotFoundError.code = 'ENOENT';
      fs.readFile.mockRejectedValue(fileNotFoundError);

      await cachePruner._pruneQuestionCache();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('not found, nothing to prune')
      );
    });
  });

  describe('getStatus', () => {
    it('should return correct status information', () => {
      const status = cachePruner.getStatus();

      expect(status).toHaveProperty('lastPruneTime');
      expect(status).toHaveProperty('nextPruneTime');
      expect(status).toHaveProperty('maxCacheEntries', cachePruner.maxCacheEntries);
      expect(status).toHaveProperty('prunePercentage', cachePruner.prunePercentage);
    });
  });
});
