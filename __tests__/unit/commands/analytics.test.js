/**
 * Analytics Command Tests
 * Tests the Discord analytics command functionality
 */

jest.useFakeTimers();

// Mock dependencies
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/discord-analytics', () => ({
  generateDailyReport: jest.fn(),
  generateServerInsights: jest.fn()
}));
jest.mock('../../../src/utils/error-handler');
jest.mock('../../../src/config/config', () => require('../../../__mocks__/configMock'));

const { handleSlashCommand } = require('../../../src/commands/index');
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

describe('Analytics Command', () => {
  const mockInteraction = {
    commandName: 'analytics',
    reply: jest.fn(),
    deferReply: jest.fn(),
    editReply: jest.fn(),
    user: {
      id: 'test-user-123',
      username: 'testuser'
    },
    guild: {
      id: 'test-guild-123'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default successful mocks
    DiscordAnalytics.generateDailyReport.mockResolvedValue({
      summary: {
        totalServers: 5,
        totalUsers: 150,
        totalCommands: 45,
        successRate: 97.8,
        errorRate: 2.2,
        avgResponseTime: 1200
      },
      commandStats: [
        { command: 'chat', count: 20 },
        { command: 'help', count: 15 },
        { command: 'ping', count: 10 }
      ]
    });

    DiscordAnalytics.generateServerInsights.mockResolvedValue({
      recommendations: [
        'Server activity is high during peak hours',
        'Consider adding more moderation during weekends'
      ]
    });

    ErrorHandler.handleError = jest.fn().mockReturnValue({
      message: 'An unexpected error occurred. Please try again later.',
      type: 'GENERAL_ERROR'
    });
  });

  test('should handle analytics command successfully', async () => {
    await handleSlashCommand(mockInteraction);
    
    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(DiscordAnalytics.generateDailyReport).toHaveBeenCalled();
    expect(DiscordAnalytics.generateServerInsights).toHaveBeenCalled();
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      embeds: [{
        color: 0x5865F2,
        title: '📊 Discord Analytics Dashboard',
        fields: [
          { 
            name: '🏢 Server Overview',
            value: 'Servers: 5\nActive Users: 150\nTotal Commands: 45',
            inline: true
          },
          { 
            name: '📈 Performance',
            value: 'Success Rate: 97.8%\nError Rate: 2.2%\nAvg Response: 1200ms',
            inline: true
          },
          {
            name: '🎯 Top Commands',
            value: '1. chat (20)\n2. help (15)\n3. ping (10)',
            inline: true
          },
          {
            name: '💡 Server Insights',
            value: 'Server activity is high during peak hours\nConsider adding more moderation during weekends',
            inline: false
          }
        ],
        footer: { text: 'Aszai Bot Analytics' },
        timestamp: expect.any(String)
      }]
    });
  });

  test('should handle analytics command error', async () => {
    const error = new Error('Analytics service unavailable');
    DiscordAnalytics.generateDailyReport.mockRejectedValue(error);

    await handleSlashCommand(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(ErrorHandler.handleError).toHaveBeenCalledWith(error, 'analytics_command');
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'An unexpected error occurred. Please try again later.'
    });
  });

  test('should handle analytics with empty data', async () => {
    DiscordAnalytics.generateDailyReport.mockResolvedValue({
      summary: {
        totalServers: 0,
        totalUsers: 0,
        totalCommands: 0,
        successRate: 0,
        errorRate: 0,
        avgResponseTime: 0
      },
      commandStats: []
    });

    DiscordAnalytics.generateServerInsights.mockResolvedValue({
      serverId: 'test-server',
      totalActivities: 0,
      uniqueUsers: 0,
      commandsExecuted: 0,
      averageResponseTime: 0,
      errorRate: 0,
      mostActiveUser: null,
      popularCommands: [],
      recommendations: []
    });

    await handleSlashCommand(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      embeds: [{
        color: 0x5865F2,
        title: '📊 Discord Analytics Dashboard',
        fields: [
          { 
            name: '🏢 Server Overview',
            value: 'Servers: 0\nActive Users: 0\nTotal Commands: 0',
            inline: true
          },
          { 
            name: '📈 Performance',
            value: 'Success Rate: 0%\nError Rate: 0%\nAvg Response: 0ms',
            inline: true
          },
          {
            name: '🎯 Top Commands',
            value: 'No data yet',
            inline: true
          },
          {
            name: '💡 Server Insights',
            value: 'Active Users: 0\nCommands: 0\nError Rate: 0%',
            inline: false
          }
        ],
        footer: { text: 'Aszai Bot Analytics' },
        timestamp: expect.any(String)
      }]
    });
  });
});