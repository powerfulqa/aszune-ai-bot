// Mock crypto BEFORE importing the setup which imports the service
jest.mock('crypto', () => ({
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('mock-hash-123'),
  }),
}));

const { preparePerplexitySecurePrivate } = require('./perplexity-secure-private.test.setup');
const crypto = require('crypto');

describe('_generateCacheKey helper', () => {
  let context;

  beforeEach(() => {
    jest.clearAllMocks();
    context = preparePerplexitySecurePrivate();
  });

  it('produces a consistent hash for identical history', () => {
    const history = [{ role: 'user', content: 'Hello' }];

    const key1 = context.PerplexityService._generateCacheKey(history);
    const key2 = context.PerplexityService._generateCacheKey(history);

    expect(key1).toBe(key2);
    expect(key1).toBe('mock-hash-123');
    expect(crypto.createHash).toHaveBeenCalledWith('md5');
  });

  it('calls crypto for each distinct history', () => {
    const history1 = [{ role: 'user', content: 'Hello' }];
    const history2 = [{ role: 'user', content: 'Hi' }];

    context.PerplexityService._generateCacheKey(history1);
    context.PerplexityService._generateCacheKey(history2);

    expect(crypto.createHash).toHaveBeenCalledTimes(2);
    expect(crypto.createHash).toHaveBeenCalledWith('md5');
  });
});
