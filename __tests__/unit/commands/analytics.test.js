/**
 * Analytics Command Tests
 * Tests the Discord analytics command functionality
 */

jest.useFakeTimers();

// Mock dependencies
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/discord-analytics', () => ({
  generateDailyReport: jest.fn(),
  generateServerInsights: jest.fn(),
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
      username: 'testuser',
    },
    guild: {
      id: 'test-guild-123',
      memberCount: 150,
      members: {
        fetch: jest.fn().mockResolvedValue(),
        cache: {
          filter: jest.fn().mockImplementation((callback) => {
            const members = [
              { user: { bot: false }, presence: { status: 'online' } },
              { user: { bot: false }, presence: { status: 'idle' } },
              { user: { bot: false }, presence: { status: 'offline' } },
              { user: { bot: true }, presence: { status: 'online' } },
            ];
            return { size: members.filter(callback).length };
          }),
          size: 4,
        },
      },
    },
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
        avgResponseTime: 1200,
      },
      commandStats: [
        { command: 'chat', count: 20 },
        { command: 'help', count: 15 },
        { command: 'ping', count: 10 },
      ],
    });

    DiscordAnalytics.generateServerInsights.mockResolvedValue({
      recommendations: [
        'Server activity is high during peak hours',
        'Consider adding more moderation during weekends',
      ],
    });

    ErrorHandler.handleError = jest.fn().mockReturnValue({
      message: 'An unexpected error occurred. Please try again later.',
      type: 'GENERAL_ERROR',
    });
  });

  test('should handle analytics command successfully', async () => {
    await handleSlashCommand(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      embeds: [
        expect.objectContaining({
          color: 0x5865f2,
          title: '📊 Discord Analytics Dashboard',
          fields: expect.arrayContaining([
            expect.objectContaining({
              name: '🏢 Server Overview',
              value: expect.stringContaining('Servers: 1\nActive Users: 149\nTotal Members: 150\nBots: 1'),
              inline: true,
            }),
            expect.objectContaining({
              name: '📈 Command Analytics (7 days)',
              value: expect.stringContaining('Total Commands:'),
              inline: true,
            }),
            expect.objectContaining({
              name: '⚠️ Error Tracking (7 days)',
              value: expect.stringContaining('Total Errors:'),
              inline: true,
            }),
            expect.objectContaining({
              name: '⏱️ Bot Uptime',
              value: expect.stringContaining('Total Uptime: 0h'),
              inline: true,
            }),
            expect.objectContaining({
              name: '💡 Server Insights',
              value: expect.stringContaining('🟢 Currently Online: 3'),
              inline: false,
            }),
          ]),
          footer: { text: 'Aszai Bot Analytics • Database-powered' },
          timestamp: expect.any(String),
        }),
      ],
    });
  });

  test('should handle analytics command error', async () => {
    // Simulate error in guild member fetching
    const mockInteractionWithError = {
      ...mockInteraction,
      guild: {
        ...mockInteraction.guild,
        members: {
          fetch: jest.fn().mockRejectedValue(new Error('Failed to fetch members')),
          cache: null, // This will cause an error
        },
      },
    };

    await handleSlashCommand(mockInteractionWithError);

    expect(mockInteractionWithError.deferReply).toHaveBeenCalled();
    expect(ErrorHandler.handleError).toHaveBeenCalledWith(expect.any(Error), 'analytics_command');
    expect(mockInteractionWithError.editReply).toHaveBeenCalledWith({
      content: 'An unexpected error occurred. Please try again later.',
    });
  });

  test('should handle analytics with empty data', async () => {
    // Mock guild with no members
    const mockInteractionEmptyGuild = {
      ...mockInteraction,
      deferReply: jest.fn(),
      editReply: jest.fn(),
      guild: {
        id: 'test-guild-123',
        memberCount: 0,
        members: {
          fetch: jest.fn().mockResolvedValue(),
          cache: {
            filter: jest.fn().mockReturnValue({ size: 0 }),
            size: 0,
          },
        },
      },
    };

    await handleSlashCommand(mockInteractionEmptyGuild);

    expect(mockInteractionEmptyGuild.editReply).toHaveBeenCalledWith({
      embeds: [
        expect.objectContaining({
          color: 0x5865f2,
          title: '📊 Discord Analytics Dashboard',
          fields: expect.arrayContaining([
            expect.objectContaining({
              name: '🏢 Server Overview',
              value: expect.stringContaining('Servers: 1\nActive Users: 0\nTotal Members: 0\nBots: 0'),
              inline: true,
            }),
            expect.objectContaining({
              name: '📈 Command Analytics (7 days)',
              value: expect.stringContaining('Total Commands:'),
              inline: true,
            }),
            expect.objectContaining({
              name: '⚠️ Error Tracking (7 days)',
              value: expect.stringContaining('Total Errors:'),
              inline: true,
            }),
            expect.objectContaining({
              name: '⏱️ Bot Uptime',
              value: expect.stringContaining('Total Uptime: 0h'),
              inline: true,
            }),
            expect.objectContaining({
              name: '💡 Server Insights',
              value: expect.stringContaining('🟢 Currently Online: 0'),
              inline: false,
            }),
          ]),
          footer: { text: 'Aszai Bot Analytics • Database-powered' },
          timestamp: expect.any(String),
        }),
      ],
    });
  });
});
