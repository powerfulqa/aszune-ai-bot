/**
 * Metrics aggregation and the cache, database and reminder collectors,
 * including the fallback values used when a collector fails.
 */

jest.mock('../../../../src/services/database', () => ({
  getUserCount: jest.fn(),
  getTotalMessageCount: jest.fn(),
  getReminderStats: jest.fn(),
}));
jest.mock('../../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../../src/utils/error-handler', () => ({
  ErrorHandler: { handleError: jest.fn((error) => ({ message: error.message })) },
}));
jest.mock('../../../../src/services/perplexity-secure', () => ({
  getCacheStats: jest.fn(),
}));

const NOW = '2026-11-16T12:00:00.000Z';
const NO_REMINDERS = {
  totalReminders: 0,
  activeReminders: 0,
  completedReminders: 0,
  cancelledReminders: 0,
};
const REMINDERS = {
  totalReminders: 9,
  activeReminders: 4,
  completedReminders: 3,
  cancelledReminders: 2,
};
const COLLECTORS = [
  ['getCacheStats', 'cache', 'Cache stats'],
  ['getDatabaseStats', 'database', 'Database stats'],
  ['getReminderStats', 'reminders', 'Reminder stats'],
  ['getSystemInfo', 'system', 'System info'],
  ['getResourceData', 'resources', 'Resource data'],
  ['getAnalyticsData', 'analytics', 'Analytics data'],
];

describe('dashboard metrics', () => {
  let service;
  let databaseService;
  const warnings = () =>
    service.allLogs.filter((entry) => entry.level === 'WARN').map((entry) => entry.message);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date(NOW) });
    service = require('../../../../src/services/web-dashboard');
    databaseService = require('../../../../src/services/database');
    databaseService.getUserCount.mockReturnValue(7);
    databaseService.getTotalMessageCount.mockReturnValue(1234);
    databaseService.getReminderStats.mockReturnValue(REMINDERS);
  });

  describe('getMetrics', () => {
    it('puts each collector result under its own key', async () => {
      COLLECTORS.forEach(([method, key]) => {
        jest.spyOn(service, method).mockResolvedValue({ from: key });
      });
      service.startTime = Date.now() - 3723000;

      expect(await service.getMetrics()).toEqual({
        timestamp: NOW,
        uptime: '1h 2m',
        cache: { from: 'cache' },
        database: { from: 'database' },
        reminders: { from: 'reminders' },
        system: { from: 'system' },
        resources: { from: 'resources' },
        analytics: { from: 'analytics' },
      });
    });

    it('substitutes safe defaults for every collector that fails', async () => {
      COLLECTORS.forEach(([method, key]) => {
        jest.spyOn(service, method).mockRejectedValue(new Error(`${key} down`));
      });
      service.startTime = Date.now();

      expect(await service.getMetrics()).toEqual({
        timestamp: NOW,
        uptime: '0s',
        cache: {
          hits: 0,
          misses: 0,
          hitRate: 0,
          sets: 0,
          deletes: 0,
          evictions: 0,
          entryCount: 0,
          memoryUsage: 0,
          memoryUsageFormatted: '0 B',
          uptime: 0,
          uptimeFormatted: '0s',
        },
        database: { userCount: 0, totalMessages: 0, reminders: NO_REMINDERS },
        reminders: NO_REMINDERS,
        system: {
          platform: 'unknown',
          arch: 'unknown',
          nodeVersion: 'unknown',
          uptime: 0,
          uptimeFormatted: '0s',
          externalIp: 'Not available',
          memory: { usagePercent: 0 },
          cpu: { loadPercent: 0, loadAverage: [0, 0, 0] },
        },
        resources: {
          memory: { status: 'unknown', used: 0, free: 0, percentage: 0 },
          optimizationTier: 'unknown',
        },
        analytics: { summary: { totalUsers: 0 }, recentErrors: [] },
      });
      expect(warnings()).toEqual(COLLECTORS.map(([, key, label]) => `${label} error: ${key} down`));
    });

    it('shares one collection between calls inside the cache window', async () => {
      const collect = jest
        .spyOn(service, '_collectAllMetrics')
        .mockResolvedValue([1, 2, 3, 4, 5, 6]);

      const first = await service.getMetrics();
      jest.advanceTimersByTime(4999);
      const second = await service.getMetrics();
      jest.advanceTimersByTime(1);
      const third = await service.getMetrics();

      expect(second).toBe(first);
      expect(third.timestamp).toBe('2026-11-16T12:00:05.000Z');
      expect(collect).toHaveBeenCalledTimes(2);
    });

    it('rethrows when the collection itself fails', async () => {
      jest.spyOn(service, '_collectAllMetrics').mockRejectedValue(new Error('aggregate failed'));

      await expect(service.getMetrics()).rejects.toThrow('aggregate failed');

      expect(service.errorLogs.at(-1).message).toBe('Metrics aggregation error: aggregate failed');
    });
  });

  describe('getCacheStats', () => {
    it('returns the Perplexity service cache stats', async () => {
      const perplexityService = require('../../../../src/services/perplexity-secure');
      perplexityService.getCacheStats.mockReturnValue({ hits: 8, misses: 2, hitRate: 80 });

      expect(await service.getCacheStats()).toEqual({ hits: 8, misses: 2, hitRate: 80 });
    });

    it('returns empty stats when the cache cannot be read', async () => {
      const perplexityService = require('../../../../src/services/perplexity-secure');
      perplexityService.getCacheStats.mockImplementation(() => {
        throw new Error('cache not ready');
      });

      expect(await service.getCacheStats()).toEqual({
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        evictions: 0,
        hitRate: 0,
        entryCount: 0,
        memoryUsage: 0,
        memoryUsageFormatted: '0 B',
        maxMemory: 0,
        maxMemoryFormatted: '0 B',
        maxSize: 0,
        uptime: 0,
        uptimeFormatted: '0s',
        evictionStrategy: 'hybrid',
      });
      expect(warnings()).toEqual(['Failed to get cache stats: cache not ready']);
    });
  });

  describe('getDatabaseStats', () => {
    it('reports users, messages and reminder counts', async () => {
      expect(await service.getDatabaseStats()).toEqual({
        userCount: 7,
        totalMessages: 1234,
        reminders: REMINDERS,
      });
    });

    it('reports zero for counters the database service does not provide', async () => {
      databaseService.getUserCount = undefined;
      databaseService.getTotalMessageCount = undefined;

      expect(await service.getDatabaseStats()).toEqual({
        userCount: 0,
        totalMessages: 0,
        reminders: REMINDERS,
      });
    });

    it('reports zeros when the database fails', async () => {
      databaseService.getUserCount.mockImplementation(() => {
        throw new Error('SQLITE_BUSY');
      });

      expect(await service.getDatabaseStats()).toEqual({
        userCount: 0,
        totalMessages: 0,
        reminders: NO_REMINDERS,
      });
      expect(warnings()).toEqual(['Failed to get database stats: SQLITE_BUSY']);
    });
  });

  describe('getReminderStats', () => {
    it('returns the database reminder stats', async () => {
      expect(await service.getReminderStats()).toEqual(REMINDERS);
    });

    it('reports zeros when the database fails', async () => {
      databaseService.getReminderStats.mockImplementation(() => {
        throw new Error('SQLITE_BUSY');
      });

      expect(await service.getReminderStats()).toEqual(NO_REMINDERS);
      expect(warnings()).toEqual(['Failed to get reminder stats: SQLITE_BUSY']);
    });
  });
});
