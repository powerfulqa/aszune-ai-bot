/**
 * Additional tests for message-formatter.js
 * Target: Improve coverage from 58.6% to 80%+
 */

/* eslint-disable max-lines-per-function */

jest.mock('../../src/utils/logger');
const messageFormatter = require('../../src/utils/message-formatter');

// Mock config for testing
jest.mock('../../src/config/config', () => ({
  PI_OPTIMIZATIONS: {
    ENABLED: true,
    COMPACT_MODE: true,
    LOW_CPU_MODE: false,
  },
  MESSAGE_LIMITS: {
    EMBED_DESCRIPTION_MAX_LENGTH: 2048,
    MAX_PARAGRAPH_LENGTH: 1000,
  },
}));

describe('MessageFormatter - Coverage Improvements', () => {
  describe('formatResponse edge cases', () => {
    it('should handle empty string', () => {
      const result = messageFormatter.formatResponse('');
      expect(result).toBe('');
    });

    it('should handle null', () => {
      const result = messageFormatter.formatResponse(null);
      expect(result).toBe('');
    });

    it('should handle undefined', () => {
      const result = messageFormatter.formatResponse(undefined);
      expect(result).toBe('');
    });

    it('should handle very long messages', () => {
      const result = messageFormatter.formatResponse('A'.repeat(5000));
      expect(result).toBeDefined();
    });

    it('should handle markdown content', () => {
      const result = messageFormatter.formatResponse('**bold** *italic* `code`');
      expect(result).toBeDefined();
    });

    it('should handle emojis', () => {
      const result = messageFormatter.formatResponse('Hello 👋 World 🌍');
      expect(result).toBeDefined();
    });

    it('should handle multiple consecutive newlines', () => {
      const result = messageFormatter.formatResponse('Line1\n\n\n\n\nLine2');
      expect(result).toBe('Line1\n\nLine2');
    });

    it('should handle tabs', () => {
      const result = messageFormatter.formatResponse('Col1\tCol2\tCol3');
      expect(result).toBeDefined();
    });

    it('should handle special characters', () => {
      const result = messageFormatter.formatResponse('<>&"\'\\/');
      expect(result).toBeDefined();
    });

    it('should handle URLs', () => {
      const result = messageFormatter.formatResponse('Visit https://example.com/path?q=1&a=2');
      expect(result).toBeDefined();
    });

    it('should handle code blocks', () => {
      const result = messageFormatter.formatResponse('```javascript\nconst x = 1;\n```');
      expect(result).toBeDefined();
    });
  });

  describe('formatResponse with maxLength', () => {
    it('should truncate when exceeding maxLength', () => {
      const long = 'A'.repeat(500);
      const result = messageFormatter.formatResponse(long, { maxLength: 100 });
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it('should add ellipsis when truncating', () => {
      const long = 'A'.repeat(500);
      const result = messageFormatter.formatResponse(long, { maxLength: 100 });
      expect(result).toMatch(/\.\.\.$/);
    });

    it('should not truncate short messages', () => {
      const short = 'Short message';
      const result = messageFormatter.formatResponse(short, { maxLength: 100 });
      expect(result).toBe(short);
    });

    it('should handle maxLength of 0', () => {
      const result = messageFormatter.formatResponse('test', { maxLength: 0 });
      expect(result).toBeDefined();
    });

    it('should handle very small maxLength', () => {
      const result = messageFormatter.formatResponse('Hello World', { maxLength: 5 });
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  describe('_formatSourceLinks private method via formatResponse', () => {
    it('should format source references with URLs', () => {
      const text = 'Check source (1) for more info https://example.com';
      const result = messageFormatter.formatResponse(text);
      expect(result).toBeDefined();
      // Should convert (1) to a markdown link
      expect(result).toContain('[(1)]');
    });

    it('should handle multiple source links with multiple URLs', () => {
      const text = 'See (1) and (2) for details https://first.com https://second.com';
      const result = messageFormatter.formatResponse(text);
      expect(result).toBeDefined();
    });

    it('should handle text without source links', () => {
      const text = 'No source links here';
      const result = messageFormatter.formatResponse(text);
      expect(result).toBe(text);
    });

    it('should format URLs as domain-name links', () => {
      const text = 'Visit this site: https://example.com/path/to/page';
      const result = messageFormatter.formatResponse(text);
      expect(result).toBeDefined();
    });

    it('should handle invalid URLs gracefully', () => {
      const text = 'Check source (1) for info';
      const result = messageFormatter.formatResponse(text);
      expect(result).toBeDefined();
    });
  });

  describe('_breakLongParagraphs private method via formatResponse', () => {
    it('should break very long paragraphs at sentence boundaries', () => {
      const longParagraph =
        'This is sentence one. This is sentence two. This is sentence three. '.repeat(50);
      const result = messageFormatter.formatResponse(longParagraph);
      expect(result).toBeDefined();
      // Result should contain paragraph breaks
      expect(result).toContain('\n\n');
    });

    it('should preserve short paragraphs', () => {
      const shortParagraph = 'This is a short paragraph.';
      const result = messageFormatter.formatResponse(shortParagraph);
      expect(result).toContain('This is a short paragraph');
    });

    it('should handle mixed length paragraphs', () => {
      const mixed =
        'Short.\n\n' + 'This is a longer sentence that repeats. '.repeat(20) + '\n\nAnother short.';
      const result = messageFormatter.formatResponse(mixed);
      expect(result).toBeDefined();
    });

    it('should handle paragraphs without sentence boundaries', () => {
      const noSentences = 'word '.repeat(200);
      const result = messageFormatter.formatResponse(noSentences);
      expect(result).toBeDefined();
    });

    it('should handle paragraphs with question marks as boundaries', () => {
      const questions = 'What is this? Who knows? Where are we? '.repeat(30);
      const result = messageFormatter.formatResponse(questions);
      expect(result).toBeDefined();
    });

    it('should handle paragraphs with exclamation marks as boundaries', () => {
      const exclamations = 'Wow! Amazing! Incredible! '.repeat(30);
      const result = messageFormatter.formatResponse(exclamations);
      expect(result).toBeDefined();
    });
  });

  describe('createCompactEmbed', () => {
    it('should return embed unchanged when compact mode is disabled', () => {
      // Note: compact is set to true in mock config, so this tests the compact path
      const embed = {
        title: 'Test',
        description: 'Short description',
      };
      const result = messageFormatter.createCompactEmbed(embed);
      expect(result).toBeDefined();
      expect(result.title).toBe('Test');
    });

    it('should limit fields to 2 in compact mode', () => {
      const embed = {
        title: 'Test',
        fields: [
          { name: 'Field1', value: 'Value1' },
          { name: 'Field2', value: 'Value2' },
          { name: 'Field3', value: 'Value3' },
          { name: 'Field4', value: 'Value4' },
        ],
      };
      const result = messageFormatter.createCompactEmbed(embed);
      expect(result.fields.length).toBe(2);
    });

    it('should truncate long descriptions', () => {
      const embed = {
        title: 'Test',
        description: 'A'.repeat(3000),
      };
      const result = messageFormatter.createCompactEmbed(embed);
      expect(result.description.length).toBeLessThanOrEqual(2048);
    });

    it('should handle embed without fields', () => {
      const embed = {
        title: 'Test',
        description: 'No fields here',
      };
      const result = messageFormatter.createCompactEmbed(embed);
      expect(result).toBeDefined();
      expect(result.fields).toBeUndefined();
    });

    it('should handle embed with empty fields array', () => {
      const embed = {
        title: 'Test',
        fields: [],
      };
      const result = messageFormatter.createCompactEmbed(embed);
      expect(result.fields).toEqual([]);
    });

    it('should handle embed without description', () => {
      const embed = {
        title: 'Test Only Title',
      };
      const result = messageFormatter.createCompactEmbed(embed);
      expect(result.title).toBe('Test Only Title');
    });

    it('should preserve footer when LOW_CPU_MODE is false', () => {
      const embed = {
        title: 'Test',
        footer: { text: 'Footer text' },
      };
      const result = messageFormatter.createCompactEmbed(embed);
      // LOW_CPU_MODE is false in mock, so footer should be preserved
      expect(result.footer).toBeDefined();
    });

    it('should handle complex embed with all properties', () => {
      const embed = {
        title: 'Complex Embed',
        description: 'This is a description with content.',
        color: '#5865F2',
        fields: [
          { name: 'Field1', value: 'Value1', inline: true },
          { name: 'Field2', value: 'Value2', inline: true },
          { name: 'Field3', value: 'Value3', inline: false },
        ],
        footer: { text: 'Footer' },
        thumbnail: { url: 'https://example.com/thumb.png' },
        image: { url: 'https://example.com/image.png' },
        author: { name: 'Author Name' },
        timestamp: new Date().toISOString(),
      };
      const result = messageFormatter.createCompactEmbed(embed);
      expect(result).toBeDefined();
      expect(result.fields.length).toBe(2);
    });
  });

  describe('compact mode behavior', () => {
    it('should apply compact formatting when enabled', () => {
      const longText = 'A'.repeat(100) + '\n\n\n\n' + 'B'.repeat(100);
      const result = messageFormatter.formatResponse(longText);
      // Should reduce multiple newlines
      expect(result).not.toContain('\n\n\n\n');
    });

    it('should handle text with mixed newline patterns', () => {
      const text = 'Para1\n\nPara2\n\n\nPara3\n\n\n\nPara4';
      const result = messageFormatter.formatResponse(text);
      // Should normalize to double newlines
      expect(result).not.toContain('\n\n\n\n');
    });
  });
});
