const { preparePerplexitySecurePrivate } = require('./perplexity-secure-private.test.setup');

describe('_safeGetHeader helper', () => {
  let context;

  beforeEach(() => {
    context = preparePerplexitySecurePrivate();
  });

  it('returns empty string for null headers', () => {
    const result = context.PerplexityService._safeGetHeader(null, 'content-type');

    expect(result).toBe('');
  });

  it('returns empty string for undefined headers', () => {
    const result = context.PerplexityService._safeGetHeader(undefined, 'content-type');

    expect(result).toBe('');
  });

  it('returns empty string for null key', () => {
    const headers = { 'content-type': 'application/json' };

    const result = context.PerplexityService._safeGetHeader(headers, null);

    expect(result).toBe('');
  });

  it('uses Headers.get when available', () => {
    const headers = { get: jest.fn().mockReturnValue('application/json') };

    const result = context.PerplexityService._safeGetHeader(headers, 'content-type');

    expect(result).toBe('application/json');
    expect(headers.get).toHaveBeenCalledWith('content-type');
  });

  it('falls back to object property access', () => {
    const headers = { 'content-type': 'application/json' };

    const result = context.PerplexityService._safeGetHeader(headers, 'content-type');

    expect(result).toBe('application/json');
  });

  it('checks different casing variations', () => {
    const headers = { 'CONTENT-TYPE': 'application/json' };

    const result = context.PerplexityService._safeGetHeader(headers, 'content-type');

    expect(result).toBe('application/json');
  });

  it('handles Headers.get throwing', () => {
    const headers = {
      get: jest.fn().mockImplementation(() => {
        throw new Error('Headers error');
      }),
      'content-type': 'application/json',
    };

    const result = context.PerplexityService._safeGetHeader(headers, 'content-type');

    expect(result).toBe('application/json');
  });

  it('handles non-object headers gracefully', () => {
    const result = context.PerplexityService._safeGetHeader('not-an-object', 'content-type');

    expect(result).toBe('');
  });

  it('handles function-like headers', () => {
    const headers = function () {};
    headers.get = jest.fn().mockReturnValue('test-value');

    const result = context.PerplexityService._safeGetHeader(headers, 'content-type');

    expect(result).toBe('test-value');
  });
});
