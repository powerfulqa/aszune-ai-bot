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

  describe('module loading with disabled tracking', () => {
    beforeEach(() => {
      jest.resetModules();
      process.env.INSTANCE_TRACKING_ENABLED = 'false';
      delete process.env.INSTANCE_TRACKING_SERVER;
    });

    it('should return true when tracking is disabled', async () => {
      const instanceTracker = require('../../../src/services/instance-tracker');

      const mockClient = { user: { tag: 'TestBot#1234' } };
      const result = await instanceTracker.initialize(mockClient);

      expect(result).toBe(true);
      
      // Clean up
      instanceTracker.stop();
    });

    it('should report tracking as disabled in status', () => {
      const instanceTracker = require('../../../src/services/instance-tracker');

      const status = instanceTracker.getStatus();

      expect(status.trackingEnabled).toBe(false);
      expect(status.isVerified).toBe(false);
      expect(status.instanceId).toBeNull();
    });

    it('should return false for isVerificationRequired when not set', () => {
      delete process.env.REQUIRE_VERIFICATION;
      jest.resetModules();
      
      const instanceTracker = require('../../../src/services/instance-tracker');
      
      expect(instanceTracker.isVerificationRequired()).toBe(false);
    });

    it('should return true for isVerificationRequired when set', () => {
      process.env.REQUIRE_VERIFICATION = 'true';
      jest.resetModules();
      
      const instanceTracker = require('../../../src/services/instance-tracker');
      
      expect(instanceTracker.isVerificationRequired()).toBe(true);
    });
  });

  describe('stop', () => {
    beforeEach(() => {
      jest.resetModules();
      process.env.INSTANCE_TRACKING_ENABLED = 'false';
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
      process.env.INSTANCE_TRACKING_ENABLED = 'false';
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
});
