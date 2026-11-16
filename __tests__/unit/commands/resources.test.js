/**
 * Resources Command Tests
 * /resources shows process memory and the recommendations computed from it
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

describe('Resources Command', () => {
  const mockInteraction = {
    commandName: 'resources',
    reply: jest.fn(),
    deferReply: jest.fn(),
    editReply: jest.fn(),
    user: { id: 'test-user-123', username: 'testuser' },
    client: { guilds: { cache: { size: 5 } } },
    guild: { id: 'test-guild-123' },
  };

  const footer = {
    text: 'Total memory = used + free (heap allocated) | Free = available within allocated heap',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date('2026-11-16T12:00:00.000Z') });
    ErrorHandler.handleError = jest.fn().mockReturnValue({
      message: 'An unexpected error occurred. Please try again later.',
      type: 'GENERAL_ERROR',
    });
  });

  test('shows a healthy status and the default recommendation', async () => {
    ResourceOptimizer.monitorResources.mockReturnValue({
      memory: { status: 'good', used: 245, free: 755, percentage: 24.5 },
      optimizationTier: 'Optimal',
      recommendations: [],
    });

    await handleSlashCommand(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      embeds: [
        {
          color: 0x00ff00,
          title: '🔧 Resource Optimization',
          description: '📊 Node.js process memory (heap) - see /cache for cached responses',
          fields: [
            {
              name: '💾 Memory Status',
              value: 'Status: GOOD\nUsed: 245MB\nFree: 755MB\nUsage: 25%',
              inline: true,
            },
            {
              name: '📈 Optimization Tier',
              value: 'Current: Optimal\nServer Count: 5',
              inline: true,
            },
            {
              name: '💡 Recommendations',
              value: '✅ Memory usage is healthy - continue monitoring',
              inline: false,
            },
          ],
          footer,
          timestamp: '2026-11-16T12:00:00.000Z',
        },
      ],
    });
  });

  test('lists at most three memory recommendations on a critical status', async () => {
    ResourceOptimizer.monitorResources.mockReturnValue({
      memory: { status: 'critical', used: 450, free: 50, percentage: 90 },
      optimizationTier: 'Critical',
      recommendations: ['one', 'two', 'three', 'four'],
    });

    await handleSlashCommand(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      embeds: [
        {
          color: 0xff0000,
          title: '🔧 Resource Optimization',
          description: '📊 Node.js process memory (heap) - see /cache for cached responses',
          fields: [
            {
              name: '💾 Memory Status',
              value: 'Status: CRITICAL\nUsed: 450MB\nFree: 50MB\nUsage: 90%',
              inline: true,
            },
            {
              name: '📈 Optimization Tier',
              value: 'Current: Critical\nServer Count: 5',
              inline: true,
            },
            { name: '💡 Recommendations', value: 'one\ntwo\nthree', inline: false },
          ],
          footer,
          timestamp: '2026-11-16T12:00:00.000Z',
        },
      ],
    });
  });

  test('should handle resources command error', async () => {
    const error = new Error('Resource monitoring unavailable');
    ResourceOptimizer.monitorResources.mockImplementation(() => {
      throw error;
    });

    await handleSlashCommand(mockInteraction);

    expect(ErrorHandler.handleError).toHaveBeenCalledWith(error, 'resources_command');
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      embeds: [
        { color: '#ED4245', description: 'An unexpected error occurred. Please try again later.' },
      ],
    });
  });
});
