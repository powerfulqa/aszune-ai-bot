/**
 * PerformanceTracker Reporting Tests - Performance report generation
 */

const PerformanceTracker = require('../../../src/utils/performance-tracker');

describe('PerformanceTracker - Reporting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generatePerformanceReport', () => {
    it('should generate comprehensive performance report', () => {
      const mockMetrics = [
        { duration: 2000, success: true, memoryUsage: { heapUsed: 1000000 } },
        { duration: 4000, success: false, memoryUsage: { heapUsage: 2000000 } },
        { duration: 1000, success: true, memoryUsage: { heapUsed: 3000000 } }
      ];
      
      const result = PerformanceTracker.generatePerformanceReport(mockMetrics);
      
      expect(result).toEqual({
        timestamp: expect.any(String),
        summary: {
          totalOperations: 3,
          averageResponseTime: '2333ms',
          successRate: '66.67%',
          slowOperations: 0,
          memoryTrend: 'insufficient_data'
        },
        recommendations: expect.any(Array)
      });
    });

    it('should generate recommendations for poor performance', () => {
      const mockMetrics = Array(10).fill(null).map((_, i) => ({
        duration: 4000, // High response time
        success: i < 5, // 50% success rate
        memoryUsage: { heapUsed: 1000000 * (i + 1) }
      }));
      
      const result = PerformanceTracker.generatePerformanceReport(mockMetrics);
      
      expect(result.recommendations).toContain('Consider optimizing API response times');
      expect(result.recommendations).toContain('Investigate error causes to improve success rate');
    });

    it('should generate positive recommendations for good performance', () => {
      const mockMetrics = [
        { duration: 1000, success: true, memoryUsage: { heapUsed: 1000000 } },
        { duration: 1500, success: true, memoryUsage: { heapUsed: 1100000 } },
        { duration: 800, success: true, memoryUsage: { heapUsed: 1000000 } }
      ];
      
      const result = PerformanceTracker.generatePerformanceReport(mockMetrics);
      
      expect(result.recommendations).toContain('Performance metrics are within acceptable ranges');
    });

    it('should detect slow operations issue', () => {
      const mockMetrics = Array(5).fill(null).map(() => ({
        duration: 6000, // All slow operations
        success: true,
        memoryUsage: { heapUsed: 1000000 }
      }));
      
      const result = PerformanceTracker.generatePerformanceReport(mockMetrics);
      
      expect(result.recommendations).toContain('High number of slow operations detected');
    });

    it('should detect memory leak warning', () => {
      const mockMetrics = [
        { duration: 1000, success: true, memoryUsage: { heapUsed: 1000000 } },
        { duration: 1000, success: true, memoryUsage: { heapUsed: 2000000 } },
        { duration: 1000, success: true, memoryUsage: { heapUsed: 3000000 } },
        { duration: 1000, success: true, memoryUsage: { heapUsed: 4000000 } },
        { duration: 1000, success: true, memoryUsage: { heapUsed: 5000000 } }
      ];
      
      const result = PerformanceTracker.generatePerformanceReport(mockMetrics);
      
      expect(result.recommendations).toContain('Memory usage is increasing, check for memory leaks');
    });
  });

  describe('_calculateBasicMetrics', () => {
    it('should calculate metrics correctly', () => {
      const mockMetrics = [
        { duration: 1000, success: true },
        { duration: 2000, success: false },
        { duration: 3000, success: true }
      ];
      
      const result = PerformanceTracker._calculateBasicMetrics(mockMetrics);
      
      expect(result.averageResponseTime).toBe(2000);
      expect(result.successRate).toBe(66.67);
      expect(result.slowOperations).toBe(0);
    });

    it('should count slow operations correctly', () => {
      const mockMetrics = [
        { duration: 6000, success: true }, // Slow
        { duration: 2000, success: true },
        { duration: 8000, success: true }  // Slow
      ];
      
      const result = PerformanceTracker._calculateBasicMetrics(mockMetrics);
      
      expect(result.slowOperations).toBe(2);
    });
  });

  describe('_analyzeMemoryTrend', () => {
    it('should return insufficient_data for small datasets', () => {
      const mockMetrics = [
        { memoryUsage: { heapUsed: 1000000 } },
        { memoryUsage: { heapUsed: 2000000 } }
      ];
      
      const result = PerformanceTracker._analyzeMemoryTrend(mockMetrics);
      
      expect(result).toBe('insufficient_data');
    });
  });

  describe('_generateRecommendations', () => {
    it('should recommend optimization for slow responses', () => {
      const analysis = {
        averageResponseTime: 4000,
        successRate: 95,
        slowOperations: 1,
        totalOperations: 10,
        memoryTrend: 'stable'
      };
      
      const result = PerformanceTracker._generateRecommendations(analysis);
      
      expect(result).toContain('Consider optimizing API response times');
    });

    it('should recommend error investigation for low success rate', () => {
      const analysis = {
        averageResponseTime: 2000,
        successRate: 80,
        slowOperations: 1,
        totalOperations: 10,
        memoryTrend: 'stable'
      };
      
      const result = PerformanceTracker._generateRecommendations(analysis);
      
      expect(result).toContain('Investigate error causes to improve success rate');
    });

    it('should recommend memory leak investigation', () => {
      const analysis = {
        averageResponseTime: 2000,
        successRate: 95,
        slowOperations: 1,
        totalOperations: 10,
        memoryTrend: 'increasing'
      };
      
      const result = PerformanceTracker._generateRecommendations(analysis);
      
      expect(result).toContain('Memory usage is increasing, check for memory leaks');
    });
  });
});