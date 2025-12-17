const { setupDatabaseService } = require('./database.test.setup');

describe('Data Cleanup and Close', () => {
  let context;

  beforeEach(() => {
    context = setupDatabaseService();
  });

  it('should delete user data', () => {
    context.mockStmt.run.mockReturnValue({ changes: 1 });

    context.dbService.clearUserData('123');

    expect(context.mockStmt.run).toHaveBeenCalled();
  });

  it('should throw when clearing user data fails', () => {
    context.mockStmt.run.mockImplementation(() => {
      throw new Error('Delete failed');
    });

    expect(() => context.dbService.clearUserData('123')).toThrow(
      'Failed to clear user data for 123: Delete failed'
    );
  });

  it('should close the database connection', () => {
    context.dbService.getDb();
    context.dbService.close();

    expect(context.mockDb.close).toHaveBeenCalled();
    expect(context.dbService.db).toBeNull();
  });

  it('should ignore close when db is uninitialized', () => {
    context.dbService.close();

    expect(context.mockDb.close).not.toHaveBeenCalled();
  });

  it('should throw on close failure', () => {
    context.dbService.getDb();
    context.mockDb.close.mockImplementation(() => {
      throw new Error('Close failed');
    });

    expect(() => context.dbService.close()).toThrow('Failed to close database: Close failed');
  });
});
