const { preparePerplexitySecurePrivate } = require('./perplexity-secure-private.test.setup');

describe('_isRetryableError helper', () => {
  let context;

  beforeEach(() => {
    context = preparePerplexitySecurePrivate();
  });

  it('returns false for null errors', () => {
    const result = context.PerplexityService._isRetryableError(null);

    expect(result).toBe(false);
  });

  it('returns false for errors without messages', () => {
    const result = context.PerplexityService._isRetryableError({});

    expect(result).toBe(false);
  });

  it('flags temporary service errors', () => {
    const result = context.PerplexityService._isRetryableError({
      message: 'Temporary service unavailable',
    });

    expect(result).toBe(true);
  });

  it('flags network timeout errors', () => {
    const result = context.PerplexityService._isRetryableError({ message: 'Network timeout' });

    expect(result).toBe(true);
  });

  it('flags 429 rate limit errors', () => {
    const result = context.PerplexityService._isRetryableError({
      message: 'Rate limit 429 exceeded',
    });

    expect(result).toBe(true);
  });

  it('ignores permanent API errors', () => {
    const result = context.PerplexityService._isRetryableError({ message: 'Permanent API error' });

    expect(result).toBe(false);
  });

  it('ignores invalid request errors', () => {
    const result = context.PerplexityService._isRetryableError({
      message: 'Invalid request format',
    });

    expect(result).toBe(false);
  });

  it('ignores unauthorized errors', () => {
    const result = context.PerplexityService._isRetryableError({ message: 'Unauthorized access' });

    expect(result).toBe(false);
  });

  it('ignores forbidden errors', () => {
    const result = context.PerplexityService._isRetryableError({ message: 'Forbidden operation' });

    expect(result).toBe(false);
  });

  it('defaults to false for unknown errors', () => {
    const result = context.PerplexityService._isRetryableError({ message: 'Some random error' });

    expect(result).toBe(false);
  });
});
