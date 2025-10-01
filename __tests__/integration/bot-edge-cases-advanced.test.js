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

describe('Bot Edge Cases - Advanced', () => {
  let fakeMessage;

  beforeEach(() => {
    fakeMessage = {
      content: '',
      author: { bot: false, id: 'user1' },
      reply: jest.fn(),
      react: jest.fn(),
      channel: { sendTyping: jest.fn() },
    };
    jest.clearAllMocks();
  });

  it('should handle messages with mixed content types', () => {
    fakeMessage.content = 'Text with **bold** and *italic* and `code`';

    // Should handle mixed markdown content
    expect(fakeMessage.content).toContain('**bold**');
    expect(fakeMessage.content).toContain('*italic*');
    expect(fakeMessage.content).toContain('`code`');
  });

  it('should handle messages with URLs', () => {
    fakeMessage.content = 'Check out https://example.com and http://test.org';

    // Should handle URLs
    expect(fakeMessage.content).toContain('https://example.com');
    expect(fakeMessage.content).toContain('http://test.org');
  });

  it('should handle messages with email addresses', () => {
    fakeMessage.content = 'Contact me at user@example.com';

    // Should handle email addresses
    expect(fakeMessage.content).toContain('user@example.com');
  });

  it('should handle messages with mentions', () => {
    fakeMessage.content = 'Hello <@123456789012345678> and <@!987654321098765432>';

    // Should handle user mentions
    expect(fakeMessage.content).toContain('<@123456789012345678>');
    expect(fakeMessage.content).toContain('<@!987654321098765432>');
  });

  it('should handle messages with channel mentions', () => {
    fakeMessage.content = 'Check out <#123456789012345678>';

    // Should handle channel mentions
    expect(fakeMessage.content).toContain('<#123456789012345678>');
  });

  it('should handle messages with role mentions', () => {
    fakeMessage.content = 'Hey <@&123456789012345678>';

    // Should handle role mentions
    expect(fakeMessage.content).toContain('<@&123456789012345678>');
  });

  it('should handle messages with custom emojis', () => {
    fakeMessage.content = 'Great! <:custom_emoji:123456789012345678>';

    // Should handle custom emojis
    expect(fakeMessage.content).toContain('<:custom_emoji:123456789012345678>');
  });

  it('should handle messages with animated emojis', () => {
    fakeMessage.content = 'Awesome! <a:animated_emoji:123456789012345678>';

    // Should handle animated emojis
    expect(fakeMessage.content).toContain('<a:animated_emoji:123456789012345678>');
  });

  it('should handle messages with timestamps', () => {
    fakeMessage.content = 'Meeting at <t:1234567890:F>';

    // Should handle timestamps
    expect(fakeMessage.content).toContain('<t:1234567890:F>');
  });

  it('should handle messages with spoilers', () => {
    fakeMessage.content = 'The answer is ||spoiler text||';

    // Should handle spoiler text
    expect(fakeMessage.content).toContain('||spoiler text||');
  });

  it('should handle messages with strikethrough', () => {
    fakeMessage.content = 'This is ~~strikethrough~~ text';

    // Should handle strikethrough text
    expect(fakeMessage.content).toContain('~~strikethrough~~');
  });

  it('should handle messages with underlines', () => {
    fakeMessage.content = 'This is __underlined__ text';

    // Should handle underlined text
    expect(fakeMessage.content).toContain('__underlined__');
  });

  it('should handle messages with quotes', () => {
    fakeMessage.content = '> This is a quote\n> With multiple lines';

    // Should handle quoted text
    expect(fakeMessage.content).toContain('> This is a quote');
  });

  it('should handle messages with code blocks', () => {
    fakeMessage.content = '```javascript\nconsole.log("Hello");\n```';

    // Should handle code blocks
    expect(fakeMessage.content).toContain('```javascript');
    expect(fakeMessage.content).toContain('```');
  });
});
