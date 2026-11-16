/**
 * Socket handlers for the log viewer: filtering, limits, clearing and the exact
 * callback payloads.
 */

jest.mock('../../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  registerLogsHandlers,
  handleRequestLogs,
  handleClearLogs,
} = require('../../../../src/services/web-dashboard/handlers/logsHandlers');

const A = { timestamp: 't1', level: 'INFO', message: 'a' };
const B = { timestamp: 't2', level: 'WARN', message: 'b' };
const C = { timestamp: 't3', level: 'ERROR', message: 'c' };
const D = { timestamp: 't4', level: 'INFO', message: 'd' };

/** Payload of the only callback call, with its timestamp checked as a string */
function onlyPayload(callback) {
  expect(callback).toHaveBeenCalledTimes(1);
  const payload = callback.mock.calls[0][0];
  expect(typeof payload.timestamp).toBe('string');
  return payload;
}

describe('handleRequestLogs', () => {
  const dashboard = () => ({ allLogs: [A, B, C, D] });

  it.each([
    ['no request data: everything, oldest first', undefined, [A, B, C, D]],
    ['an empty request', {}, [A, B, C, D]],
    ['a level filter', { level: 'INFO' }, [A, D]],
    ['a level with a single entry', { level: 'ERROR' }, [C]],
    ['a level with no entries', { level: 'DEBUG' }, []],
    ['a limit keeps the newest entries', { limit: 2 }, [C, D]],
    ['a limit larger than the buffer', { limit: 50 }, [A, B, C, D]],
    ['a level and a limit', { level: 'INFO', limit: 1 }, [D]],
    ['a level is case sensitive', { level: 'info' }, []],
  ])('%s', (_name, data, expected) => {
    const callback = jest.fn();

    handleRequestLogs(dashboard(), data, callback);

    const payload = onlyPayload(callback);
    expect(payload).toEqual({
      logs: expected,
      total: 4,
      filtered: expected.length,
      timestamp: payload.timestamp,
    });
  });

  it('does not change the buffer', () => {
    const d = dashboard();
    handleRequestLogs(d, { level: 'INFO', limit: 1 }, jest.fn());
    expect(d.allLogs).toEqual([A, B, C, D]);
  });

  it('does not throw without a callback', () => {
    expect(() => handleRequestLogs(dashboard(), {}, undefined)).not.toThrow();
  });

  it('answers a failure with the message and an empty log list', () => {
    const callback = jest.fn();
    const broken = {
      get allLogs() {
        throw new Error('buffer unavailable');
      },
    };

    handleRequestLogs(broken, {}, callback);

    expect(callback).toHaveBeenCalledWith({ error: 'buffer unavailable', logs: [] });
  });
});

describe('handleClearLogs', () => {
  const dashboard = () => ({
    allLogs: [A, B, C],
    errorLogs: [C],
    io: { emit: jest.fn() },
  });

  it('empties both buffers, reports the count and tells every viewer', () => {
    const d = dashboard();
    const callback = jest.fn();

    handleClearLogs(d, callback);

    expect(d.allLogs).toEqual([]);
    expect(d.errorLogs).toEqual([]);
    const payload = onlyPayload(callback);
    expect(payload).toEqual({ cleared: true, count: 3, timestamp: payload.timestamp });
    expect(d.io.emit).toHaveBeenCalledTimes(1);
    const [event, broadcast] = d.io.emit.mock.calls[0];
    expect(event).toBe('logs_cleared');
    expect(broadcast).toEqual({ count: 3, timestamp: broadcast.timestamp });
  });

  it('reports a count of 0 when there was nothing to clear', () => {
    const d = { ...dashboard(), allLogs: [] };
    const callback = jest.fn();

    handleClearLogs(d, callback);

    expect(onlyPayload(callback).count).toBe(0);
  });

  it('answers a failure with cleared:false and leaves viewers alone', () => {
    const callback = jest.fn();
    const io = { emit: jest.fn() };
    const broken = {
      io,
      get allLogs() {
        throw new Error('buffer unavailable');
      },
    };

    handleClearLogs(broken, callback);

    expect(callback).toHaveBeenCalledWith({ error: 'buffer unavailable', cleared: false });
    expect(io.emit).not.toHaveBeenCalled();
  });
});

describe('registerLogsHandlers', () => {
  const events = (options) => {
    const socket = { on: jest.fn() };
    registerLogsHandlers(socket, {}, options);
    return socket.on.mock.calls.map(([event]) => event);
  };

  it('registers clear_logs only when writes are allowed', () => {
    expect(events({ allowWrite: true })).toEqual(['request_logs', 'clear_logs']);
    expect(events({ allowWrite: false })).toEqual(['request_logs']);
    expect(events()).toEqual(['request_logs', 'clear_logs']);
  });

  it('routes the socket events to the handlers', () => {
    const socket = { on: jest.fn() };
    const d = { allLogs: [A, B], errorLogs: [], io: { emit: jest.fn() } };
    registerLogsHandlers(socket, d);
    const handlerFor = (name) => socket.on.mock.calls.find(([event]) => event === name)[1];
    const viewer = jest.fn();
    const clearer = jest.fn();

    handlerFor('request_logs')({ level: 'WARN' }, viewer);
    handlerFor('clear_logs')({}, clearer);

    expect(viewer.mock.calls[0][0].logs).toEqual([B]);
    expect(clearer.mock.calls[0][0].cleared).toBe(true);
    expect(d.allLogs).toEqual([]);
  });
});
