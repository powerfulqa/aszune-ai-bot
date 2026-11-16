/**
 * Control endpoints: bot restart through PM2 and git pull. PM2 and the shell
 * are mocked; nothing is spawned.
 */

const path = require('path');

jest.mock('../../../../src/services/database', () => ({}));
jest.mock('../../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../../src/utils/error-handler', () => ({
  ErrorHandler: { handleError: jest.fn((error) => ({ message: error.message })) },
}));
jest.mock('../../../../src/utils/pm2-service', () => ({
  runPm2ServiceAction: jest.fn(),
  BOT_PM2_APP_NAME: 'aszune-ai',
}));
jest.mock('../../../../src/utils/shell-exec-helper', () => ({
  execPromise: jest.fn(),
}));

const NOW = '2026-11-16T12:00:00.000Z';
const REPO_ROOT = path.join(__dirname, '../../../../src/services', '../../');

function makeRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('dashboard restart', () => {
  let service;
  let runPm2ServiceAction;
  let res;
  const logged = () => service.allLogs.map((entry) => `${entry.level} ${entry.message}`);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date(NOW) });
    process.env.pm_id = '0';
    service = require('../../../../src/services/web-dashboard');
    ({ runPm2ServiceAction } = require('../../../../src/utils/pm2-service'));
    runPm2ServiceAction.mockResolvedValue(undefined);
    res = makeRes();
  });

  afterEach(() => {
    delete process.env.pm_id;
  });

  it('refuses with 409 when the bot is not under PM2', async () => {
    delete process.env.pm_id;
    service.discordClient = { destroy: jest.fn() };

    await service._handleRestartRequest(res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error:
        'The bot is not running under PM2, so it cannot restart itself. Restart it on the host.',
      timestamp: NOW,
    });
    expect(service.discordClient.destroy).not.toHaveBeenCalled();
    expect(runPm2ServiceAction).not.toHaveBeenCalled();
  });

  it('disconnects Discord, then restarts the PM2 app', async () => {
    service.discordClient = { destroy: jest.fn().mockResolvedValue(undefined) };

    await service._handleRestartRequest(res);

    expect(service.discordClient.destroy).toHaveBeenCalledTimes(1);
    expect(runPm2ServiceAction).toHaveBeenCalledWith('aszune-ai', 'restart');
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Bot restart initiated via PM2 aszune-ai',
      timestamp: NOW,
    });
  });

  it('still restarts when the Discord disconnect fails', async () => {
    service.discordClient = { destroy: jest.fn().mockRejectedValue(new Error('ws closed')) };

    await service._handleRestartRequest(res);

    expect(logged()).toContain('WARN Failed to disconnect Discord client: ws closed');
    expect(runPm2ServiceAction).toHaveBeenCalledWith('aszune-ai', 'restart');
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Bot restart initiated via PM2 aszune-ai',
      timestamp: NOW,
    });
  });

  it('falls back to exiting the process when PM2 refuses', async () => {
    service.discordClient = null;
    runPm2ServiceAction.mockRejectedValue(new Error('pm2 not found'));

    await service._handleRestartRequest(res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Bot restart initiated (fallback mode)',
      timestamp: NOW,
    });
    expect(logged()).toContain('WARN PM2 restart failed: pm2 not found');
    expect(process.exit).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);

    expect(process.exit).toHaveBeenCalledTimes(1);
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it('answers 500 when the response cannot be written', async () => {
    service.discordClient = null;
    res.json.mockImplementationOnce(() => {
      throw new Error('socket hang up');
    });

    await service._handleRestartRequest(res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenLastCalledWith({
      success: false,
      error: 'socket hang up',
      timestamp: '2026-11-16T12:00:00.000Z',
    });
    expect(logged()).toContain('ERROR Restart error: socket hang up');
  });
});

describe('dashboard git pull', () => {
  let service;
  let execPromise;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date(NOW) });
    service = require('../../../../src/services/web-dashboard');
    ({ execPromise } = require('../../../../src/utils/shell-exec-helper'));
    res = makeRes();
  });

  it('pulls main in the repository root and returns the output', async () => {
    execPromise.mockResolvedValue({ stdout: 'Already up to date.\n', stderr: '' });

    await service._handleGitPullRequest(res);

    expect(execPromise).toHaveBeenCalledTimes(1);
    expect(execPromise).toHaveBeenCalledWith('git pull origin main', {
      cwd: REPO_ROOT,
      timeout: 30000,
    });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Git pull completed successfully',
      output: 'Already up to date.\n',
      timestamp: NOW,
    });
  });

  it.each([
    ['stderr', Object.assign(new Error('Command failed'), { stderr: 'Permission denied' })],
    ['an EACCES error', new Error('spawn git EACCES')],
  ])('answers 403 when %s reports a permission problem', async (_name, error) => {
    execPromise.mockRejectedValue(error);

    await service._handleGitPullRequest(res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Permission denied - check file permissions',
      timestamp: NOW,
    });
    expect(service.errorLogs.at(-1).message).toBe(`Git pull permission denied: ${error.message}`);
  });

  it('reports any other git failure in the body', async () => {
    execPromise.mockRejectedValue(new Error('fatal: not a git repository'));

    await service._handleGitPullRequest(res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'fatal: not a git repository',
      timestamp: NOW,
    });
  });

  it('answers 500 when the failure report itself cannot be written', async () => {
    execPromise.mockRejectedValue(new Error('fatal: not a git repository'));
    res.json.mockImplementationOnce(() => {
      throw new Error('socket hang up');
    });

    await service._handleGitPullRequest(res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenLastCalledWith({
      success: false,
      error: 'socket hang up',
      timestamp: NOW,
    });
  });
});
