const { setupDatabaseService } = require('./database.test.setup');

describe('User Messages', () => {
  let context;

  beforeEach(() => {
    context = setupDatabaseService();
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
