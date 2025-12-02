/**
 * Tests for message-formatter.js LOW_CPU_MODE behavior
 * Target: Cover the footer removal branch
 */

/* eslint-disable max-lines-per-function */

jest.mock('../../src/utils/logger');

// Mock config for LOW_CPU_MODE testing
jest.mock('../../src/config/config', () => ({
  PI_OPTIMIZATIONS: {
    ENABLED: true,
    COMPACT_MODE: true,
    LOW_CPU_MODE: true, // Enable LOW_CPU_MODE to test footer removal
  },
  MESSAGE_LIMITS: {
    EMBED_DESCRIPTION_MAX_LENGTH: 2048,
    MAX_PARAGRAPH_LENGTH: 1000,
  },
}));

// Import after mock setup
const messageFormatter = require('../../src/utils/message-formatter');

describe('MessageFormatter - LOW_CPU_MODE enabled', () => {
  describe('createCompactEmbed with LOW_CPU_MODE', () => {
    it('should remove footer when LOW_CPU_MODE is enabled', () => {
      const embed = {
        title: 'Test',
        description: 'Some description',
        footer: { text: 'This footer should be removed' },
      };
      const result = messageFormatter.createCompactEmbed(embed);
      expect(result.footer).toBeUndefined();
    });

    it('should handle embed without footer in LOW_CPU_MODE', () => {
      const embed = {
        title: 'Test',
        description: 'No footer here',
      };
      const result = messageFormatter.createCompactEmbed(embed);
      expect(result).toBeDefined();
      expect(result.footer).toBeUndefined();
    });

    it('should still limit fields in LOW_CPU_MODE', () => {
      const embed = {
        fields: [
          { name: 'F1', value: 'V1' },
          { name: 'F2', value: 'V2' },
          { name: 'F3', value: 'V3' },
        ],
        footer: { text: 'Footer' },
      };
      const result = messageFormatter.createCompactEmbed(embed);
      expect(result.fields.length).toBe(2);
      expect(result.footer).toBeUndefined();
    });
  });
});
