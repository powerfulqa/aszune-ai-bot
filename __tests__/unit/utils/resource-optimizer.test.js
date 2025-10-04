/**
 * ResourceOptimizer Test Suite
 * Tests for dynamic resource allocation and optimization
 */

const ResourceOptimizer = require('../../../src/utils/resource-optimizer');

// Mock logger to prevent actual logging during tests
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock config module
jest.mock('../../../src/config/config', () => ({
  PI_OPTIMIZATIONS: false,
  MAX_MEMORY_USAGE: 500,
  PERFORMANCE_THRESHOLDS: {
    RESPONSE_TIME_WARNING: 3000,
    RESPONSE_TIME_CRITICAL: 5000,
    ERROR_RATE_WARNING: 5,
    ERROR_RATE_CRITICAL: 10,
  },
}));

describe('ResourceOptimizer - optimizeForServerCount', () => {
  it('should optimize for small server count', () => {
    const result = ResourceOptimizer.optimizeForServerCount(5, 50, {});

    expect(result.tier).toBe('small');
    expect(result.memoryAllocation).toBeLessThanOrEqual(128);
    expect(result.cacheSize).toBeLessThanOrEqual(50);
    expect(result.maxConcurrentRequests).toBeLessThanOrEqual(20);
  });

  it('should optimize for medium server count', () => {
    const result = ResourceOptimizer.optimizeForServerCount(25, 250, {});

    expect(result.tier).toBe('medium');
    expect(result.memoryAllocation).toBeGreaterThan(128);
    expect(result.memoryAllocation).toBeLessThanOrEqual(256);
    expect(result.cacheSize).toBeGreaterThan(50);
    expect(result.maxConcurrentRequests).toBeGreaterThan(20);
  });

  it('should optimize for large server count', () => {
    const result = ResourceOptimizer.optimizeForServerCount(75, 750, {});

    expect(result.tier).toBe('large');
    expect(result.memoryAllocation).toBeGreaterThan(256);
    expect(result.cacheSize).toBeGreaterThan(100);
    expect(result.maxConcurrentRequests).toBeGreaterThan(40);
  });

  it('should optimize for enterprise server count', () => {
    const result = ResourceOptimizer.optimizeForServerCount(150, 1500, {});

    expect(result.tier).toBe('enterprise');
    expect(result.memoryAllocation).toBeGreaterThan(400);
    expect(result.cacheSize).toBeGreaterThan(200);
    expect(result.maxConcurrentRequests).toBeGreaterThan(80);
  });

  it('should apply performance adjustments', () => {
    const slowPerformance = { avgResponseTime: 4000, errorRate: 8 };
    const result = ResourceOptimizer.optimizeForServerCount(25, 250, slowPerformance);

    expect(result.performanceAdjustments).toBeDefined();
    expect(result.performanceAdjustments.responseTimeAdjustment).toBeTruthy();
    expect(result.performanceAdjustments.errorRateAdjustment).toBeTruthy();
  });

  it('should handle zero servers gracefully', () => {
    const result = ResourceOptimizer.optimizeForServerCount(0, 0, {});

    expect(result.tier).toBe('small');
    expect(result.memoryAllocation).toBeDefined();
    expect(result.cacheSize).toBeDefined();
  });
});

describe('ResourceOptimizer - monitorResources', () => {
  let mockMetrics;

  beforeEach(() => {
    mockMetrics = {
      avgResponseTime: 2000,
      errorRate: 3,
      cpuUsage: 60,
    };
  });

  it('should monitor resource status correctly', () => {
    const result = ResourceOptimizer.monitorResources(mockMetrics);

    expect(result).toHaveProperty('memory');
    expect(result).toHaveProperty('performance');
    expect(result).toHaveProperty('network');
    expect(result).toHaveProperty('overall');
    expect(result).toHaveProperty('recommendations');
  });

  it('should detect good performance status', () => {
    const goodMetrics = { avgResponseTime: 1000, errorRate: 1, cpuUsage: 30 };
    const result = ResourceOptimizer.monitorResources(goodMetrics);

    expect(result.performance.status).toBe('good');
    expect(['healthy', 'warning', 'degraded', 'critical']).toContain(result.overall.status); // Depends on actual memory usage
  });

  it('should detect poor performance status', () => {
    const poorMetrics = { avgResponseTime: 6000, errorRate: 15, cpuUsage: 90 };
    const result = ResourceOptimizer.monitorResources(poorMetrics);

    expect(result.performance.status).toBe('poor');
    expect(result.overall.status).toBe('critical');
  });

  it('should calculate memory usage correctly', () => {
    const result = ResourceOptimizer.monitorResources(mockMetrics);

    expect(result.memory).toHaveProperty('used');
    expect(result.memory).toHaveProperty('total');
    expect(result.memory).toHaveProperty('percentage');
    expect(result.memory).toHaveProperty('status');
  });

  it('should provide appropriate recommendations', () => {
    const highUsageMetrics = { avgResponseTime: 4000, errorRate: 8, cpuUsage: 85 };
    const result = ResourceOptimizer.monitorResources(highUsageMetrics);

    expect(Array.isArray(result.recommendations)).toBe(true);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('should include free memory field in monitoring results', () => {
    const result = ResourceOptimizer.monitorResources(mockMetrics);

    expect(result.memory).toHaveProperty('free');
    expect(typeof result.memory.free).toBe('number');
    expect(result.memory.free).toBeGreaterThanOrEqual(0);
    expect(result.memory.used + result.memory.free).toBeLessThanOrEqual(result.memory.total);
  });

  it('should include load field in performance monitoring', () => {
    const result = ResourceOptimizer.monitorResources(mockMetrics);

    expect(result.performance).toHaveProperty('load');
    expect(['light', 'moderate', 'heavy']).toContain(result.performance.load);
  });

  it('should include optimizationTier field', () => {
    const result = ResourceOptimizer.monitorResources(mockMetrics);

    expect(result).toHaveProperty('optimizationTier');
    expect(['Optimal', 'Standard', 'High', 'Critical']).toContain(result.optimizationTier);
  });

  it('should determine load correctly based on metrics', () => {
    const lightLoad = ResourceOptimizer.monitorResources({
      avgResponseTime: 500,
      cpuUsage: 30,
      errorRate: 1,
    });
    expect(lightLoad.performance.load).toBe('light');

    const moderateLoad = ResourceOptimizer.monitorResources({
      avgResponseTime: 1500,
      cpuUsage: 60,
      errorRate: 3,
    });
    expect(moderateLoad.performance.load).toBe('moderate');

    const heavyLoad = ResourceOptimizer.monitorResources({
      avgResponseTime: 3000,
      cpuUsage: 90,
      errorRate: 8,
    });
    expect(heavyLoad.performance.load).toBe('heavy');
  });
});

describe('ResourceOptimizer - applyDynamicScaling', () => {
  it('should apply scaling for increasing load', () => {
    const currentConfig = { memoryAllocation: 200, cacheSize: 100, maxConcurrentRequests: 50 };
    const metrics = { avgResponseTime: 4500, errorRate: 7, serverCount: 75 };

    const result = ResourceOptimizer.applyDynamicScaling(currentConfig, metrics);

    expect(result.scaled).toBe(true);
    expect(result.adjustments).toBeDefined();
    expect(result.newConfig.memoryAllocation).toBeGreaterThanOrEqual(
      currentConfig.memoryAllocation
    );
  });

  it('should not scale when performance is good', () => {
    const currentConfig = { memoryAllocation: 200, cacheSize: 100, maxConcurrentRequests: 50 };
    const metrics = { avgResponseTime: 1500, errorRate: 2, serverCount: 25 };

    const result = ResourceOptimizer.applyDynamicScaling(currentConfig, metrics);

    expect(result.scaled).toBe(false);
    expect(result.reason).toContain('performance is within acceptable limits');
  });

  it('should handle missing metrics gracefully', () => {
    const currentConfig = { memoryAllocation: 200, cacheSize: 100, maxConcurrentRequests: 50 };
    const incompleteMetrics = { avgResponseTime: 2000 };

    const result = ResourceOptimizer.applyDynamicScaling(currentConfig, incompleteMetrics);

    expect(result).toBeDefined();
    expect(result.scaled).toBeDefined();
  });
});

describe('ResourceOptimizer - generateOptimizationRecommendations', () => {
  let mockAnalytics, mockPerformance;

  beforeEach(() => {
    mockAnalytics = {
      summary: {
        totalServers: 30,
        totalUsers: 300,
        errorRate: 5,
      },
    };

    mockPerformance = {
      averageResponseTime: 2500,
      slowOperations: 15,
      totalOperations: 100,
    };
  });

  it('should generate recommendations based on analytics and performance', () => {
    const result = ResourceOptimizer.generateOptimizationRecommendations(
      mockAnalytics,
      mockPerformance
    );

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should recommend scaling for high server count', () => {
    mockAnalytics.summary.totalServers = 80;
    const result = ResourceOptimizer.generateOptimizationRecommendations(
      mockAnalytics,
      mockPerformance
    );

    const scalingRecommendation = result.find((r) => r.includes('scaling') || r.includes('server'));
    expect(scalingRecommendation).toBeDefined();
  });

  it('should recommend performance improvements for slow response times', () => {
    mockPerformance.averageResponseTime = 4500;
    const result = ResourceOptimizer.generateOptimizationRecommendations(
      mockAnalytics,
      mockPerformance
    );

    const performanceRecommendation = result.find(
      (r) => r.includes('performance') || r.includes('response')
    );
    expect(performanceRecommendation).toBeDefined();
  });

  it('should recommend error investigation for high error rates', () => {
    mockAnalytics.summary.errorRate = 12;
    const result = ResourceOptimizer.generateOptimizationRecommendations(
      mockAnalytics,
      mockPerformance
    );

    const errorRecommendation = result.find(
      (r) => r.includes('error') || r.includes('reliability')
    );
    expect(errorRecommendation).toBeDefined();
  });

  it('should handle empty or null inputs gracefully', () => {
    expect(() => ResourceOptimizer.generateOptimizationRecommendations(null, null)).not.toThrow();
    expect(() => ResourceOptimizer.generateOptimizationRecommendations({}, {})).not.toThrow();
  });
});

describe('ResourceOptimizer - Pi Optimizations', () => {
  beforeEach(() => {
    // Mock Pi environment
    const config = require('../../../src/config/config');
    config.PI_OPTIMIZATIONS = true;
  });

  afterEach(() => {
    // Reset Pi optimizations
    const config = require('../../../src/config/config');
    config.PI_OPTIMIZATIONS = false;
  });

  it('should apply Pi-specific optimizations when enabled', () => {
    const result = ResourceOptimizer.optimizeForServerCount(25, 250, {});

    expect(result.piOptimizations).toBe(true);
    expect(result.memoryAllocation).toBeLessThan(256); // Pi has memory constraints
  });

  it('should monitor resources with Pi constraints', () => {
    const metrics = { avgResponseTime: 2000, errorRate: 3, cpuUsage: 70 };
    const result = ResourceOptimizer.monitorResources(metrics);

    expect(result.piOptimized).toBe(true);
    expect(result.recommendations.some((r) => r.includes('Pi'))).toBe(true);
  });
});

describe('ResourceOptimizer - Error Handling', () => {
  it('should handle invalid server counts gracefully', () => {
    expect(() => ResourceOptimizer.optimizeForServerCount(-1, 100, {})).not.toThrow();
    expect(() => ResourceOptimizer.optimizeForServerCount(NaN, 100, {})).not.toThrow();
    expect(() => ResourceOptimizer.optimizeForServerCount('invalid', 100, {})).not.toThrow();
  });

  it('should handle invalid metrics gracefully', () => {
    expect(() => ResourceOptimizer.monitorResources(null)).not.toThrow();
    expect(() => ResourceOptimizer.monitorResources(undefined)).not.toThrow();
    expect(() => ResourceOptimizer.monitorResources({})).not.toThrow();
  });

  it('should provide fallback values for missing data', () => {
    const result = ResourceOptimizer.optimizeForServerCount();

    expect(result.tier).toBeDefined();
    expect(result.memoryAllocation).toBeDefined();
    expect(result.cacheSize).toBeDefined();
    expect(result.maxConcurrentRequests).toBeDefined();
  });
});

describe('ResourceOptimizer - Performance', () => {
  it('should optimize quickly for large datasets', () => {
    const startTime = Date.now();

    for (let i = 0; i < 1000; i++) {
      ResourceOptimizer.optimizeForServerCount(i % 100, i * 10, {});
    }

    const endTime = Date.now();
    expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
  });

  it('should not consume excessive memory during optimization', () => {
    const memoryBefore = process.memoryUsage().heapUsed;

    for (let i = 0; i < 1000; i++) {
      ResourceOptimizer.monitorResources({
        avgResponseTime: 1000 + (i % 500),
        errorRate: i % 10,
        cpuUsage: 30 + (i % 40),
      });
    }

    const memoryAfter = process.memoryUsage().heapUsed;
    const memoryIncrease = (memoryAfter - memoryBefore) / 1024 / 1024; // MB

    expect(memoryIncrease).toBeLessThan(20); // Should not increase memory by more than 20MB
  });
});
