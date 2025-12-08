/**
 * Tests for Instance Tracker Client Info Helper
 *
 * @jest-environment node
 */

const os = require('os');

// Mock os module
jest.mock('os', () => ({
  hostname: jest.fn(),
  platform: jest.fn(),
  arch: jest.fn(),
  cpus: jest.fn(),
  totalmem: jest.fn(),
  freemem: jest.fn(),
  uptime: jest.fn(),
  networkInterfaces: jest.fn(),
}));

const {
  gatherClientInfo,
  generateInstanceKey,
  getBotIdentity,
  getServerStats,
  getSystemInfo,
  getProcessInfo,
} = require('../../../src/services/instance-tracker/helpers/client-info');

describe('client-info helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default os mocks
    os.hostname.mockReturnValue('test-host');
    os.platform.mockReturnValue('linux');
    os.arch.mockReturnValue('arm64');
    os.cpus.mockReturnValue([{ model: 'ARM Cortex-A76' }]);
    os.totalmem.mockReturnValue(4 * 1024 * 1024 * 1024); // 4GB
    os.freemem.mockReturnValue(2 * 1024 * 1024 * 1024); // 2GB
    os.uptime.mockReturnValue(86400); // 1 day
    os.networkInterfaces.mockReturnValue({
      eth0: [{ mac: '00:11:22:33:44:55', internal: false }],
    });
  });

  describe('getBotIdentity', () => {
    it('should return bot identity from client', () => {
      const mockClient = {
        user: {
          id: '123456789',
          username: 'TestBot',
          tag: 'TestBot#1234',
        },
      };

      const result = getBotIdentity(mockClient);

      expect(result).toEqual({
        botId: '123456789',
        botUsername: 'TestBot',
        botTag: 'TestBot#1234',
      });
    });

    it('should return unknown for null client', () => {
      const result = getBotIdentity(null);

      expect(result).toEqual({
        botId: 'unknown',
        botUsername: 'unknown',
        botTag: 'unknown',
      });
    });

    it('should return unknown for client without user', () => {
      const result = getBotIdentity({});

      expect(result).toEqual({
        botId: 'unknown',
        botUsername: 'unknown',
        botTag: 'unknown',
      });
    });
  });

  describe('getServerStats', () => {
    it('should return server statistics', () => {
      const mockClient = {
        guilds: { cache: { size: 10 } },
        users: { cache: { size: 500 } },
        channels: { cache: { size: 50 } },
      };

      const result = getServerStats(mockClient);

      expect(result).toEqual({
        guildCount: 10,
        userCount: 500,
        channelCount: 50,
      });
    });

    it('should return zeros for null client', () => {
      const result = getServerStats(null);

      expect(result).toEqual({
        guildCount: 0,
        userCount: 0,
        channelCount: 0,
      });
    });
  });

  describe('getSystemInfo', () => {
    it('should return system information', () => {
      const result = getSystemInfo();

      expect(result).toEqual({
        hostname: 'test-host',
        platform: 'linux',
        arch: 'arm64',
        cpus: 1,
        totalMemoryMb: 4096,
        freeMemoryMb: 2048,
        osUptime: 86400,
      });
    });

    it('should handle empty CPU array', () => {
      os.cpus.mockReturnValue([]);

      const result = getSystemInfo();

      expect(result.cpus).toBe(0);
    });
  });

  describe('getProcessInfo', () => {
    it('should return process information', () => {
      const result = getProcessInfo();

      expect(result).toHaveProperty('pid');
      expect(result).toHaveProperty('processUptime');
      expect(typeof result.pid).toBe('number');
      expect(typeof result.processUptime).toBe('number');
    });
  });

  describe('generateInstanceKey', () => {
    it('should generate a 32-character hash', () => {
      const result = generateInstanceKey();

      expect(result).toHaveLength(32);
      expect(result).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate consistent keys for same hardware', () => {
      const key1 = generateInstanceKey();
      const key2 = generateInstanceKey();

      expect(key1).toBe(key2);
    });

    it('should find MAC from eth0', () => {
      os.networkInterfaces.mockReturnValue({
        eth0: [{ mac: 'aa:bb:cc:dd:ee:ff', internal: false }],
      });

      const result = generateInstanceKey();

      expect(result).toHaveLength(32);
    });

    it('should find MAC from en0 (macOS)', () => {
      os.networkInterfaces.mockReturnValue({
        en0: [{ mac: 'aa:bb:cc:dd:ee:ff', internal: false }],
      });

      const result = generateInstanceKey();

      expect(result).toHaveLength(32);
    });

    it('should find MAC from wlan0', () => {
      os.networkInterfaces.mockReturnValue({
        wlan0: [{ mac: 'aa:bb:cc:dd:ee:ff', internal: false }],
      });

      const result = generateInstanceKey();

      expect(result).toHaveLength(32);
    });

    it('should fallback to any external interface', () => {
      os.networkInterfaces.mockReturnValue({
        someInterface: [{ mac: 'aa:bb:cc:dd:ee:ff', internal: false }],
      });

      const result = generateInstanceKey();

      expect(result).toHaveLength(32);
    });

    it('should use unknown when no MAC available', () => {
      os.networkInterfaces.mockReturnValue({});

      const result = generateInstanceKey();

      expect(result).toHaveLength(32);
    });

    it('should skip internal interfaces', () => {
      os.networkInterfaces.mockReturnValue({
        lo: [{ mac: '00:00:00:00:00:00', internal: true }],
      });

      const result = generateInstanceKey();

      expect(result).toHaveLength(32);
    });
  });

  describe('gatherClientInfo', () => {
    it('should gather all client information', async () => {
      const mockClient = {
        user: {
          id: '123',
          username: 'TestBot',
          tag: 'TestBot#1234',
        },
        guilds: { cache: { size: 5 } },
        users: { cache: { size: 100 } },
        channels: { cache: { size: 20 } },
      };

      const result = await gatherClientInfo(mockClient);

      expect(result).toHaveProperty('botId', '123');
      expect(result).toHaveProperty('botTag', 'TestBot#1234');
      expect(result).toHaveProperty('guildCount', 5);
      expect(result).toHaveProperty('hostname', 'test-host');
      expect(result).toHaveProperty('platform', 'linux');
      expect(result).toHaveProperty('pid');
      expect(result).toHaveProperty('startTime');
      expect(result).toHaveProperty('timezone');
    });
  });
});
