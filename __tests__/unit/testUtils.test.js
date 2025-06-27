/**
 * Test the utility functions for testing
 */
const { 
  createMockMessage, 
  createMockInteraction, 
  resetMocks, 
  mockReply, 
  mockReact 
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
      expect(message.channel.sendTyping).toBeDefined();
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
      mockReply('test');
      mockReact('test');
      expect(mockReply).toHaveBeenCalled();
      expect(mockReact).toHaveBeenCalled();
      
      resetMocks();
      
      expect(mockReply).not.toHaveBeenCalled();
      expect(mockReact).not.toHaveBeenCalled();
    });
  });
});
