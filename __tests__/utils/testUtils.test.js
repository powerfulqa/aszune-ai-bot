/**
 * Tests for test utilities
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
    it('creates a default mock message', () => {
      const message = createMockMessage();
      expect(message.content).toBe('');
      expect(message.author.bot).toBe(false);
      expect(message.author.id).toBe('12345');
      expect(typeof message.reply).toBe('function');
      expect(typeof message.react).toBe('function');
      expect(typeof message.channel.sendTyping).toBe('function');
    });
    
    it('overrides defaults with provided options', () => {
      const message = createMockMessage({
        content: 'test message',
        isBot: true,
        userId: '67890',
        customField: 'custom value'
      });
      
      expect(message.content).toBe('test message');
      expect(message.author.bot).toBe(true);
      expect(message.author.id).toBe('67890');
      expect(message.customField).toBe('custom value');
    });
  });
  
  describe('createMockInteraction', () => {
    it('creates a default mock interaction', () => {
      const interaction = createMockInteraction();
      expect(interaction.user.id).toBe('12345');
      expect(interaction.commandName).toBe('help');
      expect(interaction.isChatInputCommand()).toBe(true);
      expect(typeof interaction.reply).toBe('function');
      expect(typeof interaction.deferReply).toBe('function');
      expect(typeof interaction.editReply).toBe('function');
    });
    
    it('overrides defaults with provided options', () => {
      const interaction = createMockInteraction({
        userId: '67890',
        commandName: 'stats',
        customField: 'custom value'
      });
      
      expect(interaction.user.id).toBe('67890');
      expect(interaction.commandName).toBe('stats');
      expect(interaction.customField).toBe('custom value');
    });
  });
  
  describe('resetMocks', () => {
    it('resets all mocks', () => {
      mockReply.mockReturnValueOnce('test');
      mockReact.mockReturnValueOnce('test');
      
      expect(mockReply.mock.calls.length).toBe(0);
      expect(mockReact.mock.calls.length).toBe(0);
      
      mockReply();
      mockReact();
      
      expect(mockReply.mock.calls.length).toBe(1);
      expect(mockReact.mock.calls.length).toBe(1);
      
      resetMocks();
      
      expect(mockReply.mock.calls.length).toBe(0);
      expect(mockReact.mock.calls.length).toBe(0);
    });
  });
});
