/**
 * Conversation history persistence against a real in-memory SQLite database:
 * reload returns the NEWEST messages in chronological order, and the trigger
 * caps stored history per user.
 */
const Database = require('better-sqlite3');
const schema = require('../../../src/services/database/schema');
const userOps = require('../../../src/services/database/user-operations');

describe('conversation history ordering (SQLite)', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    schema.initializeTables(db);
    schema.ensureTriggers(db);
  });

  afterEach(() => {
    db.close();
  });

  function addTurns(userId, count) {
    userOps.ensureUserExists(db, userId);
    for (let i = 1; i <= count; i++) {
      userOps.addUserMessage(db, { userId, message: `q${i}`, responseTimeMs: 0 });
      userOps.addBotResponse(db, { userId, response: `a${i}`, responseTimeMs: 5 });
    }
  }

  it('returns the newest N messages oldest-first, even within the same second', () => {
    addTurns('user-1', 10); // 20 rows, all sharing a timestamp

    const history = userOps.getConversationHistory(db, 'user-1', 4);

    expect(history.map((row) => [row.role, row.message])).toEqual([
      ['user', 'q9'],
      ['assistant', 'a9'],
      ['user', 'q10'],
      ['assistant', 'a10'],
    ]);
  });

  it('keeps only the latest 60 rows per user', () => {
    addTurns('user-1', 40); // 80 rows
    addTurns('user-2', 1);

    const count = (userId) =>
      db.prepare('SELECT COUNT(*) AS n FROM conversation_history WHERE user_id = ?').get(userId).n;
    expect(count('user-1')).toBe(60);
    expect(count('user-2')).toBe(2);

    const oldest = userOps.getConversationHistory(db, 'user-1', 60)[0];
    expect(oldest.message).toBe('q11');
  });
});
