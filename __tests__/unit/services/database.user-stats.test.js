const { setupDatabaseService } = require('./database.test.setup');

describe('User Stats Queries', () => {
  let context;

  beforeEach(() => {
    context = setupDatabaseService();
  });

  describe('getUserStats', () => {
    it('returns stored stats when the user exists', () => {
      const mockStats = { user_id: '123', message_count: 5, last_active: '2023-01-01' };
      context.mockStmt.get.mockReturnValue(mockStats);

      const result = context.dbService.getUserStats('123');

      expect(context.mockStmt.get).toHaveBeenCalledWith('123');
      expect(result).toEqual(mockStats);
    });

    it('returns defaults when no stats exist', () => {
      context.mockStmt.get.mockReturnValue(undefined);

      const result = context.dbService.getUserStats('456');

      expect(result).toEqual({
        user_id: '456',
        message_count: 0,
        last_active: null,
        first_seen: null,
        preferences: '{}',
        total_commands: 0,
        total_summaries: 0,
        username: null,
      });
    });

    it('throws when the query fails', () => {
      context.mockStmt.get.mockImplementation(() => {
        throw new Error('Query failed');
      });

      expect(() => context.dbService.getUserStats('123')).toThrow(
        'Failed to get user stats for 123: Query failed'
      );
    });
  });

  describe('updateUserStats', () => {
    it('updates stats when changes are provided', () => {
      context.mockStmt.run.mockReturnValue({ changes: 1 });

      context.dbService.updateUserStats('123', {
        message_count: 1,
        last_active: '2023-01-02',
      });

      expect(context.mockStmt.run).toHaveBeenCalledWith(
        '123',
        1,
        '2023-01-02',
        expect.any(String),
        0,
        0,
        '{}',
        null,
        1,
        '2023-01-02',
        0,
        0,
        null
      );
    });

    it('handles missing update fields gracefully', () => {
      context.dbService.updateUserStats('123', {});

      expect(context.mockStmt.run).toHaveBeenCalledWith(
        '123',
        0,
        expect.any(String),
        expect.any(String),
        0,
        0,
        '{}',
        null,
        0,
        expect.any(String),
        0,
        0,
        null
      );
    });

    it('throws when update fails', () => {
      context.mockStmt.run.mockImplementation(() => {
        throw new Error('Update failed');
      });

      expect(() => context.dbService.updateUserStats('123', { message_count: 1 })).toThrow(
        'Failed to update user stats for 123: Update failed'
      );
    });
  });
});
