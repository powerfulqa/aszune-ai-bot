/**
 * Dashboard Command Tests
 * /dashboard shows only live readings: process memory, uptime, guild counts
 */

jest.useFakeTimers();

jest.mock('../../../src/config/config', () => require('../../../__mocks__/configMock'));
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/resource-optimizer', () => ({
  monitorResources: jest.fn(),
}));
jest.mock('../../../src/utils/error-handler');

const { handleSlashCommand } = require('../../../src/commands/index');
const ResourceOptimizer = require('../../../src/utils/resource-optimizer');
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

describe('Dashboard Command', () => {
  const mockInteraction = {
    commandName: 'dashboard',
    reply: jest.fn(),
    deferReply: jest.fn(),
    editReply: jest.fn(),
    user: { id: 'test-user-123', username: 'testuser' },
    client: { guilds: { cache: { size: 5 } } },
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

  const resourceStatus = (overall, used, optimizationTier) => ({
    memory: { used },
    overall: { status: overall },
    optimizationTier,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date('2026-11-16T12:00:00.000Z') });
    jest.spyOn(process, 'uptime').mockReturnValue(19800);
    ErrorHandler.handleError = jest.fn().mockReturnValue({
      message: 'An unexpected error occurred. Please try again later.',
      type: 'GENERAL_ERROR',
    });
  });

  afterEach(() => jest.restoreAllMocks());

  test.each([
    ['healthy', 0x00ff00, 245, 'Optimal'],
    ['warning', 0xffa500, 150, 'Standard'],
    ['degraded', 0xff0000, 250, 'High'],
    ['critical', 0xff0000, 450, 'Critical'],
  ])('shows %s status with live values only', async (status, color, used, tier) => {
    ResourceOptimizer.monitorResources.mockReturnValue(resourceStatus(status, used, tier));

    await handleSlashCommand(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      embeds: [
        {
          color,
          title: '🖥️ Performance Dashboard',
          fields: [
            {
              name: '🚦 System Status',
              value: `Status: ${status.toUpperCase()}\nUptime: 5h 30m\nMemory: ${used}MB`,
              inline: true,
            },
            { name: '⚡ Optimization', value: `Tier: ${tier}`, inline: true },
            { name: '📊 Activity', value: 'Servers: 5\nMembers: 150', inline: true },
          ],
          footer: { text: 'Aszai Bot Dashboard • Real-time data' },
          timestamp: '2026-11-16T12:00:00.000Z',
        },
      ],
    });
  });

  test('should handle dashboard command error', async () => {
    const error = new Error('Dashboard service unavailable');
    ResourceOptimizer.monitorResources.mockImplementation(() => {
      throw error;
    });

    await handleSlashCommand(mockInteraction);

    expect(ErrorHandler.handleError).toHaveBeenCalledWith(error, 'dashboard_command');
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      embeds: [
        { color: '#ED4245', description: 'An unexpected error occurred. Please try again later.' },
      ],
    });
  });
});
