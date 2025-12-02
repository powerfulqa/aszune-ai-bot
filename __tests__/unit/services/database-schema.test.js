const schema = require('../../../src/services/database/schema');

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
}));

const createMockDb = ({ columns = [] } = {}) => ({
  exec: jest.fn(),
  prepare: jest.fn((sql) => {
    if (sql.includes('PRAGMA table_info(user_stats)')) {
      return { all: () => columns };
    }

    return { all: () => [] };
  }),
});

describe('database schema helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes every configured table writer', () => {
    const db = createMockDb();

    schema.initializeTables(db);

    expect(db.exec).toHaveBeenCalledTimes(schema._test.tableCreators.length);
    expect(
      db.exec.mock.calls.some((call) => call[0].includes('CREATE TABLE IF NOT EXISTS user_stats'))
    ).toBe(true);
  });

  it('builds indexes in a single execution context', () => {
    const db = createMockDb();

    schema.createIndexes(db);

    expect(db.exec).toHaveBeenCalledTimes(1);
    expect(db.exec).toHaveBeenCalledWith(
      expect.stringContaining('CREATE INDEX IF NOT EXISTS idx_user_messages_user_id_timestamp')
    );
  });

  it('deploys triggers for history and messages', () => {
    const db = createMockDb();

    schema.ensureTriggers(db);

    expect(db.exec).toHaveBeenCalledTimes(2);
    expect(db.exec.mock.calls[0][0]).toContain('limit_conversation_history');
    expect(db.exec.mock.calls[1][0]).toContain('limit_user_messages');
  });

  describe('runMigrations', () => {
    it('adds the username column when it is missing', () => {
      const db = createMockDb({ columns: [{ name: 'user_id' }] });

      schema.runMigrations(db);

      expect(db.exec).toHaveBeenCalledTimes(1);
      expect(db.exec).toHaveBeenCalledWith(
        expect.stringContaining('ALTER TABLE user_stats ADD COLUMN username TEXT')
      );
    });

    it('is no-op when username already exists', () => {
      const db = createMockDb({ columns: [{ name: 'username' }] });

      schema.runMigrations(db);

      expect(db.exec).not.toHaveBeenCalled();
    });
  });
});
