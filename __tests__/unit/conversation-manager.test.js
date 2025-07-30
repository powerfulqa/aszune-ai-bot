/**
 * Tests for conversation manager
 */
const ConversationManager = require('../../src/utils/conversation');
const config = require('../../src/config/config');
let conversationManager;
describe('Conversation Manager', () => {
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
      const history = conversationManager.getHistory('new-user');
      expect(history).toEqual([]);
    });
    
    it('returns conversation history for existing users', () => {
      const userId = 'existing-user';
      const mockHistory = [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' }
      ];
      
      conversationManager.conversations.set(userId, mockHistory);
      const history = conversationManager.getHistory(userId);
      
      expect(history).toEqual(mockHistory);
    });
  });
  
  describe('addMessage', () => {
    it('adds a message to conversation history', () => {
      const userId = 'test-user';
      conversationManager.addMessage(userId, 'user', 'hello');
      
      const history = conversationManager.getHistory(userId);
      expect(history).toEqual([{ role: 'user', content: 'hello' }]);
    });
    
    it('updates user stats when adding a user message', () => {
      const userId = 'test-user';
      conversationManager.addMessage(userId, 'user', 'hello');
      
      const stats = conversationManager.getUserStats(userId);
      expect(stats.messages).toBe(1);
    });
    
    it('trims conversation history when it exceeds the maximum length', () => {
      const userId = 'test-user';
      
      // Enable PI optimization mode for this test
      const originalEnabledValue = config.PI_OPTIMIZATIONS.ENABLED;
      config.PI_OPTIMIZATIONS.ENABLED = true;
      
      try {
        // Add more messages than the limit
        for (let i = 0; i < config.MAX_HISTORY * 3; i++) {
          conversationManager.addMessage(userId, 'user', `message ${i}`);
          conversationManager.addMessage(userId, 'assistant', `reply ${i}`);
        }
        
        const history = conversationManager.getHistory(userId);
        expect(history.length).toBeLessThanOrEqual(config.MAX_HISTORY * 2);
      } finally {
        // Restore the original value after test
        config.PI_OPTIMIZATIONS.ENABLED = originalEnabledValue;
      }
    });
  });
  
  describe('clearHistory', () => {
    it('clears conversation history for a user', () => {
      const userId = 'test-user';
      
      conversationManager.addMessage(userId, 'user', 'hello');
      conversationManager.addMessage(userId, 'assistant', 'hi');
      
      conversationManager.clearHistory(userId);
      
      const history = conversationManager.getHistory(userId);
      expect(history).toEqual([]);
    });
  });
  
  describe('isRateLimited', () => {
    it('returns false for users with no recent messages', () => {
      expect(conversationManager.isRateLimited('new-user')).toBe(false);
    });
    
    it('returns true for users with recent messages', () => {
      const userId = 'test-user';
      conversationManager.lastMessageTimestamps.set(userId, Date.now());
      
      expect(conversationManager.isRateLimited(userId)).toBe(true);
    });
    
    it('returns false after the rate limit window passes', () => {
      const userId = 'test-user';
      // Set timestamp to older than the rate limit window
      const pastTime = Date.now() - config.RATE_LIMIT_WINDOW - 1000;
      conversationManager.lastMessageTimestamps.set(userId, pastTime);
      
      expect(conversationManager.isRateLimited(userId)).toBe(false);
    });
  });
  
  describe('getUserStats', () => {
    it('returns default stats for new users', () => {
      const stats = conversationManager.getUserStats('new-user');
      expect(stats).toEqual({ messages: 0, summaries: 0 });
    });
    
    it('returns user stats for existing users', () => {
      const userId = 'test-user';
      const mockStats = { messages: 5, summaries: 2 };
      
      conversationManager.userStats.set(userId, mockStats);
      const stats = conversationManager.getUserStats(userId);
      
      expect(stats).toEqual(mockStats);
    });
  });
  
  describe('updateUserStats', () => {
    it('increments message count', () => {
      const userId = 'test-user';
      
      conversationManager.updateUserStats(userId, 'messages');
      conversationManager.updateUserStats(userId, 'messages');
      
      const stats = conversationManager.getUserStats(userId);
      expect(stats.messages).toBe(2);
    });
    
    it('increments summary count', () => {
      const userId = 'test-user';
      
      conversationManager.updateUserStats(userId, 'summaries');
      
      const stats = conversationManager.getUserStats(userId);
      expect(stats.summaries).toBe(1);
    });
  });

  describe('destroy', () => {
    it('clears intervals and saves user stats', async () => {
      // Mock the intervals
      conversationManager.cleanupInterval = setInterval(() => {}, 10000);
      conversationManager.saveStatsInterval = setInterval(() => {}, 10000);
      
      // Mock the saveUserStats method
      const saveStatsOriginal = conversationManager.saveUserStats;
      conversationManager.saveUserStats = jest.fn().mockResolvedValue();
      
      // Store references to intervals before destroy
      const cleanupIntervalBeforeDestroy = conversationManager.cleanupInterval;
      const saveStatsIntervalBeforeDestroy = conversationManager.saveStatsInterval;
      
      // Verify they exist before destroy
      expect(cleanupIntervalBeforeDestroy).toBeDefined();
      expect(saveStatsIntervalBeforeDestroy).toBeDefined();
      
      // Call destroy
      await conversationManager.destroy();
      
      // Verify intervals were cleared by checking activeIntervals size
      expect(conversationManager.activeIntervals.size).toBe(0);
      
      // Verify references are null now
      expect(conversationManager.cleanupInterval).toBeNull();
      expect(conversationManager.saveStatsInterval).toBeNull();
      
      // Verify saveUserStats was called
      expect(conversationManager.saveUserStats).toHaveBeenCalled();
      
      // Restore the original method
      conversationManager.saveUserStats = saveStatsOriginal;
    });

    it('handles errors when saving user stats during shutdown', async () => {
      // Mock the saveUserStats method to throw an error
      const saveStatsOriginal = conversationManager.saveUserStats;
      conversationManager.saveUserStats = jest.fn().mockRejectedValue(new Error('Test error'));
      
      // Call destroy
      await conversationManager.destroy();
      
      // Verify saveUserStats was called
      expect(conversationManager.saveUserStats).toHaveBeenCalled();
      
      // Restore the original method
      conversationManager.saveUserStats = saveStatsOriginal;
    });
  });
});
