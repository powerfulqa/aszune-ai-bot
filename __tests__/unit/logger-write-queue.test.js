/**
 * Logger file writes: the directory is created once, the rotation check runs
 * once per interval instead of once per line, and lines keep their order.
 */
const mockFs = {
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    appendFile: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue({ size: 1024 }),
    readdir: jest.fn().mockResolvedValue([]),
    rename: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
  },
};

jest.mock('fs', () => mockFs);
jest.mock('../../src/config/config', () => ({
  LOGGING: { DEFAULT_MAX_SIZE_MB: 5, MAX_LOG_FILES: 5, ROTATION_CHECK_INTERVAL_MS: 60000 },
}));

describe('Logger write queue', () => {
  let logger;
  let savedEnv;

  beforeEach(() => {
    savedEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date('2026-11-11T10:00:00Z') });
    logger = require('../../src/utils/logger');
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env.NODE_ENV = savedEnv;
  });

  it('creates the directory once and checks rotation once per interval', async () => {
    logger._writeToFile('one');
    logger._writeToFile('two');
    await logger._writeToFile('three');

    expect(mockFs.promises.mkdir).toHaveBeenCalledTimes(1);
    expect(mockFs.promises.stat).toHaveBeenCalledTimes(1);
    expect(mockFs.promises.appendFile.mock.calls.map((call) => call[1])).toEqual([
      'one\n',
      'two\n',
      'three\n',
    ]);

    jest.setSystemTime(new Date('2026-11-11T10:01:01Z'));
    await logger._writeToFile('four');

    expect(mockFs.promises.mkdir).toHaveBeenCalledTimes(1);
    expect(mockFs.promises.stat).toHaveBeenCalledTimes(2);
  });

  it('keeps writing after a failed write', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFs.promises.appendFile.mockRejectedValueOnce(new Error('disk full'));

    await logger._writeToFile('lost');
    await logger._writeToFile('kept');

    expect(mockFs.promises.appendFile).toHaveBeenCalledTimes(2);
    expect(mockFs.promises.appendFile).toHaveBeenLastCalledWith(logger.logFile, 'kept\n');
  });
});
