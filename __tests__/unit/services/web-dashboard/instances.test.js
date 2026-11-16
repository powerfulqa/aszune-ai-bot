/**
 * Instance panel: local status, the instance list from the tracking server and
 * approve/revoke. The instance tracker and fetch are mocked at the boundary.
 */

jest.mock('../../../../src/services/database', () => ({}));
jest.mock('../../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../../src/services/instance-tracker', () => ({
  getStatus: jest.fn(),
}));

const NOW = '2026-11-16T12:00:00.000Z';
const SERVER = 'https://track.example/api/beacon';
const FAKE_KEY = 'fake-admin-key';

const LOCAL_INSTANCE = {
  instanceId: 'inst-local',
  clientName: 'Aszune AI Bot (Local)',
  ip: '198.51.100.4',
  location: 'Leeds, GB',
  guilds: 3,
  online: true,
  revoked: false,
  authorized: true,
  lastHeartbeat: NOW,
  isLocal: true,
};
const LOCAL_RESPONSE = {
  instances: [LOCAL_INSTANCE],
  myIp: '198.51.100.4',
  authorizedIps: ['198.51.100.4'],
  trackingUnavailable: true,
};

const REMOTE_INSTANCES = [
  {
    instanceId: 'a',
    client: { botTag: 'Aszune#0001', name: 'ignored', guildCount: 12 },
    location: { actualIp: '203.0.113.9', city: 'Leeds', country: 'GB' },
    ip: '10.0.0.1',
    isOnline: true,
    revoked: false,
    authorized: true,
    lastSeen: '2026-11-16T11:59:00.000Z',
  },
  {
    instanceId: 'b',
    client: { name: 'Fork' },
    stats: { guildCount: 2 },
    location: { city: 'unknown', country: 'FR' },
    ip: '192.0.2.50',
    isOnline: false,
    revoked: true,
    authorized: false,
    lastSeen: '2026-11-15T08:00:00.000Z',
  },
  { instanceId: 'c', location: { city: 'Oslo' }, ip: '192.0.2.51' },
  { instanceId: 'd', location: { city: 'unknown', country: '' }, ip: '192.0.2.52' },
  { instanceId: 'e', ip: '192.0.2.53' },
];
const blank = { online: undefined, revoked: undefined, authorized: undefined };
const missing = { clientName: 'Unknown', guilds: 0, lastHeartbeat: undefined, ...blank };
const MAPPED_INSTANCES = [
  {
    instanceId: 'a',
    clientName: 'Aszune#0001',
    ip: '203.0.113.9',
    location: 'Leeds, GB',
    guilds: 12,
    online: true,
    revoked: false,
    authorized: true,
    lastHeartbeat: '2026-11-16T11:59:00.000Z',
  },
  {
    instanceId: 'b',
    clientName: 'Fork',
    ip: '192.0.2.50',
    location: 'FR',
    guilds: 2,
    online: false,
    revoked: true,
    authorized: false,
    lastHeartbeat: '2026-11-15T08:00:00.000Z',
  },
  { instanceId: 'c', ip: '192.0.2.51', location: 'Oslo', ...missing },
  { instanceId: 'd', ip: '192.0.2.52', location: 'Local Network', ...missing },
  { instanceId: 'e', ip: '192.0.2.53', location: 'Unknown', ...missing },
];

describe('dashboard instance panel', () => {
  let service;
  let instanceTracker;
  let fetchSpy;
  let callback;
  const jsonResponse = (ok, body) => ({ ok, json: async () => body });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date(NOW) });
    delete process.env.INSTANCE_TRACKING_SERVER;
    delete process.env.TRACKING_ADMIN_KEY;
    delete process.env.AUTHORIZED_IPS;
    service = require('../../../../src/services/web-dashboard');
    instanceTracker = require('../../../../src/services/instance-tracker');
    instanceTracker.getStatus.mockReturnValue({
      instanceId: 'inst-local',
      locationInfo: { ip: '198.51.100.4', city: 'Leeds', country: 'GB' },
    });
    service.discordClient = { guilds: { cache: { size: 3 } } };
    fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('unexpected fetch'));
    callback = jest.fn();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    delete process.env.INSTANCE_TRACKING_SERVER;
    delete process.env.TRACKING_ADMIN_KEY;
    delete process.env.AUTHORIZED_IPS;
  });

  const configureTracking = () => {
    process.env.INSTANCE_TRACKING_SERVER = SERVER;
    process.env.TRACKING_ADMIN_KEY = FAKE_KEY;
  };

  describe('handleInstanceStatus', () => {
    it('returns the tracker status with a timestamp', () => {
      service.handleInstanceStatus(callback);

      expect(callback).toHaveBeenCalledWith({
        instanceId: 'inst-local',
        locationInfo: { ip: '198.51.100.4', city: 'Leeds', country: 'GB' },
        timestamp: NOW,
      });
    });

    it('reports tracking as disabled when the tracker throws', () => {
      instanceTracker.getStatus.mockImplementation(() => {
        throw new Error('tracker offline');
      });

      service.handleInstanceStatus(callback);
      expect(() => service.handleInstanceStatus(undefined)).not.toThrow();

      expect(callback).toHaveBeenCalledWith({
        error: 'tracker offline',
        trackingEnabled: false,
        isVerified: false,
      });
    });
  });

  describe('handleAllInstances', () => {
    it('ignores a request without an ack function', async () => {
      await service.handleAllInstances('not-a-function');

      expect(instanceTracker.getStatus).not.toHaveBeenCalled();
      expect(service.allLogs.at(-1).message).toBe('handleAllInstances called without callback');
    });

    it('returns only the local instance when tracking is not configured', async () => {
      await service.handleAllInstances(callback);

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(LOCAL_RESPONSE);
    });

    it('describes a local instance with no location or Discord client', async () => {
      instanceTracker.getStatus.mockReturnValue({});
      service.discordClient = null;

      await service.handleAllInstances(callback);

      expect(callback).toHaveBeenCalledWith({
        instances: [
          {
            ...LOCAL_INSTANCE,
            instanceId: 'local',
            ip: 'local',
            location: 'Local Network',
            guilds: 0,
          },
        ],
        myIp: 'local',
        authorizedIps: ['local'],
        trackingUnavailable: true,
      });
    });

    it('maps the tracking server list to the dashboard format', async () => {
      configureTracking();
      process.env.AUTHORIZED_IPS = '203.0.113.9, ,192.0.2.44';
      fetchSpy.mockResolvedValue(jsonResponse(true, REMOTE_INSTANCES));

      await service.handleAllInstances(callback);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith('https://track.example/api/instances', {
        headers: { Authorization: `Bearer ${FAKE_KEY}` },
      });
      expect(callback).toHaveBeenCalledWith({
        instances: MAPPED_INSTANCES,
        myIp: '198.51.100.4',
        authorizedIps: ['203.0.113.9', '192.0.2.44', '198.51.100.4'],
      });
    });

    it.each([
      ['the tracking server refuses', () => fetchSpy.mockResolvedValue(jsonResponse(false, {}))],
      ['the tracking server is unreachable', () => fetchSpy.mockRejectedValue(new Error('down'))],
    ])('falls back to the local instance when %s', async (_name, arrange) => {
      configureTracking();
      arrange();

      await service.handleAllInstances(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(LOCAL_RESPONSE);
    });

    it('returns an empty error result when even the local status fails', async () => {
      instanceTracker.getStatus.mockImplementation(() => {
        throw new Error('tracker offline');
      });

      await service.handleAllInstances(callback);

      expect(callback).toHaveBeenCalledWith({
        instances: [],
        myIp: 'unknown',
        authorizedIps: [],
        error: true,
      });
    });
  });

  describe('handleInstanceAction', () => {
    it.each([
      ['an unknown action', { action: 'delete', instanceId: 'a' }],
      ['a missing instance id', { action: 'approve' }],
    ])('rejects %s without calling the server', async (_name, data) => {
      configureTracking();

      await service.handleInstanceAction(data, callback);

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid action or instanceId',
      });
    });

    it('does not throw when the client sends no payload and no ack', async () => {
      configureTracking();

      await expect(service.handleInstanceAction(undefined, undefined)).resolves.toBeUndefined();

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('refuses when tracking is not configured', async () => {
      await service.handleInstanceAction({ action: 'revoke', instanceId: 'a' }, callback);

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith({ success: false, error: 'Tracking not configured' });
    });

    it.each([
      ['approve', 'https://track.example/api/approve'],
      ['revoke', 'https://track.example/api/revoke'],
    ])('posts %s to the tracking server', async (action, url) => {
      configureTracking();
      fetchSpy.mockResolvedValue(jsonResponse(true, { success: true }));

      await service.handleInstanceAction({ action, instanceId: 'inst-9' }, callback);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${FAKE_KEY}` },
        body: '{"instanceId":"inst-9"}',
      });
      expect(callback).toHaveBeenCalledWith({ success: true });
      expect(service.allLogs.at(-1).message).toBe(`Instance ${action}d: inst-9`);
    });

    it.each([
      [
        'the server error',
        jsonResponse(false, { error: 'Instance not found' }),
        'Instance not found',
      ],
      ['a generic error when the server gives none', jsonResponse(true, {}), 'Action failed'],
    ])('reports %s', async (_name, response, error) => {
      configureTracking();
      fetchSpy.mockResolvedValue(response);

      await service.handleInstanceAction({ action: 'revoke', instanceId: 'inst-9' }, callback);

      expect(callback).toHaveBeenCalledWith({ success: false, error });
    });

    it('reports a network failure', async () => {
      configureTracking();
      fetchSpy.mockRejectedValue(new Error('connect ECONNREFUSED'));

      await service.handleInstanceAction({ action: 'approve', instanceId: 'inst-9' }, callback);

      expect(callback).toHaveBeenCalledWith({ success: false, error: 'connect ECONNREFUSED' });
    });
  });
});
