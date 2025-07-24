/**
 * Tests for the Message Formatter utility
 */
jest.mock('../../src/utils/logger');
const messageFormatter = require('../../src/utils/message-formatter');
const config = require('../../src/config/config');

// Mock config for testing
jest.mock('../../src/config/config', () => ({
  PI_OPTIMIZATIONS: {
    ENABLED: true,
    COMPACT_MODE: true,
    LOW_CPU_MODE: false
  }
}));

describe('Message Formatter', () => {
  describe('formatResponse', () => {
    it('should format a response message with default options', () => {
      const message = 'Hello, world!';
      const formattedMessage = messageFormatter.formatResponse(message);
      
      expect(formattedMessage).toBeDefined();
      expect(formattedMessage).toBe('Hello, world!');
    });

    it('should remove excessive whitespace', () => {
      const message = 'Hello\n\n\n\nworld!';
      const formattedMessage = messageFormatter.formatResponse(message);
      
      expect(formattedMessage).toBe('Hello\n\nworld!');
    });

    it('should truncate long messages', () => {
      const longMessage = 'a'.repeat(2000);
      const formattedMessage = messageFormatter.formatResponse(longMessage, { maxLength: 1000 });
      
      expect(formattedMessage.length).toBeLessThanOrEqual(1000);
      expect(formattedMessage.endsWith('...')).toBe(true);
    });
  });

  describe('createCompactEmbed', () => {
    it('should return original embed when not in compact mode', () => {
      // Temporarily override compact mode
      const originalCompact = messageFormatter.compact;
      messageFormatter.compact = false;
      
      const embed = { title: 'Test', description: 'This is a test embed' };
      const result = messageFormatter.createCompactEmbed(embed);
      
      expect(result).toEqual(embed);
      
      // Restore compact mode
      messageFormatter.compact = originalCompact;
    });

    it('should simplify description in compact mode', () => {
      const embed = { 
        title: 'Test', 
        description: 'This is a very long description\n\n\n\nwith excessive whitespace.' 
      };
      
      const result = messageFormatter.createCompactEmbed(embed);
      
      expect(result.description).toBeDefined();
      expect(result.description).not.toEqual(embed.description);
    });
    
    it('should limit fields in compact mode', () => {
      const embed = { 
        title: 'Test',
        fields: [
          { name: 'Field 1', value: 'Value 1' },
          { name: 'Field 2', value: 'Value 2' },
          { name: 'Field 3', value: 'Value 3' },
          { name: 'Field 4', value: 'Value 4' }
        ] 
      };
      
      const result = messageFormatter.createCompactEmbed(embed);
      
      expect(result.fields).toBeDefined();
      expect(result.fields.length).toBeLessThan(embed.fields.length);
    });
    
    it('should remove footer in low CPU mode', () => {
      // Temporarily set LOW_CPU_MODE to true
      const originalConfig = config.PI_OPTIMIZATIONS.LOW_CPU_MODE;
      config.PI_OPTIMIZATIONS.LOW_CPU_MODE = true;
      
      const embed = { 
        title: 'Test',
        footer: { text: 'This is a footer' } 
      };
      
      const result = messageFormatter.createCompactEmbed(embed);
      
      expect(result.footer).toBeUndefined();
      
      // Restore original config
      config.PI_OPTIMIZATIONS.LOW_CPU_MODE = originalConfig;
    });
  });
});