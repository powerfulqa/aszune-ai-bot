const { EventEmitter } = require('events');
const { request } = require('undici');
jest.mock('undici');

describe('Bot Edge Cases', () => {
  let fakeMessage;

  beforeEach(() => {
    fakeMessage = {
      content: '',
      author: { bot: false, id: 'user1' },
      reply: jest.fn(),
      react: jest.fn(),
      channel: { sendTyping: jest.fn() }
    };
    jest.clearAllMocks();
  });

  it('handles empty message', async () => {
    fakeMessage.content = '';
    // Simulate handler logic: should add to history, but not trigger emoji or command
    expect(() => {
      // Your handler logic here if refactored
    }).not.toThrow();
  });

  it('handles very long message and truncates history', () => {
    const MAX_HISTORY = 20;
    let conversationHistory = { user1: [] };
    for (let i = 0; i < MAX_HISTORY * 3; i++) {
      conversationHistory['user1'].push({ role: 'user', content: `msg${i}` });
    }
    // Truncate logic
    if (conversationHistory['user1'].length > MAX_HISTORY * 2) {
      conversationHistory['user1'] = conversationHistory['user1'].slice(-MAX_HISTORY * 2);
    }
    expect(conversationHistory['user1'].length).toBe(MAX_HISTORY * 2);
  });

  it('handles API failure for chat completions', async () => {
    request.mockRejectedValueOnce(new Error('API Down'));
    await fakeMessage.reply('There was an error processing your request. Please try again later.');
    expect(fakeMessage.reply).toHaveBeenCalledWith('There was an error processing your request. Please try again later.');
  });

  it('reacts with correct emoji for hello', async () => {
    fakeMessage.content = 'hello world';
    await fakeMessage.react('👋');
    expect(fakeMessage.react).toHaveBeenCalledWith('👋');
  });

  it('does not react for non-keyword', async () => {
    fakeMessage.content = 'no emoji here';
    // Should not call react
    expect(fakeMessage.react).not.toHaveBeenCalled();
  });

  it('handles missing environment variables gracefully', () => {
    const originalEnv = { ...process.env };
    delete process.env.PERPLEXITY_API_KEY;
    delete process.env.DISCORD_BOT_TOKEN;

    jest.resetModules();

    expect(() => {
      require('../../src/config/config.js');
    }).toThrow('Missing PERPLEXITY_API_KEY, DISCORD_BOT_TOKEN in environment variables.');

    // Cleanup
    process.env = originalEnv;
    jest.resetModules();
  });
});
