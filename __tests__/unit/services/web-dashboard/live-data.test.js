/**
 * Dashboard metrics carry only live readings: process memory from the resource
 * optimizer, the user count from the database and the recent error log. No
 * command counts, success rates, response times or invented recommendations.
 */

jest.mock('../../../../src/services/database', () => ({}));
jest.mock('../../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../../src/utils/resource-optimizer', () => ({
  monitorResources: jest.fn(),
}));

describe('dashboard live data', () => {
  let service;
  let ResourceOptimizer;

  beforeEach(() => {
    service = require('../../../../src/services/web-dashboard');
    ResourceOptimizer = require('../../../../src/utils/resource-optimizer');
  });

  describe('getResourceData', () => {
    it('reports memory and tier only', async () => {
      ResourceOptimizer.monitorResources.mockReturnValue({
        memory: { status: 'high', used: 210, free: 40, percentage: 83.4, total: 250 },
        overall: { status: 'degraded' },
        recommendations: ['x'],
        optimizationTier: 'High',
      });

      expect(await service.getResourceData()).toEqual({
        memory: { status: 'high', used: 210, free: 40, percentage: 83 },
        optimizationTier: 'High',
      });
    });

    it('falls back to unknown when the optimizer throws', async () => {
      ResourceOptimizer.monitorResources.mockImplementation(() => {
        throw new Error('boom');
      });

      expect(await service.getResourceData()).toEqual({
        memory: { status: 'unknown', used: 0, free: 0, percentage: 0 },
        optimizationTier: 'unknown',
      });
    });
  });

  describe('getAnalyticsData', () => {
    const error = { timestamp: 't', level: 'ERROR', message: 'bad', error: 'detail' };

    it('reports the database user count and recent errors only', async () => {
      jest.spyOn(service, 'getDatabaseStats').mockResolvedValue({ userCount: 7 });
      service.errorLogs = [{ ...error, message: 'old' }, error];

      expect(await service.getAnalyticsData()).toEqual({
        summary: { totalUsers: 7 },
        recentErrors: [error, { ...error, message: 'old' }],
      });
    });

    it('reports zero users when the database stats fail', async () => {
      jest.spyOn(service, 'getDatabaseStats').mockRejectedValue(new Error('db down'));
      service.errorLogs = [];

      expect(await service.getAnalyticsData()).toEqual({
        summary: { totalUsers: 0 },
        recentErrors: [],
      });
    });
  });
});
