/**
 * Unit tests for natural language reminder processor
 * Tests the ability to detect and process reminder requests in natural language
 */

const naturalLanguageReminderProcessor = require('../../src/utils/natural-language-reminder');
const reminderService = require('../../src/services/reminder-service');
const timeParser = require('../../src/utils/time-parser');

// Mock dependencies
jest.mock('../../src/services/reminder-service');
jest.mock('../../src/utils/time-parser');
jest.mock('../../src/services/perplexity-secure');
jest.mock('../../src/utils/conversation');
jest.mock('../../src/utils/logger');

describe('Natural Language Reminder Processor', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock reminder service
    reminderService.createReminder = jest.fn().mockResolvedValue('reminder-123');

    // Mock time parser
    timeParser.getRelativeTime = jest.fn().mockReturnValue('in 2 weeks');
    timeParser.formatTime = jest.fn().mockReturnValue('December 25, 2024 at 12:00 PM UTC');

    // Mock ConversationManager
    const MockConversationManager = jest.fn().mockImplementation(() => ({
      getHistory: jest.fn().mockReturnValue([]),
    }));
    require('../../src/utils/conversation').mockImplementation(MockConversationManager);
  });

  describe('isReminderRequest', () => {
    test('should detect explicit reminder requests', () => {
      expect(
        naturalLanguageReminderProcessor.isReminderRequest(
          'remind me when the new iPhone comes out'
        )
      ).toBe(true);
      expect(
        naturalLanguageReminderProcessor.isReminderRequest('can you remind me about the concert')
      ).toBe(true);
      expect(
        naturalLanguageReminderProcessor.isReminderRequest('set a reminder for the game')
      ).toBe(true);
    });

    test('should not detect non-reminder messages', () => {
      expect(naturalLanguageReminderProcessor.isReminderRequest('hello world')).toBe(false);
      expect(naturalLanguageReminderProcessor.isReminderRequest('what is the weather like')).toBe(
        false
      );
      expect(naturalLanguageReminderProcessor.isReminderRequest('tell me a joke')).toBe(false);
    });
  });

  describe('extractEvent', () => {
    test('should extract event from reminder requests', () => {
      expect(
        naturalLanguageReminderProcessor.extractEvent('remind me when the new iPhone comes out')
      ).toBe('new iPhone');
      expect(
        naturalLanguageReminderProcessor.extractEvent(
          'can you remind me about the concert next week'
        )
      ).toBe('concert');
      expect(
        naturalLanguageReminderProcessor.extractEvent('set a reminder for the game tomorrow')
      ).toBe('game');
    });

    test('should return null for messages without clear events', () => {
      expect(naturalLanguageReminderProcessor.extractEvent('remind me')).toBe(null);
      expect(naturalLanguageReminderProcessor.extractEvent('set a reminder')).toBe(null);
    });
  });

  describe('processReminderRequest', () => {
    test('should process valid reminder requests', async () => {
      const result = await naturalLanguageReminderProcessor.processReminderRequest(
        'remind me when the new iPhone comes out',
        'user123',
        'channel456',
        'server789'
      );

      expect(result.success).toBe(true);
      expect(result.event).toBe('new iPhone');
      expect(result.userId).toBe('user123');
      expect(result.channelId).toBe('channel456');
      expect(result.serverId).toBe('server789');
    });

    test('should handle messages without extractable events', async () => {
      const result = await naturalLanguageReminderProcessor.processReminderRequest(
        'remind me',
        'user123',
        'channel456',
        'server789'
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Could not extract event from message');
    });
  });

  describe('extractDatesFromResponse', () => {
    test('should extract dates from AI responses', () => {
      const response =
        'The new iPhone 15 is expected to be released on September 15, 2024. The official announcement will be on September 12, 2024.';

      const dates = naturalLanguageReminderProcessor.extractDatesFromResponse(response);

      expect(dates.length).toBeGreaterThan(0);
      expect(dates[0]).toHaveProperty('text');
      expect(dates[0]).toHaveProperty('type');
    });

    test('should handle responses without dates', () => {
      const response = 'I don\'t have information about release dates for that product.';

      const dates = naturalLanguageReminderProcessor.extractDatesFromResponse(response);

      expect(dates.length).toBe(0);
    });
  });

  describe('lookupAndSetReminder integration', () => {
    test('should successfully set reminder when date is found', async () => {
      // Mock AI response with a date
      const mockPerplexityService = require('../../src/services/perplexity-secure');
      mockPerplexityService.generateChatResponse = jest
        .fn()
        .mockResolvedValue('The new iPhone 15 will be released on September 15, 2026.');

      const requestData = {
        event: 'new iPhone',
        userId: 'user123',
        channelId: 'channel456',
        serverId: 'server789',
      };

      const result = await naturalLanguageReminderProcessor.lookupAndSetReminder(requestData);

      expect(result.success).toBe(true);
      expect(result.event).toBe('new iPhone');
      expect(reminderService.createReminder).toHaveBeenCalled();
    });

    test('should handle cases where no date is found', async () => {
      // Mock AI response without a clear date
      const mockPerplexityService = require('../../src/services/perplexity-secure');
      mockPerplexityService.generateChatResponse = jest
        .fn()
        .mockResolvedValue(
          'I don\'t have specific information about the release date for this unknown product.'
        );

      const requestData = {
        event: 'unknown product',
        userId: 'user123',
        channelId: 'channel456',
        serverId: 'server789',
      };

      const result = await naturalLanguageReminderProcessor.lookupAndSetReminder(requestData);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('No valid future dates');
      expect(reminderService.createReminder).not.toHaveBeenCalled();
    });
  });
});
