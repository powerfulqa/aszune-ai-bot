/**
 * Conversation Manager Basic Operations Tests
 * Tests for basic conversation management operations
 */

// Mock the config module
jest.mock('../../src/config/config', () => require('../../__mocks__/configMock'));

// Mock the storage service
jest.mock('../../src/services/storage', () => ({
  loadUserStats: jest.fn().mockResolvedValue({}),
  saveUserStats: jest.fn().mockResolvedValue(),
}));

const ConversationManager = require('../../src/utils/conversation');
const config = require('../../src/config/config');
let conversationManager;

describe('Conversation Manager - Basic Operations', () => {
  beforeEach(() => {
    conversationManager = new ConversationManager();
    jest.clearAllMocks();

    // Clear all conversation data
    conversationManager.conversations.clear();
    conversationManager.lastMessageTimestamps.clear();
    conversationManager.userStats.clear();
  });

  afterEach(() => {
    // Clear intervals to avoid memory leaks
    if (conversationManager.cleanupInterval) {
      clearInterval(conversationManager.cleanupInterval);
    }
    if (conversationManager.saveStatsInterval) {
      clearInterval(conversationManager.saveStatsInterval);
    }
  });

  describe('getHistory', () => {
    it('returns empty array for new users', () => {
      const history = conversationManager.getHistory('123456789012345678');
      expect(history).toEqual([]);
    });

    it('returns conversation history for existing users', () => {
      const userId = '123456789012345678';
      const mockHistory = [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
      ];

      conversationManager.conversations.set(userId, mockHistory);
      const history = conversationManager.getHistory(userId);
      expect(history).toEqual(mockHistory);
    });
  });

  describe('addMessage', () => {
    it('adds message to new conversation', () => {
      const userId = '123456789012345678';
      conversationManager.addMessage(userId, 'user', 'hello');
      const history = conversationManager.getHistory(userId);
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual({ role: 'user', content: 'hello' });
    });

    it('adds message to existing conversation', () => {
      const userId = '123456789012345678';
      conversationManager.addMessage(userId, 'user', 'hello');
      conversationManager.addMessage(userId, 'assistant', 'hi');
      const history = conversationManager.getHistory(userId);
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual({ role: 'user', content: 'hello' });
      expect(history[1]).toEqual({ role: 'assistant', content: 'hi' });
    });

    it('maintains conversation history limit', () => {
      const userId = '123456789012345678';
      const maxHistory = config.MAX_HISTORY;

      // Add more messages than the limit
      for (let i = 0; i < maxHistory + 5; i++) {
        conversationManager.addMessage(userId, 'user', `message ${i}`);
      }

      const history = conversationManager.getHistory(userId);
      expect(history).toHaveLength(maxHistory);
      // Should keep the most recent messages (messages 5-24 when adding 0-24)
      expect(history[0].content).toBe(`message ${maxHistory - 15}`); // message 5
      expect(history[history.length - 1].content).toBe(`message ${maxHistory + 4}`); // message 24
    });
  });

  describe('clearHistory', () => {
    it('clears conversation history for user', () => {
      const userId = '123456789012345678';
      conversationManager.addMessage(userId, 'user', 'hello');
      conversationManager.addMessage(userId, 'assistant', 'hi');
      
      expect(conversationManager.getHistory(userId)).toHaveLength(2);
      
      conversationManager.clearHistory(userId);
      expect(conversationManager.getHistory(userId)).toHaveLength(0);
    });

    it('clears all conversation data when no userId provided', () => {
      const userId1 = '123456789012345678';
      const userId2 = '987654321098765432';
      
      conversationManager.addMessage(userId1, 'user', 'hello');
      conversationManager.addMessage(userId2, 'user', 'hi');
      
      expect(conversationManager.getHistory(userId1)).toHaveLength(1);
      expect(conversationManager.getHistory(userId2)).toHaveLength(1);
      
      conversationManager.clearHistory();
      expect(conversationManager.getHistory(userId1)).toHaveLength(0);
      expect(conversationManager.getHistory(userId2)).toHaveLength(0);
    });
  });
});
