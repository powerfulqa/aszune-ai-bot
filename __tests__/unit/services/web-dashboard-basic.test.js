/**
 * Web Dashboard Service - Basic Tests
 * Tests for web dashboard service basic functionality
 */

// Mock express, http, and socket.io BEFORE requiring the service
jest.mock('express', () => {
  const mockApp = {
    use: jest.fn().mockReturnThis(),
    get: jest.fn().mockReturnThis(),
    post: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    listen: jest.fn(),
  };
  const express = jest.fn(() => mockApp);
  express.static = jest.fn(() => jest.fn());
  express.json = jest.fn(() => jest.fn());
  return express;
});

jest.mock('http', () => ({
  createServer: jest.fn(() => ({
    listen: jest.fn((port, callback) => {
      if (callback) callback();
    }),
    close: jest.fn((callback) => {
      if (callback) callback();
    }),
    on: jest.fn(),
    once: jest.fn(),
    removeAllListeners: jest.fn(),
    address: jest.fn(() => ({ port: 3000 })),
  })),
}));

jest.mock('socket.io', () => {
  const _mockSocket = {
    id: 'test-socket-id',
    on: jest.fn(),
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
  };
  const mockIo = {
    on: jest.fn((event, callback) => {
      if (event === 'connection') {
        // Store for later use but don't call immediately
        mockIo._connectionHandler = callback;
      }
    }),
    emit: jest.fn(),
    close: jest.fn((callback) => {
      if (callback) callback();
    }),
    sockets: { sockets: new Map() },
  };
  return jest.fn(() => mockIo);
});

// Mock dependencies BEFORE requiring the service
jest.mock('../../../src/services/database', () => ({
  getUserStats: jest.fn().mockReturnValue({ message_count: 10, last_active: new Date() }),
  getLeaderboard: jest.fn().mockReturnValue([]),
  getReminders: jest.fn().mockReturnValue([]),
  addReminder: jest.fn().mockResolvedValue({ id: 1 }),
  deleteReminder: jest.fn().mockResolvedValue(true),
  updateReminder: jest.fn().mockResolvedValue(true),
  getAllUsers: jest.fn().mockReturnValue([]),
}));

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../../src/utils/error-handler', () => ({
  ErrorHandler: {
    handleError: jest.fn().mockImplementation((error) => ({
      message: error.message || 'An unexpected error occurred',
    })),
  },
}));

jest.mock('../../../src/services/network-detector', () => {
  return jest.fn().mockImplementation(() => ({
    detect: jest.fn().mockResolvedValue({ type: 'dhcp', ip: '192.168.1.100' }),
    getNetworkInfo: jest.fn().mockResolvedValue({ interfaces: [] }),
  }));
});

jest.mock('../../../src/utils/cache-stats-helper', () => ({
  getEmptyCacheStats: jest.fn().mockReturnValue({
    hits: 0,
    misses: 0,
    hitRate: '0%',
    size: 0,
  }),
}));

// Mock route modules - they export objects with register functions
jest.mock('../../../src/services/web-dashboard/routes/configRoutes', () => ({
  registerConfigRoutes: jest.fn(),
}));
jest.mock('../../../src/services/web-dashboard/routes/logRoutes', () => ({
  registerLogRoutes: jest.fn(),
}));
jest.mock('../../../src/services/web-dashboard/routes/networkRoutes', () => ({
  registerNetworkRoutes: jest.fn(),
}));
jest.mock('../../../src/services/web-dashboard/routes/reminderRoutes', () => ({
  registerReminderRoutes: jest.fn(),
}));
jest.mock('../../../src/services/web-dashboard/routes/serviceRoutes', () => ({
  registerServiceRoutes: jest.fn(),
}));
jest.mock('../../../src/services/web-dashboard/routes/recommendationRoutes', () => ({
  registerRecommendationRoutes: jest.fn(),
}));
jest.mock('../../../src/services/web-dashboard/routes/controlRoutes', () => ({
  registerControlRoutes: jest.fn(),
}));

// Import the class (named export), not the singleton instance (default export)
const { WebDashboardService } = require('../../../src/services/web-dashboard');
const _logger = require('../../../src/utils/logger');
const { execPromise } = require('../../../src/utils/shell-exec-helper');

jest.mock('../../../src/utils/shell-exec-helper', () => ({ execPromise: jest.fn() }));

describe('Dashboard port retries', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    service = new WebDashboardService();
    jest.spyOn(service, '_createServerListener');
    jest.spyOn(service, '_bindToFallbackPort').mockResolvedValue(3005);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('uses the preferred port immediately when it is available', async () => {
    service._createServerListener.mockResolvedValueOnce();

    await expect(service.bindServerWithRetry(3000)).resolves.toBe(3000);
    expect(service._createServerListener).toHaveBeenCalledTimes(1);
    expect(service._bindToFallbackPort).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('falls back after the last failed attempt without running shell commands', async () => {
    service._createServerListener.mockRejectedValue(
      Object.assign(new Error('Busy'), { code: 'EADDRINUSE' })
    );
    const pending = service.bindServerWithRetry(3000);

    await jest.runAllTimersAsync();

    await expect(pending).resolves.toBe(3005);
    expect(service._createServerListener).toHaveBeenCalledTimes(3);
    expect(service._createServerListener).toHaveBeenCalledWith(3000, service.bindHost);
    expect(service._bindToFallbackPort).toHaveBeenCalledWith(3000, 3);
    expect(execPromise).not.toHaveBeenCalled();
  });

  it('keeps the preferred port when a retry succeeds', async () => {
    service._createServerListener
      .mockRejectedValueOnce(Object.assign(new Error('Busy'), { code: 'EADDRINUSE' }))
      .mockResolvedValueOnce();
    const pending = service.bindServerWithRetry(3000);

    await jest.runAllTimersAsync();

    await expect(pending).resolves.toBe(3000);
    expect(service._createServerListener).toHaveBeenCalledTimes(2);
    expect(service._bindToFallbackPort).not.toHaveBeenCalled();
    expect(execPromise).not.toHaveBeenCalled();
  });

  it('does not retry non-port errors', async () => {
    const error = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
    service._createServerListener.mockRejectedValueOnce(error);

    await expect(service.bindServerWithRetry(3000)).rejects.toBe(error);
    expect(service._createServerListener).toHaveBeenCalledTimes(1);
    expect(service._bindToFallbackPort).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('propagates fallback errors', async () => {
    const error = new Error('Fallback unavailable');
    service._createServerListener.mockRejectedValueOnce({ code: 'EADDRINUSE' });
    service._bindToFallbackPort.mockRejectedValueOnce(error);

    await expect(service.bindServerWithRetry(3000, 1)).rejects.toBe(error);
    expect(execPromise).not.toHaveBeenCalled();
  });

  it('falls back after repeated listen timeouts', async () => {
    service._createServerListener.mockRejectedValue(new Error('Server listen timeout'));
    const pending = service.bindServerWithRetry(3000);

    await jest.runAllTimersAsync();

    await expect(pending).resolves.toBe(3005);
    expect(service._createServerListener).toHaveBeenCalledTimes(3);
    expect(service._bindToFallbackPort).toHaveBeenCalledTimes(1);
    expect(service._bindToFallbackPort).toHaveBeenCalledWith(3000, 3);
    expect(execPromise).not.toHaveBeenCalled();
  });
});

describe('Dashboard listen lifecycle', () => {
  let service;
  let existingErrorHandler;

  beforeEach(() => {
    jest.useFakeTimers();
    service = new WebDashboardService();
    service.server = new (require('events').EventEmitter)();
    service.server.listen = jest.fn();
    existingErrorHandler = jest.fn();
    service.server.on('error', existingErrorHandler);
  });

  afterEach(() => jest.useRealTimers());

  it('cleans up failed attempts without removing other error handlers', async () => {
    const error = Object.assign(new Error('Busy'), { code: 'EADDRINUSE' });
    const pending = service._createServerListener(3000, '127.0.0.1');
    const signal = service.server.listen.mock.calls[0][0].signal;
    service.server.emit('error', error);

    await expect(pending).rejects.toBe(error);
    expect(signal.aborted).toBe(true);
    expect(service.server.listeners('error')).toEqual([existingErrorHandler]);
    expect(service.server.listenerCount('listening')).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cleans up after successful listening without aborting the server', async () => {
    const pending = service._createServerListener(3000, '127.0.0.1');
    const signal = service.server.listen.mock.calls[0][0].signal;
    service.server.emit('listening');

    await expect(pending).resolves.toBeUndefined();
    expect(signal.aborted).toBe(false);
    expect(service.server.listeners('error')).toEqual([existingErrorHandler]);
    expect(service.server.listenerCount('listening')).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('aborts timed-out binds and cleans up its listeners', async () => {
    const pending = service._createServerListener(3000, '127.0.0.1', 50);
    const rejected = expect(pending).rejects.toThrow('Server listen timeout');
    const signal = service.server.listen.mock.calls[0][0].signal;

    await jest.advanceTimersByTimeAsync(50);
    await rejected;

    expect(signal.aborted).toBe(true);
    expect(service.server.listeners('error')).toEqual([existingErrorHandler]);
    expect(service.server.listenerCount('listening')).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cleans up synchronous listen errors', async () => {
    const error = new Error('Invalid port');
    service.server.listen.mockImplementationOnce(() => {
      throw error;
    });

    await expect(service._createServerListener(-1, '127.0.0.1')).rejects.toBe(error);
    expect(service.server.listeners('error')).toEqual([existingErrorHandler]);
    expect(service.server.listenerCount('listening')).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('WebDashboardService - Basic Operations', () => {
  let dashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    dashboardService = new WebDashboardService();
  });

  afterEach(async () => {
    if (dashboardService && dashboardService.isRunning) {
      await dashboardService.stop();
    }
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(dashboardService.app).toBeNull();
      expect(dashboardService.server).toBeNull();
      expect(dashboardService.io).toBeNull();
      expect(dashboardService.isRunning).toBe(false);
      expect(dashboardService.errorLogs).toEqual([]);
      expect(dashboardService.maxErrorLogs).toBe(75);
      expect(dashboardService.discordClient).toBeNull();
    });

    it('should initialize username cache as Map', () => {
      expect(dashboardService.usernameCache).toBeInstanceOf(Map);
    });

    it('should initialize log watchers as Set', () => {
      expect(dashboardService.logWatchers).toBeInstanceOf(Set);
    });
  });

  describe('findAvailablePort', () => {
    it('should find an available port', async () => {
      const port = await dashboardService.findAvailablePort();
      expect(typeof port).toBe('number');
      expect(port).toBeGreaterThan(0);
      expect(port).toBeLessThan(65536);
    });
  });

  describe('_isPortInUseError', () => {
    it('should return true for EADDRINUSE error code', () => {
      const error = { code: 'EADDRINUSE' };
      expect(dashboardService._isPortInUseError(error)).toBe(true);
    });

    it('should return true for EADDRINUSE in message', () => {
      const error = { message: 'Error: EADDRINUSE' };
      expect(dashboardService._isPortInUseError(error)).toBe(true);
    });

    it('should return true for address already in use', () => {
      const error = { message: 'address already in use' };
      expect(dashboardService._isPortInUseError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = { code: 'ENOENT', message: 'File not found' };
      expect(dashboardService._isPortInUseError(error)).toBe(false);
    });

    it('should handle null/undefined errors', () => {
      // Function returns falsy (undefined) for non-matching errors
      expect(dashboardService._isPortInUseError({})).toBeFalsy();
      expect(dashboardService._isPortInUseError({ code: null })).toBeFalsy();
    });
  });

  describe('start', () => {
    // Note: Full start/stop integration tests are in integration tests folder
    // These unit tests verify logic without actual server binding

    it('should return early if already running', async () => {
      // Verify the guard behavior works - isRunning should prevent re-setup
      dashboardService.isRunning = true;
      const originalApp = dashboardService.app;

      await dashboardService.start(); // Should return early without changes

      // App should remain unchanged (null) because it returned early
      expect(dashboardService.app).toBe(originalApp);
    });

    it('should have start method defined', () => {
      expect(typeof dashboardService.start).toBe('function');
    });
  });

  describe('stop', () => {
    it('should do nothing if not running', async () => {
      await dashboardService.stop(); // Should not throw
      expect(dashboardService.isRunning).toBe(false);
    });

    it('should have stop method defined', () => {
      expect(typeof dashboardService.stop).toBe('function');
    });
  });

  describe('setDiscordClient', () => {
    it('should set the Discord client', () => {
      const mockClient = { user: { id: '123' } };
      dashboardService.setDiscordClient(mockClient);

      expect(dashboardService.discordClient).toBe(mockClient);
    });
  });
});

describe('WebDashboardService - Error Handling', () => {
  let dashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    dashboardService = new WebDashboardService();
  });

  afterEach(async () => {
    if (dashboardService && dashboardService.isRunning) {
      await dashboardService.stop();
    }
  });

  describe('error log buffering', () => {
    it('should buffer error logs up to maxErrorLogs', () => {
      // Simulate adding error logs
      for (let i = 0; i < 100; i++) {
        dashboardService.errorLogs.push({ message: `Error ${i}`, timestamp: Date.now() });
        if (dashboardService.errorLogs.length > dashboardService.maxErrorLogs) {
          dashboardService.errorLogs.shift();
        }
      }

      expect(dashboardService.errorLogs.length).toBeLessThanOrEqual(dashboardService.maxErrorLogs);
    });
  });

  describe('all log buffering', () => {
    it('should buffer all logs up to maxAllLogs', () => {
      // Simulate adding logs
      for (let i = 0; i < 600; i++) {
        dashboardService.allLogs.push({
          level: 'INFO',
          message: `Log ${i}`,
          timestamp: Date.now(),
        });
        if (dashboardService.allLogs.length > dashboardService.maxAllLogs) {
          dashboardService.allLogs.shift();
        }
      }

      expect(dashboardService.allLogs.length).toBeLessThanOrEqual(dashboardService.maxAllLogs);
    });
  });
});

describe('WebDashboardService - Helper Methods', () => {
  let dashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    dashboardService = new WebDashboardService();
  });

  describe('external IP caching', () => {
    beforeEach(() => {
      // jest.setup.js resets modules per test: build the service from the same
      // module registry as the cache we clear, so they share one store.
      const { WebDashboardService: FreshService } = require('../../../src/services/web-dashboard');
      require('../../../src/utils/cached').invalidate();
      dashboardService = new FreshService();
    });

    it('looks the IP up once and shares it between callers', async () => {
      const fetchSpy = jest
        .spyOn(dashboardService, '_fetchExternalIp')
        .mockResolvedValue('203.0.113.10');

      const [a, b] = await Promise.all([
        dashboardService.getExternalIp(),
        dashboardService.getExternalIp(),
      ]);
      const c = await dashboardService.getExternalIp();

      expect([a, b, c]).toEqual(['203.0.113.10', '203.0.113.10', '203.0.113.10']);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('remembers a failed lookup instead of retrying every poll', async () => {
      const fetchSpy = jest
        .spyOn(dashboardService, '_fetchExternalIp')
        .mockRejectedValue(new Error('offline'));

      await expect(dashboardService.getExternalIp()).rejects.toThrow('offline');
      await expect(dashboardService.getExternalIp()).rejects.toThrow('offline');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('username cache', () => {
    it('should cache usernames', () => {
      dashboardService.usernameCache.set('123', 'TestUser');
      expect(dashboardService.usernameCache.get('123')).toBe('TestUser');
    });

    it('should return undefined for uncached users', () => {
      expect(dashboardService.usernameCache.get('unknown')).toBeUndefined();
    });
  });
});
