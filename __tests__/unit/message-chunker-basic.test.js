// Tests for the message chunker utility - Basic functionality
const { chunkMessage } = require('../../src/utils/message-chunker');

describe('Message Chunker - Basic', () => {
  test('should not chunk message that fits within max length', () => {
    const shortMessage = 'This is a short message that fits within the limit';
    const chunks = chunkMessage(shortMessage, 2000);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(shortMessage);
  });

  test('should chunk a message that exceeds max length', () => {
    // Create a message that exceeds the max length with sentence breaks
    const longParagraph = 'This is sentence 1. '.repeat(100) + 'This is sentence 2. '.repeat(100);
    // Use a smaller chunk size to ensure it breaks into multiple chunks
    const chunks = chunkMessage(longParagraph, 500);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toMatch(/^\[1\/\d+\]/); // Should start with [1/N]
  });

  test('should preserve paragraph breaks when possible', () => {
    const multiParagraph = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    const chunks = chunkMessage(multiParagraph, 50);

    // We expect at least one break since the total length exceeds 50
    expect(chunks.length).toBeGreaterThan(1);

    // The chunks should contain the original text (minus the formatting)
    const combined = chunks.map((c) => c.replace(/^\[\d+\/\d+\]\s*/, '')).join('');
    expect(combined).toContain('First paragraph');
    expect(combined).toContain('Second paragraph');
    expect(combined).toContain('Third paragraph');
  });

  test('should add correct chunk numbering', () => {
    const longText = Array(5)
      .fill('This is a paragraph that will need to be split into chunks.')
      .join('\n\n');
    const chunks = chunkMessage(longText, 50);

    // Check that each chunk has the correct numbering format
    chunks.forEach((chunk, index) => {
      expect(chunk).toMatch(new RegExp(`^\\[${index + 1}\\/${chunks.length}\\]`));
    });
  });

  test('should handle empty message', () => {
    const chunks = chunkMessage('', 2000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('');
  });

  test('should handle null or undefined input', () => {
    expect(() => chunkMessage(null, 2000)).not.toThrow();
    expect(() => chunkMessage(undefined, 2000)).not.toThrow();
  });

  test('should handle very small chunk size', () => {
    const message = 'This is a test message';
    const chunks = chunkMessage(message, 5);
    
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach(chunk => {
      expect(chunk.length).toBeLessThanOrEqual(5 + 10); // chunk size + numbering overhead
    });
  });
});
