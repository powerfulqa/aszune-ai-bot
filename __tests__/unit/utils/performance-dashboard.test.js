/**
 * PerformanceDashboard Test Suite
 * Tests for unified performance monitoring and dashboard functionality
 */

const PerformanceDashboard = require('../../../src/utils/performance-dashboard');

// Mock dependencies
jest.mock('../../../src/utils/discord-analytics', () => ({
  generateDailyReport: jest.fn(),
  analyzeUsagePatterns: jest.fn()
}));

jest.mock('../../../src/utils/resource-optimizer', () => ({
  optimizeForServerCount: jest.fn(),
  monitorResources: jest.fn(),
  generateOptimizationRecommendations: jest.fn()
}));

jest.mock('../../../src/utils/performance-tracker', () => ({
  analyzePerformanceTrends: jest.fn(),
  generatePerformanceReport: jest.fn()
}));

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const DiscordAnalytics = require('../../../src/utils/discord-analytics');
const ResourceOptimizer = require('../../../src/utils/resource-optimizer');
const PerformanceTracker = require('../../../src/utils/performance-tracker');

describe('PerformanceDashboard - generateDashboardReport', () => {
  let mockActivityHistory, mockPerformanceMetrics;

  beforeEach(() => {
    jest.clearAllMocks();

    mockActivityHistory = [
      { serverId: 'server1', action: 'command_executed', timestamp: new Date().toISOString() }
    ];

    mockPerformanceMetrics = [
      { operation: 'api_call', responseTime: 200, success: true, timestamp: new Date().toISOString() }
    ];

    // Setup mock returns
    DiscordAnalytics.generateDailyReport.mockReturnValue({
      summary: {
        totalServers: 5,
        totalUsers: 50,
        totalCommands: 100,
        errorRate: 3
      }
    });

    DiscordAnalytics.analyzeUsagePatterns.mockReturnValue({
      commandPopularity: [{ command: 'help', count: 20 }],
      userEngagement: 'medium',
      growthTrend: 'growing'
    });

    PerformanceTracker.analyzePerformanceTrends.mockReturnValue({
      averageResponseTime: 250,
      successRate: 97,
      slowOperations: 5,
      totalOperations: 100
    });

    PerformanceTracker.generatePerformanceReport.mockReturnValue({
      summary: 'Performance is good'
    });

    ResourceOptimizer.optimizeForServerCount.mockReturnValue({
      tier: 'small',
      memoryAllocation: 128,
      cacheSize: 50
    });

    ResourceOptimizer.monitorResources.mockReturnValue({
      memory: { used: 150, status: 'normal' },
      performance: { status: 'good' }
    });

    ResourceOptimizer.generateOptimizationRecommendations.mockReturnValue([
      'Consider upgrading to medium tier for better performance'
    ]);
  });

  it('should generate comprehensive dashboard report', () => {
    const report = PerformanceDashboard.generateDashboardReport(mockActivityHistory, mockPerformanceMetrics);

    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('overview');
    expect(report).toHaveProperty('analytics');
    expect(report).toHaveProperty('performance');
    expect(report).toHaveProperty('resources');
    expect(report).toHaveProperty('security');
    expect(report).toHaveProperty('actionItems');
    expect(report).toHaveProperty('nextSteps');
  });

  it('should include correct overview information', () => {
    const report = PerformanceDashboard.generateDashboardReport(mockActivityHistory, mockPerformanceMetrics);

    expect(report.overview.serverCount).toBe(5);
    expect(report.overview.activeUsers).toBe(50);
    expect(report.overview.totalCommands).toBe(100);
    expect(report.overview.errorRate).toBe('3%');
    expect(report.overview.averageResponseTime).toBe('250ms');
    expect(report.overview.optimizationTier).toBe('small');
  });

  it('should call all required service methods', () => {
    PerformanceDashboard.generateDashboardReport(mockActivityHistory, mockPerformanceMetrics);

    expect(DiscordAnalytics.generateDailyReport).toHaveBeenCalledWith(mockActivityHistory);
    expect(DiscordAnalytics.analyzeUsagePatterns).toHaveBeenCalledWith(mockActivityHistory);
    expect(PerformanceTracker.analyzePerformanceTrends).toHaveBeenCalledWith(mockPerformanceMetrics);
    expect(PerformanceTracker.generatePerformanceReport).toHaveBeenCalledWith(mockPerformanceMetrics);
    expect(ResourceOptimizer.optimizeForServerCount).toHaveBeenCalled();
    expect(ResourceOptimizer.monitorResources).toHaveBeenCalled();
  });

  it('should handle empty input gracefully', () => {
    const report = PerformanceDashboard.generateDashboardReport([], []);

    expect(report).toBeDefined();
    expect(report.overview).toBeDefined();
    expect(report.analytics).toBeDefined();
    expect(report.performance).toBeDefined();
  });
});

describe('PerformanceDashboard - getRealTimeStatus', () => {
  it('should return real-time status information', () => {
    const status = PerformanceDashboard.getRealTimeStatus();

    expect(status).toHaveProperty('timestamp');
    expect(status).toHaveProperty('uptime');
    expect(status).toHaveProperty('memory');
    expect(status).toHaveProperty('status');
    expect(status).toHaveProperty('lastUpdate');
  });

  it('should include uptime in seconds and formatted', () => {
    const status = PerformanceDashboard.getRealTimeStatus();

    expect(typeof status.uptime.seconds).toBe('number');
    expect(typeof status.uptime.formatted).toBe('string');
    expect(status.uptime.formatted).toMatch(/\d+d \d+h \d+m/);
  });

  it('should include memory usage information', () => {
    const status = PerformanceDashboard.getRealTimeStatus();

    expect(typeof status.memory.used).toBe('number');
    expect(typeof status.memory.total).toBe('number');
    expect(typeof status.memory.percentage).toBe('number');
    expect(status.memory.percentage).toBeGreaterThanOrEqual(0);
    expect(status.memory.percentage).toBeLessThanOrEqual(100);
  });

  it('should have online status', () => {
    const status = PerformanceDashboard.getRealTimeStatus();

    expect(status.status).toBe('online');
  });
});

describe('PerformanceDashboard - generateAlerts', () => {
  it('should generate memory alerts for high usage', () => {
    const metrics = { memoryUsage: 450, avgResponseTime: 2000, errorRate: 2 };
    const alerts = PerformanceDashboard.generateAlerts(metrics);

    const memoryAlert = alerts.find(a => a.type === 'memory');
    expect(memoryAlert).toBeDefined();
    expect(memoryAlert.severity).toBe('critical');
    expect(memoryAlert.message).toContain('Memory usage is critically high');
  });

  it('should generate performance alerts for slow response times', () => {
    const metrics = { memoryUsage: 100, avgResponseTime: 6000, errorRate: 2 };
    const alerts = PerformanceDashboard.generateAlerts(metrics);

    const performanceAlert = alerts.find(a => a.type === 'performance');
    expect(performanceAlert).toBeDefined();
    expect(performanceAlert.severity).toBe('critical');
    expect(performanceAlert.message).toContain('Response time is very slow');
  });

  it('should generate reliability alerts for high error rates', () => {
    const metrics = { memoryUsage: 100, avgResponseTime: 2000, errorRate: 12 };
    const alerts = PerformanceDashboard.generateAlerts(metrics);

    const reliabilityAlert = alerts.find(a => a.type === 'reliability');
    expect(reliabilityAlert).toBeDefined();
    expect(reliabilityAlert.severity).toBe('critical');
    expect(reliabilityAlert.message).toContain('Error rate is critically high');
  });

  it('should not generate alerts for good metrics', () => {
    const metrics = { memoryUsage: 100, avgResponseTime: 1500, errorRate: 2 };
    const alerts = PerformanceDashboard.generateAlerts(metrics);

    expect(alerts).toHaveLength(0);
  });

  it('should generate warning alerts for elevated metrics', () => {
    const metrics = { memoryUsage: 250, avgResponseTime: 3500, errorRate: 7 };
    const alerts = PerformanceDashboard.generateAlerts(metrics);

    expect(alerts).toHaveLength(3);
    alerts.forEach(alert => {
      expect(alert.severity).toBe('warning');
    });
  });

  it('should include timestamp in alerts', () => {
    const metrics = { memoryUsage: 450, avgResponseTime: 2000, errorRate: 2 };
    const alerts = PerformanceDashboard.generateAlerts(metrics);

    alerts.forEach(alert => {
      expect(alert.timestamp).toBeDefined();
      expect(new Date(alert.timestamp)).toBeInstanceOf(Date);
    });
  });
});

describe('PerformanceDashboard - exportDashboardData', () => {
  let mockDashboardData;

  beforeEach(() => {
    mockDashboardData = {
      timestamp: '2024-01-15T10:00:00.000Z',
      overview: {
        status: 'healthy',
        serverCount: 5,
        activeUsers: 50,
        totalCommands: 100,
        errorRate: '3%',
        averageResponseTime: '250ms',
        memoryUsage: '150MB',
        optimizationTier: 'small'
      }
    };
  });

  it('should export as JSON by default', () => {
    const exported = PerformanceDashboard.exportDashboardData(mockDashboardData);
    const parsed = JSON.parse(exported);

    expect(parsed.timestamp).toBe(mockDashboardData.timestamp);
    expect(parsed.overview.status).toBe('healthy');
  });

  it('should export as JSON when explicitly specified', () => {
    const exported = PerformanceDashboard.exportDashboardData(mockDashboardData, 'json');
    const parsed = JSON.parse(exported);

    expect(parsed.overview.serverCount).toBe(5);
  });

  it('should export as CSV format', () => {
    const exported = PerformanceDashboard.exportDashboardData(mockDashboardData, 'csv');

    expect(exported).toContain('Status,Server Count,Active Users,Commands,Error Rate,Response Time,Memory Usage');
    expect(exported).toContain('healthy,5,50,100,3%,250ms,150MB');
  });

  it('should export as text format', () => {
    const exported = PerformanceDashboard.exportDashboardData(mockDashboardData, 'text');

    expect(exported).toContain('Discord Bot Performance Dashboard');
    expect(exported).toContain('Status: healthy');
    expect(exported).toContain('Servers: 5');
    expect(exported).toContain('Active Users: 50');
    expect(exported).toContain('Error Rate: 3%');
  });

  it('should fallback to JSON for unknown formats', () => {
    const exported = PerformanceDashboard.exportDashboardData(mockDashboardData, 'unknown');
    const parsed = JSON.parse(exported);

    expect(parsed.overview.status).toBe('healthy');
  });
});

describe('PerformanceDashboard - Private Methods', () => {
  it('should calculate overall status correctly for healthy system', () => {
    const analytics = { summary: { errorRate: 2, totalCommands: 100 } };
    const performance = { averageResponseTime: 2000, slowOperations: 5, totalOperations: 100 };
    const resources = { memory: { status: 'normal' }, performance: { status: 'good' } };

    const status = PerformanceDashboard._calculateOverallStatus(analytics, performance, resources);
    expect(status).toBe('healthy');
  });

  it('should calculate overall status correctly for critical system', () => {
    const analytics = { summary: { errorRate: 15, totalCommands: 100 } };
    const performance = { averageResponseTime: 6000, slowOperations: 50, totalOperations: 100 };
    const resources = { memory: { status: 'critical' }, performance: { status: 'poor' } };

    const status = PerformanceDashboard._calculateOverallStatus(analytics, performance, resources);
    expect(status).toBe('critical');
  });

  it('should format uptime correctly', () => {
    const uptime = 90061; // 1 day, 1 hour, 1 minute, 1 second
    const formatted = PerformanceDashboard._formatUptime(uptime);

    expect(formatted).toBe('1d 1h 1m');
  });

  it('should generate insights from analytics patterns', () => {
    const analyticsReport = { summary: { totalCommands: 500 } };
    const usagePatterns = { 
      growthTrend: 'growing',
      userEngagement: 'high',
      commandPopularity: [{ command: 'help', count: 100 }],
      peakUsageHours: ['14', '15', '16']
    };

    const insights = PerformanceDashboard._generateInsights(analyticsReport, usagePatterns);

    expect(Array.isArray(insights)).toBe(true);
    expect(insights.length).toBeGreaterThan(0);
    expect(insights.some(i => i.includes('growing'))).toBe(true);
    expect(insights.some(i => i.includes('help'))).toBe(true);
  });
});

describe('PerformanceDashboard - Error Handling', () => {
  it('should handle missing dependencies gracefully', () => {
    // Reset mocks to return undefined
    DiscordAnalytics.generateDailyReport.mockReturnValue(undefined);
    PerformanceTracker.analyzePerformanceTrends.mockReturnValue(undefined);

    expect(() => {
      PerformanceDashboard.generateDashboardReport([], []);
    }).not.toThrow();
  });

  it('should handle null inputs gracefully', () => {
    expect(() => {
      PerformanceDashboard.generateDashboardReport(null, null);
    }).not.toThrow();

    expect(() => {
      PerformanceDashboard.generateAlerts(null);
    }).not.toThrow();

    expect(() => {
      PerformanceDashboard.exportDashboardData(null);
    }).not.toThrow();
  });

  it('should provide fallback values when services fail', () => {
    DiscordAnalytics.generateDailyReport.mockImplementation(() => {
      throw new Error('Service unavailable');
    });

    // Should not throw and should provide reasonable defaults
    expect(() => {
      PerformanceDashboard.generateDashboardReport([], []);
    }).not.toThrow(); // Now with null safety, it should not throw
  });
});

describe('PerformanceDashboard - Performance', () => {
  it('should generate dashboard quickly', () => {
    const startTime = Date.now();
    
    for (let i = 0; i < 100; i++) {
      PerformanceDashboard.generateDashboardReport([], []);
    }
    
    const endTime = Date.now();
    expect(endTime - startTime).toBeLessThan(2000); // Should complete in under 2 seconds
  });

  it('should handle large alert datasets efficiently', () => {
    const largeMetrics = {
      memoryUsage: 500,
      avgResponseTime: 6000,
      errorRate: 15
    };

    const startTime = Date.now();
    
    for (let i = 0; i < 1000; i++) {
      PerformanceDashboard.generateAlerts(largeMetrics);
    }
    
    const endTime = Date.now();
    expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
  });
});