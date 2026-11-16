/**
 * Socket.IO wiring: handshake guard, per-connection handlers, the packet
 * middleware that drops a trailing non-function, and the metrics broadcast.
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
jest.mock('../../../../src/services/instance-tracker', () => ({
  getStatus: jest.fn(),
}));

const NOW = '2026-11-16T12:00:00.000Z';
const FAKE_TOKEN = 'fake-dashboard-token-0123456789';
const METRICS = { uptime: '5s', cache: { hitRate: 80 } };

function makeSocket() {
  const socket = { id: 'sock-1', handlers: {}, middleware: [], emit: jest.fn() };
  socket.on = (event, handler) => {
    socket.handlers[event] = handler;
  };
  socket.use = (fn) => socket.middleware.push(fn);
  return socket;
}

describe('dashboard socket handlers', () => {
  let service;
  let io;
  const logged = () => service.allLogs.map((entry) => `${entry.level} ${entry.message}`);

  /** Wire the handlers and connect one fake socket */
  const connect = async (token) => {
    service.authToken = token;
    service.setupSocketHandlers();
    const socket = makeSocket();
    io.on.mock.calls[0][1](socket);
    await jest.advanceTimersByTimeAsync(0);
    return socket;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date(NOW) });
    service = require('../../../../src/services/web-dashboard');
    service.bindHost = '127.0.0.1';
    io = { use: jest.fn(), on: jest.fn(), emit: jest.fn(), sockets: { sockets: new Map() } };
    service.io = io;
    jest.spyOn(service, 'getMetrics').mockResolvedValue(METRICS);
  });

  afterEach(() => {
    clearInterval(service.metricsInterval);
    service.io = null;
  });

  it('guards the handshake with the socket authorisation rule', async () => {
    await connect(null);
    const guard = io.use.mock.calls[0][0];
    const next = jest.fn();

    guard({ id: 'a', handshake: { headers: { host: 'localhost:3000' } } }, next);
    guard({ id: 'b', handshake: { headers: { host: 'evil.example' } } }, next);

    expect(next.mock.calls[0]).toEqual([]);
    expect(next.mock.calls[1][0].message).toBe(
      'Forbidden: open the dashboard at http://localhost, or list this hostname in DASHBOARD_ALLOWED_HOSTS'
    );
  });

  it('is read-only without a token: no instance_action handler, and says so', async () => {
    const socket = await connect(null);

    expect('instance_action' in socket.handlers).toBe(false);
    expect('request_instance_status' in socket.handlers).toBe(true);
    expect('request_all_instances' in socket.handlers).toBe(true);
    expect(logged()).toContain(
      'WARN DASHBOARD_TOKEN is not set — dashboard is read-only. Config saves, ' +
        'service control, reminder edits and instance actions are disabled. ' +
        'Set DASHBOARD_TOKEN to enable them.'
    );
  });

  it('registers instance_action with a token and stays quiet about a long one', async () => {
    const socket = await connect(FAKE_TOKEN);

    expect('instance_action' in socket.handlers).toBe(true);
    expect(logged().filter((line) => line.startsWith('WARN'))).toEqual([]);
  });

  it('warns about a short token', async () => {
    await connect('short-fake');

    expect(logged()).toContain('WARN DASHBOARD_TOKEN is short; use at least 32 random characters.');
  });

  it('sends metrics on connect and again on request-metrics', async () => {
    const socket = await connect(null);

    expect(socket.emit.mock.calls).toEqual([['metrics', METRICS]]);

    socket.handlers['request-metrics']();
    await jest.advanceTimersByTimeAsync(0);

    expect(socket.emit.mock.calls).toEqual([
      ['metrics', METRICS],
      ['metrics', METRICS],
    ]);
  });

  it('sends an error event when metrics cannot be collected', async () => {
    service.getMetrics.mockRejectedValue(new Error('collect failed'));

    const socket = await connect(null);

    expect(socket.emit.mock.calls).toEqual([['error', { message: 'collect failed' }]]);
  });

  it('logs connect and disconnect', async () => {
    const socket = await connect(null);
    socket.handlers.disconnect();

    expect(logged()).toContain('DEBUG Dashboard client connected: sock-1');
    expect(logged()).toContain('DEBUG Dashboard client disconnected: sock-1');
  });

  it('drops trailing arguments that are not an ack function', async () => {
    const socket = await connect(null);
    const trim = socket.middleware[0];
    const ack = () => {};
    const next = jest.fn();
    const plain = ['evt', { a: 1 }];
    const junk = ['evt', { a: 1 }, 'junk', 42];
    const withAck = ['evt', { a: 1 }, 'junk', ack];
    const ackOnly = ['evt', { a: 1 }, ack];

    [plain, junk, withAck, ackOnly].forEach((packet) => trim(packet, next));

    expect(plain).toEqual(['evt', { a: 1 }]);
    expect(junk).toEqual(['evt', { a: 1 }]);
    expect(withAck).toEqual(['evt', { a: 1 }, ack]);
    expect(ackOnly).toEqual(['evt', { a: 1 }, ack]);
    expect(next).toHaveBeenCalledTimes(4);
  });

  it('routes the instance events to their handlers', async () => {
    const instanceTracker = require('../../../../src/services/instance-tracker');
    instanceTracker.getStatus.mockReturnValue({ instanceId: 'inst-1', isVerified: true });
    const socket = await connect(FAKE_TOKEN);
    const status = jest.fn();
    const all = jest.fn();
    const action = jest.fn();

    socket.handlers.request_instance_status(undefined, status);
    socket.handlers.request_all_instances(undefined, all);
    socket.handlers.instance_action({ action: 'delete', instanceId: 'inst-1' }, action);
    await jest.advanceTimersByTimeAsync(0);

    expect(status).toHaveBeenCalledWith({ instanceId: 'inst-1', isVerified: true, timestamp: NOW });
    expect(all.mock.calls[0][0].instances[0].instanceId).toBe('inst-1');
    expect(action).toHaveBeenCalledWith({ success: false, error: 'Invalid action or instanceId' });
  });

  describe('metrics broadcast', () => {
    it('emits to everyone every 30 seconds while a client is connected', async () => {
      io.sockets.sockets.set('sock-1', {});
      service.startMetricsBroadcast();

      await jest.advanceTimersByTimeAsync(29999);
      expect(io.emit).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);
      expect(io.emit.mock.calls).toEqual([['metrics', METRICS]]);

      await jest.advanceTimersByTimeAsync(30000);
      expect(io.emit).toHaveBeenCalledTimes(2);
    });

    it('collects nothing while nobody is connected', async () => {
      service.startMetricsBroadcast();

      await jest.advanceTimersByTimeAsync(60000);

      expect(service.getMetrics).not.toHaveBeenCalled();
      expect(io.emit).not.toHaveBeenCalled();
    });

    it('logs a failed collection and keeps the interval alive', async () => {
      io.sockets.sockets.set('sock-1', {});
      service.getMetrics.mockRejectedValueOnce(new Error('collect failed'));
      service.startMetricsBroadcast();

      await jest.advanceTimersByTimeAsync(30000);
      expect(service.errorLogs.at(-1)).toEqual({
        timestamp: '2026-11-16T12:00:30.000Z',
        message: 'Metrics broadcast error: collect failed',
        error: 'collect failed',
      });

      await jest.advanceTimersByTimeAsync(30000);
      expect(io.emit.mock.calls.filter(([event]) => event === 'metrics')).toEqual([
        ['metrics', METRICS],
      ]);
    });
  });
});
