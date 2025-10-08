const { debounce } = require('../../src/utils/debouncer');

describe('Debouncer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('debounce', () => {
    it('should delay function execution', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn();
      expect(mockFn).not.toHaveBeenCalled();

      // Fast forward time
      jest.advanceTimersByTime(500);
      expect(mockFn).not.toHaveBeenCalled();

      // Complete the wait time
      jest.advanceTimersByTime(500);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should only execute once for multiple rapid calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 1000);

      // Call multiple times
      debouncedFn('a');
      debouncedFn('b');
      debouncedFn('c');

      // Fast forward past wait time
      jest.advanceTimersByTime(1000);

      // Should only be called once with last arguments
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('c');
    });

    it('should reset the timer when called again during wait time', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn('first');

      // Advance halfway through the wait time
      jest.advanceTimersByTime(500);

      // Call again, should reset timer
      debouncedFn('second');

      // Advance halfway through the wait time again
      jest.advanceTimersByTime(500);
      expect(mockFn).not.toHaveBeenCalled();

      // Advance through the remaining wait time
      jest.advanceTimersByTime(500);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('second');
    });

    it('should pass arguments to the debounced function', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn('test', 123, { key: 'value' });

      // Fast forward past wait time
      jest.advanceTimersByTime(1000);

      expect(mockFn).toHaveBeenCalledWith('test', 123, { key: 'value' });
    });
  });
});
