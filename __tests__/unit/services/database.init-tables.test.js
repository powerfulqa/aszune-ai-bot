const { setupDatabaseService } = require('./database.test.setup');

describe('initTables', () => {
  let context;

  beforeEach(() => {
    context = setupDatabaseService();
  });

  it('should create user_stats and user_messages tables', () => {
    context.dbService.getDb();

    expect(context.mockDb.exec).toHaveBeenCalled();
    const statements = context.mockDb.exec.mock.calls.map(([sql]) => sql);
    expect(
      statements.filter((sql) => /CREATE TABLE IF NOT EXISTS user_stats \(/.test(sql))
    ).toHaveLength(1);
    expect(
      statements.filter((sql) => /CREATE TABLE IF NOT EXISTS user_messages \(/.test(sql))
    ).toHaveLength(1);
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
