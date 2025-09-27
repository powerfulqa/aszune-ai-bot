/**
 * Tests for emoji utility
 */
const emojiManager = require('../../src/utils/emoji');
const _config = require('../../src/config/config');

describe('EmojiManager', () => {
  it('adds emojis to response based on keywords', () => {
    const content = 'I am happy to help you';
    const result = emojiManager.addEmojisToResponse(content);
    expect(result).toContain('I am happy to help you 😊');
  });

  it('adds multiple emojis when multiple keywords are found', () => {
    const content = 'I love to help, welcome!';
    const result = emojiManager.addEmojisToResponse(content);
    expect(result).toContain('❤️');
    expect(result).toContain('👋');
  });

  it('does not add emojis when no keywords are found', () => {
    const content = 'This content has no matching keywords';
    const result = emojiManager.addEmojisToResponse(content);
    expect(result).toBe(content);
  });

  it('gets reactions for a message based on keywords', () => {
    const content = 'hello, I am sad';
    const reactions = emojiManager.getReactionsForMessage(content);
    expect(reactions).toContain('👋'); // hello
    expect(reactions).toContain('😢'); // sad
    expect(reactions.length).toBe(2);
  });

  it('returns empty array when no reaction keywords are found', () => {
    const content = 'This content has no matching keywords';
    const reactions = emojiManager.getReactionsForMessage(content);
    expect(reactions).toEqual([]);
  });

  it('adds reactions to a message', async () => {
    const mockMessage = {
      content: 'I am happy and in love',
      react: jest.fn().mockResolvedValue(true),
    };

    await emojiManager.addReactionsToMessage(mockMessage);

    expect(mockMessage.react).toHaveBeenCalledWith('😊'); // happy
    expect(mockMessage.react).toHaveBeenCalledWith('❤️'); // love
    expect(mockMessage.react).toHaveBeenCalledTimes(2);
  });

  it('handles errors when adding reactions', async () => {
    const mockMessage = {
      content: 'hello',
      react: jest.fn().mockRejectedValue(new Error('Error adding reaction')),
    };

    // Mock console.error to avoid test output pollution
    const originalConsoleError = console.error;
    console.error = jest.fn();

    await emojiManager.addReactionsToMessage(mockMessage);

    expect(mockMessage.react).toHaveBeenCalledWith('👋'); // hello
    expect(console.error).toHaveBeenCalled();

    // Restore console.error
    console.error = originalConsoleError;
  });
});
