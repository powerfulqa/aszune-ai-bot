const { setupDatabaseService } = require('./database.test.setup');

describe('User Messages', () => {
  let context;

  beforeEach(() => {
    context = setupDatabaseService();
  });

  describe('getUserMessages', () => {
    it('returns the latest messages for a user', () => {
      const mockMessages = ['msg1', 'msg2', 'msg3'];
      context.mockStmt.all.mockReturnValue([
        { message: 'msg1' },
        { message: 'msg2' },
        { message: 'msg3' },
      ]);

      const result = context.dbService.getUserMessages('123');

      expect(context.mockStmt.all).toHaveBeenCalledWith('123', 10);
      expect(result).toEqual(mockMessages);
    });

    it('returns an empty array when no messages exist', () => {
      context.mockStmt.all.mockReturnValue([]);

      const result = context.dbService.getUserMessages('456');

      expect(result).toEqual([]);
    });

    it('does not throw when the query fails', () => {
      context.mockStmt.all.mockImplementation(() => {
        throw new Error('Query failed');
      });

      expect(() => context.dbService.getUserMessages('123')).not.toThrow();
    });
  });

  describe('addUserMessage', () => {
    it('inserts a new message', () => {
      context.mockStmt.run.mockReturnValue({ lastInsertRowid: 1 });

      context.dbService.addUserMessage('123', 'Hello world');

      expect(context.mockStmt.run).toHaveBeenCalledWith('123', 'Hello world');
    });

    it('throws when insertion fails', () => {
      context.mockStmt.run.mockImplementation(() => {
        throw new Error('Insert failed');
      });

      expect(() => context.dbService.addUserMessage('123', 'Hello world')).toThrow(
        'Failed to add user message for 123: Insert failed'
      );
    });
  });
});
