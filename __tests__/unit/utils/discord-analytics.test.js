/**
 * DiscordAnalytics Test Suite - Core Analytics
 * Tests for Discord-specific analytics and usage pattern analysis
 */

const DiscordAnalytics = require('../../../src/utils/discord-analytics');

// Mock logger to prevent actual logging during tests
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// Shared test data
const mockActivityHistory = [
  {
    timestamp: new Date('2024-01-15T10:00:00Z').toISOString(),
    serverId: 'server1',
    userId: 'user1',
    action: 'command_executed',
    command: 'help',
    metadata: { responseTime: 150, success: true }
  },
  {
    timestamp: new Date('2024-01-15T10:05:00Z').toISOString(),
    serverId: 'server1',
    userId: 'user2',
    action: 'command_executed',
    command: 'stats',
    metadata: { responseTime: 200, success: true }
  },
  {
    timestamp: new Date('2024-01-15T10:10:00Z').toISOString(),
    serverId: 'server2',
    userId: 'user1',
    action: 'command_executed',
    command: 'help',
    metadata: { responseTime: 500, success: false, error: 'API timeout' }
  },
  {
    timestamp: new Date('2024-01-15T14:00:00Z').toISOString(),
    serverId: 'server2',
    userId: 'user3',
    action: 'message_processed',
    metadata: { responseTime: 300, success: true }
  },
  {
    timestamp: new Date('2024-01-15T20:00:00Z').toISOString(),
    serverId: 'server1',
    userId: 'user2',
    action: 'command_executed',
    command: 'stats',
    metadata: { responseTime: 180, success: true }
  }
];

describe('DiscordAnalytics - trackServerActivity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should track server activity correctly', () => {
    const activity = {
      serverId: 'test-server',
      userId: 'test-user',
      action: 'command_executed',
      command: 'test'
    };

    const result = DiscordAnalytics.trackServerActivity(activity);

    expect(result.tracked).toBe(true);
    expect(result.serverId).toBe('test-server');
    expect(result.action).toBe('command_executed');
    expect(result.timestamp).toBeDefined();
  });

  it('should handle missing serverId', () => {
    const activity = {
      userId: 'test-user',
      action: 'command_executed',
      command: 'test'
    };

    const result = DiscordAnalytics.trackServerActivity(activity);

    expect(result.tracked).toBe(true);
    expect(result.serverId).toBe('unknown');
  });

  it('should handle missing action', () => {
    const activity = {
      serverId: 'test-server',
      userId: 'test-user',
      command: 'test'
    };

    const result = DiscordAnalytics.trackServerActivity(activity);

    expect(result.tracked).toBe(true);
    expect(result.action).toBe('unknown');
  });

  it('should include metadata when provided', () => {
    const activity = {
      serverId: 'test-server',
      userId: 'test-user',
      action: 'command_executed',
      command: 'test',
      metadata: { custom: 'data' }
    };

    const result = DiscordAnalytics.trackServerActivity(activity);

    expect(result.metadata).toEqual({ custom: 'data' });
  });
});

describe('DiscordAnalytics - analyzeUsagePatterns', () => {
  it('should analyze usage patterns correctly', () => {
    const patterns = DiscordAnalytics.analyzeUsagePatterns(mockActivityHistory);

    expect(patterns).toHaveProperty('commandPopularity');
    expect(patterns).toHaveProperty('serverActivity');
    expect(patterns).toHaveProperty('userEngagement');
    expect(patterns).toHaveProperty('peakUsageHours');
    expect(patterns).toHaveProperty('growthTrend');
  });

  it('should identify command popularity correctly', () => {
    const patterns = DiscordAnalytics.analyzeUsagePatterns(mockActivityHistory);

    expect(patterns.commandPopularity).toHaveLength(2);
    expect(patterns.commandPopularity[0]).toEqual({ command: 'help', count: 2 });
    expect(patterns.commandPopularity[1]).toEqual({ command: 'stats', count: 2 });
  });

  it('should handle empty activity history', () => {
    const patterns = DiscordAnalytics.analyzeUsagePatterns([]);

    expect(patterns.commandPopularity).toHaveLength(0);
    expect(patterns.serverActivity).toHaveLength(0);
    expect(patterns.userEngagement).toBe('low');
    expect(patterns.peakUsageHours).toHaveLength(0);
    expect(patterns.growthTrend).toBe('stable');
  });
});

describe('DiscordAnalytics - generateDailyReport', () => {
  it('should generate comprehensive daily report', () => {
    const report = DiscordAnalytics.generateDailyReport(mockActivityHistory);

    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('serverBreakdown');
    expect(report).toHaveProperty('commandAnalysis');
    expect(report).toHaveProperty('performanceMetrics');
    expect(report).toHaveProperty('recommendations');
  });

  it('should calculate summary statistics correctly', () => {
    const report = DiscordAnalytics.generateDailyReport(mockActivityHistory);

    expect(report.summary.totalServers).toBe(2);
    expect(report.summary.totalUsers).toBe(3);
    expect(report.summary.totalCommands).toBe(4);
    expect(report.summary.totalActivities).toBe(5);
  });

  it('should handle empty activity history gracefully', () => {
    const report = DiscordAnalytics.generateDailyReport([]);

    expect(report.summary.totalServers).toBe(0);
    expect(report.summary.totalUsers).toBe(0);
    expect(report.summary.totalCommands).toBe(0);
    expect(report.summary.errorRate).toBe(0);
    expect(report.serverBreakdown).toHaveLength(0);
    expect(report.recommendations).toContain('No activity detected today');
  });
});