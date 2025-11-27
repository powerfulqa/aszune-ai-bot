const { preparePerplexitySecurePrivate } = require('./perplexity-secure-private.test.setup');

const mockConfig = require('../../../src/config/config');

describe('_getPiOptimizationSettings helper', () => {
  let context;

  beforeEach(() => {
    context = preparePerplexitySecurePrivate();
  });

  it('returns defaults when PI_OPTIMIZATIONS is missing', () => {
    const original = mockConfig.PI_OPTIMIZATIONS;
    delete mockConfig.PI_OPTIMIZATIONS;

    const result = context.PerplexityService._getPiOptimizationSettings();

    expect(result).toEqual({ enabled: false, lowCpuMode: false });

    mockConfig.PI_OPTIMIZATIONS = original;
  });

  it('reads values from config when available', () => {
    const result = context.PerplexityService._getPiOptimizationSettings();

    expect(result).toHaveProperty('enabled');
    expect(result).toHaveProperty('lowCpuMode');
    expect(typeof result.enabled).toBe('boolean');
    expect(typeof result.lowCpuMode).toBe('boolean');
  });

  it('handles config getters throwing errors', () => {
    const original = mockConfig.PI_OPTIMIZATIONS;

    Object.defineProperty(mockConfig, 'PI_OPTIMIZATIONS', {
      get: () => {
        throw new Error('Config error');
      },
      configurable: true,
    });

    const result = context.PerplexityService._getPiOptimizationSettings();

    expect(result).toEqual({ enabled: false, lowCpuMode: false });

    delete mockConfig.PI_OPTIMIZATIONS;
    mockConfig.PI_OPTIMIZATIONS = original;
  });
});
