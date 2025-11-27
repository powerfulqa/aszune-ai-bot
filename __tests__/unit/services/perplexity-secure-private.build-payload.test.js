const { preparePerplexitySecurePrivate } = require('./perplexity-secure-private.test.setup');

describe('_buildRequestPayload helper', () => {
  let context;

  beforeEach(() => {
    context = preparePerplexitySecurePrivate();
  });

  it('builds defaults for the request payload', () => {
    const messages = [{ role: 'user', content: 'Hello' }];
    const result = context.PerplexityService._buildRequestPayload(messages, {});

    expect(result).toHaveProperty('model');
    expect(result).toHaveProperty('messages', messages);
    expect(result).toHaveProperty('max_tokens');
    expect(result).toHaveProperty('temperature');
  });

  it('respects custom options when provided', () => {
    const messages = [{ role: 'user', content: 'Hello' }];
    const options = { model: 'custom-model', maxTokens: 100, temperature: 0.8 };

    const result = context.PerplexityService._buildRequestPayload(messages, options);

    expect(result.model).toBe('custom-model');
    expect(result.max_tokens).toBe(100);
    expect(result.temperature).toBe(0.8);
  });
});
