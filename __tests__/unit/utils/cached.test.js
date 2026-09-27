/**
 * Tests for the TTL cache with in-flight de-duplication
 */

describe('cached', () => {
  let cached;
  let invalidate;

  beforeEach(() => {
    ({ cached, invalidate } = require('../../../src/utils/cached'));
    invalidate();
  });

  it('fetches once and serves the cached value while fresh', async () => {
    const fetchFn = jest.fn().mockResolvedValue('value');

    await expect(cached('k', 1000, fetchFn)).resolves.toBe('value');
    await expect(cached('k', 1000, fetchFn)).resolves.toBe('value');

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('treats falsy values as hits', async () => {
    const fetchFn = jest.fn().mockResolvedValue(0);

    await cached('zero', 1000, fetchFn);
    await expect(cached('zero', 1000, fetchFn)).resolves.toBe(0);

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('shares one fetch between concurrent callers', async () => {
    let resolve;
    const fetchFn = jest.fn(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    );

    const a = cached('shared', 1000, fetchFn);
    const b = cached('shared', 1000, fetchFn);
    resolve('done');

    await expect(Promise.all([a, b])).resolves.toEqual(['done', 'done']);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('refetches after the TTL expires', async () => {
    jest.useFakeTimers();
    try {
      const fetchFn = jest.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');

      await cached('ttl', 1000, fetchFn);
      jest.advanceTimersByTime(1001);

      await expect(cached('ttl', 1000, fetchFn)).resolves.toBe('second');
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not cache failures by default', async () => {
    const fetchFn = jest.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce('up');

    await expect(cached('retry', 1000, fetchFn)).rejects.toThrow('down');
    await expect(cached('retry', 1000, fetchFn)).resolves.toBe('up');
  });

  it('remembers a failure for errorTtl when asked', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('offline'));

    await expect(cached('neg', 1000, fetchFn, { errorTtl: 5000 })).rejects.toThrow('offline');
    await expect(cached('neg', 1000, fetchFn, { errorTtl: 5000 })).rejects.toThrow('offline');

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('invalidate(key) forces the next call to fetch', async () => {
    const fetchFn = jest.fn().mockResolvedValueOnce('a').mockResolvedValueOnce('b');

    await cached('inv', 1000, fetchFn);
    invalidate('inv');

    await expect(cached('inv', 1000, fetchFn)).resolves.toBe('b');
  });
});
