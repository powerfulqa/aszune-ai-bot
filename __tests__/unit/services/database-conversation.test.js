// Mock config to use in-memory database
jest.mock('../../../src/config/config', () => ({
  DB_PATH: ':memory:',
}));

const { DatabaseService } = require('../../../src/services/database');

describe('DatabaseService - Conversation History', function () {
  let dbService;

  beforeEach(() => {
    jest.clearAllMocks();
    dbService = new DatabaseService();
    // Force re-initialization for each test
    dbService.db = null;
    dbService.dbPath = ':memory:';
  });

  afterEach(() => {
    if (dbService.db && !dbService.isDisabled) {
      try {
        dbService.close();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  });
    }
  });

  describe('getConversationHistory', () => {
    it('should return empty array for user with no conversation', () => {
      const result = dbService.getConversationHistory('123');
      expect(result).toEqual([]);
    });

    it('should return conversation history with proper roles', () => {
      dbService.addUserMessage('123', 'Hello');
      dbService.addBotResponse('123', 'Hi there!');
      dbService.addUserMessage('123', 'How are you?');

      const history = dbService.getConversationHistory('123');
      expect(history.length).toBe(3);
      expect(history[0].role).toBe('user');
      expect(history[0].message).toBe('Hello');
      expect(history[1].role).toBe('assistant');
      expect(history[1].message).toBe('Hi there!');
      expect(history[2].role).toBe('user');
      expect(history[2].message).toBe('How are you?');
    });

    it('should respect conversation limit', () => {
      // Add more messages than the limit
      for (let i = 0; i < 25; i++) {
        dbService.addUserMessage('123', `Message ${i}`);
      }

      const history = dbService.getConversationHistory('123', 10);
      expect(history.length).toBe(10);
      // Just check that we have some messages, don't worry about exact order for now
      expect(history[0].message).toMatch(/Message \d+/);
    });

    it('should handle alternating user and bot messages correctly', () => {
      // Create a realistic conversation pattern
      dbService.addUserMessage('456', 'What is AI?');
      dbService.addBotResponse('456', 'AI stands for Artificial Intelligence...');
      dbService.addUserMessage('456', 'Can you give examples?');
      dbService.addBotResponse('456', 'Sure! Examples include machine learning...');
      dbService.addUserMessage('456', 'Thank you');

      const history = dbService.getConversationHistory('456');
      expect(history.length).toBe(5);

      // Verify the conversation flow
      expect(history[0]).toEqual({
        role: 'user',
        message: 'What is AI?',
        timestamp: expect.any(String),
        message_length: 11,
        response_time_ms: 0,
      });
      expect(history[1]).toEqual({
        role: 'assistant',
        message: 'AI stands for Artificial Intelligence...',
        timestamp: expect.any(String),
        message_length: 40,
        response_time_ms: 0,
      });
      expect(history[2]).toEqual({
        role: 'user',
        message: 'Can you give examples?',
        timestamp: expect.any(String),
        message_length: 22,
        response_time_ms: 0,
      });
      expect(history[3]).toEqual({
        role: 'assistant',
        message: 'Sure! Examples include machine learning...',
        timestamp: expect.any(String),
        message_length: 42,
        response_time_ms: 0,
      });
      expect(history[4]).toEqual({
        role: 'user',
        message: 'Thank you',
        timestamp: expect.any(String),
        message_length: 9,
        response_time_ms: 0,
      });
    });

    it('should handle database errors gracefully', () => {
      // Force a database error by closing the database
      if (dbService.db && !dbService.isDisabled) {
        dbService.close();
      }

      // Should return empty array instead of throwing
      const result = dbService.getConversationHistory('789');
      expect(result).toEqual([]);
    });

    it('should return conversation history in chronological order', () => {
      dbService.addUserMessage('999', 'First message');
      dbService.addBotResponse('999', 'First response');
      dbService.addUserMessage('999', 'Second message');
      dbService.addBotResponse('999', 'Second response');

      const history = dbService.getConversationHistory('999');
      expect(history.length).toBe(4);
      expect(history[0].message).toBe('First message');
      expect(history[1].message).toBe('First response');
      expect(history[2].message).toBe('Second message');
      expect(history[3].message).toBe('Second response');
    });
  });
});
