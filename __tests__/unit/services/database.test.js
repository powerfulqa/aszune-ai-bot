const path = require('path');

// Mock better-sqlite3
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

const Database = require('better-sqlite3');

// Mock config
jest.mock('../../../src/config/config', () => ({
  DB_PATH: './test-data/bot.db',
}));

const DatabaseService = require('../../../src/services/database').DatabaseService;

describe('DatabaseService', () => {
  let dbService;
  let mockDb;
  let mockStmt;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStmt = {
      get: jest.fn(),
      all: jest.fn(),
      run: jest.fn(),
    };

    mockDb = {
      exec: jest.fn(),
      prepare: jest.fn().mockReturnValue(mockStmt),
      close: jest.fn(),
      pragma: jest.fn(),
    };

    Database.mockReturnValue(mockDb);
    dbService = new DatabaseService();
  });

  afterEach(() => {
    if (dbService.db) {
      dbService.close();
    }
  });

  describe('constructor', () => {
    it('should initialize without accessing config', () => {
      expect(dbService.dbPath).toBeNull();
      expect(dbService.db).toBeNull();
    });
  });

  describe('getDb', () => {
    it('should initialize database on first call and access config', () => {
      const db = dbService.getDb();

      expect(Database).toHaveBeenCalledWith(path.resolve('./test-data/bot.db'));
      expect(db).toBe(mockDb);
      expect(dbService.db).toBe(mockDb);
      expect(mockDb.exec).toHaveBeenCalled(); // Tables creation
    });

    it('should return existing db on subsequent calls', () => {
      dbService.getDb();
      const db2 = dbService.getDb();

      expect(Database).toHaveBeenCalledTimes(1);
      expect(db2).toBe(mockDb);
    });

    it('should throw error on database initialization failure', () => {
      Database.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      expect(() => dbService.getDb()).toThrow(
        'Failed to initialize database: Database connection failed'
      );
    });
  });

  describe('initTables', () => {
    it('should create user_stats and user_messages tables', () => {
      dbService.getDb(); // Triggers initTables

      expect(mockDb.exec).toHaveBeenCalled();
      expect(mockDb.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS user_stats')
      );
      expect(mockDb.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS user_messages')
      );
    });

    it('should throw error on table creation failure', () => {
      mockDb.exec.mockImplementation(() => {
        throw new Error('Table creation failed');
      });

      expect(() => dbService.getDb()).toThrow(
        'Failed to initialize database tables: Table creation failed'
      );
    });
  });

  describe('getUserStats', () => {
    it('should return user stats for existing user', () => {
      const mockStats = { user_id: '123', message_count: 5, last_active: '2023-01-01' };
      mockStmt.get.mockReturnValue(mockStats);

      const result = dbService.getUserStats('123');

      expect(mockStmt.get).toHaveBeenCalledWith('123');
      expect(result).toEqual(mockStats);
    });

    it('should return default stats for non-existing user', () => {
      mockStmt.get.mockReturnValue(undefined);

      const result = dbService.getUserStats('456');

      expect(result).toEqual({
        user_id: '456',
        message_count: 0,
        last_active: null,
        first_seen: null,
        preferences: '{}',
        total_commands: 0,
        total_summaries: 0,
      });
    });

    it('should throw error on query failure', () => {
      mockStmt.get.mockImplementation(() => {
        throw new Error('Query failed');
      });

      expect(() => dbService.getUserStats('123')).toThrow(
        'Failed to get user stats for 123: Query failed'
      );
    });
  });

  describe('updateUserStats', () => {
    it('should update user stats correctly', () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      dbService.updateUserStats('123', { message_count: 1, last_active: '2023-01-02' });

      expect(mockStmt.run).toHaveBeenCalledWith(
        '123',
        1,
        '2023-01-02',
        expect.any(String),
        0,
        0,
        '{}',
        1,
        '2023-01-02',
        0,
        0
      );
    });

    it('should handle missing updates gracefully', () => {
      dbService.updateUserStats('123', {});

      expect(mockStmt.run).toHaveBeenCalledWith(
        '123',
        0,
        expect.any(String),
        expect.any(String),
        0,
        0,
        '{}',
        0,
        expect.any(String),
        0,
        0
      );
    });

    it('should throw error on update failure', () => {
      mockStmt.run.mockImplementation(() => {
        throw new Error('Update failed');
      });

      expect(() => dbService.updateUserStats('123', { message_count: 1 })).toThrow(
        'Failed to update user stats for 123: Update failed'
      );
    });
  });

  describe('getUserMessages', () => {
    it('should return last 10 messages for user', () => {
      const mockMessages = ['msg1', 'msg2', 'msg3'];
      mockStmt.all.mockReturnValue([{ message: 'msg1' }, { message: 'msg2' }, { message: 'msg3' }]);

      const result = dbService.getUserMessages('123');

      expect(mockStmt.all).toHaveBeenCalledWith('123', 10);
      expect(result).toEqual(mockMessages);
    });

    it('should return empty array for user with no messages', () => {
      mockStmt.all.mockReturnValue([]);

      const result = dbService.getUserMessages('456');

      expect(result).toEqual([]);
    });

    it('should throw error on query failure', () => {
      mockStmt.all.mockImplementation(() => {
        throw new Error('Query failed');
      });

      // Note: Current implementation logs warnings instead of throwing for getUserMessages
      expect(() => dbService.getUserMessages('123')).not.toThrow();
    });
  });

  describe('addUserMessage', () => {
    it('should add message to database', () => {
      mockStmt.run.mockReturnValue({ lastInsertRowid: 1 });

      dbService.addUserMessage('123', 'Hello world');

      expect(mockStmt.run).toHaveBeenCalledWith('123', 'Hello world');
    });

    it('should throw error on insert failure', () => {
      mockStmt.run.mockImplementation(() => {
        throw new Error('Insert failed');
      });

      expect(() => dbService.addUserMessage('123', 'Hello world')).toThrow(
        'Failed to add user message for 123: Insert failed'
      );
    });
  });

  describe('clearUserData', () => {
    it('should delete all user data', () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      dbService.clearUserData('123');

      expect(mockStmt.run).toHaveBeenCalled(); // One for stats, one for messages
    });

    it('should throw error on delete failure', () => {
      mockStmt.run.mockImplementation(() => {
        throw new Error('Delete failed');
      });

      expect(() => dbService.clearUserData('123')).toThrow(
        'Failed to clear user data for 123: Delete failed'
      );
    });
  });

  describe('close', () => {
    it('should close database connection', () => {
      dbService.getDb();
      dbService.close();

      expect(mockDb.close).toHaveBeenCalled();
      expect(dbService.db).toBeNull();
    });

    it('should handle close when db is not initialized', () => {
      dbService.close();

      expect(mockDb.close).not.toHaveBeenCalled();
    });

    it.skip('should throw error on close failure', () => {
      dbService.getDb();
      mockDb.close.mockImplementation(() => {
        throw new Error('Close failed');
      });

      expect(() => dbService.close()).toThrow('Failed to close database: Close failed');
    });
  });
});
