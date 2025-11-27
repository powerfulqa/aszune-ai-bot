const { preparePerplexitySecurePrivate } = require('./perplexity-secure-private.test.setup');

describe('_generateCacheKey helper', () => {
  let context;

  beforeEach(() => {
    context = preparePerplexitySecurePrivate();
  });

  it('produces a consistent hash for identical history', () => {
    const history = [{ role: 'user', content: 'Hello' }];

    const key1 = context.PerplexityService._generateCacheKey(history);
    const key2 = context.PerplexityService._generateCacheKey(history);

    expect(key1).toBe(key2);
    expect(key1).toBe('mock-hash-123');
    expect(context.crypto.createHash).toHaveBeenCalledWith('md5');
  });

  it('calls crypto for each distinct history', () => {
    const history1 = [{ role: 'user', content: 'Hello' }];
    const history2 = [{ role: 'user', content: 'Hi' }];

    context.PerplexityService._generateCacheKey(history1);
    context.PerplexityService._generateCacheKey(history2);

    expect(context.crypto.createHash).toHaveBeenCalledTimes(2);
    expect(context.crypto.createHash).toHaveBeenCalledWith('md5');
  });
});
