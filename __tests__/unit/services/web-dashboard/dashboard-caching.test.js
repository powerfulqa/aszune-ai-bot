/**
 * Tests for shared/cached dashboard data collection:
 *  - metrics are collected once for concurrent callers and errors propagate
 */

jest.mock('../../../../src/services/database', () => ({}));
jest.mock('../../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('dashboard data caching', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = require('../../../../src/services/web-dashboard');
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
});
