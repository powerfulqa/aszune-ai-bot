/**
 * Resources Command Tests
 * Tests the Discord resources command functionality
 */

jest.useFakeTimers();

// Mock dependencies
jest.mock('../../../src/config/config', () => require('../../../__mocks__/configMock'));
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/resource-optimizer', () => ({
  monitorResources: jest.fn(),
  generateOptimizationRecommendations: jest.fn(),
}));
jest.mock('../../../src/utils/discord-analytics', () => ({
  generateDailyReport: jest.fn(),
}));
jest.mock('../../../src/utils/error-handler');

const { handleSlashCommand } = require('../../../src/commands/index');
const ResourceOptimizer = require('../../../src/utils/resource-optimizer');
const DiscordAnalytics = require('../../../src/utils/discord-analytics');
const { ErrorHandler } = require('../../../src/utils/error-handler');

// Mock the conversation module
jest.mock('../../../src/utils/conversation', () => {
  const mockInstance = {
    clearHistory: jest.fn(),
    getHistory: jest.fn().mockReturnValue([]),
    getUserStats: jest.fn().mockReturnValue({ messages: 10, summaries: 2 }),
    updateUserStats: jest.fn(),
    addMessage: jest.fn(),
  };
  return jest.fn(() => mockInstance);
});

describe('Resources Command', () => {
  const mockInteraction = {
    commandName: 'resources',
    reply: jest.fn(),
    deferReply: jest.fn(),
    editReply: jest.fn(),
    user: {
      id: 'test-user-123',
      username: 'testuser',
    },
    guild: {
      id: 'test-guild-123',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default successful mocks
    ResourceOptimizer.monitorResources.mockResolvedValue({
      memory: {
        status: 'good',
        used: 245,
        free: 755,
        percentage: 24.5,
      },
      performance: {
        status: 'good',
        responseTime: 120,
        load: 'light',
      },
      optimizationTier: 'Standard',
    });

    DiscordAnalytics.generateDailyReport.mockResolvedValue({
      summary: {
        totalServers: 5,
      },
    });

    ResourceOptimizer.generateOptimizationRecommendations.mockResolvedValue([
      '✅ Memory usage is optimal',
      '✅ Performance is good',
      '⚠️ Consider auto-scaling',
    ]);

    ErrorHandler.handleError = jest.fn().mockReturnValue({
      message: 'An unexpected error occurred. Please try again later.',
      type: 'GENERAL_ERROR',
    });
  });

  test('should handle resources command successfully', async () => {
    await handleSlashCommand(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(ResourceOptimizer.monitorResources).toHaveBeenCalled();
    expect(DiscordAnalytics.generateDailyReport).toHaveBeenCalled();
    expect(ResourceOptimizer.generateOptimizationRecommendations).toHaveBeenCalled();
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      embeds: [
        {
          color: 0x00ff00,
          title: '🔧 Resource Optimization',
          fields: [
            {
              name: '💾 Memory Status',
              value: 'Status: GOOD\nUsed: 245MB\nFree: 755MB\nUsage: 25%',
              inline: true,
            },
            {
              name: '⚙️ Performance',
              value: 'Status: GOOD\nResponse Time: 120ms\nLoad: light',
              inline: true,
            },
            {
              name: '📈 Database Metrics (24h)',
              value: 'Avg Memory: 0MB\nPerformance Ops: 0\nOptimization: Active',
              inline: true,
            },
            {
              name: '💡 Recommendations',
              value: '✅ Memory usage is optimal\n✅ Performance is good\n⚠️ Consider auto-scaling',
              inline: false,
            },
          ],
          footer: { text: 'Aszai Bot Resource Monitor • Database-powered' },
          timestamp: expect.any(String),
        },
      ],
    });
  });

  test('should handle resources command error', async () => {
    const error = new Error('Resource monitoring unavailable');
    ResourceOptimizer.monitorResources.mockRejectedValue(error);

    await handleSlashCommand(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(ErrorHandler.handleError).toHaveBeenCalledWith(error, 'resources_command');
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'An unexpected error occurred. Please try again later.',
    });
  });

  test('should handle resources with warning status', async () => {
    ResourceOptimizer.monitorResources.mockResolvedValue({
      memory: {
        status: 'warning',
        used: 850,
        free: 150,
        percentage: 85.0,
      },
      performance: {
        status: 'warning',
        responseTime: 850,
        load: 'heavy',
      },
      optimizationTier: 'High',
    });

    ResourceOptimizer.generateOptimizationRecommendations.mockResolvedValue([
      '⚠️ Memory usage high',
      '🔴 Response time degraded',
      '💡 Consider upgrading resources',
    ]);

    await handleSlashCommand(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      embeds: [
        {
          color: 0xffa500,
          title: '🔧 Resource Optimization',
          fields: [
            {
              name: '💾 Memory Status',
              value: 'Status: WARNING\nUsed: 850MB\nFree: 150MB\nUsage: 85%',
              inline: true,
            },
            {
              name: '⚙️ Performance',
              value: 'Status: WARNING\nResponse Time: 850ms\nLoad: heavy',
              inline: true,
            },
            {
              name: '📈 Database Metrics (24h)',
              value: 'Avg Memory: 0MB\nPerformance Ops: 0\nOptimization: Active',
              inline: true,
            },
            {
              name: '💡 Recommendations',
              value:
                '⚠️ Memory usage high\n🔴 Response time degraded\n💡 Consider upgrading resources',
              inline: false,
            },
          ],
          footer: { text: 'Aszai Bot Resource Monitor • Database-powered' },
          timestamp: expect.any(String),
        },
      ],
    });
  });
});
