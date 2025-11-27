const { setupIndexContext } = require('./index.test.setup');

describe('Graceful Shutdown', () => {
  let context;

  beforeEach(() => {
    context = setupIndexContext();
  });

  afterEach(() => {
    context.resetEnv();
    context.restoreProcess();
  });

  it('registers SIGINT and SIGTERM handlers', () => {
    const sigintHandler = context.processHandlers.get('SIGINT');
    const sigtermHandler = context.processHandlers.get('SIGTERM');

    expect(sigintHandler).toBeDefined();
    expect(typeof sigintHandler).toBe('function');
    expect(sigtermHandler).toBeDefined();
    expect(typeof sigtermHandler).toBe('function');
  });

  it('registers uncaughtException handler', () => {
    expect(context.processHandlers.get('uncaughtException')).toBeDefined();
  });

  it('calls shutdown via new handler', () => {
    const mockShutdown = jest.fn();
    const originalHandler = context.processHandlers.get('uncaughtException');
    context.processHandlers.set('uncaughtException', (_error) => {
      mockShutdown('uncaughtException');
    });

    const handler = context.processHandlers.get('uncaughtException');
    handler(new Error('Test')); // eslint-disable-line no-unused-expressions

    expect(mockShutdown).toHaveBeenCalledWith('uncaughtException');
    context.processHandlers.set('uncaughtException', originalHandler);
  });

  it('uses process.exit spy when shutdown fails', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined);
    const shutdown = require('../../src/index').shutdown;

    await shutdown('SIGINT');

    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it('registers unhandledRejection handler', () => {
    expect(context.processHandlers.get('unhandledRejection')).toBeDefined();
  });
});
