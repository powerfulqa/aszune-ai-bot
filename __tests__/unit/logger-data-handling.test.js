/**
 * Logger Critical Coverage Tests - Data Logging and Error Handling
 */

const fs = require('fs').promises;

// Mock fs promises
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    stat: jest.fn(),
    appendFile: jest.fn(),
    rename: jest.fn(),
    readdir: jest.fn(),
    unlink: jest.fn()
  }
}));

// Mock config
jest.mock('../../src/config/config', () => ({
  LOGGING: {
    DEFAULT_MAX_SIZE_MB: 10,
    MAX_LOG_FILES: 5
  }
}));

describe('Logger - Data Logging and Error Handling', () => {
  let logger;
  let originalEnv;
  let originalConsole;

  beforeEach(() => {
    jest.clearAllMocks();
    
    originalEnv = { ...process.env };
    originalConsole = { ...console };
    
    process.env.NODE_ENV = 'development';
    process.env.PI_LOG_LEVEL = 'DEBUG';
    
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    
    fs.mkdir.mockResolvedValue();
    fs.stat.mockResolvedValue({ size: 1000000 });
    fs.appendFile.mockResolvedValue();
    fs.rename.mockResolvedValue();
    fs.readdir.mockResolvedValue(['bot.log.2023-01-01']);
    fs.unlink.mockResolvedValue();
    
    delete require.cache[require.resolve('../../src/utils/logger')];
    logger = require('../../src/utils/logger');
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.assign(console, originalConsole);
  });

  describe('Data Logging', () => {
    it('should log data object when provided to info', async () => {
      const data = { key: 'value', number: 123 };
      
      await logger.info('test message', data);
      
      expect(console.log).toHaveBeenCalledWith(data);
    });

    it('should log data object when provided to warn', async () => {
      const data = { warning: 'data' };
      
      await logger.warn('test message', data);
      
      expect(console.warn).toHaveBeenCalledWith(data);
    });

    it('should log data object when provided to debug', async () => {
      const data1 = { debug: 'data1' };
      const data2 = { debug: 'data2' };
      
      await logger.debug('test message', data1, data2);
      
      expect(console.log).toHaveBeenCalledWith(data1);
      expect(console.log).toHaveBeenCalledWith(data2);
    });

    it('should handle null data gracefully', async () => {
      await logger.info('test message', null);
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] test message')
      );
    });

    it('should handle undefined data gracefully', async () => {
      await logger.info('test message', undefined);
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] test message')
      );
    });
  });

  describe('Error Method Context', () => {
    it('should handle error method with request details', async () => {
      const mockError = {
        response: {
          status: 500,
          data: { error: 'Server error' }
        }
      };
      
      await logger.error('API call failed', mockError);
      
      expect(console.error).toHaveBeenCalledWith(
        'API Error Response:',
        expect.objectContaining({
          type: 'API Error Response',
          status: 500,
          data: { error: 'Server error' }
        })
      );
    });

    it('should handle errors without response', async () => {
      const mockError = {
        request: { url: '/api/test' }
      };
      
      await logger.error('API call failed', mockError);
      
      expect(console.error).toHaveBeenCalledWith(
        'No response received from API:',
        mockError.request
      );
    });

    it('should handle errors without stack trace', async () => {
      const mockError = {
        message: 'Simple error'
      };
      
      await logger.error('Operation failed', mockError);
      
      expect(console.error).toHaveBeenCalledWith('Error:', 'Simple error');
    });
  });

  describe('Test Environment Handling', () => {
    it('should not write to file in test environment', async () => {
      process.env.NODE_ENV = 'test';
      delete require.cache[require.resolve('../../src/utils/logger')];
      const testLogger = require('../../src/utils/logger');
      
      await testLogger.info('test message');
      
      expect(fs.appendFile).not.toHaveBeenCalled();
    });

    it('should not create directory in test environment', () => {
      process.env.NODE_ENV = 'test';
      delete require.cache[require.resolve('../../src/utils/logger')];
      require('../../src/utils/logger');
      
      expect(fs.mkdir).not.toHaveBeenCalled();
    });
  });
});