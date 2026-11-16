/**
 * Bot Integration - Features
 *
 * Drives the real chat handler (src/services/chat.js) with its real
 * collaborators and covers the behaviour around a normal answer: the in-flight
 * guard, API failures, the simple-reminder path, emoji reactions and chunking.
 * Only the edges are doubled: the Discord message, the Perplexity service, the
 * database, the reminder service, file storage, the logger and the session
 * validator.
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
const CHANNEL_ID = '987654321098765432';
const GUILD_ID = '555555555555555555';
const PRIMARY = 0x0099ff;
const SUCCESS = 0x57f287;
const WARNING = 0xfee75c;
const START = new Date('2026-11-16T12:00:00.000Z');
const FOOTER = { text: 'Aszai Bot' };

let nextMessageId = 0;
function createMessage(content, overrides = {}) {
  nextMessageId += 1;
  return {
    id: `msg-${nextMessageId}`,
    content,
    author: { bot: false, id: USER_ID, username: 'tester' },
    client: { user: { id: '999999999999999999' } },
    channel: { id: CHANNEL_ID, sendTyping: jest.fn() },
    guild: { id: GUILD_ID },
    reply: jest.fn().mockResolvedValue({}),
    react: jest.fn().mockResolvedValue({}),
    ...overrides,
  };
}

// Let the handler run up to its next real wait (the pending API call).
const flush = () => new Promise((resolve) => setImmediate(resolve));

function embedReply(color, description) {
  return { embeds: [{ color, description, footer: FOOTER }] };
}

let handleChatMessage;
let perplexityService;
let reminderService;
let databaseService;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: START, doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
  handleChatMessage = require('../../src/services/chat');
  perplexityService = require('../../src/services/perplexity-secure');
  reminderService = require('../../src/services/reminder-service');
  databaseService = require('../../src/services/database');
  perplexityService.generateChatResponse.mockResolvedValue('Malenia is the Blade of Miquella.');
  reminderService.isInitialized = true;
  reminderService.setReminder.mockResolvedValue({ id: 42 });
});

describe('Bot Integration - one run per user', () => {
  it('tells the user it is still working when a second message arrives mid-run', async () => {
    let finishFirst;
    perplexityService.generateChatResponse.mockReturnValueOnce(
      new Promise((resolve) => {
        finishFirst = resolve;
      })
    );
    const first = createMessage('Who is Malenia?');
    const firstRun = handleChatMessage(first);
    await flush();

    // Past the 5s rate-limit window, so only the in-flight guard can stop it.
    jest.setSystemTime(START.getTime() + 6000);
    const second = createMessage('And Radahn?');
    await handleChatMessage(second);

    expect(second.reply).toHaveBeenCalledTimes(1);
    expect(second.reply).toHaveBeenCalledWith({
      embeds: [
        {
          color: WARNING,
          description: "I'm still working on your previous message. Ask again once I've replied.",
        },
      ],
    });
    expect(perplexityService.generateChatResponse).toHaveBeenCalledTimes(1);
    expect(databaseService.addUserMessage).toHaveBeenCalledTimes(1);

    finishFirst('Malenia is the Blade of Miquella.');
    await firstRun;
    expect(first.reply).toHaveBeenCalledWith(
      embedReply(PRIMARY, 'Malenia is the Blade of Miquella.')
    );

    // The guard is released once the first run ends.
    jest.setSystemTime(START.getTime() + 12000);
    const third = createMessage('And Radahn?');
    await handleChatMessage(third);
    expect(perplexityService.generateChatResponse).toHaveBeenCalledTimes(2);
  });

  it('refreshes the typing indicator every 8 seconds until the answer arrives', async () => {
    let finish;
    perplexityService.generateChatResponse.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const message = createMessage('Who is Malenia?');
    const run = handleChatMessage(message);
    await flush();
    expect(message.channel.sendTyping).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(16000);
    expect(message.channel.sendTyping).toHaveBeenCalledTimes(3);

    finish('Malenia is the Blade of Miquella.');
    await run;
    jest.advanceTimersByTime(16000);
    expect(message.channel.sendTyping).toHaveBeenCalledTimes(3);
  });
});

describe('Bot Integration - API failures', () => {
  it.each([
    [
      'a 429',
      { statusCode: 429 },
      'The service is currently busy. Please wait a moment and try again.',
    ],
    [
      'a 500',
      { statusCode: 500 },
      'Network connection issue. Please check your connection and try again.',
    ],
    ['an unclassified error', {}, 'An unexpected error occurred. Please try again later.'],
  ])('replies with an error embed for %s', async (_label, props, description) => {
    perplexityService.generateChatResponse.mockRejectedValue(
      Object.assign(new Error('Perplexity failed'), props)
    );
    const message = createMessage('Who is Malenia?');

    await expect(handleChatMessage(message)).resolves.toBeUndefined();

    expect(message.reply).toHaveBeenCalledTimes(1);
    expect(message.reply).toHaveBeenCalledWith(embedReply(PRIMARY, description));
    expect(databaseService.addBotResponse).not.toHaveBeenCalled();
    expect(message.react).not.toHaveBeenCalled();
  });

  it('releases the in-flight guard after a failure', async () => {
    perplexityService.generateChatResponse.mockRejectedValueOnce(new Error('Perplexity failed'));
    await handleChatMessage(createMessage('Who is Malenia?'));

    jest.setSystemTime(START.getTime() + 6000);
    const retry = createMessage('Who is Malenia?');
    await handleChatMessage(retry);

    expect(retry.reply).toHaveBeenCalledWith(
      embedReply(PRIMARY, 'Malenia is the Blade of Miquella.')
    );
  });

  it('carries on when the database is down', async () => {
    const dbDown = () => {
      throw new Error('SQLITE_BUSY');
    };
    databaseService.addUserMessage.mockImplementation(dbDown);
    databaseService.addBotResponse.mockImplementation(dbDown);
    databaseService.logPerformanceMetric.mockImplementation(dbDown);
    const message = createMessage('Who is Malenia?');

    await handleChatMessage(message);

    expect(message.reply).toHaveBeenCalledWith(
      embedReply(PRIMARY, 'Malenia is the Blade of Miquella.')
    );
  });
});

describe('Bot Integration - simple reminders', () => {
  it('sets a guild reminder and confirms it without calling the AI', async () => {
    const message = createMessage('remind me in 5 minutes to check the oven');

    await handleChatMessage(message);

    expect(reminderService.setReminder).toHaveBeenCalledTimes(1);
    expect(reminderService.setReminder).toHaveBeenCalledWith(
      USER_ID,
      'in 5 minutes',
      'check the oven',
      CHANNEL_ID,
      GUILD_ID
    );
    expect(reminderService.initialize).not.toHaveBeenCalled();
    expect(message.reply).toHaveBeenCalledTimes(1);
    expect(message.reply).toHaveBeenCalledWith(
      embedReply(
        SUCCESS,
        '✅ **Reminder Set!**\n\nI\'ll remind you about "check the oven" in 5 minutes.\n\n*Reminder ID: 42*'
      )
    );
    expect(perplexityService.generateChatResponse).not.toHaveBeenCalled();
  });

  it('passes a null server for a DM and handles the message-first phrasing', async () => {
    const message = createMessage('please remind me to call mum in 2 hours', {
      guild: null,
    });

    await handleChatMessage(message);

    expect(reminderService.setReminder).toHaveBeenCalledWith(
      USER_ID,
      'in 2 hours',
      'call mum',
      CHANNEL_ID,
      null
    );
    expect(message.reply).toHaveBeenCalledWith(
      embedReply(
        SUCCESS,
        '✅ **Reminder Set!**\n\nI\'ll remind you about "call mum" in 2 hours.\n\n*Reminder ID: 42*'
      )
    );
  });

  it('initialises the reminder service first when it is not ready', async () => {
    reminderService.isInitialized = false;

    await handleChatMessage(createMessage('remind me in 1 day'));

    expect(reminderService.initialize).toHaveBeenCalledTimes(1);
    expect(reminderService.setReminder).toHaveBeenCalledWith(
      USER_ID,
      'in 1 day',
      'Reminder',
      CHANNEL_ID,
      GUILD_ID
    );
  });

  it('replies with a warning embed when the reminder cannot be set', async () => {
    reminderService.setReminder.mockRejectedValue(new Error('disk full'));
    const message = createMessage('remind me in 5 minutes to check the oven');

    await handleChatMessage(message);

    expect(message.reply).toHaveBeenCalledWith(
      embedReply(
        WARNING,
        'Sorry, I couldn\'t set that reminder. Please try using the /remind command or say "remind me in 5 minutes to check the oven".'
      )
    );
    expect(perplexityService.generateChatResponse).not.toHaveBeenCalled();
  });
});

describe('Bot Integration - emoji and chunking', () => {
  it('reacts to keywords in the question and appends emoji for keywords in the answer', async () => {
    perplexityService.generateChatResponse.mockResolvedValue('That boss is awesome.');
    const message = createMessage('hello, thanks for the tip');

    await handleChatMessage(message);

    expect(message.reply).toHaveBeenCalledWith(embedReply(PRIMARY, 'That boss is awesome. 😎'));
    expect(message.react.mock.calls).toEqual([['👋'], ['🙏']]);
    // History keeps the answer without the display emoji.
    expect(databaseService.addBotResponse).toHaveBeenCalledWith(USER_ID, 'That boss is awesome.');
  });

  it('still answers when a reaction is rejected by Discord', async () => {
    const message = createMessage('hello there');
    message.react.mockRejectedValue(new Error('Missing Permissions'));

    await expect(handleChatMessage(message)).resolves.toBeUndefined();

    expect(message.reply).toHaveBeenCalledWith(
      embedReply(PRIMARY, 'Malenia is the Blade of Miquella.')
    );
  });

  it('splits a long answer into numbered embeds that together carry the whole answer', async () => {
    const paragraphs = Array.from(
      { length: 6 },
      (_, i) => `Part ${i + 1}. ${'lore '.repeat(120).trim()}.`
    );
    perplexityService.generateChatResponse.mockResolvedValue(paragraphs.join('\n\n'));
    const message = createMessage('Tell me everything');

    await handleChatMessage(message);

    const descriptions = message.reply.mock.calls.map(([payload]) => payload.embeds[0].description);
    expect(descriptions).toHaveLength(2);
    descriptions.forEach((description, index) => {
      expect(description.startsWith(`[${index + 1}/2] `)).toBe(true);
      expect(description.length).toBeLessThanOrEqual(2000);
    });
    expect(descriptions.map((d) => d.replace(/^\[\d\/2\] /, '')).join('\n\n')).toBe(
      paragraphs.join('\n\n')
    );
  });
});
