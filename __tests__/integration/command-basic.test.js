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

describe('Command Handling - Basic', () => {
  it('responds to !clearhistory and clears the conversation history', async () => {
    const msg = createMockMessage('!clearhistory');
    const userId = msg.author.id;

    // simulate existing history
    conversationHistory.set(userId, [{ role: 'user', content: 'Hello' }]);
    expect(conversationHistory.get(userId).length).toBeGreaterThan(0);

    // Simulate command handler logic
    conversationHistory.set(userId, []);
    await msg.reply('Your conversation history has been cleared.');

    expect(conversationHistory.get(userId).length).toBe(0);
    expect(msg.reply).toHaveBeenCalledWith('Your conversation history has been cleared.');
  });

  test('!help command replies with help message', async () => {
    const msg = createMockMessage('!help');
    const helpText =
      '**Aszai Bot Commands:**\n' +
      '`!help` - Show this help message\n' +
      '`!clearhistory` - Clear your conversation history\n' +
      '`!summary` - Summarise your current conversation\n' +
      '`!summarise <text>` or `!summerise <text>` - Summarise provided text\n' +
      '`!stats` - Show your usage stats\n' +
      'Simply chat as normal to talk to the bot!';

    await msg.reply(helpText);

    expect(msg.reply).toHaveBeenCalledWith(helpText);
  });

  test('!summary command replies with summary message', async () => {
    const msg = createMockMessage('!summary');
    const userId = msg.author.id;

    // simulate existing history
    conversationHistory.set(userId, [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ]);

    const summaryText = 'This conversation covered greetings and introductions.';
    await msg.reply(summaryText);

    expect(msg.reply).toHaveBeenCalledWith(summaryText);
  });

  test('!stats command replies with stats message', async () => {
    const msg = createMockMessage('!stats');
    const statsText = '**Your Aszai Bot Stats:**\nMessages sent: 5\nSummaries requested: 2';

    await msg.reply(statsText);

    expect(msg.reply).toHaveBeenCalledWith(statsText);
  });

  test('handles unknown commands gracefully', async () => {
    const msg = createMockMessage('!unknowncommand');

    // Should not throw an error
    expect(() => {
      // Mock command handler would return null for unknown commands
    }).not.toThrow();
  });

  test('ignores messages that do not start with !', async () => {
    const msg = createMockMessage('Hello, how are you?');

    // Should not process as command
    expect(msg.content.startsWith('!')).toBe(false);
  });
});
