/**
 * Tests for the Lazy Loader utility
 */
const lazyLoader = require('../../src/utils/lazy-loader');

describe('Lazy Loader', () => {
  it('should return a function that loads a module when called', () => {
    // Create a mock module
    const mockModule = { foo: 'bar' };
    const mockLoader = jest.fn().mockReturnValue(mockModule);
    
    // Create a lazy loader for the mock module
    const lazyLoad = lazyLoader.lazyLoad(mockLoader);
    
    // The loader function should not have been called yet
    expect(mockLoader).not.toHaveBeenCalled();
    
    // Access the module through the lazy loader
    const loadedModule = lazyLoad();
    
    // Now the loader function should have been called
    expect(mockLoader).toHaveBeenCalledTimes(1);
    
    // And the returned module should be the mock module
    expect(loadedModule).toBe(mockModule);
    
    // Calling the lazy loader again should not call the loader function again
    const loadedModuleAgain = lazyLoad();
    expect(mockLoader).toHaveBeenCalledTimes(1);
    expect(loadedModuleAgain).toBe(mockModule);
  });

  it('should handle modules with methods', () => {
    // Create a mock module with methods
    const mockModule = {
      greet: jest.fn().mockReturnValue('Hello'),
      farewell: jest.fn().mockReturnValue('Goodbye')
    };
    const mockLoader = jest.fn().mockReturnValue(mockModule);
    
    // Create a lazy loader for the mock module
    const lazyLoad = lazyLoader.lazyLoad(mockLoader);
    
    // Access the module methods
    const module = lazyLoad();
    const greeting = module.greet();
    const farewell = module.farewell();
    
    // Verify the loader was called and methods work
    expect(mockLoader).toHaveBeenCalledTimes(1);
    expect(greeting).toBe('Hello');
    expect(farewell).toBe('Goodbye');
    expect(mockModule.greet).toHaveBeenCalledTimes(1);
    expect(mockModule.farewell).toHaveBeenCalledTimes(1);
  });

  it('should memoize the loaded module', () => {
    // Create mock modules with different values
    const mockModule1 = { id: 1 };
    const mockModule2 = { id: 2 };
    
    // Create a loader that returns different modules on successive calls
    const mockLoader = jest.fn()
      .mockReturnValueOnce(mockModule1)
      .mockReturnValueOnce(mockModule2);
    
    // Create a lazy loader
    const lazyLoad = lazyLoader.lazyLoad(mockLoader);
    
    // First call should return the first mock module
    const firstResult = lazyLoad();
    expect(firstResult).toBe(mockModule1);
    expect(mockLoader).toHaveBeenCalledTimes(1);
    
    // Second call should return the same module, not the second mock module
    const secondResult = lazyLoad();
    expect(secondResult).toBe(mockModule1);
    expect(mockLoader).toHaveBeenCalledTimes(1);
  });

  it('should handle errors in the loader function', () => {
    // Create a loader that throws an error
    const error = new Error('Module loading failed');
    const mockLoader = jest.fn().mockImplementation(() => {
      throw error;
    });
    
    // Create a lazy loader
    const lazyLoad = lazyLoader.lazyLoad(mockLoader);
    
    // Calling the lazy loader should throw the error
    expect(() => lazyLoad()).toThrow('Module loading failed');
    expect(mockLoader).toHaveBeenCalledTimes(1);
    
    // Subsequent calls should also throw (since memoization didn't occur due to error)
    expect(() => lazyLoad()).toThrow('Module loading failed');
    expect(mockLoader).toHaveBeenCalledTimes(2);
  });
});
