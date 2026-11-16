// Mock config to use in-memory database
jest.mock('../../../src/config/config', () => ({
  DB_PATH: ':memory:',
}));

const { DatabaseService } = require('../../../src/services/database');

describe('DatabaseService - reminder updates and history clearing', () => {
  let dbService;

  beforeEach(() => {
    jest.clearAllMocks();
    dbService = new DatabaseService();
    // Force re-initialization for each test
    dbService.db = null;
    dbService.dbPath = ':memory:';
  });

  afterEach(() => {
    if (dbService.db && !dbService.isDisabled) {
      try {
        dbService.close();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  });

  describe('updateReminder', () => {
    it('changes the message and time of an active reminder and keeps the rest', () => {
      const created = dbService.createReminder('u1', 'old', new Date(Date.now() + 3600000));
      const newTime = new Date(Date.now() + 7200000).toISOString();

      const updated = dbService.updateReminder(created.id, 'u1', {
        message: 'new',
        scheduledTime: newTime,
      });

      expect(updated).toEqual({ ...created, message: 'new', scheduled_time: newTime });
      expect(dbService.getReminder(created.id)).toEqual(updated);
    });

    it('leaves a field alone when it is not given', () => {
      const created = dbService.createReminder('u1', 'old', new Date(Date.now() + 3600000));
      const updated = dbService.updateReminder(created.id, 'u1', { message: 'new' });
      expect(updated.scheduled_time).toBe(created.scheduled_time);
    });

    it('returns null for another user or a completed reminder', () => {
      const created = dbService.createReminder('u1', 'old', new Date(Date.now() + 3600000));
      expect(dbService.updateReminder(created.id, 'u2', { message: 'x' })).toBeNull();
      dbService.completeReminder(created.id);
      expect(dbService.updateReminder(created.id, 'u1', { message: 'x' })).toBeNull();
    });
  });

  describe('clearUserConversationData', () => {
    it('removes conversation rows but keeps stats and reminders', () => {
      dbService.addUserMessage('u1', 'hello');
      const reminder = dbService.createReminder('u1', 'keep me', new Date(Date.now() + 3600000));

      dbService.clearUserConversationData('u1');

      expect(dbService.getConversationHistory('u1')).toEqual([]);
      expect(dbService.getReminder(reminder.id)).toEqual(reminder);
      expect(dbService.getUserStats('u1').message_count).toBe(1);
    });
  });
});
