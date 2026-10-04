/**
 * Chat service: typing indicator stays alive through long agent runs, and the
 * conversation memory stores the model's answer rather than the emoji-decorated
 * display text.
 */

jest.mock('../../src/config/config', () => require('../../__mocks__/configMock'));
jest.mock('../../src/commands', () => ({
  handleSlashCommand: jest.fn(),
  getSlashCommandsData: jest.fn().mockReturnValue([{ name: 'test' }]),
}));
jest.mock('../../src/services/perplexity-secure', () => ({
  generateChatResponse: jest.fn(),
}));
jest.mock('../../src/services/database', () => ({
  addUserMessage: jest.fn(),
  updateUserStats: jest.fn(),
  addBotResponse: jest.fn(),
  getConversationHistory: jest.fn().mockReturnValue([]),
  logPerformanceMetric: jest.fn(),
}));
jest.mock('../../src/utils/conversation', () => {
  const mockConversationManager = {
    isRateLimited: jest.fn().mockReturnValue(false),
    getHistory: jest.fn().mockReturnValue([{ role: 'user', content: 'hello' }]),
    addMessage: jest.fn(),
    updateTimestamp: jest.fn(),
  };
  return jest.fn().mockImplementation(() => mockConversationManager);
});
// Verified session: responses pass through unchanged (the validator itself is
// covered by its own tests).
jest.mock('../../src/utils/metrics/session-validator', () => ({
  validateRequest: jest.fn().mockReturnValue({ degraded: false }),
  processResponse: jest.fn((response) => response),
}));
jest.mock('../../src/utils/emoji');

const chatService = require('../../src/services/chat');
const handleChatMessage = chatService.handleChatMessage;
const perplexityService = require('../../src/services/perplexity-secure');
const ConversationManager = require('../../src/utils/conversation');
const emojiManager = require('../../src/utils/emoji');
const databaseService = require('../../src/services/database');

const USER_ID = '123456789012345678';

const createMessage = (content = 'hello', id = 'msg-1') => ({
  id,
  content,
  author: { bot: false, id: USER_ID, username: 'tester' },
  reply: jest.fn().mockResolvedValue({}),
  react: jest.fn().mockResolvedValue({}),
  channel: { sendTyping: jest.fn().mockResolvedValue(undefined) },
});

describe('Chat Service - typing indicator and memory', () => {
  let mockConversationManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConversationManager = new ConversationManager();
    mockConversationManager.isRateLimited.mockReturnValue(false);
    mockConversationManager.getHistory.mockReturnValue([{ role: 'user', content: 'hello' }]);
    emojiManager.addEmojisToResponse.mockImplementation((text) => `${text} 😊`);
    emojiManager.addReactionsToMessage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stores the undecorated answer in memory and the database', async () => {
    perplexityService.generateChatResponse.mockResolvedValue('Arthas fell at Icecrown.');

    await handleChatMessage(createMessage('Who is Arthas?'));

    expect(mockConversationManager.addMessage).toHaveBeenCalledWith(
      USER_ID,
      'assistant',
      'Arthas fell at Icecrown.'
    );
    expect(databaseService.addBotResponse).toHaveBeenCalledWith(
      USER_ID,
      'Arthas fell at Icecrown.'
    );
  });

  it('refreshes typing every 8s during a long run and stops afterwards', async () => {
    jest.useFakeTimers();
    let finish;
    perplexityService.generateChatResponse.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const message = createMessage('Tell me the full lore', 'msg-typing');

    const pending = handleChatMessage(message);
    while (!finish) {
      await jest.advanceTimersByTimeAsync(0);
    }
    expect(message.channel.sendTyping).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(16000);
    expect(message.channel.sendTyping).toHaveBeenCalledTimes(3);

    finish('Done.');
    await pending;
    await jest.advanceTimersByTimeAsync(30000);
    expect(message.channel.sendTyping).toHaveBeenCalledTimes(3);
  });

  it('keeps going when sendTyping rejects', async () => {
    perplexityService.generateChatResponse.mockResolvedValue('Answer.');
    const message = createMessage('hello again', 'msg-typing-fail');
    message.channel.sendTyping.mockRejectedValue(new Error('Missing Permissions'));

    await handleChatMessage(message);

    expect(message.reply).toHaveBeenCalledTimes(1);
  });
});
