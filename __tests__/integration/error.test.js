/**
 * Error handling - slash commands
 *
 * Drives the real command router (src/commands/index.js) with the real
 * conversation manager and error handler. Only the edges are doubled: the
 * Discord interaction, the Perplexity service, the database, the reminder
 * service, file storage and the logger. The chat-message error path is covered
 * the same way in bot-features.test.js.
 */

jest.mock('../../src/services/perplexity-secure', () => ({
  generateChatResponse: jest.fn(),
  generateSummary: jest.fn(),
}));
jest.mock('../../src/services/database', () => ({
  ensureUserExists: jest.fn(),
  updateUsername: jest.fn(),
  updateUserStats: jest.fn(),
  addUserMessage: jest.fn(),
  addBotResponse: jest.fn(),
  getConversationHistory: jest.fn().mockReturnValue([]),
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

const USER_ID = '123456789012345678';
const PRIMARY = 0x0099ff;
const ERROR = 0xed4245;

function createInteraction(commandName) {
  return {
    commandName,
    user: { id: USER_ID, username: 'tester' },
    guild: { id: '555555555555555555' },
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(),
    deferReply: jest.fn().mockResolvedValue(),
    editReply: jest.fn().mockResolvedValue(),
  };
}

describe('Error handling - /summary', () => {
  let handleSlashCommand;
  let perplexityService;
  let databaseService;

  beforeEach(() => {
    jest.clearAllMocks();
    ({ handleSlashCommand } = require('../../src/commands'));
    perplexityService = require('../../src/services/perplexity-secure');
    databaseService = require('../../src/services/database');

    const conversationManager = require('../../src/state/conversationManager');
    conversationManager.addMessage(USER_ID, 'user', 'Who is Malenia?');
    conversationManager.addMessage(USER_ID, 'assistant', 'The Blade of Miquella.');
  });

  it.each([
    [
      'a 429',
      Object.assign(new Error('Too many'), { statusCode: 429 }),
      'The service is currently busy. Please wait a moment and try again.',
    ],
    [
      'a 503',
      Object.assign(new Error('Unavailable'), { statusCode: 503 }),
      'Network connection issue. Please check your connection and try again.',
    ],
    [
      'an error that names the API',
      new Error('Summary API Error'),
      'The service is temporarily unavailable. Please try again later.',
    ],
    [
      'an unclassified error',
      new Error('socket hang up'),
      'An unexpected error occurred. Please try again later.',
    ],
  ])('replies with an error embed when the API fails with %s', async (_label, error, text) => {
    perplexityService.generateSummary.mockRejectedValue(error);
    const interaction = createInteraction('summary');

    await handleSlashCommand(interaction);

    // The trailing assistant turn is dropped before summarising.
    expect(perplexityService.generateSummary).toHaveBeenCalledWith([
      { role: 'user', content: 'Who is Malenia?' },
    ]);
    expect(interaction.deferReply).toHaveBeenCalledTimes(1);
    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledTimes(1);
    expect(interaction.editReply).toHaveBeenCalledWith({
      embeds: [{ color: ERROR, description: text }],
    });
    // A failed summary is not counted in the user's stats.
    expect(databaseService.updateUserStats).not.toHaveBeenCalled();
  });

  it('replies with the summary embed and counts it when the API succeeds', async () => {
    perplexityService.generateSummary.mockResolvedValue('You asked about Malenia.');
    const interaction = createInteraction('summary');

    await handleSlashCommand(interaction);

    expect(interaction.editReply).toHaveBeenCalledTimes(1);
    expect(interaction.editReply).toHaveBeenCalledWith({
      embeds: [
        {
          color: PRIMARY,
          title: 'Conversation Summary',
          description: 'You asked about Malenia.',
          footer: { text: 'Aszai Bot' },
        },
      ],
    });
    expect(databaseService.updateUserStats).toHaveBeenCalledWith(USER_ID, { total_summaries: 1 });
  });
});
