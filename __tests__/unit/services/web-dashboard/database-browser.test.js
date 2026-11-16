/**
 * Database browser: schema listing, table allowlist, paging and Discord
 * username enrichment. The database service is mocked.
 */

jest.mock('../../../../src/services/database', () => ({
  getDb: jest.fn(),
}));
jest.mock('../../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const NOW = '2026-11-16T12:00:00.000Z';
const USER_STATS_COLUMNS = [
  'user_id',
  'username',
  'message_count',
  'total_summaries',
  'total_commands',
  'last_active',
  'first_seen',
];

describe('dashboard database browser', () => {
  let service;
  let databaseService;
  let db;
  let counts;
  let rows;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date(NOW) });
    service = require('../../../../src/services/web-dashboard');
    databaseService = require('../../../../src/services/database');
    counts = { user_stats: 3, user_messages: 0, conversation_history: 42, reminders: 5 };
    rows = [];
    db = {
      prepare: jest.fn((sql) => {
        const table = sql.split(' FROM ')[1].split(' ')[0];
        if (!(table in counts)) throw new Error(`no such table: ${table}`);
        return {
          get: jest.fn(() => counts[table]),
          all: jest.fn(() => rows),
        };
      }),
    };
    databaseService.getDb.mockReturnValue(db);
    Object.keys(counts).forEach((table) => {
      counts[table] = { count: counts[table] };
    });
  });

  describe('getDatabaseSchema', () => {
    it('lists the four dashboard tables with row counts and descriptions', async () => {
      expect(await service.getDatabaseSchema()).toEqual({
        tables: [
          { name: 'user_stats', rowCount: 3, description: 'User profiles and stats' },
          {
            name: 'user_messages',
            rowCount: 0,
            description: 'Legacy user messages (deprecated)',
          },
          {
            name: 'conversation_history',
            rowCount: 42,
            description: 'AI conversation history with roles',
          },
          { name: 'reminders', rowCount: 5, description: 'User reminders with scheduling info' },
        ],
        timestamp: NOW,
      });
      expect(db.prepare.mock.calls).toEqual([
        ['SELECT COUNT(*) as count FROM user_stats'],
        ['SELECT COUNT(*) as count FROM user_messages'],
        ['SELECT COUNT(*) as count FROM conversation_history'],
        ['SELECT COUNT(*) as count FROM reminders'],
      ]);
    });

    it('leaves out a table that cannot be read', async () => {
      delete counts.user_messages;
      counts.reminders = undefined;

      const schema = await service.getDatabaseSchema();

      expect(schema.tables.map((table) => [table.name, table.rowCount])).toEqual([
        ['user_stats', 3],
        ['conversation_history', 42],
        ['reminders', 0],
      ]);
      expect(service.allLogs.map((entry) => entry.message)).toEqual([
        'Table user_messages not found or error reading: no such table: user_messages',
      ]);
    });

    it.each([
      ['has no getDb', () => delete databaseService.getDb, 'Database not available'],
      [
        'has no open connection',
        () => databaseService.getDb.mockReturnValue(null),
        'Database connection unavailable',
      ],
    ])('lists no tables when the database service %s', async (_name, arrange, reason) => {
      arrange();

      expect(await service.getDatabaseSchema()).toEqual({ tables: [], timestamp: NOW });
      expect(service.allLogs[0].message).toBe(
        `Table user_stats not found or error reading: ${reason}`
      );
    });
  });

  describe('getDatabaseTableContents', () => {
    it.each(['users', 'sqlite_master', 'reminders; DROP TABLE reminders', undefined])(
      'refuses the table name %p before touching the database',
      async (table) => {
        await expect(service.getDatabaseTableContents(table)).rejects.toThrow(
          `Invalid table: ${table}`
        );
        expect(databaseService.getDb).not.toHaveBeenCalled();
      }
    );

    it.each([
      ['has no getDb', () => delete databaseService.getDb, 'Database not available'],
      [
        'has no open connection',
        () => databaseService.getDb.mockReturnValue(null),
        'Database connection unavailable',
      ],
    ])('throws when the database service %s', async (_name, arrange, reason) => {
      arrange();

      await expect(service.getDatabaseTableContents('reminders')).rejects.toThrow(reason);
    });

    it('returns one page of a table with its columns', async () => {
      rows = [{ id: 5, user_id: '123', role: 'user', message: 'hi', timestamp: 't' }];

      expect(await service.getDatabaseTableContents('conversation_history', 1, 4)).toEqual({
        table: 'conversation_history',
        totalRows: 42,
        limit: 1,
        offset: 4,
        returnedRows: 1,
        columns: ['id', 'user_id', 'role', 'message', 'timestamp'],
        data: rows,
        timestamp: NOW,
      });
      expect(db.prepare.mock.calls).toEqual([
        ['SELECT COUNT(*) as count FROM conversation_history'],
        ['SELECT * FROM conversation_history LIMIT ? OFFSET ?'],
      ]);
      expect(db.prepare.mock.results[1].value.all).toHaveBeenCalledWith(1, 4);
    });

    it('defaults to the first 100 rows and copes with an empty table', async () => {
      counts.user_messages = undefined;
      rows = undefined;

      expect(await service.getDatabaseTableContents('user_messages')).toEqual({
        table: 'user_messages',
        totalRows: 0,
        limit: 100,
        offset: 0,
        returnedRows: 0,
        columns: ['id', 'user_id', 'message', 'timestamp'],
        data: [],
        timestamp: NOW,
      });
      expect(db.prepare.mock.results[1].value.all).toHaveBeenCalledWith(100, 0);
    });

    it('fills in missing usernames in user_stats from Discord', async () => {
      rows = [
        { user_id: '111', username: 'stored-name', message_count: 4 },
        { user_id: '222', username: null, message_count: 9 },
        { user_id: '333', username: null, message_count: 1 },
      ];
      const fetchUser = jest.fn(async (id) => (id === '222' ? { username: 'resolved' } : null));
      service.discordClient = { users: { fetch: fetchUser } };

      const result = await service.getDatabaseTableContents('user_stats', 10, 0);

      expect(result.columns).toEqual(USER_STATS_COLUMNS);
      expect(result.data).toEqual([
        { user_id: '111', username: 'stored-name', message_count: 4 },
        { user_id: '222', username: 'resolved', message_count: 9 },
        { user_id: '333', username: null, message_count: 1 },
      ]);
      expect(fetchUser.mock.calls).toEqual([
        ['222', { cache: false }],
        ['333', { cache: false }],
      ]);
    });

    it('returns user_stats rows as stored when there is no Discord client', async () => {
      rows = [{ user_id: '222', username: null, message_count: 9 }];
      service.discordClient = null;

      const result = await service.getDatabaseTableContents('user_stats');

      expect(result.data).toEqual([{ user_id: '222', username: null, message_count: 9 }]);
    });
  });

  describe('table metadata', () => {
    it('has no columns or description for a table outside the list', () => {
      expect(service.getTableColumns('users')).toEqual([]);
      expect(service.getTableDescription('users')).toBe('Unknown table');
    });

    it('describes the reminders table', () => {
      expect(service.getTableColumns('reminders')).toEqual([
        'id',
        'user_id',
        'message',
        'scheduled_time',
        'status',
        'created_at',
      ]);
    });
  });
});
