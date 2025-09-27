// Tests for the message chunker utility - Advanced functionality
const { chunkMessage } = require('../../src/utils/message-chunker');

describe('Message Chunker - Advanced', () => {
  test('should not cut off sentences at chunk boundaries', () => {
    // Create a long message with sentences that would be near the chunk boundary
    const longMessage =
      'This is a very long sentence that should not be cut off in the middle. '.repeat(20);
    const chunks = chunkMessage(longMessage, 200);

    // Check that no chunk ends with a partial sentence
    chunks.forEach((chunk) => {
      const content = chunk.replace(/^\[\d+\/\d+\]\s*/, '');
      if (content.length > 0) {
        // Should end with complete sentence or be the last chunk
        const lastChar = content[content.length - 1];
        expect(['.', '!', '?', ' ']).toContain(lastChar);
      }
    });
  });

  test('should handle messages with special characters', () => {
    const specialMessage = 'Message with special chars: !@#$%^&*()_+-=[]{}|;:,.<>?';
    const chunks = chunkMessage(specialMessage, 30);

    expect(chunks.length).toBeGreaterThan(1);
    const combined = chunks.map((c) => c.replace(/^\[\d+\/\d+\]\s*/, '')).join('');
    expect(combined).toContain('!@#$%^&*()');
  });

  test('should handle messages with unicode characters', () => {
    const unicodeMessage = 'Hello 世界 🌍 emoji test';
    const chunks = chunkMessage(unicodeMessage, 15);

    expect(chunks.length).toBeGreaterThan(1);
    const combined = chunks.map((c) => c.replace(/^\[\d+\/\d+\]\s*/, '')).join('');
    expect(combined).toContain('世界');
    expect(combined).toContain('🌍');
  });

  test('should handle messages with URLs', () => {
    const urlMessage = 'Check out https://example.com for more information';
    const chunks = chunkMessage(urlMessage, 25);

    expect(chunks.length).toBeGreaterThan(1);
    const combined = chunks.map((c) => c.replace(/^\[\d+\/\d+\]\s*/, '')).join('');
    expect(combined).toContain('https://example.com');
  });

  test('should handle messages with markdown formatting', () => {
    const markdownMessage = '**Bold text** and *italic text* and `code`';
    const chunks = chunkMessage(markdownMessage, 20);

    expect(chunks.length).toBeGreaterThan(1);
    const combined = chunks.map((c) => c.replace(/^\[\d+\/\d+\]\s*/, '')).join('');
    expect(combined).toContain('**Bold text**');
    expect(combined).toContain('*italic text*');
    expect(combined).toContain('`code`');
  });

  test('should handle messages with line breaks', () => {
    const lineBreakMessage = 'Line 1\nLine 2\nLine 3';
    const chunks = chunkMessage(lineBreakMessage, 10);

    expect(chunks.length).toBeGreaterThan(1);
    const combined = chunks.map((c) => c.replace(/^\[\d+\/\d+\]\s*/, '')).join('');
    expect(combined).toContain('Line 1');
    expect(combined).toContain('Line 2');
    expect(combined).toContain('Line 3');
  });

  test('should handle very long single word', () => {
    const longWord = 'A'.repeat(1000);
    const chunks = chunkMessage(longWord, 100);

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.length).toBeLessThanOrEqual(100 + 10); // chunk size + numbering overhead
    });
  });

  test('should handle mixed content types', () => {
    const mixedMessage =
      'Text with **bold** and *italic* and `code` and https://example.com and emoji 🎉';
    const chunks = chunkMessage(mixedMessage, 30);

    expect(chunks.length).toBeGreaterThan(1);
    const combined = chunks.map((c) => c.replace(/^\[\d+\/\d+\]\s*/, '')).join('');
    expect(combined).toContain('**bold**');
    expect(combined).toContain('*italic*');
    expect(combined).toContain('`code`');
    expect(combined).toContain('https://example.com');
    expect(combined).toContain('🎉');
  });

  test('should maintain chunk order', () => {
    const longMessage =
      'This is a very long message that will be split into multiple chunks. '.repeat(10);
    const chunks = chunkMessage(longMessage, 100);

    // Check that chunks are in correct order
    chunks.forEach((chunk, index) => {
      const expectedNumber = index + 1;
      expect(chunk).toMatch(new RegExp(`^\\[${expectedNumber}\\/${chunks.length}\\]`));
    });
  });

  test('should handle edge case with exact chunk size', () => {
    const exactSizeMessage = 'A'.repeat(50);
    const chunks = chunkMessage(exactSizeMessage, 50);

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.length).toBeLessThanOrEqual(50 + 10); // chunk size + numbering overhead
    });
  });
});
