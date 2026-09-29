const connectionThrottler = require('../../src/utils/connection-throttler');
const logger = require('../../src/utils/logger');

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/config/config', () => ({
  PI_OPTIMIZATIONS: {
    ENABLED: true,
    MAX_CONNECTIONS: 2,
  },
}));

describe('Throttling service integration', () => {
  it('shares the real singleton and queues requests beyond its connection limit', async () => {
    const { ThrottlingService } = require('../../src/services/throttling-service');
    const throttler = require('../../src/utils/connection-throttler');
    const service = new ThrottlingService();
    const otherService = new ThrottlingService();
    const first = Promise.withResolvers();
    const second = Promise.withResolvers();
    const queuedRequest = jest.fn().mockResolvedValue('third');

    expect(service.connectionThrottler).toBe(throttler);
    expect(otherService.connectionThrottler).toBe(throttler);
    expect(service.getThrottlerStatus()).toEqual({ enabled: true, available: true });

    const firstResult = service.executeWithThrottling(() => first.promise);
    const secondResult = service.executeWithThrottling(() => second.promise);
    const thirdResult = otherService.executeWithThrottling(queuedRequest);

    expect(throttler.activeConnections).toBe(2);
    expect(throttler.connectionQueue).toHaveLength(1);
    expect(queuedRequest).not.toHaveBeenCalled();

    first.resolve('first');
    second.resolve('second');
    await expect(Promise.all([firstResult, secondResult, thirdResult])).resolves.toEqual([
      'first',
      'second',
      'third',
    ]);
    expect(throttler.activeConnections).toBe(0);
    expect(throttler.connectionQueue).toHaveLength(0);
  });
});

describe('Connection Throttler', () => {
  // Reset mocks between tests
  beforeEach(() => {
    jest.clearAllMocks();
    connectionThrottler.activeConnections = 0;
    connectionThrottler.connectionQueue = [];
    connectionThrottler.maxConnections = 2;
    connectionThrottler.maxQueueLength = 20;
    connectionThrottler.queueTimeoutMs = 30000;
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
    it('should reject all queued requests without executing them', async () => {
      connectionThrottler.activeConnections = 2;
      const request = jest.fn();
      const pending = Array.from({ length: 3 }, () => connectionThrottler.executeRequest(request));
      const settled = Promise.allSettled(pending);

      connectionThrottler.clearQueue();

      const results = await settled;
      expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected', 'rejected']);
      expect(request).not.toHaveBeenCalled();
      expect(connectionThrottler.connectionQueue).toHaveLength(0);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cleared 3 pending requests')
      );
    });
  });

  describe('queue bounds', () => {
    it('rejects overload without growing the queue', async () => {
      connectionThrottler.activeConnections = 2;
      connectionThrottler.maxQueueLength = 1;
      const queuedRequest = jest.fn().mockResolvedValue('queued');
      const pending = connectionThrottler.executeRequest(queuedRequest);
      const rejectedRequest = jest.fn();

      await expect(connectionThrottler.executeRequest(rejectedRequest)).rejects.toThrow(
        'Request queue is full. Please try again shortly.'
      );
      expect(connectionThrottler.connectionQueue).toHaveLength(1);
      expect(rejectedRequest).not.toHaveBeenCalled();
      connectionThrottler.activeConnections = 1;
      connectionThrottler._processQueue();
      await expect(pending).resolves.toBe('queued');
    });

    it('expires queued requests without executing them later', async () => {
      jest.useFakeTimers();
      connectionThrottler.activeConnections = 2;
      const request = jest.fn();
      const pending = connectionThrottler.executeRequest(request);
      const rejected = expect(pending).rejects.toThrow(
        'Request expired while waiting. Please try again shortly.'
      );

      await jest.advanceTimersByTimeAsync(30000);
      await rejected;
      expect(connectionThrottler.connectionQueue).toHaveLength(0);
      connectionThrottler.activeConnections = 1;
      connectionThrottler._processQueue();
      expect(request).not.toHaveBeenCalled();
    });

    it('clears the queue deadline when execution starts', async () => {
      jest.useFakeTimers();
      connectionThrottler.activeConnections = 2;
      const request = Promise.withResolvers();
      const pending = connectionThrottler.executeRequest(() => request.promise);

      connectionThrottler.activeConnections = 1;
      connectionThrottler._processQueue();
      expect(jest.getTimerCount()).toBe(0);
      await jest.advanceTimersByTimeAsync(30000);
      request.resolve('completed');
      await expect(pending).resolves.toBe('completed');
    });
  });
});
