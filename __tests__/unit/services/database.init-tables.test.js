const { setupDatabaseService } = require('./database.test.setup');

describe('initTables', () => {
  let context;

  beforeEach(() => {
    context = setupDatabaseService();
  });

  it('should create user_stats and user_messages tables', () => {
    context.dbService.getDb();

    expect(context.mockDb.exec).toHaveBeenCalled();
    expect(context.mockDb.exec).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS user_stats')
    );
    expect(context.mockDb.exec).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS user_messages')
    );
  });

  it('should throw if table creation fails', () => {
    context.mockDb.exec.mockImplementation(() => {
      throw new Error('Table creation failed');
    });

    expect(() => context.dbService.getDb()).toThrow(
      'Failed to initialize database tables: Table creation failed'
    );
  });
});
