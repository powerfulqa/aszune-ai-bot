/**
 * ResourceOptimizer Test Suite
 * Memory-only monitoring: status, tier and recommendations come from process.memoryUsage()
 */

const ResourceOptimizer = require('../../../src/utils/resource-optimizer');

jest.mock('../../../src/config/config', () => ({
  PI_OPTIMIZATIONS: { ENABLED: false },
}));

const MB = 1024 * 1024;

/** Make process.memoryUsage report the given heap figures (MB) */
function mockHeap(usedMB, totalMB) {
  jest
    .spyOn(process, 'memoryUsage')
    .mockReturnValue({ heapUsed: usedMB * MB, heapTotal: totalMB * MB });
}

afterEach(() => jest.restoreAllMocks());

describe('ResourceOptimizer.monitorResources', () => {
  it.each([
    [50, 200, 'good', 'healthy', 'Optimal', []],
    [150, 200, 'normal', 'warning', 'Standard', []],
    [
      250,
      300,
      'high',
      'degraded',
      'High',
      [
        'WARNING: High memory usage detected - consider cache cleanup',
        'Consider enabling aggressive cache eviction',
      ],
    ],
    [
      450,
      500,
      'critical',
      'critical',
      'Critical',
      [
        'CRITICAL: Memory usage is very high - restart bot or reduce cache size',
        'Consider enabling aggressive cache eviction',
      ],
    ],
  ])('heap %iMB of %iMB', (used, total, status, overall, tier, recommendations) => {
    mockHeap(used, total);
    const result = ResourceOptimizer.monitorResources();
    expect(result).toEqual({
      memory: {
        used,
        total,
        free: total - used,
        percentage: Math.round((used / total) * 100),
        status,
      },
      overall: { status: overall },
      recommendations,
      optimizationTier: tier,
    });
  });

  it('reports no performance, network or load figures', () => {
    mockHeap(50, 200);
    const result = ResourceOptimizer.monitorResources();
    expect(Object.keys(result).sort()).toEqual([
      'memory',
      'optimizationTier',
      'overall',
      'recommendations',
    ]);
  });

  it('adds the Pi note only when Pi optimizations are enabled', () => {
    mockHeap(50, 200);
    const config = require('../../../src/config/config');
    config.PI_OPTIMIZATIONS.ENABLED = true;
    const result = ResourceOptimizer.monitorResources();
    config.PI_OPTIMIZATIONS.ENABLED = false;
    expect(result.piOptimized).toBe(true);
    expect(result.recommendations).toEqual([
      'Pi-specific optimizations enabled - monitor memory usage closely',
    ]);
    expect(ResourceOptimizer.monitorResources().piOptimized).toBeUndefined();
  });
});
