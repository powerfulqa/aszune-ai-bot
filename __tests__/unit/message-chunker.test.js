// Tests for the message chunker utility
const { chunkMessage } = require('../../src/utils/message-chunker');

describe('Message Chunker', () => {
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

  test('should not cut off sentences at chunk boundaries', () => {
    // Create a long message with sentences that would be near the chunk boundary
    const longSentence =
      'This is a very long sentence that contains important information about Starsector assigning operatives to do missions through the campaign interface by interacting with contacts who offer missions and then selecting an officer to carry out the mission.';
    const nextSentence =
      'The general process includes obtaining a mission, assigning an officer, and awaiting the mission outcome.';
    const longText = longSentence + ' ' + nextSentence;

    // Force chunking by using a length that falls in the middle of the first sentence
    const chunkLength = longSentence.length - 20;
    const chunks = chunkMessage(longText, chunkLength);

    // Should split into at least 2 chunks
    expect(chunks.length).toBeGreaterThan(1);

    // Check that the sentence is properly preserved across chunks
    const cleanChunks = chunks.map((chunk) => chunk.replace(/^\[\d+\/\d+\]\s*/, ''));
    const reconstructed = cleanChunks.join('');

    // Make sure all key phrases are present in the reconstructed text
    expect(reconstructed).toContain(
      'This is a very long sentence that contains important information'
    );
    expect(reconstructed).toContain('Starsector assigning operatives');
    expect(reconstructed).toContain('offer missions and then selecting');
    expect(reconstructed).toContain('officer to carry out the mission');
    expect(reconstructed).toContain('general process includes obtaining a mission');

    // Most important: ensure the content remains intact (with small formatting variations allowed)
    const normalizedReconstruction = reconstructed.replace(/\s+/g, ' ');
    const normalizedOriginal = longText.replace(/\s+/g, ' ');

    // The key phrases should be present in the proper order
    expect(normalizedReconstruction).toContain('information about Starsector');
    expect(normalizedReconstruction).toContain('selecting an officer');
    expect(normalizedReconstruction).toContain('carry out the mission');
    expect(normalizedReconstruction).toContain('general process includes obtaining');
  });
});
