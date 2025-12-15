/**
 * Tests for Instance Tracker Beacon Helper
 *
 * @jest-environment node
 */

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock global fetch
global.fetch = jest.fn();

const {
  createBeaconPayload,
  sendBeacon,
  buildHeaders,
} = require('../../../src/services/instance-tracker/helpers/beacon');
const logger = require('../../../src/utils/logger');

describe('beacon helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockReset();
  });

  describe('createBeaconPayload', () => {
    it('should create payload with action and timestamp', () => {
      const result = createBeaconPayload('register', { clientId: '123' });

      expect(result.action).toBe('register');
      expect(result.clientId).toBe('123');
      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
    });

    it('should merge additional data', () => {
      const result = createBeaconPayload('heartbeat', {
        instanceId: 'inst_456',
        stats: { guildCount: 5 },
      });

      expect(result.action).toBe('heartbeat');
      expect(result.instanceId).toBe('inst_456');
      expect(result.stats.guildCount).toBe(5);
    });
  });

  describe('buildHeaders', () => {
    it('should include content-type and version', () => {
      const result = buildHeaders({});

      expect(result['Content-Type']).toBe('application/json');
      expect(result['X-Bot-Version']).toBe('1.10.0');
    });

    it('should include instance key when provided', () => {
      const result = buildHeaders({ instanceKey: 'key123' });

      expect(result['X-Instance-Key']).toBe('key123');
    });

    it('should include instance id when provided', () => {
      const result = buildHeaders({ instanceId: 'inst_789' });

      expect(result['X-Instance-Id']).toBe('inst_789');
    });
  });

  describe('sendBeacon', () => {
    it('should send successful beacon', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ verified: true, instanceId: 'inst_123' }),
      });

      const result = await sendBeacon('https://tracking.example.com', { action: 'register' });

      expect(result).toEqual({ verified: true, instanceId: 'inst_123' });
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ verified: true }),
      });

      const result = await sendBeacon(
        'https://tracking.example.com',
        { action: 'register' },
        { maxRetries: 2, retryDelayMs: 10 }
      );

      expect(result).toEqual({ verified: true });
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith('Beacon failed, retrying', expect.any(Object));
    });

    it('should return null after all retries fail', async () => {
      global.fetch.mockResolvedValue({ ok: false });

      const result = await sendBeacon(
        'https://tracking.example.com',
        { action: 'register' },
        { maxRetries: 3, retryDelayMs: 10 }
      );

      expect(result).toBeNull();
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(logger.error).toHaveBeenCalledWith(
        'Beacon failed after all retries',
        expect.any(Object)
      );
    });

    it('should handle network errors', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const result = await sendBeacon(
        'https://tracking.example.com',
        { action: 'register' },
        { maxRetries: 1 }
      );

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        'Beacon request failed',
        expect.objectContaining({ error: 'Network error' })
      );
      expect(logger.error).toHaveBeenCalledWith('Beacon failed after all retries', {
        maxRetries: 1,
      });
    });

    it('should handle timeout errors', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      global.fetch.mockRejectedValue(abortError);

      const result = await sendBeacon(
        'https://tracking.example.com',
        { action: 'register' },
        { maxRetries: 1 }
      );

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        'Beacon request timed out - tracking server may be unavailable'
      );
      expect(logger.error).toHaveBeenCalledWith('Beacon failed after all retries', {
        maxRetries: 1,
      });
    });

    it('should use default options', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await sendBeacon('https://tracking.example.com', { action: 'heartbeat' });

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should log warning on non-ok response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await sendBeacon('https://tracking.example.com', { action: 'register' }, { maxRetries: 1 });

      expect(logger.warn).toHaveBeenCalledWith(
        'Beacon request failed',
        expect.objectContaining({ status: 500 })
      );
    });
  });
});
