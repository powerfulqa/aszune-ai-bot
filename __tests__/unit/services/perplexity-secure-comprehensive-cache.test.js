/**
 * PerplexitySecure cache helpers split tests (QLTY-friendly).
 */
const {
  setupPerplexityServiceTestContext,
} = require('./perplexity-secure-comprehensive.test.setup');

const { PerplexityService, fs } = setupPerplexityServiceTestContext();

let perplexityService;

beforeEach(() => {
  jest.clearAllMocks();
  perplexityService = PerplexityService;
  fs.readFile.mockRejectedValue(new Error('File not found'));
});

describe('getCacheStats method', () => {
  it('should return cache stats when available', () => {
    perplexityService.cacheManager = {
      getStats: jest.fn().mockReturnValue({
        hits: 10,
        misses: 5,
        hitRate: 0.67,
      }),
    };

    const result = perplexityService.getCacheStats();
    expect(result.hits).toBe(10);
    expect(result.misses).toBe(5);
    expect(result.hitRate).toBe(0.67);
  });

  it('should return error stats when cache throws', () => {
    perplexityService.cacheManager = {
      getStats: jest.fn().mockImplementation(() => {
        throw new Error('Cache error');
      }),
    };

    const result = perplexityService.getCacheStats();
    expect(result.hits).toBe(0);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Please try again later');
  });

  it('should handle missing cache gracefully', () => {
    delete perplexityService.cacheManager;

    const result = perplexityService.getCacheStats();
    expect(result.hits).toBe(0);
    expect(result.error).toBeDefined();
  });
});
