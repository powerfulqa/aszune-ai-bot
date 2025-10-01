/**
 * PerformanceTracker Basic Tests - API call tracking and basic metrics
 */

const PerformanceTracker = require('../../../src/utils/performance-tracker');

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('PerformanceTracker - API Call Tracking', () => {
  let logger;

  beforeEach(() => {
    logger = require('../../../src/utils/logger');
    jest.clearAllMocks();
  });

  describe('trackApiCall', () => {
    it('should track successful API call', () => {
      const result = PerformanceTracker.trackApiCall('test_operation', 1000, true, { test: 'data' });
      
      expect(result).toEqual({
        operation: 'test_operation',
        duration: 1000,
        success: true,
        metadata: { test: 'data' },
        timestamp: expect.any(String),
        memoryUsage: expect.any(Object)
      });
      
      expect(result.memoryUsage).toHaveProperty('heapUsed');
      expect(result.memoryUsage).toHaveProperty('heapTotal');
    });

    it('should log slow operations', () => {
      PerformanceTracker.trackApiCall('slow_operation', 6000, true);
      
      expect(logger.info).toHaveBeenCalledWith(
        'Slow operation detected: slow_operation took 6000ms',
        {}
      );
    });

    it('should log very slow operations', () => {
      PerformanceTracker.trackApiCall('very_slow_operation', 12000, false);
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Very slow operation detected: very_slow_operation took 12000ms',
        {}
      );
    });

    it('should track failed API call', () => {
      const result = PerformanceTracker.trackApiCall('failed_operation', 500, false);
      
      expect(result.success).toBe(false);
      expect(result.operation).toBe('failed_operation');
      expect(result.duration).toBe(500);
    });

    it('should include metadata in tracking', () => {
      const metadata = { userId: 'user123', feature: 'chat' };
      const result = PerformanceTracker.trackApiCall('chat_request', 2000, true, metadata);
      
      expect(result.metadata).toEqual(metadata);
    });
  });

  describe('analyzePerformanceTrends - Basic Cases', () => {
    it('should return default values for empty metrics', () => {
      const result = PerformanceTracker.analyzePerformanceTrends([]);
      
      expect(result).toEqual({
        averageResponseTime: 0,
        successRate: 100,
        slowOperations: 0,
        memoryTrend: 'stable',
        totalOperations: 0
      });
    });

    it('should return default values for null metrics', () => {
      const result = PerformanceTracker.analyzePerformanceTrends(null);
      
      expect(result).toEqual({
        averageResponseTime: 0,
        successRate: 100,
        slowOperations: 0,
        memoryTrend: 'stable',
        totalOperations: 0
      });
    });

    it('should analyze performance trends correctly', () => {
      const mockMetrics = [
        { duration: 1000, success: true, memoryUsage: { heapUsed: 1000000 } },
        { duration: 2000, success: true, memoryUsage: { heapUsed: 2000000 } },
        { duration: 6000, success: false, memoryUsage: { heapUsed: 3000000 } },
        { duration: 1500, success: true, memoryUsage: { heapUsed: 4000000 } },
        { duration: 3000, success: true, memoryUsage: { heapUsed: 5000000 } }
      ];
      
      const result = PerformanceTracker.analyzePerformanceTrends(mockMetrics);
      
      expect(result.averageResponseTime).toBe(2700); // (1000+2000+6000+1500+3000)/5
      expect(result.successRate).toBe(80); // 4/5 * 100
      expect(result.slowOperations).toBe(1); // 6000ms > 5000ms threshold
      expect(result.totalOperations).toBe(5);
      expect(result.memoryTrend).toBe('increasing');
    });
  });
});