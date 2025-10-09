/**
 * Commands - Cache Command Tests
 * Tests cache command functionality
 */

jest.useFakeTimers();

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/perplexity-secure');

// Create a mock database service instance
const mockDatabaseService = {
  addUserMessage: jest.fn(),
  updateUserStats: jest.fn(),
  getUserMessages: jest.fn().mockReturnValue([]),
  addBotResponse: jest.fn(),
  clearUserData: jest.fn(),
  clearUserConversationData: jest.fn(),
  trackCommandUsage: jest.fn(),
  logError: jest.fn(),
  getUserStats: jest.fn().mockReturnValue({
    message_count: 10,
    total_summaries: 2,
  }),
  getUserReminderCount: jest.fn().mockReturnValue(3),
};

jest.mock('../../src/services/database', () => mockDatabaseService);

const { handleSlashCommand } = require('../../src/commands');
const perplexityService = require('../../src/services/perplexity-secure');
const { createMockInteraction, resetMocks } = require('../../src/utils/testUtils');

describe('Commands - Cache Command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  describe('/cache command', () => {
    it('should handle /cache command successfully', async () => {
      const interaction = createMockInteraction({ commandName: 'cache' });

      perplexityService.getCacheStats = jest.fn().mockReturnValue({
        hitRate: 90,
        hits: 180,
        misses: 20,
        sets: 150,
        deletes: 15,
        evictions: 5,
        memoryUsageFormatted: '50MB',
        maxMemoryFormatted: '100MB',
        entryCount: 75,
        maxSize: 100,
        evictionStrategy: 'LRU',
        uptimeFormatted: '2h 30m',
      });

      perplexityService.getDetailedCacheInfo = jest.fn().mockReturnValue({
        entries: [],
      });

      await handleSlashCommand(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith({
        embeds: [
          expect.objectContaining({
            title: 'Cache Statistics',
            fields: expect.arrayContaining([
              expect.objectContaining({
                name: 'Performance',
                value: expect.stringContaining('Hit Rate: 90%'),
              }),
              expect.objectContaining({
                name: 'Memory Usage',
                value: expect.stringContaining('50MB / 100MB'),
              }),
            ]),
          }),
        ],
      });
    });

    it('should handle /cache command with detailed info having entries', async () => {
      const interaction = createMockInteraction({ commandName: 'cache' });

      perplexityService.getCacheStats = jest.fn().mockReturnValue({
        hitRate: 85,
        hits: 170,
        misses: 30,
        sets: 100,
        deletes: 20,
        evictions: 10,
        memoryUsageFormatted: '75MB',
        maxMemoryFormatted: '100MB',
        entryCount: 50,
        maxSize: 100,
        evictionStrategy: 'LRU',
        uptimeFormatted: '3h 45m',
      });

      perplexityService.getDetailedCacheInfo = jest.fn().mockReturnValue({
        recentEntries: [
          { key: 'entry1', value: 'value1', ttl: 300 },
          { key: 'entry2', value: 'value2', ttl: 600 },
          { key: 'entry3', value: 'value3', ttl: 900 },
        ],
      });

      await handleSlashCommand(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith({
        embeds: [
          expect.objectContaining({
            fields: expect.arrayContaining([
              expect.objectContaining({
                name: 'Recent Entries',
                value: expect.stringContaining('entry1'),
              }),
            ]),
          }),
        ],
      });
    });

    it('should handle /cache command API error', async () => {
      const interaction = createMockInteraction({ commandName: 'cache' });

      // Mock the service to reject
      perplexityService.getCacheStats = jest.fn().mockImplementation(() => {
        throw new Error('Cache service unavailable');
      });
      perplexityService.getDetailedCacheInfo = jest.fn().mockImplementation(() => {
        throw new Error('Cache service unavailable');
      });

      await handleSlashCommand(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining('Error retrieving cache statistics')
      );
    });

    it('should handle /cache command with invalid user ID', async () => {
      const interaction = createMockInteraction({
        commandName: 'cache',
        userId: 'invalid-id',
      });

      await handleSlashCommand(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('Invalid user ID'));
    });
  });
});
