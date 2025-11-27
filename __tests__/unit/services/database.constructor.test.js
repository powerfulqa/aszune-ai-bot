const path = require('path');
const { setupDatabaseService } = require('./database.test.setup');

describe('DatabaseService Initialization', () => {
  let context;

  beforeEach(() => {
    context = setupDatabaseService();
  });

  it('should initialize without accessing config', () => {
    expect(context.dbService.dbPath).toBeNull();
    expect(context.dbService.db).toBeNull();
  });

  it('should initialize database and create tables on first getDb', () => {
    const db = context.dbService.getDb();

    expect(context.Database).toHaveBeenCalledWith(path.resolve('./test-data/bot.db'));
    expect(db).toBe(context.mockDb);
    expect(context.dbService.db).toBe(context.mockDb);
    expect(context.mockDb.exec).toHaveBeenCalled();
  });

  it('should return existing connection on subsequent getDb calls', () => {
    context.dbService.getDb();
    const db2 = context.dbService.getDb();

    expect(context.Database).toHaveBeenCalledTimes(1);
    expect(db2).toBe(context.mockDb);
  });

  it('should throw if database initialization fails', () => {
    context.Database.mockImplementation(() => {
      throw new Error('Database connection failed');
    });

    expect(() => context.dbService.getDb()).toThrow(
      'Failed to initialize database: Database connection failed'
    );
  });
});
