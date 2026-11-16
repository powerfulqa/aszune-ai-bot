/**
 * REST routes registered by setupRoutes, driven through the registered
 * handlers with request/response doubles (no listening socket).
 */

const path = require('path');

jest.mock('../../../../src/services/database', () => ({
  getDb: jest.fn(),
  getAllReminders: jest.fn(),
}));
jest.mock('../../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../../src/utils/error-handler', () => ({
  ErrorHandler: { handleError: jest.fn((error) => ({ message: error.message })) },
}));
jest.mock('../../../../src/services/network-detector', () => ({
  getNetworkStatus: jest.fn(),
}));

const NOW = '2026-11-16T12:00:00.000Z';
const REPO_ROOT = path.join(__dirname, '../../../..');

function makeRes() {
  const res = { headersSent: false };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => {
    res.headersSent = true;
    return res;
  });
  res.sendFile = jest.fn();
  return res;
}

describe('dashboard REST routes', () => {
  let service;
  let databaseService;
  let routes;

  const call = async (method, route, req = {}) => {
    const res = makeRes();
    await routes[`${method} ${route}`]({ params: {}, query: {}, ...req }, res);
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date(NOW) });
    service = require('../../../../src/services/web-dashboard');
    databaseService = require('../../../../src/services/database');
    routes = {};
    const register = (method) => (route, handler) => {
      routes[`${method} ${route}`] = handler;
    };
    service.app = {
      get: register('GET'),
      post: register('POST'),
      put: register('PUT'),
      patch: register('PATCH'),
      delete: register('DELETE'),
    };
    service.setupRoutes();
  });

  afterEach(() => {
    service.app = null;
  });

  it('reports health with the dashboard uptime', async () => {
    service.startTime = Date.now() - 90000;

    const res = await call('GET', '/api/health');

    expect(res.json).toHaveBeenCalledWith({ status: 'healthy', uptime: '1m 30s', timestamp: NOW });
  });

  it.each([
    ['/api/metrics', 'getMetrics'],
    ['/api/system', 'getSystemInfo'],
    ['/api/database-schema', 'getDatabaseSchema'],
    ['/api/version', 'getVersionInfo'],
  ])('%s answers with the result of %s plus a timestamp', async (route, method) => {
    jest.spyOn(service, method).mockResolvedValue({ value: 42 });

    const res = await call('GET', route);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ value: 42, timestamp: NOW });
  });

  it.each([
    ['/api/metrics', 'getMetrics'],
    ['/api/system', 'getSystemInfo'],
    ['/api/database-schema', 'getDatabaseSchema'],
    ['/api/version', 'getVersionInfo'],
  ])('%s answers 500 when %s fails', async (route, method) => {
    jest.spyOn(service, method).mockRejectedValue(new Error('collector down'));

    const res = await call('GET', route);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'collector down', timestamp: NOW });
  });

  it('sends recommendations as a bare array', async () => {
    const recommendations = [{ category: 'general', severity: 'info' }];
    jest.spyOn(service, 'getDetailedRecommendations').mockResolvedValue(recommendations);

    const res = await call('GET', '/api/recommendations');

    expect(res.json).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(recommendations);
  });

  it('serves the dashboard page at /', async () => {
    const res = await call('GET', '/');

    expect(res.sendFile).toHaveBeenCalledWith(path.join(REPO_ROOT, 'dashboard/public/index.html'));
  });

  describe('GET /api/database/:table', () => {
    let statements;

    beforeEach(() => {
      statements = {
        'SELECT COUNT(*) as count FROM reminders': { get: jest.fn(() => ({ count: 9 })) },
        'SELECT * FROM reminders LIMIT ? OFFSET ?': { all: jest.fn(() => [{ id: 1 }]) },
      };
      databaseService.getDb.mockReturnValue({ prepare: jest.fn((sql) => statements[sql]) });
    });

    it.each([
      ['defaults', {}, 100, 0],
      ['given values', { limit: '25', offset: '50' }, 25, 50],
      ['out-of-range values clamped', { limit: '5000', offset: '-3' }, 1000, 0],
      ['a zero limit raised to 1', { limit: '0', offset: 'abc' }, 1, 0],
    ])('pages with %s', async (_name, query, limit, offset) => {
      const res = await call('GET', '/api/database/:table', {
        params: { table: 'reminders' },
        query,
      });

      expect(statements['SELECT * FROM reminders LIMIT ? OFFSET ?'].all).toHaveBeenCalledWith(
        limit,
        offset
      );
      expect(res.json).toHaveBeenCalledWith({
        table: 'reminders',
        totalRows: 9,
        limit,
        offset,
        returnedRows: 1,
        columns: ['id', 'user_id', 'message', 'scheduled_time', 'status', 'created_at'],
        data: [{ id: 1 }],
        timestamp: NOW,
      });
    });

    it('answers 400 for a table outside the allowlist without touching the database', async () => {
      const res = await call('GET', '/api/database/:table', {
        params: { table: 'sqlite_master' },
      });

      expect(databaseService.getDb).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid table: sqlite_master',
        timestamp: NOW,
      });
    });
  });
});

describe('dashboard data delegates', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = require('../../../../src/services/web-dashboard');
  });

  it('getNetworkStatus returns the detector result', async () => {
    const NetworkDetector = require('../../../../src/services/network-detector');
    NetworkDetector.getNetworkStatus.mockResolvedValue({ connected: true, gateway: '192.0.2.1' });

    expect(await service.getNetworkStatus()).toEqual({ connected: true, gateway: '192.0.2.1' });
  });

  describe('getReminders', () => {
    const reminders = [
      { id: 1, status: 'active' },
      { id: 2, status: 'completed' },
      { id: 3, status: 'active' },
    ];

    beforeEach(() => {
      require('../../../../src/services/database').getAllReminders.mockReturnValue(reminders);
    });

    it('returns every reminder by default', async () => {
      expect(await service.getReminders()).toEqual(reminders);
    });

    it('filters by status', async () => {
      expect(await service.getReminders('active')).toEqual([reminders[0], reminders[2]]);
      expect(await service.getReminders('cancelled')).toEqual([]);
    });
  });
});
