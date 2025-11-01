/**
 * Cache Command Tests
 * Tests the Discord cache command functionality
 * Ensures /cache command displays proper values instead of "undefined"
 */

jest.useFakeTimers();

// Mock dependencies
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/services/perplexity-secure', () => ({
  getCacheStats: jest.fn(),
  getDetailedCacheInfo: jest.fn(),
}));
jest.mock('../../../src/utils/error-handler');
jest.mock('../../../src/config/config', () => require('../../../__mocks__/configMock'));

const { handleSlashCommand } = require('../../../src/commands/index');
const perplexityService = require('../../../src/services/perplexity-secure');
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

describe('Cache Command', () => {
  const mockInteraction = {
    commandName: 'cache',
    reply: jest.fn(),
    deferReply: jest.fn(),
    editReply: jest.fn(),
    replied: false,
    deferred: false,
    user: {
      id: '123456789012345678', // Valid Discord user ID format (18-19 digit number)
      username: 'testuser',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default successful mocks with all required fields for Discord compatibility
    perplexityService.getCacheStats.mockReturnValue({
      hits: 42,
      misses: 8,
      hitRate: 84.0,
      sets: 25,
      deletes: 3,
      evictions: 1,
      entryCount: 21,
      memoryUsage: 1048576,
      memoryUsageFormatted: '1.0 MB',
      maxMemory: 52428800,
      maxMemoryFormatted: '50 MB',
      maxSize: 1000,
      uptime: 3661,
      uptimeFormatted: '1h 1m 1s',
      evictionStrategy: 'hybrid',
    });

    perplexityService.getDetailedCacheInfo.mockReturnValue({
      recentEntries: [
        { key: 'test-key-1', value: 'test-value-1', ttl: 300 },
        { key: 'test-key-2', value: 'test-value-2', ttl: 600 },
      ],
      totalEntries: 21,
    });

    ErrorHandler.handleError = jest.fn().mockReturnValue({
      message: 'An unexpected error occurred. Please try again later.',
      type: 'GENERAL_ERROR',
    });
  });

  test('should handle cache command successfully with proper field values', async () => {
    await handleSlashCommand(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(perplexityService.getCacheStats).toHaveBeenCalled();
    expect(perplexityService.getDetailedCacheInfo).toHaveBeenCalled();

    // Verify the embed was created with proper structure
    expect(mockInteraction.editReply).toHaveBeenCalled();

    const embedCall = mockInteraction.editReply.mock.calls[0][0];
    const embed = embedCall.embeds[0];

    // Verify essential properties
    expect(embed.title).toBe('Cache Statistics');
    expect(embed.fields).toHaveLength(5); // Performance, Operations, Memory, Config, Recent Entries

    // Verify NO undefined values in any field
    embed.fields.forEach((field) => {
      expect(field.value).not.toContain('undefined');
    });
  });

  test('should never display "undefined" values in cache statistics', async () => {
    await handleSlashCommand(mockInteraction);

    const editReplyCall = mockInteraction.editReply.mock.calls[0][0];
    const embedFields = editReplyCall.embeds[0].fields;

    // Critical test: Ensure NO field contains "undefined" string
    embedFields.forEach((field) => {
      expect(field.value).not.toContain('undefined');
      expect(field.value).not.toMatch(/:\s*undefined/);
      expect(field.value).not.toMatch(/undefined\s*\//);
    });
  });

  test('should handle missing cache stats with proper fallback values', async () => {
    // Mock cache service returning fallback values (0s instead of undefined)
    perplexityService.getCacheStats.mockReturnValue({
      hits: 0,
      misses: 0,
      hitRate: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      entryCount: 0,
      memoryUsage: 0,
      memoryUsageFormatted: '0 B',
      maxMemory: 0,
      maxMemoryFormatted: '0 B',
      maxSize: 0,
      uptime: 0,
      uptimeFormatted: '0s',
      evictionStrategy: 'hybrid',
      error: 'Cache not available',
    });

    // Mock detailed cache info with fallback values
    perplexityService.getDetailedCacheInfo.mockReturnValue({
      stats: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        sets: 0,
        deletes: 0,
        evictions: 0,
        entryCount: 0,
        memoryUsage: 0,
        memoryUsageFormatted: '0 B',
        maxMemory: 0,
        maxMemoryFormatted: '0 B',
        maxSize: 0,
        uptime: 0,
        uptimeFormatted: '0s',
        evictionStrategy: 'hybrid',
      },
      recentEntries: [], // Empty entries
    });

    await handleSlashCommand(mockInteraction);

    const editReplyCall = mockInteraction.editReply.mock.calls[0][0];
    const embedFields = editReplyCall.embeds[0].fields;

    // Even with fallback values, should NOT contain "undefined"
    embedFields.forEach((field) => {
      expect(field.value).not.toContain('undefined');
      // Check that values are properly displayed (could be 0 or empty message)
      expect(field.value).toBeTruthy();
    });
  });

  test('should handle cache service throwing error gracefully', async () => {
    perplexityService.getCacheStats.mockImplementation(() => {
      throw new Error('Cache service unavailable');
    });

    await handleSlashCommand(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(ErrorHandler.handleError).toHaveBeenCalledWith(
      expect.any(Error),
      'cache statistics retrieval',
      expect.objectContaining({
        userId: '123456789012345678',
      })
    );

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('Error retrieving cache statistics')
    );
  });

  test('should handle invalid user ID gracefully', async () => {
    const invalidInteraction = {
      ...mockInteraction,
      user: { id: null },
    };

    await handleSlashCommand(invalidInteraction);

    expect(invalidInteraction.reply).toHaveBeenCalledWith(
      expect.stringContaining('❌ Invalid user ID')
    );
    expect(invalidInteraction.deferReply).not.toHaveBeenCalled();
  });

  test('should display all required cache fields for v1.6.5 compatibility', async () => {
    await handleSlashCommand(mockInteraction);

    const editReplyCall = mockInteraction.editReply.mock.calls[0][0];
    const embed = editReplyCall.embeds[0];

    // Verify all critical fields are present (v1.6.5 requirements)
    expect(embed.title).toBe('Cache Statistics');
    expect(embed.fields.length).toBeGreaterThan(0);

    const fieldNames = embed.fields.map((f) => f.name);
    expect(fieldNames).toContain('Performance');
    expect(fieldNames).toContain('Operations');
    expect(fieldNames).toContain('Cache Memory Usage'); // Updated name to match v1.7.0 changes
    expect(fieldNames).toContain('Configuration');

    // Verify each field contains expected values without "undefined"
    const performanceField = embed.fields.find((f) => f.name === 'Performance');
    expect(performanceField.value).toMatch(/Hit Rate: \d+/);
    expect(performanceField.value).toMatch(/Hits: \d+/);
    expect(performanceField.value).toMatch(/Misses: \d+/);

    const memoryField = embed.fields.find((f) => f.name === 'Cache Memory Usage'); // Updated name to match v1.7.0 changes
    expect(memoryField.value).toMatch(/.+ \/ .+/);
    expect(memoryField.value).toMatch(/Entries: \d+ \/ \d+/);

    const configField = embed.fields.find((f) => f.name === 'Configuration');
    expect(configField.value).toMatch(/Strategy: \w+/);
    expect(configField.value).toMatch(/Uptime: .+/);
  });
});
