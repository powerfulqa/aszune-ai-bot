/**
 * Tests for the Lazy Loader utility
 */
const lazyLoader = require('../../src/utils/lazy-loader');

describe('Lazy Loader', () => {
  describe('basic functionality', () => {
    it('should return a function that loads a module when called', () => {
      const mockModule = { foo: 'bar' };
      const mockLoader = jest.fn().mockReturnValue(mockModule);
      const lazyLoad = lazyLoader.lazyLoad(mockLoader);

      expect(mockLoader).not.toHaveBeenCalled();
      const loadedModule = lazyLoad();
      expect(mockLoader).toHaveBeenCalledTimes(1);
      expect(loadedModule).toBe(mockModule);

      const loadedModuleAgain = lazyLoad();
      expect(mockLoader).toHaveBeenCalledTimes(1);
      expect(loadedModuleAgain).toBe(mockModule);
    });

    it('should handle modules with methods', () => {
      const mockModule = {
        greet: jest.fn().mockReturnValue('Hello'),
        farewell: jest.fn().mockReturnValue('Goodbye'),
      };
      const mockLoader = jest.fn().mockReturnValue(mockModule);
      const lazyLoad = lazyLoader.lazyLoad(mockLoader);

      const module = lazyLoad();
      const greeting = module.greet();
      const farewell = module.farewell();

      expect(mockLoader).toHaveBeenCalledTimes(1);
      expect(greeting).toBe('Hello');
      expect(farewell).toBe('Goodbye');
      expect(mockModule.greet).toHaveBeenCalledTimes(1);
      expect(mockModule.farewell).toHaveBeenCalledTimes(1);
    });
  });

  describe('memoization', () => {
    it('should memoize the loaded module', () => {
      const mockModule1 = { id: 1 };
      const mockModule2 = { id: 2 };
      const mockLoader = jest
        .fn()
        .mockReturnValueOnce(mockModule1)
        .mockReturnValueOnce(mockModule2);
      const lazyLoad = lazyLoader.lazyLoad(mockLoader);

      const firstResult = lazyLoad();
      expect(firstResult).toBe(mockModule1);
      expect(mockLoader).toHaveBeenCalledTimes(1);

      const secondResult = lazyLoad();
      expect(secondResult).toBe(mockModule1);
      expect(mockLoader).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should handle errors in the loader function', () => {
      const error = new Error('Module loading failed');
      const mockLoader = jest.fn().mockImplementation(() => {
        throw error;
      });
      const lazyLoad = lazyLoader.lazyLoad(mockLoader);

      expect(() => lazyLoad()).toThrow('Module loading failed');
      expect(mockLoader).toHaveBeenCalledTimes(1);

      expect(() => lazyLoad()).toThrow('Module loading failed');
      expect(mockLoader).toHaveBeenCalledTimes(2);
    });
  });
});
