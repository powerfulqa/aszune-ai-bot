/**
 * Security tests for the dashboard REST layer:
 *  - without DASHBOARD_TOKEN the REST API is read-only (matches the socket rule)
 *  - service names from requests can't inject shell commands
 *  - config reads mask secrets; saves keep the real values behind the mask
 */

jest.mock('../../../../src/services/database', () => ({}));
jest.mock('../../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('child_process', () => ({
  exec: jest.fn(),
  execFile: jest.fn(),
  spawn: jest.fn(),
}));

const fsPromises = require('fs').promises;

// jest.setup.js resets modules before each test, so the mocked child_process
// the service sees is re-created too — take the reference after requiring it.
let childProcess;

/** Minimal Express response double */
function makeRes() {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((body) => {
    res.body = body;
    return res;
  });
  return res;
}

describe('dashboard REST security', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.DASHBOARD_TOKEN;
    service = require('../../../../src/services/web-dashboard');
    childProcess = require('child_process');
    childProcess.execFile.mockImplementation((file, args, opts, cb) =>
      cb(null, { stdout: 'line one\nline two\n', stderr: '' })
    );
  });

  describe('auth middleware without a token (read-only)', () => {
    beforeEach(() => {
      service.authToken = null;
    });

    it.each(['GET', 'HEAD', 'OPTIONS'])('allows %s', (method) => {
      const next = jest.fn();
      const res = makeRes();
      service._createAuthMiddleware()({ method, headers: {} }, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it.each(['POST', 'PUT', 'DELETE', 'PATCH'])('refuses %s with 403', (method) => {
      const next = jest.fn();
      const res = makeRes();
      service._createAuthMiddleware()({ method, headers: {} }, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('Dashboard is read-only: set DASHBOARD_TOKEN to enable changes');
    });
  });

  describe('auth middleware with a token', () => {
    beforeEach(() => {
      service.authToken = 'secret-token';
    });

    it('rejects a POST without a bearer token', () => {
      const next = jest.fn();
      const res = makeRes();
      service._createAuthMiddleware()({ method: 'POST', headers: {} }, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
    });

    it('allows a POST with the correct bearer token', () => {
      const next = jest.fn();
      const res = makeRes();
      service._createAuthMiddleware()(
        { method: 'POST', headers: { authorization: 'Bearer secret-token' } },
        res,
        next
      );
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('manageService', () => {
    it.each(['nginx; rm -rf /', 'a$(id)', '`reboot`', '--help', 'x|y', '', null])(
      'rejects unsafe service name %p without running anything',
      async (name) => {
        await expect(service.manageService('restart', name)).rejects.toThrow(
          'Invalid service name'
        );
        expect(childProcess.execFile).not.toHaveBeenCalled();
        expect(childProcess.exec).not.toHaveBeenCalled();
      }
    );

    it('rejects an action outside the allowlist', async () => {
      await expect(service.manageService('enable', 'nginx')).rejects.toThrow(
        'Invalid action. Must be start, stop, or restart'
      );
      expect(childProcess.execFile).not.toHaveBeenCalled();
    });

    it('runs systemctl with separate arguments and no shell', async () => {
      const result = await service.manageService('restart', 'nginx');
      expect(childProcess.execFile).toHaveBeenCalledWith(
        'systemctl',
        ['restart', 'nginx'],
        { timeout: 10000 },
        expect.any(Function)
      );
      expect(childProcess.exec).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('runs pm2 with separate arguments for the bot service', async () => {
      await service.manageService('restart', 'aszune-ai');
      expect(childProcess.execFile).toHaveBeenCalledWith(
        'pm2',
        ['restart', 'aszune-ai'],
        { timeout: 10000 },
        expect.any(Function)
      );
    });
  });

  describe('getServiceLogs', () => {
    it('rejects an unsafe service name', async () => {
      await expect(service.getServiceLogs('x; cat /etc/passwd', 50)).rejects.toThrow(
        'Invalid service name'
      );
      expect(childProcess.execFile).not.toHaveBeenCalled();
    });

    it('passes a clamped line count as an argument', async () => {
      const logs = await service.getServiceLogs('nginx', '999999');
      expect(childProcess.execFile).toHaveBeenCalledWith(
        'journalctl',
        ['-u', 'nginx', '-n', '1000', '--no-pager', '--output=short-iso'],
        { timeout: 10000 },
        expect.any(Function)
      );
      expect(logs).toEqual(['line one', 'line two']);
    });

    it('falls back to 50 lines for a non-numeric count', async () => {
      await service.getServiceLogs('nginx', 'abc');
      expect(childProcess.execFile.mock.calls[0][1]).toEqual([
        '-u',
        'nginx',
        '-n',
        '50',
        '--no-pager',
        '--output=short-iso',
      ]);
    });
  });

  describe('config file secrets', () => {
    const envFile = 'DISCORD_BOT_TOKEN=real-discord\nPERPLEXITY_API_KEY=real-pplx\nLOG_LEVEL=info';

    beforeEach(() => {
      jest.spyOn(fsPromises, 'access').mockResolvedValue();
      jest.spyOn(fsPromises, 'copyFile').mockResolvedValue();
      jest.spyOn(fsPromises, 'readFile').mockResolvedValue(envFile);
      jest.spyOn(fsPromises, 'writeFile').mockResolvedValue();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('masks secret values when reading .env over REST', async () => {
      const content = await service.readConfigFile('.env');
      expect(content).toBe(
        'DISCORD_BOT_TOKEN=********\nPERPLEXITY_API_KEY=********\nLOG_LEVEL=info'
      );
    });

    it('keeps the real secret when a save still carries the mask', async () => {
      await service.updateConfigFile(
        '.env',
        'DISCORD_BOT_TOKEN=********\nPERPLEXITY_API_KEY=new-pplx\nLOG_LEVEL=debug',
        false
      );
      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/\.env$/),
        'DISCORD_BOT_TOKEN=real-discord\nPERPLEXITY_API_KEY=new-pplx\nLOG_LEVEL=debug',
        'utf-8'
      );
    });
  });
});

describe('dashboard config save safety', () => {
  let service;

  beforeEach(() => {
    service = require('../../../../src/services/web-dashboard');
    jest.spyOn(fsPromises, 'readFile').mockResolvedValue('export API_KEY="first\nsecond"');
    jest.spyOn(fsPromises, 'writeFile').mockResolvedValue();
    jest.spyOn(fsPromises, 'copyFile').mockResolvedValue();
    jest.spyOn(fsPromises, 'access').mockResolvedValue();
  });

  afterEach(() => jest.restoreAllMocks());

  it('masks and restores an exported multiline secret over REST', async () => {
    const masked = await service.readConfigFile('.env');
    expect(masked).toBe('export API_KEY=********');
    await service.updateConfigFile('.env', masked, false);
    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      require('path').join(process.cwd(), '.env'),
      'export API_KEY="first\nsecond"',
      'utf-8'
    );
  });

  it.each(['EACCES', 'EIO', 'ENOENT'])('does not overwrite secrets after %s', async (code) => {
    fsPromises.readFile.mockRejectedValueOnce(Object.assign(new Error('Read failed'), { code }));
    await expect(service.updateConfigFile('.env', 'API_KEY=********')).rejects.toThrow(
      code === 'ENOENT'
        ? 'Cannot restore masked value for API_KEY: original value is unavailable'
        : 'Read failed'
    );
    expect(fsPromises.writeFile).not.toHaveBeenCalled();
  });

  it('does not overwrite the original after a backup failure', async () => {
    fsPromises.copyFile.mockRejectedValueOnce(new Error('Backup failed'));
    await expect(service.updateConfigFile('.env', 'API_KEY=********')).rejects.toThrow(
      'Backup failed'
    );
    expect(fsPromises.writeFile).not.toHaveBeenCalled();
  });

  it('allows a new config with explicit values', async () => {
    fsPromises.readFile.mockRejectedValueOnce(
      Object.assign(new Error('Missing'), { code: 'ENOENT' })
    );
    await service.updateConfigFile('.env', 'API_KEY=new-value');
    expect(fsPromises.copyFile).not.toHaveBeenCalled();
    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      require('path').join(process.cwd(), '.env'),
      'API_KEY=new-value',
      'utf-8'
    );
  });
});
