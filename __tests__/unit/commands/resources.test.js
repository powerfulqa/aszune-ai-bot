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
          color: expect.any(Number),
          title: '🔧 Resource Optimization',
          fields: expect.arrayContaining([
            expect.objectContaining({
              name: '💾 Memory Status',
              value: expect.stringContaining('Status:'),
              inline: true,
            }),
            expect.objectContaining({
              name: '⚙️ Performance',
              value: expect.stringContaining('Status:'),
              inline: true,
            }),
            expect.objectContaining({
              name: '📈 Optimization Tier',
              value: expect.stringContaining('Current:'),
              inline: true,
            }),
            expect.objectContaining({
              name: '💡 Recommendations',
              value: expect.any(String),
              inline: false,
            }),
          ]),
          footer: { text: 'Aszai Bot Resources • Database-powered • Real-time monitoring' },
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
          fields: expect.arrayContaining([
            expect.objectContaining({
              name: '💾 Memory Status',
              value: expect.stringContaining('Status:'),
              inline: true,
            }),
            expect.objectContaining({
              name: '⚙️ Performance',
              value: expect.stringContaining('Status:'),
              inline: true,
            }),
            expect.objectContaining({
              name: '📈 Optimization Tier',
              value: expect.stringContaining('Current:'),
              inline: true,
            }),
            expect.objectContaining({
              name: '💡 Recommendations',
              value: expect.any(String),
              inline: false,
            }),
          ]),
          footer: { text: 'Aszai Bot Resources • Database-powered • Real-time monitoring' },
          timestamp: expect.any(String),
        },
      ],
    });
  });
});
