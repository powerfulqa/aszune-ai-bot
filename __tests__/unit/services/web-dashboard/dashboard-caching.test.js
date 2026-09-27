/**
 * Tests for shared/cached dashboard data collection:
 *  - metrics are collected once for concurrent callers and errors propagate
 *  - service status runs per-unit checks via execFile (no shell), in parallel
 */

jest.mock('../../../../src/services/database', () => ({}));
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

describe('dashboard data caching', () => {
  let service;
  let childProcess;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.DASHBOARD_SERVICES;
    service = require('../../../../src/services/web-dashboard');
    childProcess = require('child_process');
    require('../../../../src/utils/cached').invalidate();
  });

  describe('getMetrics', () => {
    it('collects once for concurrent callers', async () => {
      const collect = jest
        .spyOn(service, '_collectAllMetrics')
        .mockResolvedValue([{ c: 1 }, { d: 1 }, { r: 1 }, { s: 1 }, { res: 1 }, { a: 1 }]);

      const [first, second] = await Promise.all([service.getMetrics(), service.getMetrics()]);

      expect(collect).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
      expect(first.cache).toEqual({ c: 1 });
      expect(first.analytics).toEqual({ a: 1 });
    });

    it('throws when collection fails instead of returning undefined', async () => {
      jest.spyOn(service, '_collectAllMetrics').mockRejectedValue(new Error('collect failed'));

      await expect(service.getMetrics()).rejects.toThrow('collect failed');
    });
  });

  describe('getServiceStatus', () => {
    beforeEach(() => {
      childProcess.execFile.mockImplementation((file, args, opts, cb) => {
        const [sub] = args;
        const stdout = sub === 'is-active' ? 'active\n' : '';
        cb(null, { stdout, stderr: '' });
      });
    });

    it('queries each configured unit with execFile and no shell', async () => {
      process.env.DASHBOARD_SERVICES = 'aszune-ai, nginx';

      const result = await service.getServiceStatus();

      expect(result.map((s) => [s.name, s.status])).toEqual([
        ['aszune-ai', 'active'],
        ['nginx', 'active'],
      ]);
      expect(childProcess.execFile).toHaveBeenCalledWith(
        'systemctl',
        ['is-active', 'nginx'],
        { timeout: 5000 },
        expect.any(Function)
      );
      expect(childProcess.exec).not.toHaveBeenCalled();
    });

    it('defaults to the built-in unit list', () => {
      expect(service._getMonitoredServices()).toEqual(['aszune-ai-bot', 'nginx', 'postgresql']);
    });

    it('reports an unsafe configured unit name as an error without running it', async () => {
      process.env.DASHBOARD_SERVICES = 'bad;name';

      const result = await service.getServiceStatus();

      expect(result).toEqual([{ name: 'bad;name', status: 'error', uptime: null, enabled: false }]);
      expect(childProcess.execFile).not.toHaveBeenCalled();
    });
  });
});
