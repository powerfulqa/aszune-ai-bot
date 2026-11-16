/**
 * Socket handlers for service control: exact pm2/systemctl argv, allowlist
 * rejections (nothing spawned) and exact callback payloads.
 */

jest.mock('../../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('child_process', () => ({
  exec: jest.fn(),
  execFile: jest.fn(),
  spawn: jest.fn(),
}));

// jest.setup.js resets modules before each test, so the mocked child_process the
// handlers see is re-created too: take references after requiring them.
let childProcess;
let handlers;

const BOT = 'aszune-ai';
const ok = (stdout) => (file, args, opts, cb) => cb(null, { stdout, stderr: '' });
const fail = (message) => (file, args, opts, cb) => cb(new Error(message));

/** [file, args, options] of every spawn so far (drops the promisify callback) */
const spawned = () =>
  childProcess.execFile.mock.calls.map(([file, args, opts]) => [file, args, opts]);

/** The single payload passed to the socket callback, checked to carry a timestamp */
function onlyPayload(callback) {
  expect(callback).toHaveBeenCalledTimes(1);
  return callback.mock.calls[0][0];
}

beforeEach(() => {
  jest.clearAllMocks();
  childProcess = require('child_process');
  handlers = require('../../../../src/services/web-dashboard/handlers/serviceHandlers');
  childProcess.execFile.mockImplementation(ok('pm2 output'));
});

describe('handleServiceAction: allowed actions', () => {
  const MESSAGES = { start: 'started', stop: 'stopped', restart: 'restarted' };

  it.each(
    ['aszune-ai', 'aszune-ai-bot', 'aszune-bot'].flatMap((name) =>
      ['start', 'stop', 'restart'].map((action) => [name, action])
    )
  )('%s %s runs pm2 with separate arguments and reports success', async (serviceName, action) => {
    const callback = jest.fn();

    await handlers.handleServiceAction({}, { serviceName, action }, callback);

    expect(spawned()).toEqual([['pm2', [action, BOT], { timeout: 10000 }]]);
    expect(childProcess.exec).not.toHaveBeenCalled();
    const payload = onlyPayload(callback);
    expect(typeof payload.timestamp).toBe('string');
    expect(payload).toEqual({
      success: true,
      serviceName,
      action,
      message: `Successfully ${MESSAGES[action]} ${serviceName}`,
      timestamp: payload.timestamp,
      output: 'pm2 output',
    });
  });

  it.each(['start', 'restart'])(
    'falls back to a generated output for %s with empty stdout',
    async (action) => {
      childProcess.execFile.mockImplementation(ok(''));
      const callback = jest.fn();

      await handlers.handleServiceAction({}, { serviceName: BOT, action }, callback);

      expect(onlyPayload(callback).output).toBe(`pm2 ${action} ${BOT} succeeded`);
    }
  );

  it('reports a pm2 failure with the exact error payload', async () => {
    childProcess.execFile.mockImplementation(fail('pm2 exploded'));
    const callback = jest.fn();

    await handlers.handleServiceAction({}, { serviceName: BOT, action: 'restart' }, callback);

    expect(callback).toHaveBeenCalledWith({
      error: 'Failed to restart service: pm2 exploded',
      success: false,
    });
  });
});

describe('handleServiceAction: rejections spawn nothing', () => {
  it.each([
    ['sshd', 'restart', 'Unknown or disallowed service: sshd'],
    ['nginx; rm -rf /', 'restart', 'Unknown or disallowed service: nginx; rm -rf /'],
    ['aszune-ai && reboot', 'stop', 'Unknown or disallowed service: aszune-ai && reboot'],
    ['--help', 'start', 'Unknown or disallowed service: --help'],
    ['$(id)', 'start', 'Unknown or disallowed service: $(id)'],
    ['constructor', 'start', 'Unknown or disallowed service: constructor'],
    ['__proto__', 'start', 'Unknown or disallowed service: __proto__'],
    [['aszune-ai'], 'start', 'Unknown or disallowed service: aszune-ai'],
    [BOT, 'enable', 'Invalid action: enable. Must be one of: start, stop, restart'],
    [
      BOT,
      'restart; reboot',
      'Invalid action: restart; reboot. Must be one of: start, stop, restart',
    ],
    [BOT, 'delete', 'Invalid action: delete. Must be one of: start, stop, restart'],
    ['', 'start', 'Missing required fields: serviceName, action'],
    [BOT, '', 'Missing required fields: serviceName, action'],
    [undefined, undefined, 'Missing required fields: serviceName, action'],
  ])('%p %p', async (serviceName, action, error) => {
    const callback = jest.fn();

    await handlers.handleServiceAction({}, { serviceName, action }, callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ error, success: false });
    expect(childProcess.execFile).not.toHaveBeenCalled();
    expect(childProcess.exec).not.toHaveBeenCalled();
    expect(childProcess.spawn).not.toHaveBeenCalled();
  });

  it('does not throw when the client sent no callback', async () => {
    await expect(
      handlers.handleServiceAction({}, { serviceName: 'sshd', action: 'stop' })
    ).resolves.toBeUndefined();
    expect(childProcess.execFile).not.toHaveBeenCalled();
  });
});

describe('handleQuickServiceAction', () => {
  it.each([
    ['restart-all', ['restart', 'all']],
    ['start-all', ['start', 'all']],
    ['stop-non-essential', ['restart', 'all']],
  ])('%s runs pm2 %j', async (group, args) => {
    const callback = jest.fn();

    await handlers.handleQuickServiceAction({ group }, callback);

    expect(spawned()).toEqual([['pm2', args, { timeout: 10000 }]]);
    const payload = onlyPayload(callback);
    expect(payload).toEqual({
      success: true,
      group,
      message: `Quick action '${group}' completed successfully`,
      timestamp: payload.timestamp,
      output: 'pm2 output',
    });
  });

  it.each([
    ['rm-all', 'Failed to execute quick action: Unknown quick action group: rm-all'],
    [
      'restart-all; reboot',
      'Failed to execute quick action: Unknown quick action group: restart-all; reboot',
    ],
    ['__proto__', 'Failed to execute quick action: Unknown quick action group: __proto__'],
    [undefined, 'Missing required field: group'],
    ['', 'Missing required field: group'],
  ])('rejects group %p without spawning', async (group, error) => {
    const callback = jest.fn();

    await handlers.handleQuickServiceAction({ group }, callback);

    expect(callback).toHaveBeenCalledWith({ error, success: false });
    expect(childProcess.execFile).not.toHaveBeenCalled();
  });

  it('reports a pm2 failure with the exact error payload', async () => {
    childProcess.execFile.mockImplementation(fail('no such process'));
    const callback = jest.fn();

    await handlers.handleQuickServiceAction({ group: 'restart-all' }, callback);

    expect(callback).toHaveBeenCalledWith({
      error: 'Failed to execute quick action: no such process',
      success: false,
    });
  });
});

describe('registerServiceHandlers', () => {
  const events = (options) => {
    const socket = { on: jest.fn() };
    handlers.registerServiceHandlers(socket, {}, options);
    return socket.on.mock.calls.map(([event]) => event);
  };

  it('registers the control events only when control is allowed', () => {
    expect(events({ allowControl: true })).toEqual([
      'request_services',
      'request_discord_status',
      'service_action',
      'quick_service_action',
    ]);
    expect(events({ allowControl: false })).toEqual(['request_services', 'request_discord_status']);
  });
});

describe('handleDiscordStatus', () => {
  const user = { tag: 'Aszune#0001', id: '42' };
  const client = (overrides) => ({
    isReady: () => true,
    user,
    uptime: 3661000,
    guilds: { cache: { size: 3 } },
    ...overrides,
  });

  it('reports a ready client', async () => {
    const callback = jest.fn();

    await handlers.handleDiscordStatus({ discordClient: client() }, callback);

    const payload = onlyPayload(callback);
    expect(payload).toEqual({
      connected: true,
      username: 'Aszune#0001',
      id: '42',
      uptime: '1h 1m 1s',
      guilds: 3,
      timestamp: payload.timestamp,
    });
  });

  it.each([
    ['no client', undefined, 'Discord client not initialized'],
    [
      'a client that is not ready',
      client({ isReady: () => false }),
      'Discord bot is not connected',
    ],
    ['a ready client without a user', client({ user: null }), 'Discord bot is not connected'],
  ])('answers %s with connected:false', async (_name, discordClient, error) => {
    const callback = jest.fn();

    await handlers.handleDiscordStatus({ discordClient }, callback);

    expect(callback).toHaveBeenCalledWith({ error, connected: false });
  });

  it('answers a throwing client with connected:false and its message', async () => {
    const callback = jest.fn();
    const discordClient = client({
      isReady: () => {
        throw new Error('gateway gone');
      },
    });

    await handlers.handleDiscordStatus({ discordClient }, callback);

    expect(callback).toHaveBeenCalledWith({ error: 'gateway gone', connected: false });
  });
});

describe('formatUptime', () => {
  it.each([
    [0, '0s'],
    [59000, '59s'],
    [60000, '1m 0s'],
    [3600000, '1h 0m 0s'],
    [3661000, '1h 1m 1s'],
    [90061000, '25h 1m 1s'],
  ])('%i ms is %s', (ms, expected) => {
    expect(handlers.formatUptime(ms)).toBe(expected);
  });
});

describe('boot status and handleRequestServices', () => {
  const realPlatform = process.platform;
  const hadPmId = Object.prototype.hasOwnProperty.call(process.env, 'pm_id');
  const realPmId = process.env.pm_id;

  const setPlatform = (value) => Object.defineProperty(process, 'platform', { value });

  beforeEach(() => {
    delete process.env.pm_id;
    setPlatform('linux');
  });

  afterEach(() => {
    setPlatform(realPlatform);
    if (hadPmId) process.env.pm_id = realPmId;
    else delete process.env.pm_id;
  });

  it('under PM2 reports boot-enabled without running systemctl', async () => {
    process.env.pm_id = '0';
    expect(await handlers.getBootEnabledStatus('aszune-bot')).toBe(true);
    expect(childProcess.execFile).not.toHaveBeenCalled();
  });

  it.each([
    ['enabled\n', true],
    ['disabled\n', false],
    ['static\n', false],
  ])('systemctl is-enabled printing %j gives %s', async (stdout, expected) => {
    childProcess.execFile.mockImplementation(ok(stdout));

    expect(await handlers.getBootEnabledStatus('aszune-bot')).toBe(expected);
    expect(spawned()).toEqual([['systemctl', ['is-enabled', 'aszune-bot'], { timeout: 5000 }]]);
  });

  it('treats a systemctl failure as not enabled', async () => {
    childProcess.execFile.mockImplementation(fail('unit not found'));
    expect(await handlers.getBootEnabledStatus('aszune-bot')).toBe(false);
  });

  it('refuses an unsafe unit name without running systemctl', async () => {
    expect(await handlers.checkUnixBootStatus('x; reboot')).toBe(false);
    expect(childProcess.execFile).not.toHaveBeenCalled();
  });

  it.each([
    ['START_TYPE : 2 AUTO_START', true],
    ['START_TYPE : 0 BOOT_START', true],
    ['START_TYPE : 3 DEMAND_START', false],
  ])('on Windows sc qc printing %j gives %s', async (line, expected) => {
    setPlatform('win32');
    childProcess.execFile.mockImplementation(ok(`SERVICE_NAME: x\r\n${line}\r\n`));

    expect(await handlers.getBootEnabledStatus('aszune-bot')).toBe(expected);
    expect(spawned()).toEqual([['sc', ['qc', 'aszune-bot'], { timeout: 5000 }]]);
  });

  it('is never enabled on other platforms', async () => {
    setPlatform('freebsd');
    expect(await handlers.getBootEnabledStatus('aszune-bot')).toBe(false);
    expect(childProcess.execFile).not.toHaveBeenCalled();
  });

  it('handleRequestServices sends the bot service with its boot flag', async () => {
    process.env.pm_id = '0';
    const callback = jest.fn();

    await handlers.handleRequestServices({}, callback);

    const payload = onlyPayload(callback);
    expect(payload).toEqual({
      services: [handlers.buildServiceObject(true)].map((service) => ({
        ...service,
        uptime: payload.services[0].uptime,
        memory: payload.services[0].memory,
      })),
      total: 1,
      timestamp: payload.timestamp,
    });
    expect(payload.services[0].enabledOnBoot).toBe(true);
  });
});
