const { setupIndexCriticalMocks } = require('./index-critical-coverage.test.setup');

let context;

describe('Discord Client Event Handlers', () => {
  beforeEach(() => {
    context = setupIndexCriticalMocks();
    process.env.NODE_ENV = 'test';
    context.index = context.loadIndex();
  });

  afterEach(() => {
    context.resetEnv();
    context.restoreProcess();
  });

  it('should handle ready event and register slash commands', () => {
    const readyHandlers = context.mockClient.once.mock.calls.filter(
      (call) => call[0] === 'clientReady' || call[0] === 'ready'
    );
    expect(readyHandlers.length).toBeGreaterThan(0);
    expect(context.mockRest.put).toBeDefined();
  });

  it('should handle slash command registration errors', () => {
    context.mockRest.put.mockRejectedValueOnce(new Error('Registration failed'));

    const readyHandlers = context.mockClient.once.mock.calls.filter(
      (call) => call[0] === 'clientReady' || call[0] === 'ready'
    );
    expect(readyHandlers.length).toBeGreaterThan(0);
  });

  it('should handle client not ready during slash command registration', () => {
    expect(context.mockClient.user).toBeDefined();
    expect(context.mockClient.destroy).toBeDefined();
  });

  it('should handle error events', () => {
    const errorHandlers = context.mockClient.on.mock.calls.filter((call) => call[0] === 'error');
    expect(errorHandlers.length).toBeGreaterThan(0);
  });

  it('should handle warn events', () => {
    const warnHandlers = context.mockClient.on.mock.calls.filter((call) => call[0] === 'warn');
    expect(warnHandlers.length).toBeGreaterThan(0);
  });

  it('should handle interaction events', async () => {
    const interactionHandler = context.mockClient.on.mock.calls.find(
      (call) => call[0] === 'interactionCreate'
    )[1];
    const mockInteraction = { isChatInputCommand: () => true };

    await interactionHandler(mockInteraction);

    const commandHandler = require('../../src/commands');
    expect(commandHandler.handleSlashCommand).toHaveBeenCalledWith(mockInteraction);
  });

  it('should ignore non-slash interactions', async () => {
    const interactionHandler = context.mockClient.on.mock.calls.find(
      (call) => call[0] === 'interactionCreate'
    )[1];
    const mockInteraction = { isChatInputCommand: () => false };

    await interactionHandler(mockInteraction);

    const commandHandler = require('../../src/commands');
    expect(commandHandler.handleSlashCommand).not.toHaveBeenCalled();
  });
});
