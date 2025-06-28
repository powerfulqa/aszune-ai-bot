/**
 * Test the utility functions for testing
 * 
 * This is the test file for src/utils/testUtils.js
 * Previously, tests were duplicated in __tests__/utils/testUtils.test.js,
 * but they have been consolidated here to eliminate code duplication
 */
const { 
  createMockMessage, 
  createMockInteraction, 
  resetMocks, 
  mockReply, 
  mockReact,
  mockSendTyping
} = require('../../src/utils/testUtils');

describe('Test Utilities', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('createMockMessage', () => {
    it('creates a default mock message with expected properties', () => {
      const message = createMockMessage();
      expect(message.content).toBe('');
      expect(message.author.bot).toBe(false);
      expect(message.author.id).toBe('12345');
      expect(message.reply).toBe(mockReply);
      expect(message.react).toBe(mockReact);
      expect(message.channel.sendTyping).toBe(mockSendTyping);
      expect(typeof message.channel.sendTyping).toBe('function');
    });

    it('allows custom options', () => {
      const message = createMockMessage({
        content: 'test message',
        userId: '67890',
        isBot: true,
        customProp: 'custom'
      });
      expect(message.content).toBe('test message');
      expect(message.author.id).toBe('67890');
      expect(message.author.bot).toBe(true);
      expect(message.customProp).toBe('custom');
    });
  });

  describe('createMockInteraction', () => {
    it('creates a default mock interaction with expected properties', () => {
      const interaction = createMockInteraction();
      expect(interaction.user.id).toBe('12345');
      expect(interaction.commandName).toBe('help');
      expect(interaction.isChatInputCommand()).toBe(true);
      expect(interaction.reply).toBe(mockReply);
      expect(typeof interaction.deferReply).toBe('function');
      expect(typeof interaction.editReply).toBe('function');
    });

    it('allows custom options', () => {
      const interaction = createMockInteraction({
        userId: '67890',
        commandName: 'test',
        customProp: 'custom'
      });
      expect(interaction.user.id).toBe('67890');
      expect(interaction.commandName).toBe('test');
      expect(interaction.customProp).toBe('custom');
    });
  });

  describe('resetMocks', () => {
    it('resets all mocks', () => {
      // Set up mocks with values
      mockReply('test');
      mockReact('test');
      mockSendTyping('test');
      
      // Verify they've been called
      expect(mockReply).toHaveBeenCalled();
      expect(mockReact).toHaveBeenCalled();
      expect(mockSendTyping).toHaveBeenCalled();
      
      // Reset mocks
      resetMocks();
      
      // Verify they've been reset
      expect(mockReply).not.toHaveBeenCalled();
      expect(mockReact).not.toHaveBeenCalled();
      expect(mockSendTyping).not.toHaveBeenCalled();
    });
  });
});
