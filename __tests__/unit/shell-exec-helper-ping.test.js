/**
 * pingOnce runs ping without a shell and rejects targets that could be read
 * as an option or carry shell syntax.
 */
jest.mock('child_process', () => ({
  exec: jest.fn(),
  execFile: jest.fn((file, args, options, callback) => callback(null, { stdout: '', stderr: '' })),
}));

const { execFile } = require('child_process');
const { pingOnce, executePing } = require('../../src/utils/shell-exec-helper');

describe('pingOnce', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes the target as a separate argument', async () => {
    await pingOnce('192.168.1.1');

    const [file, args, options] = execFile.mock.calls[0];
    expect(file).toBe('ping');
    expect(args).toEqual([process.platform === 'win32' ? '-n' : '-c', '1', '192.168.1.1']);
    expect(options).toEqual({ timeout: 3000 });
  });

  it.each(['8.8.8.8; rm -rf /', '-f', '$(id)', '', null, '1.1.1.1 | cat'])(
    'rejects %p without running ping',
    async (target) => {
      await expect(pingOnce(target)).rejects.toThrow('Invalid ping target');
      expect(await executePing(target)).toBe(false);
      expect(execFile).not.toHaveBeenCalled();
    }
  );
});
