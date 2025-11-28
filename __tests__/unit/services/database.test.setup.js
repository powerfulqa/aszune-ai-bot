const Database = require('better-sqlite3');
const DatabaseService = require('../../../src/services/database').DatabaseService;

jest.mock('better-sqlite3', () => {
  const mockDb = {
    exec: jest.fn(),
    prepare: jest.fn().mockReturnValue({
      get: jest.fn(),
      all: jest.fn(),
      run: jest.fn(),
    }),
    close: jest.fn(),
    pragma: jest.fn(),
  };

  return jest.fn().mockImplementation(() => mockDb);
});

jest.mock('../../../src/config/config', () => ({
  DB_PATH: './test-data/bot.db',
}));

function setupDatabaseService() {
  jest.clearAllMocks();

  const mockStmt = {
    get: jest.fn(),
    all: jest.fn(),
    run: jest.fn(),
  };

  const mockDb = {
    exec: jest.fn(),
    prepare: jest.fn().mockReturnValue(mockStmt),
    close: jest.fn(),
    pragma: jest.fn(),
  };

  Database.mockReturnValue(mockDb);
  const dbService = new DatabaseService();

  return {
    dbService,
    mockDb,
    mockStmt,
    Database,
  };
}

module.exports = {
  setupDatabaseService,
};

describe('Database service setup helper', () => {
  it('provides the setup helper', () => {
    expect(typeof setupDatabaseService).toBe('function');
  });
});
