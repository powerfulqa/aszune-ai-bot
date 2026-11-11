jest.mock('child_process', () => ({
  exec: jest.fn(),
  execFile: jest.fn(),
}));

jest.mock('../../../src/utils/pm2-service', () => ({
  ...jest.requireActual('../../../src/utils/pm2-service'),
  runPm2ServiceAction: jest.fn(),
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

  it('restarts through pm2-service and returns a success response', async () => {
    const pm2Service = require('../../../src/utils/pm2-service');
    pm2Service.runPm2ServiceAction.mockResolvedValue('ok');
    const { WebDashboardService } = require('../../../src/services/web-dashboard');
    const service = new WebDashboardService();

    const result = await service._attemptRestart();

    expect(pm2Service.runPm2ServiceAction).toHaveBeenCalledWith('aszune-ai', 'restart');
    expect(result.success).toBe(true);
    expect(result.message).toBe('Bot restart initiated via PM2 aszune-ai');
  });

  it('never shells out to systemctl and exits when PM2 fails', async () => {
    const { exec } = require('child_process');
    const pm2Service = require('../../../src/utils/pm2-service');
    pm2Service.runPm2ServiceAction.mockRejectedValue(new Error('pm2 not found'));
    const { WebDashboardService } = require('../../../src/services/web-dashboard');
    const service = new WebDashboardService();
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

    jest.useFakeTimers();
    try {
      const result = await service._attemptRestart();

      expect(result.message).toBe('Bot restart initiated (fallback mode)');
      expect(exec).not.toHaveBeenCalled();
      expect(exitSpy).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1000);
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      exitSpy.mockRestore();
      jest.useRealTimers();
    }
  });
});
