const { preparePerplexitySecurePrivate } = require('./perplexity-secure-private.test.setup');

describe('_formatCacheEntry helper', () => {
  let context;

  beforeEach(() => {
    context = preparePerplexitySecurePrivate();
  });

  it('creates an entry for string content', () => {
    const result = context.PerplexityService._formatCacheEntry('test content', 12345);

    expect(result).toEqual({ content: 'test content', timestamp: 12345 });
  });

  it('preserves existing timestamped objects', () => {
    const entry = { content: 'existing content', timestamp: 67890, otherProperty: 'test' };

    const result = context.PerplexityService._formatCacheEntry(entry, 12345);

    expect(result).toEqual(entry);
  });

  it('adds timestamp to objects missing one', () => {
    const entry = { content: 'content without timestamp', otherProperty: 'test' };

    const result = context.PerplexityService._formatCacheEntry(entry, 12345);

    expect(result).toEqual({
      content: 'content without timestamp',
      timestamp: 12345,
      otherProperty: 'test',
    });
  });

  it('handles null entries', () => {
    const result = context.PerplexityService._formatCacheEntry(null, 12345);

    expect(result).toEqual({
      content: null,
      timestamp: 12345,
    });
  });
});
