const { preparePerplexitySecurePrivate } = require('./perplexity-secure-private.test.setup');

describe('_shouldUseCache helper', () => {
  let context;

  beforeEach(() => {
    context = preparePerplexitySecurePrivate();
  });

  it('returns false when caching options disable caching', () => {
    const options = { caching: false };
    const cacheConfig = { enabled: true };

    const result = context.PerplexityService._shouldUseCache(options, cacheConfig);

    expect(result).toBe(false);
  });

  it('returns true when in test environment regardless of cache config', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    const result = context.PerplexityService._shouldUseCache({}, { enabled: false });

    process.env.NODE_ENV = original;

    expect(result).toBe(true);
  });

  it('returns true when caching is enabled', () => {
    const result = context.PerplexityService._shouldUseCache({}, { enabled: true });

    expect(result).toBe(true);
  });
});
