/**
 * Tests for message-formatter.js with compact mode disabled
 * Target: Cover the non-compact code paths
 */

/* eslint-disable max-lines-per-function */

jest.mock('../../src/utils/logger');

// Mock config with compact mode disabled
jest.mock('../../src/config/config', () => ({
  PI_OPTIMIZATIONS: {
    ENABLED: false, // Disable optimizations
    COMPACT_MODE: false,
    LOW_CPU_MODE: false,
  },
  MESSAGE_LIMITS: {
    EMBED_DESCRIPTION_MAX_LENGTH: 2048,
    MAX_PARAGRAPH_LENGTH: 1000,
  },
}));

// Import after mock setup
const messageFormatter = require('../../src/utils/message-formatter');

describe('MessageFormatter - Compact mode disabled', () => {
  describe('formatResponse without compact mode', () => {
    it('should return content unchanged when compact is disabled', () => {
      const text = 'Line1\n\n\n\n\nLine2';
      const result = messageFormatter.formatResponse(text);
      // When compact mode is disabled, content should be returned as-is
      expect(result).toBe(text);
    });

    it('should not process URLs when compact is disabled', () => {
      const text = 'Visit https://example.com for more info';
      const result = messageFormatter.formatResponse(text);
      expect(result).toBe(text);
    });

    it('should not break paragraphs when compact is disabled', () => {
      const longParagraph = 'Word '.repeat(500);
      const result = messageFormatter.formatResponse(longParagraph);
      expect(result).toBe(longParagraph);
    });
  });

  describe('createCompactEmbed without compact mode', () => {
    it('should return embed unchanged when compact is disabled', () => {
      const embed = {
        title: 'Test',
        description: 'Description',
        fields: [
          { name: 'F1', value: 'V1' },
          { name: 'F2', value: 'V2' },
          { name: 'F3', value: 'V3' },
          { name: 'F4', value: 'V4' },
        ],
        footer: { text: 'Footer' },
      };
      const result = messageFormatter.createCompactEmbed(embed);
      // All fields should be preserved when compact is disabled
      expect(result.fields.length).toBe(4);
      expect(result.footer.text).toBe('Footer');
    });

    it('should preserve long descriptions when compact is disabled', () => {
      const longDesc = 'A'.repeat(5000);
      const embed = {
        title: 'Test',
        description: longDesc,
      };
      const result = messageFormatter.createCompactEmbed(embed);
      // Description should not be truncated
      expect(result.description).toBe(longDesc);
    });
  });
});
