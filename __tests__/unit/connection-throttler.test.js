const connectionThrottler = require('../../src/utils/connection-throttler');
const logger = require('../../src/utils/logger');
const _config = require('../../src/config/config');

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/config/config', () => ({
  PI_OPTIMIZATIONS: {
    ENABLED: true,
    MAX_CONCURRENT_CONNECTIONS: 2,
  },
}));

describe('Connection Throttler', () => {
  // Reset mocks between tests
  beforeEach(() => {
    jest.clearAllMocks();
    connectionThrottler.activeConnections = 0;
    connectionThrottler.connectionQueue = [];
    connectionThrottler.maxConnections = 2;
  });

  describe('executeRequest', () => {
    it('should execute requests immediately when under max connections', async () => {
      // Mock successful request
      const mockRequest = jest.fn().mockResolvedValue('success');

      const result = await connectionThrottler.executeRequest(mockRequest, 'TEST');

      expect(result).toBe('success');
      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Starting TEST request'));
    });

    it('should queue requests when at max connections', async () => {
      // Set up throttler to be at max connections
      connectionThrottler.activeConnections = 2;

      const mockRequest = jest.fn().mockResolvedValue('queued success');

      // Start a request that should be queued
      const requestPromise = connectionThrottler.executeRequest(mockRequest, 'QUEUED');

      // The request should be queued, not executed yet
      expect(mockRequest).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Queueing QUEUED request'));

      // Simulate a connection finishing
      connectionThrottler.activeConnections = 1;
      connectionThrottler._processQueue();

      // Now the queued request should execute
      const result = await requestPromise;
      expect(result).toBe('queued success');
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('should handle errors in requests', async () => {
      // Mock failed request
      const testError = new Error('Test error');
      const mockRequest = jest.fn().mockRejectedValue(testError);

      await expect(connectionThrottler.executeRequest(mockRequest, 'ERROR')).rejects.toThrow(
        testError
      );

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in ERROR request'),
        testError
      );
      expect(connectionThrottler.activeConnections).toBe(0);
    });

    it('should process next queue item after completion', async () => {
      // Mock two requests
      const firstRequest = jest.fn().mockResolvedValue('first');
      const secondRequest = jest.fn().mockResolvedValue('second');

      // Execute first request to occupy one slot
      const firstPromise = connectionThrottler.executeRequest(firstRequest, 'FIRST');

      // Set connections to max to simulate busy throttler
      connectionThrottler.activeConnections = 2;

      // Queue second request
      const secondPromise = connectionThrottler.executeRequest(secondRequest, 'SECOND');

      // Verify second request is queued
      expect(secondRequest).not.toHaveBeenCalled();

      // Complete first request
      await firstPromise;

      // Second request should now execute and complete
      const secondResult = await secondPromise;
      expect(secondResult).toBe('second');
    });
  });

  describe('clearQueue', () => {
    it('should clear all queued requests', () => {
      // Add some mock tasks to the queue
      connectionThrottler.connectionQueue = [jest.fn(), jest.fn(), jest.fn()];

      connectionThrottler.clearQueue();

      expect(connectionThrottler.connectionQueue).toHaveLength(0);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cleared 3 pending requests')
      );
    });
  });
});
