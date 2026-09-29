/**
 * Security tests for the dashboard config socket handlers.
 * Covers the filename allowlist (RCE / arbitrary read prevention) and
 * secret masking with round-trip restoration.
 */

jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    copyFile: jest.fn(),
    stat: jest.fn(),
  },
}));

jest.mock('../../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const fsPromises = require('fs').promises;
const { parse } = require('dotenv');
const {
  handleRequestConfig,
  handleSaveConfig,
  validateConfigSaveInput,
  maskSecrets,
  restoreMaskedSecrets,
  SECRET_MASK,
} = require('../../../../src/services/web-dashboard/handlers/configHandlers');

describe('config handlers - filename allowlist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects reading a non-allowlisted file', async () => {
    const callback = jest.fn();
    await handleRequestConfig({ filename: 'src/index.js' }, callback);

    expect(fsPromises.readFile).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Access denied') })
    );
  });

  it('rejects reading via a traversal filename', async () => {
    const callback = jest.fn();
    await handleRequestConfig({ filename: '../../etc/passwd' }, callback);

    expect(fsPromises.readFile).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Access denied') })
    );
  });

  it('rejects saving a non-allowlisted file before any write', async () => {
    const callback = jest.fn();
    await handleSaveConfig({ filename: 'package.json', content: '{"malicious":true}' }, callback);

    expect(fsPromises.writeFile).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Access denied') })
    );
  });

  it('validateConfigSaveInput rejects non-allowlisted filenames', () => {
    expect(validateConfigSaveInput({ filename: 'src/index.js', content: 'x' })).toContain(
      'Access denied'
    );
    expect(validateConfigSaveInput({ filename: '.env', content: 'x' })).toBeNull();
  });

  it('allows reading an allowlisted file', async () => {
    fsPromises.access.mockResolvedValue();
    fsPromises.readFile.mockResolvedValue('SOME_SETTING=value');
    fsPromises.stat.mockResolvedValue({ size: 18, mtime: new Date(0) });

    const callback = jest.fn();
    await handleRequestConfig({ filename: '.env' }, callback);

    expect(fsPromises.readFile).toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ filename: '.env', error: null })
    );
  });
});

describe('config handlers - secret masking', () => {
  it('masks secret values but keeps non-secret settings', () => {
    const raw = [
      'DISCORD_BOT_TOKEN=super-secret-token',
      'PERPLEXITY_API_KEY=pk-live-abcdef',
      'DB_PATH=./data/bot.db',
      'DASHBOARD_TOKEN=hunter2',
    ].join('\n');

    const masked = maskSecrets('.env', raw);

    expect(masked).not.toContain('super-secret-token');
    expect(masked).not.toContain('pk-live-abcdef');
    expect(masked).not.toContain('hunter2');
    expect(masked).toContain(`DISCORD_BOT_TOKEN=${SECRET_MASK}`);
    expect(masked).toContain(`PERPLEXITY_API_KEY=${SECRET_MASK}`);
    expect(masked).toContain('DB_PATH=./data/bot.db');
  });

  it('does not mask config.js content', () => {
    const js = 'module.exports = { API_KEY: process.env.PERPLEXITY_API_KEY };';
    expect(maskSecrets('config.js', js)).toBe(js);
  });

  it('leaves empty secret values alone', () => {
    expect(maskSecrets('.env', 'DASHBOARD_TOKEN=')).toBe('DASHBOARD_TOKEN=');
  });

  it('restores masked secrets from the existing file on save', () => {
    const existing = 'DISCORD_BOT_TOKEN=real-token\nDB_PATH=./data/bot.db';
    const submitted = `DISCORD_BOT_TOKEN=${SECRET_MASK}\nDB_PATH=./data/other.db`;

    const restored = restoreMaskedSecrets('.env', submitted, existing);

    expect(restored).toContain('DISCORD_BOT_TOKEN=real-token');
    expect(restored).toContain('DB_PATH=./data/other.db');
  });

  it('writes a genuinely changed secret through unchanged', () => {
    const existing = 'DISCORD_BOT_TOKEN=old-token';
    const submitted = 'DISCORD_BOT_TOKEN=new-token';
    expect(restoreMaskedSecrets('.env', submitted, existing)).toContain(
      'DISCORD_BOT_TOKEN=new-token'
    );
  });

  it('save restores masked secret end-to-end', async () => {
    fsPromises.access.mockResolvedValue();
    fsPromises.readFile.mockResolvedValue('DISCORD_BOT_TOKEN=real-token');
    fsPromises.copyFile.mockResolvedValue();
    fsPromises.writeFile.mockResolvedValue();

    const callback = jest.fn();
    await handleSaveConfig(
      { filename: '.env', content: `DISCORD_BOT_TOKEN=${SECRET_MASK}` },
      callback
    );

    const written = fsPromises.writeFile.mock.calls[0][1];
    expect(written).toBe('DISCORD_BOT_TOKEN=real-token');
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ saved: true }));
  });
});

describe('config handlers - dotenv syntax', () => {
  it.each([
    'export DISCORD_BOT_TOKEN=synthetic-secret',
    'PRIVATE_KEY="first-line\nsecond-line"',
    "PRIVATE_KEY='first-line\nsecond-line'",
    'PRIVATE_KEY=`first-line\nsecond-line`',
    'API.KEY: "synthetic-secret"',
    'API-KEY="value # with hash"',
    'export\tAPI_KEY = "first-line\r\nsecond-line"',
    'API_KEY="escaped\\nnewline"',
    'API_KEY="escaped\\"quote"',
  ])('masks and restores the complete assignment %s', (assignment) => {
    const raw = `# Configuration\n${assignment}\nDB_PATH=./data/bot.db\n`;
    const key = Object.keys(parse(assignment))[0];
    const masked = maskSecrets('.env', raw);

    expect(parse(masked)).toEqual({ [key]: SECRET_MASK, DB_PATH: './data/bot.db' });
    expect(masked).not.toContain('second-line');
    expect(masked).not.toContain('synthetic-secret');
    expect(restoreMaskedSecrets('.env', masked, raw)).toBe(raw);
  });

  it('preserves comments, CRLF, and non-secret multiline settings', () => {
    const raw = '# Header\r\nLABEL="first\r\nsecond"\r\nexport API_KEY="secret" # API\r\n';
    expect(maskSecrets('.env', raw)).toBe(
      '# Header\r\nLABEL="first\r\nsecond"\r\nexport API_KEY=******** # API\r\n'
    );
    expect(restoreMaskedSecrets('.env', maskSecrets('.env', raw), raw)).toBe(raw);
  });

  it('masks every duplicate assignment and restores the effective value', () => {
    const raw = 'API_KEY=older-secret\nexport API_KEY="current-secret"';
    const masked = maskSecrets('.env', raw);
    expect(masked).toBe('API_KEY=********\nexport API_KEY=********');
    expect(parse(restoreMaskedSecrets('.env', masked, raw))).toEqual(parse(raw));
  });

  it('restores a quoted mask without altering a new literal value', () => {
    const raw = 'API_KEY="original # value"\nOTHER_KEY=old';
    const edited = 'export API_KEY="********"\nOTHER_KEY="new # value"';
    expect(parse(restoreMaskedSecrets('.env', edited, raw))).toEqual({
      API_KEY: 'original # value',
      OTHER_KEY: 'new # value',
    });
  });

  it('rejects a mask without an original value instead of saving it as a credential', () => {
    expect(() => restoreMaskedSecrets('.env', 'API_KEY=********', '')).toThrow(
      'Cannot restore masked value for API_KEY: original value is unavailable'
    );
  });
});

describe('config handlers - save failure safety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fsPromises.readFile.mockResolvedValue('export API_KEY="first\nsecond"');
    fsPromises.copyFile.mockResolvedValue();
  });

  it.each(['EACCES', 'EIO'])('refuses to save after a %s read failure', async (code) => {
    fsPromises.readFile.mockRejectedValueOnce(Object.assign(new Error('Read failed'), { code }));
    const callback = jest.fn();

    await handleSaveConfig({ filename: '.env', content: 'API_KEY=********' }, callback);

    expect(callback).toHaveBeenCalledWith({ error: 'Read failed', saved: false });
    expect(fsPromises.writeFile).not.toHaveBeenCalled();
  });

  it('refuses to write an unresolved mask for a missing file', async () => {
    fsPromises.readFile.mockRejectedValueOnce(
      Object.assign(new Error('Missing'), { code: 'ENOENT' })
    );
    const callback = jest.fn();

    await handleSaveConfig({ filename: '.env', content: 'API_KEY=********' }, callback);

    expect(callback).toHaveBeenCalledWith({
      error: 'Cannot restore masked value for API_KEY: original value is unavailable',
      saved: false,
    });
    expect(fsPromises.writeFile).not.toHaveBeenCalled();
  });

  it('refuses to write when creating the backup fails', async () => {
    fsPromises.copyFile.mockRejectedValueOnce(new Error('Backup failed'));
    const callback = jest.fn();

    await handleSaveConfig({ filename: '.env', content: 'API_KEY=********' }, callback);

    expect(callback).toHaveBeenCalledWith({ error: 'Backup failed', saved: false });
    expect(fsPromises.writeFile).not.toHaveBeenCalled();
  });

  it('restores exported multiline secrets through the save handler', async () => {
    const callback = jest.fn();
    await handleSaveConfig({ filename: '.env', content: 'export API_KEY=********' }, callback);

    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      require('path').join(process.cwd(), '.env'),
      'export API_KEY="first\nsecond"',
      'utf-8'
    );
  });
});
