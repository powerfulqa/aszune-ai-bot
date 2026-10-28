/**
 * Tests for Instance Tracker Service
 *
 * @jest-environment node
 */

// Mock logger before imports
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('InstanceTracker', () => {
  let originalEnv;

  beforeEach(() => {
    jest.clearAllMocks();

    // Save original env
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('module loading with tracking enabled (default)', () => {
    beforeEach(() => {
      jest.resetModules();
      // Mock fetch to simulate failed connection (no retries needed)
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: jest.fn().mockResolvedValue({ error: 'Service unavailable' }),
      });
    });

    it('should return false when tracking server is unreachable', async () => {
      jest.resetModules();

      const instanceTracker = require('../../../src/services/instance-tracker');

      const mockClient = {
        user: { tag: 'TestBot#1234', username: 'TestBot', id: '123' },
        guilds: { cache: { size: 0 } },
        users: { cache: { size: 0 } },
      };
      const result = await instanceTracker.initialize(mockClient);

      // Returns false when server returns error
      expect(result).toBe(false);

      // Clean up
      instanceTracker.stop();
    }, 30000); // 30 second timeout for retries

    it('should report tracking status correctly', () => {
      jest.resetModules();
      const instanceTracker = require('../../../src/services/instance-tracker');

      const status = instanceTracker.getStatus();

      // Tracking is enabled by default
      expect(status.trackingEnabled).toBe(true);
      expect(status.isVerified).toBe(false); // Not verified until registered
      expect(status.instanceId).toBeNull();
    });

    it('should always require verification by default', () => {
      delete process.env.REQUIRE_VERIFICATION;
      jest.resetModules();

      const instanceTracker = require('../../../src/services/instance-tracker');

      // Now defaults to true
      expect(instanceTracker.isVerificationRequired()).toBe(true);
    });

    it('should require verification regardless of env var', () => {
      process.env.REQUIRE_VERIFICATION = 'false'; // Should be ignored
      jest.resetModules();

      const instanceTracker = require('../../../src/services/instance-tracker');

      // Always true now
      expect(instanceTracker.isVerificationRequired()).toBe(true);
    });
  });

  describe('stop', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    it('should handle stop when no timer exists', () => {
      const instanceTracker = require('../../../src/services/instance-tracker');

      // Should not throw
      expect(() => instanceTracker.stop()).not.toThrow();
    });
  });

  describe('getStatus structure', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    it('should return expected status structure', () => {
      const instanceTracker = require('../../../src/services/instance-tracker');

      const status = instanceTracker.getStatus();

      expect(status).toHaveProperty('instanceId');
      expect(status).toHaveProperty('isVerified');
      expect(status).toHaveProperty('lastHeartbeat');
      expect(status).toHaveProperty('clientInfo');
      expect(status).toHaveProperty('locationInfo');
      expect(status).toHaveProperty('trackingEnabled');
      expect(status).toHaveProperty('trackingServer');
    });
  });

  describe('heartbeat revocation', () => {
    it('should shut down when the tracker answers 404 revoked', async () => {
      jest.resetModules();
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: jest.fn().mockResolvedValue({
          error: 'Instance not found',
          revoked: true,
          authorized: false,
        }),
      });
      const instanceTracker = require('../../../src/services/instance-tracker');
      instanceTracker.isVerified = true;
      instanceTracker.instanceId = 'inst_test';
      const revokeSpy = jest
        .spyOn(instanceTracker, '_handleRevocation')
        .mockImplementation(() => {});

      const result = await instanceTracker._sendHeartbeat(null);

      expect(result).toBe(false);
      expect(revokeSpy).toHaveBeenCalledWith(null, 'Instance has been REVOKED');
    });

    it('should not report success when the tracker gives no valid response', async () => {
      jest.resetModules();
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
      const instanceTracker = require('../../../src/services/instance-tracker');
      instanceTracker.isVerified = true;
      instanceTracker.instanceId = 'inst_test';

      await expect(instanceTracker._sendHeartbeat(null)).resolves.toBe(false);
    });
  });
});
