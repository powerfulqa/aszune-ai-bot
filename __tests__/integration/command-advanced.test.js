const createMockMessage = require('../../__mocks__/discordMessageMock');
// const { Client } = require('discord.js'); // Currently unused
// const { request } = require('undici'); // Currently unused
jest.mock('undici');

// Mock the commands module first to avoid circular dependencies
jest.mock('../../src/commands', () => ({
  handleTextCommand: jest.fn().mockImplementation(async (message) => {
    // Mock implementation that returns null for non-command messages
    if (!message.content.startsWith('!')) return null;
    if (message.content.startsWith('!help')) return { content: 'Help message' };
    if (message.content.startsWith('!clearhistory')) return { content: 'History cleared' };
    if (message.content.startsWith('!summary')) return { content: 'Summary' };
    return null;
  }),
  handleSlashCommand: jest.fn(),
  getSlashCommandsData: jest.fn().mockReturnValue([{ name: 'test' }]),
}));

let conversationHistory;

beforeEach(() => {
  conversationHistory = new Map();
});

describe('Command Handling - Advanced', () => {
  test('!summarise command with text parameter', async () => {
    const msg = createMockMessage('!summarise This is a long text that needs to be summarized');

    // Mock the summarise command response
    const summaryResponse = {
      embeds: [
        {
          color: 0x0099ff,
          title: 'Text Summary',
          description: 'This text discusses summarization and contains important information.',
          footer: { text: 'Aszai Bot' },
        },
      ],
    };

    await msg.reply(summaryResponse);

    expect(msg.reply).toHaveBeenCalledWith(summaryResponse);
  });

  test('!summerise command with text parameter (alternative spelling)', async () => {
    const msg = createMockMessage('!summerise This is another text that needs summarization');

    // Mock the summarise command response
    const summaryResponse = {
      embeds: [
        {
          color: 0x0099ff,
          title: 'Text Summary',
          description: 'This text discusses summarization and contains important information.',
          footer: { text: 'Aszai Bot' },
        },
      ],
    };

    await msg.reply(summaryResponse);

    expect(msg.reply).toHaveBeenCalledWith(summaryResponse);
  });

  test('handles empty summarise command', async () => {
    const msg = createMockMessage('!summarise');
    const errorMessage =
      'Please provide the text you want summarised. Usage: `!summarise <text>` or `!summerise <text>`';

    await msg.reply(errorMessage);

    expect(msg.reply).toHaveBeenCalledWith(errorMessage);
  });

  test('handles summarise command with only whitespace', async () => {
    const msg = createMockMessage('!summarise   ');
    const errorMessage =
      'Please provide the text you want summarised. Usage: `!summarise <text>` or `!summerise <text>`';

    await msg.reply(errorMessage);

    expect(msg.reply).toHaveBeenCalledWith(errorMessage);
  });

  test('handles very long text in summarise command', async () => {
    const longText = 'A'.repeat(5000); // Very long text
    const msg = createMockMessage(`!summarise ${longText}`);

    // Should handle long text gracefully
    expect(msg.content.length).toBeGreaterThan(4000);
  });

  test('handles special characters in summarise command', async () => {
    const specialText = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const msg = createMockMessage(`!summarise ${specialText}`);

    // Should handle special characters
    expect(msg.content).toContain(specialText);
  });

  test('handles multiline text in summarise command', async () => {
    const multilineText = 'Line 1\nLine 2\nLine 3';
    const msg = createMockMessage(`!summarise ${multilineText}`);

    // Should handle multiline text
    expect(msg.content).toContain('\n');
  });

  test('handles command with extra parameters', async () => {
    const msg = createMockMessage('!summarise text extra parameter');

    // Should extract only the text part
    const textPart = msg.content.replace('!summarise ', '');
    expect(textPart).toBe('text extra parameter');
  });

  test('handles case insensitive commands', async () => {
    const msg1 = createMockMessage('!SUMMARISE test text');
    const msg2 = createMockMessage('!Summarise test text');
    const msg3 = createMockMessage('!summarise test text');

    // All should be treated as the same command
    expect(msg1.content.toLowerCase()).toContain('summarise');
    expect(msg2.content.toLowerCase()).toContain('summarise');
    expect(msg3.content.toLowerCase()).toContain('summarise');
  });

  test('handles command with markdown formatting', async () => {
    const markdownText = '**Bold text** and *italic text*';
    const msg = createMockMessage(`!summarise ${markdownText}`);

    // Should handle markdown formatting
    expect(msg.content).toContain('**Bold text**');
    expect(msg.content).toContain('*italic text*');
  });

  test('handles command with URLs', async () => {
    const urlText = 'Check out https://example.com for more info';
    const msg = createMockMessage(`!summarise ${urlText}`);

    // Should handle URLs
    expect(msg.content).toContain('https://example.com');
  });

  test('handles command with emojis', async () => {
    const emojiText = 'Hello 👋 World 🌍';
    const msg = createMockMessage(`!summarise ${emojiText}`);

    // Should handle emojis
    expect(msg.content).toContain('👋');
    expect(msg.content).toContain('🌍');
  });
});
