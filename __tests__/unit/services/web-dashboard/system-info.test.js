/**
 * System info, the external IP lookup (https mocked, no network), version
 * info (git mocked) and the uptime/byte formatters.
 */

const { EventEmitter } = require('events');
const https = require('https');
const os = require('os');

jest.mock('../../../../src/services/database', () => ({}));
jest.mock('../../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../../src/utils/shell-exec-helper', () => ({
  execPromise: jest.fn(),
}));

const NOW = '2026-11-16T12:00:00.000Z';
const GIB = 1024 ** 3;
const MIB = 1024 ** 2;

describe('dashboard system info', () => {
  let service;
  let spies;
  let httpsGet;
  let request;

  /** Make https.get answer with the given body chunks */
  const answerWith = (...chunks) => {
    httpsGet.mockImplementation((_url, _options, onResponse) => {
      const response = new EventEmitter();
      onResponse(response);
      chunks.forEach((chunk) => response.emit('data', chunk));
      response.emit('end');
      return request;
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date(NOW) });
    service = require('../../../../src/services/web-dashboard');
    request = new EventEmitter();
    request.destroy = jest.fn((error) => request.emit('error', error));
    httpsGet = jest.spyOn(https, 'get').mockImplementation(() => request);
    spies = [
      httpsGet,
      jest.spyOn(os, 'totalmem').mockReturnValue(8 * GIB),
      jest.spyOn(os, 'freemem').mockReturnValue(2 * GIB),
      jest.spyOn(os, 'platform').mockReturnValue('linux'),
      jest.spyOn(os, 'arch').mockReturnValue('arm64'),
      jest.spyOn(os, 'uptime').mockReturnValue(93784),
      jest.spyOn(os, 'loadavg').mockReturnValue([1, 0.5, 0.25]),
      jest.spyOn(os, 'cpus').mockReturnValue(new Array(4).fill({ model: 'Cortex-A76' })),
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 100 * MIB,
        heapTotal: 50 * MIB,
        heapUsed: 25 * MIB,
        external: 1536,
      }),
    ];
  });

  afterEach(() => {
    spies.forEach((spy) => spy.mockRestore());
  });

  describe('getSystemInfo', () => {
    it('reports host, memory, process and CPU readings', async () => {
      answerWith('{"ip":"203.0.113.7"}');

      expect(await service.getSystemInfo()).toEqual({
        platform: 'linux',
        arch: 'arm64',
        nodeVersion: process.version,
        uptime: 93784,
        uptimeFormatted: '1d 2h 3m',
        externalIp: '203.0.113.7',
        memory: {
          total: 8 * GIB,
          free: 2 * GIB,
          used: 6 * GIB,
          totalFormatted: '8 GB',
          freeFormatted: '2 GB',
          usedFormatted: '6 GB',
          usagePercent: 75,
        },
        process: {
          pid: process.pid,
          rss: 100 * MIB,
          heapTotal: 50 * MIB,
          heapUsed: 25 * MIB,
          external: 1536,
          rssFormatted: '100 MB',
          heapTotalFormatted: '50 MB',
          heapUsedFormatted: '25 MB',
        },
        cpu: { count: 4, model: 'Cortex-A76', loadAverage: [1, 0.5, 0.25], loadPercent: 25 },
      });
    });

    it('carries on without an external IP or CPU list', async () => {
      httpsGet.mockImplementation(() => {
        process.nextTick(() => request.emit('error', new Error('getaddrinfo ENOTFOUND')));
        return request;
      });
      os.cpus.mockReturnValue([]);
      jest.useRealTimers();

      const info = await service.getSystemInfo();

      expect(info.externalIp).toBe('Not available');
      expect(info.cpu).toEqual({
        count: 0,
        model: 'Unknown',
        loadAverage: [1, 0.5, 0.25],
        loadPercent: 100,
      });
    });
  });

  describe('getExternalIp', () => {
    it('asks ipify once with a 5 second timeout and reuses the answer for an hour', async () => {
      answerWith('{"ip":', '"203.0.113.7"}');

      expect(await service.getExternalIp()).toBe('203.0.113.7');
      jest.advanceTimersByTime(60 * 60 * 1000 - 1);
      expect(await service.getExternalIp()).toBe('203.0.113.7');

      expect(httpsGet).toHaveBeenCalledTimes(1);
      expect(httpsGet.mock.calls[0][0]).toBe('https://api.ipify.org?format=json');
      expect(httpsGet.mock.calls[0][1]).toEqual({ timeout: 5000 });

      jest.advanceTimersByTime(1);
      await service.getExternalIp();
      expect(httpsGet).toHaveBeenCalledTimes(2);
    });

    it('rejects an unparseable answer', async () => {
      answerWith('<html>captive portal</html>');

      await expect(service.getExternalIp()).rejects.toThrow('Failed to parse IP response');
    });

    it('gives up when the request times out', async () => {
      const pending = service.getExternalIp();
      request.emit('timeout');

      await expect(pending).rejects.toThrow('External IP lookup timed out');
      expect(request.destroy).toHaveBeenCalledTimes(1);
      expect(service.allLogs.at(-1)).toEqual({
        timestamp: NOW,
        level: 'WARN',
        message: 'Failed to get external IP from ipify.org: External IP lookup timed out',
        error: null,
      });
    });

    it('remembers a failure for five minutes before retrying', async () => {
      const first = service.getExternalIp();
      request.emit('error', new Error('connect ENETUNREACH'));
      await expect(first).rejects.toThrow('connect ENETUNREACH');

      jest.advanceTimersByTime(5 * 60 * 1000 - 1);
      await expect(service.getExternalIp()).rejects.toThrow('connect ENETUNREACH');
      expect(httpsGet).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(1);
      answerWith('{"ip":"203.0.113.7"}');
      expect(await service.getExternalIp()).toBe('203.0.113.7');
      expect(httpsGet).toHaveBeenCalledTimes(2);
    });
  });

  describe('getVersionInfo', () => {
    const { version } = require('../../../../package.json');
    let execPromise;

    beforeEach(() => {
      ({ execPromise } = require('../../../../src/utils/shell-exec-helper'));
    });

    it('reports the package version and the current commit', async () => {
      execPromise.mockResolvedValue({ stdout: 'abc1234\n', stderr: '' });

      expect(await service.getVersionInfo()).toEqual({
        version,
        commit: 'abc1234',
        commitUrl: 'https://github.com/powerfulqa/aszune-ai-bot/commit/abc1234',
        releaseUrl: `https://github.com/powerfulqa/aszune-ai-bot/releases/tag/v${version}`,
        nodeVersion: process.version,
        timestamp: NOW,
      });
      expect(execPromise).toHaveBeenCalledWith('git rev-parse --short HEAD');
    });

    it('reports an unknown commit when git is unavailable', async () => {
      execPromise.mockRejectedValue(new Error('git: command not found'));

      expect(await service.getVersionInfo()).toEqual({
        version,
        commit: 'unknown',
        commitUrl: '',
        releaseUrl: `https://github.com/powerfulqa/aszune-ai-bot/releases/tag/v${version}`,
        nodeVersion: process.version,
        timestamp: NOW,
      });
    });
  });

  describe('formatters', () => {
    it.each([
      [0, '0 B'],
      [512, '512 B'],
      [1536, '1.5 KB'],
      [5 * MIB + 131072, '5.13 MB'],
      [3 * GIB, '3 GB'],
      [2 * 1024 * GIB, '2 TB'],
      [0.5, '0.5 B'],
    ])('formatBytes(%d) is %s', (bytes, text) => {
      expect(service.formatBytes(bytes)).toBe(text);
    });

    it.each([
      [999, '0s'],
      [59000, '59s'],
      [61000, '1m 1s'],
      [3723000, '1h 2m'],
      [93784000, '1d 2h 3m'],
    ])('formatUptime(%d) is %s', (ms, text) => {
      expect(service.formatUptime(ms)).toBe(text);
    });
  });
});
