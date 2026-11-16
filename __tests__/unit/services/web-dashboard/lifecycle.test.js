/**
 * Dashboard lifecycle: start/stop, Discord username resolution and the log
 * buffer that feeds the log viewer.
 */

jest.mock('../../../../src/services/database', () => ({}));
jest.mock('../../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../../src/utils/error-handler', () => ({
  ErrorHandler: { handleError: jest.fn((error) => ({ message: error.message })) },
}));

const NOW = '2026-11-16T12:00:00.000Z';
const FAKE_TOKEN = 'fake-dashboard-token-0123456789';

describe('dashboard start and stop', () => {
  let service;
  const logged = () => service.allLogs.map((entry) => `${entry.level} ${entry.message}`);

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.DASHBOARD_TOKEN;
    service = require('../../../../src/services/web-dashboard');
    service.authToken = null;
    service.bindHost = '127.0.0.1';
  });

  afterEach(async () => {
    clearInterval(service.metricsInterval);
    if (service.io) service.io.close();
    service.isRunning = false;
  });

  it('listens on the loopback address and releases everything on stop', async () => {
    jest.spyOn(service, 'findAvailablePort').mockResolvedValue(0);

    await service.start();
    const { address } = service.server.address();

    expect(service.isRunning).toBe(true);
    expect(service.server.listening).toBe(true);
    expect(address).toBe('127.0.0.1');
    expect(logged()).toContain(
      'INFO Web dashboard started on 127.0.0.1:0 (no token auth, read-only (localhost-only))'
    );

    const server = service.server;
    await service.stop();

    expect(server.listening).toBe(false);
    expect(service.isRunning).toBe(false);
    expect(service.server).toBeNull();
    expect(service.io).toBeNull();
    expect(service.app).toBeNull();
    expect(service.metricsInterval).toBeNull();
    expect(logged()).toContain('INFO Web dashboard stopped');
  });

  it.each([
    [FAKE_TOKEN, '127.0.0.1', 'token auth enabled'],
    [null, '0.0.0.0', 'no DASHBOARD_TOKEN on a network bind, API and live data disabled'],
  ])('reports the security mode for token %s on %s', async (token, host, mode) => {
    service.authToken = token;
    service.bindHost = host;
    jest.spyOn(service, 'findAvailablePort').mockResolvedValue(4321);
    const bind = jest.spyOn(service, 'bindServerWithRetry').mockResolvedValue(4321);

    await service.start();

    expect(bind).toHaveBeenCalledWith(4321);
    expect(service.isRunning).toBe(true);
    expect(logged()).toContain(`INFO Web dashboard started on ${host}:4321 (${mode})`);
  });

  it('rethrows a bind failure and stays stopped', async () => {
    jest.spyOn(service, 'findAvailablePort').mockResolvedValue(4321);
    jest.spyOn(service, 'bindServerWithRetry').mockRejectedValue(new Error('bind failed'));

    await expect(service.start()).rejects.toThrow('bind failed');

    expect(service.isRunning).toBe(false);
    // stop() skips a dashboard that never ran, so no interval may be left behind.
    expect(service.metricsInterval).toBeNull();
    expect(logged()).toContain('ERROR Failed to start web dashboard: bind failed');
  });

  it('does not start a second time', async () => {
    service.isRunning = true;

    await service.start();

    expect(service.app).toBeNull();
    expect(logged()).toEqual(['WARN Web dashboard is already running']);
  });

  it('does nothing on stop when it is not running', async () => {
    service.io = { close: jest.fn() };

    await service.stop();

    expect(service.io.close).not.toHaveBeenCalled();
    service.io = null;
  });

  it('rethrows an error raised while stopping', async () => {
    service.isRunning = true;
    service.io = {
      emit: jest.fn(),
      close: () => {
        throw new Error('close failed');
      },
    };

    await expect(service.stop()).rejects.toThrow('close failed');

    expect(logged()).toContain('ERROR Failed to stop web dashboard: close failed');
    service.io = null;
  });
});

describe('dashboard Discord username resolution', () => {
  let service;
  let fetchUser;

  beforeEach(() => {
    jest.clearAllMocks();
    service = require('../../../../src/services/web-dashboard');
    fetchUser = jest.fn();
    service.setDiscordClient({ users: { fetch: fetchUser } });
  });

  it.each([[undefined], [''], ['not-a-snowflake'], [12345]])(
    'does not ask Discord about the invalid id %p',
    async (userId) => {
      expect(await service.resolveDiscordUsername(userId)).toBeNull();
      expect(fetchUser).not.toHaveBeenCalled();
    }
  );

  it('fetches a username once and then serves it from the cache', async () => {
    fetchUser.mockResolvedValue({ username: 'lorekeeper' });

    expect(await service.resolveDiscordUsername('123456789')).toBe('lorekeeper');
    expect(await service.resolveDiscordUsername('123456789')).toBe('lorekeeper');

    expect(fetchUser).toHaveBeenCalledTimes(1);
    expect(fetchUser).toHaveBeenCalledWith('123456789', { cache: false });
  });

  it('returns null when Discord has no username for the id', async () => {
    fetchUser.mockResolvedValue({});

    expect(await service.resolveDiscordUsername('123456789')).toBeNull();
    expect(service.usernameCache.has('123456789')).toBe(false);
  });

  it('returns null when the Discord fetch fails', async () => {
    fetchUser.mockRejectedValue(new Error('Unknown User'));

    expect(await service.resolveDiscordUsername('123456789')).toBeNull();
    expect(service.allLogs.at(-1).message).toBe(
      'Failed to resolve Discord username for 123456789: Unknown User'
    );
  });

  it('returns null without a Discord client', async () => {
    service.discordClient = null;

    expect(await service.resolveDiscordUsername('123456789')).toBeNull();
  });
});

describe('dashboard log buffer', () => {
  let service;
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date(NOW) });
    service = require('../../../../src/services/web-dashboard');
    logger = require('../../../../src/utils/logger');
  });

  afterEach(() => {
    service.io = null;
  });

  it('keeps only the newest 500 entries', () => {
    for (let i = 0; i <= 500; i++) logger.info(`line ${i}`);

    expect(service.allLogs).toHaveLength(500);
    expect(service.allLogs[0]).toEqual({
      timestamp: NOW,
      level: 'INFO',
      message: 'line 1',
      error: null,
    });
    expect(service.allLogs[499].message).toBe('line 500');
  });

  it('pushes each new entry to connected log viewers', () => {
    service.io = { emit: jest.fn() };

    logger.warn({ code: 7 });

    expect(service.io.emit).toHaveBeenCalledTimes(1);
    expect(service.io.emit).toHaveBeenCalledWith('log:new', {
      timestamp: NOW,
      level: 'WARN',
      message: '[object Object]',
    });
  });
});
