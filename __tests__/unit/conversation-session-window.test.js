jest.mock('../../src/utils/logger');
jest.mock('../../src/services/storage', () => ({
  loadUserStats: jest.fn().mockResolvedValue({}),
  saveUserStats: jest.fn().mockResolvedValue(),
}));

const mockDatabaseService = { updateUserStats: jest.fn() };
jest.mock('../../src/services/database', () => mockDatabaseService);

const ConversationManager = require('../../src/utils/conversation');
const config = require('../../src/config/config');

const USER = '123456789012345678';

describe('conversation session window', () => {
  let manager;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date('2026-11-16T09:00:00Z') });
    manager = new ConversationManager();
  });

  afterEach(() => {
    manager.destroy?.();
    jest.useRealTimers();
  });

  // The chat path calls updateTimestamp() before it reads the history, so the
  // inactivity check has to run against the previous timestamp.
  it('drops the old context when the user returns after the inactivity timeout', () => {
    manager.updateTimestamp(USER);
    manager.addMessage(USER, 'user', 'morning question');

    jest.advanceTimersByTime(config.CONVERSATION_INACTIVITY_TIMEOUT_MS + 60000);
    manager.updateTimestamp(USER);

    expect(manager.getHistory(USER)).toEqual([]);
  });

  it('keeps the context while the user is still inside the window', () => {
    manager.updateTimestamp(USER);
    manager.addMessage(USER, 'user', 'first question');

    jest.advanceTimersByTime(60000);
    manager.updateTimestamp(USER);

    expect(manager.getHistory(USER)).toEqual([{ role: 'user', content: 'first question' }]);
  });

  // The database counts a message once, in addUserMessage(); the in-memory
  // history must not count it again (it also re-ran for every restored message).
  it('does not touch message stats when a message is added to the history', () => {
    manager.addMessage(USER, 'user', 'hello');
    expect(mockDatabaseService.updateUserStats).not.toHaveBeenCalled();
  });
});
