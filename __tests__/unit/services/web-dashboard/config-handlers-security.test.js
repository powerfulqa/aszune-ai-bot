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
