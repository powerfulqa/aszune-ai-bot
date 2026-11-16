/**
 * Bot Integration - Core
 *
 * Drives the real chat handler (src/services/chat.js) together with the real
 * conversation manager, input validator, error handler, formatter and emoji
 * manager. Only the edges are doubled: the Discord message, the Perplexity
 * service, the database, file storage, the logger and the session validator.
 */

jest.mock('../../src/services/perplexity-secure', () => ({
  generateChatResponse: jest.fn(),
  generateSummary: jest.fn(),
}));
jest.mock('../../src/services/database', () => ({
  addUserMessage: jest.fn(),
  updateUserStats: jest.fn(),
  addBotResponse: jest.fn(),
  getConversationHistory: jest.fn().mockReturnValue([]),
  logPerformanceMetric: jest.fn(),
}));
jest.mock('../../src/services/reminder-service', () => ({
  isInitialized: true,
  initialize: jest.fn(),
  setReminder: jest.fn(),
}));
jest.mock('../../src/services/storage', () => ({
  loadUserStats: jest.fn().mockResolvedValue({}),
  saveUserStats: jest.fn().mockResolvedValue(),
}));
jest.mock('../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
// Unverified sessions randomly degrade answers; pin the validator so replies are deterministic.
jest.mock('../../src/utils/metrics/session-validator', () => ({
  validateRequest: jest.fn().mockReturnValue({ valid: true, degraded: false }),
  processResponse: jest.fn((response) => response),
}));

const USER_ID = '123456789012345678';
const PRIMARY = 0x0099ff;
const WARNING = 0xfee75c;
const START = new Date('2026-11-16T12:00:00.000Z');

let nextMessageId = 0;
function createMessage(content, overrides = {}) {
  nextMessageId += 1;
  return {
    id: `msg-${nextMessageId}`,
    content,
    author: { bot: false, id: USER_ID, username: 'tester' },
    client: { user: { id: '999999999999999999' } },
    channel: { id: '987654321098765432', sendTyping: jest.fn() },
    guild: { id: '555555555555555555' },
    reply: jest.fn().mockResolvedValue({}),
    react: jest.fn().mockResolvedValue({}),
    ...overrides,
  };
}

// A single-message answer carries no "[1/1]" numbering.
function answerEmbed(answer) {
  return {
    embeds: [{ color: PRIMARY, description: answer, footer: { text: 'Aszai Bot' } }],
  };
}

describe('Bot Integration - Core', () => {
  let handleChatMessage;
  let perplexityService;
  let databaseService;
  // chat.js hands the service the live history array, which grows once the
  // answer arrives, so each call's argument is copied at call time.
  let sentHistories;

  function answerWith(answer) {
    perplexityService.generateChatResponse.mockImplementation(async (history) => {
      sentHistories.push(history.map((entry) => ({ ...entry })));
      return answer;
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: START, doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
    handleChatMessage = require('../../src/services/chat');
    perplexityService = require('../../src/services/perplexity-secure');
    databaseService = require('../../src/services/database');
    sentHistories = [];
    answerWith('Malenia is the Blade of Miquella.');
  });

  it.each([
    ['a bot author', { author: { bot: true, id: USER_ID } }, 'Who is Malenia?'],
    ['a "!" prefix', {}, '!help'],
    ['a "/" prefix', {}, '/summary'],
    ['an empty message', {}, ''],
    ['whitespace only', {}, '   '],
    ['a bare @everyone', {}, '@everyone'],
    ['a bare mention of another user', {}, '<@111111111111111111>'],
  ])('ignores %s', async (_label, overrides, content) => {
    const message = createMessage(content, overrides);

    await expect(handleChatMessage(message)).resolves.toBeNull();

    expect(message.reply).not.toHaveBeenCalled();
    expect(message.channel.sendTyping).not.toHaveBeenCalled();
    expect(perplexityService.generateChatResponse).not.toHaveBeenCalled();
    expect(databaseService.addUserMessage).not.toHaveBeenCalled();
  });

  it('answers a question with an embed built from the service answer', async () => {
    const message = createMessage('Who is Malenia?');

    await handleChatMessage(message);

    expect(perplexityService.generateChatResponse).toHaveBeenCalledTimes(1);
    expect(sentHistories).toEqual([[{ role: 'user', content: 'Who is Malenia?' }]]);
    expect(message.channel.sendTyping).toHaveBeenCalledTimes(1);
    expect(message.reply).toHaveBeenCalledTimes(1);
    expect(message.reply).toHaveBeenCalledWith(answerEmbed('Malenia is the Blade of Miquella.'));
    expect(message.react).not.toHaveBeenCalled();
  });

  it('persists both sides of the exchange', async () => {
    await handleChatMessage(createMessage('Who is Malenia?'));

    expect(databaseService.addUserMessage).toHaveBeenCalledWith(
      USER_ID,
      'Who is Malenia?',
      0,
      'tester'
    );
    expect(databaseService.updateUserStats).toHaveBeenCalledWith(USER_ID, {
      last_active: START.toISOString(),
    });
    expect(databaseService.addBotResponse).toHaveBeenCalledWith(
      USER_ID,
      'Malenia is the Blade of Miquella.'
    );
  });

  // BUG (src/services/chat.js, handleChatMessage): the metric reads
  // processedData.messageContent, a field that does not exist (the field is
  // sanitizedContent), so messageLength is always logged as 0.
  it('logs the response time with the length of the question', async () => {
    await handleChatMessage(createMessage('Who is Malenia?'));

    expect(databaseService.logPerformanceMetric).toHaveBeenCalledWith('chat_response_time', 0, {
      userId: USER_ID,
      messageLength: 'Who is Malenia?'.length,
    });
  });

  it('answers a message that only mentions the bot itself', async () => {
    const message = createMessage('<@999999999999999999>');

    await handleChatMessage(message);

    expect(message.reply).toHaveBeenCalledWith(answerEmbed('Malenia is the Blade of Miquella.'));
  });

  it('rate limits a second message inside the window, then replays history once it has passed', async () => {
    await handleChatMessage(createMessage('Who is Malenia?'));

    jest.setSystemTime(START.getTime() + 4999);
    const tooSoon = createMessage('And Radahn?');
    await handleChatMessage(tooSoon);

    expect(tooSoon.reply).toHaveBeenCalledTimes(1);
    expect(tooSoon.reply).toHaveBeenCalledWith({
      embeds: [
        {
          color: WARNING,
          description: 'Please wait a few seconds before sending another message.',
        },
      ],
    });
    expect(perplexityService.generateChatResponse).toHaveBeenCalledTimes(1);

    jest.setSystemTime(START.getTime() + 5000);
    answerWith('Radahn held back the stars.');
    const later = createMessage('And Radahn?');
    await handleChatMessage(later);

    expect(sentHistories[1]).toEqual([
      { role: 'user', content: 'Who is Malenia?' },
      { role: 'assistant', content: 'Malenia is the Blade of Miquella.' },
      { role: 'user', content: 'And Radahn?' },
    ]);
    expect(later.reply).toHaveBeenCalledWith(answerEmbed('Radahn held back the stars.'));
  });

  it('does not rate limit a different user', async () => {
    await handleChatMessage(createMessage('Who is Malenia?'));
    const other = createMessage('Who is Malenia?', {
      author: { bot: false, id: '222222222222222222', username: 'other' },
    });

    await handleChatMessage(other);

    expect(other.reply).toHaveBeenCalledWith(answerEmbed('Malenia is the Blade of Miquella.'));
    expect(perplexityService.generateChatResponse).toHaveBeenCalledTimes(2);
  });

  it('processes the same message id only once while it is in flight', async () => {
    let finish;
    perplexityService.generateChatResponse.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const message = createMessage('Who is Malenia?');

    const firstRun = handleChatMessage(message);
    await expect(handleChatMessage(message)).resolves.toBeNull();
    finish('Malenia is the Blade of Miquella.');
    await firstRun;

    expect(perplexityService.generateChatResponse).toHaveBeenCalledTimes(1);
    expect(message.reply).toHaveBeenCalledTimes(1);
  });
});
