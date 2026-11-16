/**
 * Recommendations derived from live metrics: heap pressure, cache hit rate and
 * message volume.
 */

jest.mock('../../../../src/services/database', () => ({}));
jest.mock('../../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const NOW = '2026-11-16T12:00:00.000Z';

const HEALTHY = {
  category: 'general',
  severity: 'info',
  message: 'System healthy and performing optimally',
  action: 'Continue monitoring',
  timestamp: NOW,
};
const HEAP_CRITICAL = {
  category: 'memory',
  severity: 'critical',
  message: 'Heap memory usage exceeds 90%',
  action: 'Consider cache cleanup or server restart',
  timestamp: NOW,
};
const HEAP_WARNING = {
  category: 'memory',
  severity: 'warning',
  message: 'Heap memory usage at 75%+',
  action: 'Monitor memory usage closely',
  timestamp: NOW,
};
const lowHitRate = (rate) => ({
  category: 'performance',
  severity: 'warning',
  message: `Cache hit rate is low (${rate}%)`,
  action: 'Review cache configuration and eviction policy',
  timestamp: NOW,
});
const manyMessages = (count) => ({
  category: 'database',
  severity: 'info',
  message: `Database contains ${count} messages`,
  action: 'Consider archival of old messages',
  timestamp: NOW,
});

/** Metrics with the given heap use (out of 100), cache hit rate and message count */
const metrics = (heapUsed, hitRate, totalMessages) => ({
  system: { process: { heapUsed, heapTotal: 100 } },
  cache: { hitRate },
  database: { totalMessages },
});

describe('dashboard recommendations', () => {
  let service;
  let getMetrics;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date(NOW) });
    service = require('../../../../src/services/web-dashboard');
    getMetrics = jest.spyOn(service, 'getMetrics');
  });

  it.each([
    ['all readings are comfortable', metrics(50, 80, 500), [HEALTHY]],
    ['readings sit exactly on the thresholds', metrics(75, 50, 10000), [HEALTHY]],
    ['heap use passes 75%', metrics(76, 80, 500), [HEAP_WARNING]],
    ['heap use is exactly 90%', metrics(90, 80, 500), [HEAP_WARNING]],
    ['heap use passes 90%', metrics(91, 80, 500), [HEAP_CRITICAL]],
    ['the cache hit rate drops below 50%', metrics(50, 49, 500), [lowHitRate(49)]],
    ['there are over 10000 messages', metrics(50, 80, 10001), [manyMessages(10001)]],
    [
      'everything is wrong at once',
      metrics(95, 0, 25000),
      [HEAP_CRITICAL, lowHitRate(0), manyMessages(25000)],
    ],
    ['the metrics have no sections at all', {}, [HEALTHY]],
    ['process memory is missing', { system: {}, cache: { hitRate: 10 } }, [lowHitRate(10)]],
  ])('when %s', async (_name, current, expected) => {
    getMetrics.mockResolvedValue(current);

    expect(await service.getDetailedRecommendations()).toEqual(expected);
  });

  it('falls back to a neutral note when metrics cannot be collected', async () => {
    getMetrics.mockRejectedValue(new Error('collect failed'));

    expect(await service.getDetailedRecommendations()).toEqual([
      {
        category: 'general',
        severity: 'info',
        message: 'System monitoring active',
        action: 'Continue monitoring',
        timestamp: NOW,
      },
    ]);
    expect(service.allLogs.at(-1)).toEqual({
      timestamp: NOW,
      level: 'WARN',
      message: 'Failed to generate recommendations: collect failed',
      error: null,
    });
  });
});
