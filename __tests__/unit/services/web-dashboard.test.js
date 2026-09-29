jest.mock('child_process', () => ({
  exec: jest.fn(),
  execFile: jest.fn(),
}));

jest.mock('../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../src/utils/error-handler', () => ({
  ErrorHandler: {
    handleError: jest.fn(() => ({ message: 'An unexpected error occurred.' })),
  },
}));

describe('WebDashboardService - Real Port Conflict', () => {
  it('serves on a fallback port while leaving the original server reachable', async () => {
    const http = require('http');
    const { WebDashboardService } = require('../../../src/services/web-dashboard');
    const service = new WebDashboardService();
    service.bindHost = '127.0.0.1';
    const occupied = http.createServer((request, response) => response.end('original service'));
    service.server = http.createServer((request, response) => response.end('dashboard'));
    const existingErrorListeners = service.server.listeners('error');
    const existingListeningListeners = service.server.listeners('listening');

    try {
      await new Promise((resolve, reject) => {
        occupied.once('error', reject);
        occupied.listen(0, '127.0.0.1', resolve);
      });
      const preferredPort = occupied.address().port;
      const port = await service.bindServerWithRetry(preferredPort, 1);

      expect(port).not.toBe(preferredPort);
      expect(service.server.address().address).toBe('127.0.0.1');
      const originalResponse = await fetch(`http://127.0.0.1:${preferredPort}`, {
        signal: AbortSignal.timeout(5000),
      });
      expect(await originalResponse.text()).toBe('original service');
      const dashboardResponse = await fetch(`http://127.0.0.1:${port}`, {
        signal: AbortSignal.timeout(5000),
      });
      expect(await dashboardResponse.text()).toBe('dashboard');
      expect(service.server.listeners('error')).toEqual(existingErrorListeners);
      expect(service.server.listeners('listening')).toEqual(existingListeningListeners);
      expect(require('child_process').exec).not.toHaveBeenCalled();
      expect(require('child_process').execFile).not.toHaveBeenCalled();
    } finally {
      occupied.closeAllConnections();
      service.server.closeAllConnections();
      await Promise.all([
        new Promise((resolve) => occupied.close(resolve)),
        new Promise((resolve) => service.server.close(resolve)),
      ]);
    }
  });
});

describe('WebDashboardService - Restart Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SERVICE_NAME;
    delete process.env.name;
  });

  it('destroys Discord client connection if present', async () => {
    const { WebDashboardService } = require('../../../src/services/web-dashboard');
    const service = new WebDashboardService();

    service.discordClient = {
      destroy: jest.fn().mockResolvedValue(undefined),
    };

    jest.spyOn(service, '_attemptRestart').mockResolvedValue({
      success: true,
      message: 'ok',
      timestamp: new Date().toISOString(),
    });

    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    await service._handleRestartRequest(res);

    expect(service.discordClient.destroy).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
      })
    );
  });

  it('attempts PM2 restart first and returns success response when it works', async () => {
    const { exec } = require('child_process');
    exec.mockImplementation((command, options, callback) => callback(null, 'ok', ''));

    const { WebDashboardService } = require('../../../src/services/web-dashboard');
    const service = new WebDashboardService();

    process.env.name = 'aszune-ai';

    const result = await service._attemptRestart();

    expect(exec).toHaveBeenCalledWith(
      'pm2 restart aszune-ai',
      expect.objectContaining({ timeout: 10000 }),
      expect.any(Function)
    );
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        message: 'Bot restart initiated via PM2 aszune-ai',
      })
    );
  });

  it('falls back to process exit when restart commands fail', async () => {
    const { exec } = require('child_process');
    exec.mockImplementation((command, options, callback) => callback(new Error('nope')));

    const { WebDashboardService } = require('../../../src/services/web-dashboard');
    const service = new WebDashboardService();

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

    jest.useFakeTimers();
    try {
      const result = await service._attemptRestart();

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Bot restart initiated (fallback mode)',
        })
      );

      expect(exitSpy).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1000);
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      exitSpy.mockRestore();
      jest.useRealTimers();
    }
  });
});
