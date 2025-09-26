/**
 * Pi Detector - Initialization Tests
 * Tests Pi optimization initialization functionality
 */

const os = require('os');
const fs = require('fs').promises;
const { execSync } = require('child_process');
const piDetector = require('../../src/utils/pi-detector');
const logger = require('../../src/utils/logger');

// Mock dependencies
jest.mock('os');
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}));
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));
jest.mock('../../src/utils/logger');

describe('Pi Detector - Initialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logger.info.mockClear();
    logger.error.mockClear();

    // Clear environment variables that might interfere
    delete process.env.PI_OPTIMIZATIONS_ENABLED;
    delete process.env.PI_OPTIMIZATIONS_COMPACT_MODE;
    delete process.env.PI_COMPACT_MODE;
    delete process.env.PI_OPTIMIZATIONS_MAX_CONNECTIONS;
    delete process.env.PI_MAX_CONNECTIONS;
    delete process.env.ENABLE_PI_OPTIMIZATIONS;

    // Mock default OS values
    os.platform.mockReturnValue('linux');
    os.cpus.mockReturnValue([{}, {}, {}]); // 3 CPUs
    os.totalmem.mockReturnValue(4 * 1024 * 1024 * 1024); // 4GB
  });

  describe('initPiOptimizations', () => {
    it('should initialize and return optimized config', async () => {
      // Mock successful Pi detection
      fs.readFile.mockResolvedValue('Hardware : BCM2711 Raspberry Pi 4 Model B Rev 1.2');
      execSync.mockReturnValue('temp=42.3\'C');

      const result = await piDetector.initPiOptimizations();

      expect(result).toBeDefined();
      expect(result.ENABLED).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Detected pi4'));
    });

    it('should respect environment variable overrides', async () => {
      // Set environment variables
      process.env.PI_OPTIMIZATIONS_ENABLED = 'false';
      process.env.PI_OPTIMIZATIONS_COMPACT_MODE = 'false';
      process.env.PI_OPTIMIZATIONS_MAX_CONNECTIONS = '10';

      // Mock successful Pi detection
      fs.readFile.mockResolvedValue('Hardware : BCM2711 Raspberry Pi 4 Model B Rev 1.2');
      execSync.mockReturnValue('temp=42.3\'C');

      const result = await piDetector.initPiOptimizations();

      expect(result.ENABLED).toBe(false);
      expect(result.COMPACT_MODE).toBe(false);
      expect(result.MAX_CONNECTIONS).toBe(10);

      // Clean up environment variables
      delete process.env.PI_OPTIMIZATIONS_ENABLED;
      delete process.env.PI_OPTIMIZATIONS_COMPACT_MODE;
      delete process.env.PI_OPTIMIZATIONS_MAX_CONNECTIONS;
    });

    it('should handle errors and return safe defaults', async () => {
      // Clear environment variables that might affect the result
      delete process.env.ENABLE_PI_OPTIMIZATIONS;
      delete process.env.PI_OPTIMIZATIONS_ENABLED;
      
      // Mock file read failure to trigger error handling
      fs.readFile.mockRejectedValue(new Error('File read failed'));

      const result = await piDetector.initPiOptimizations();

      expect(result).toBeDefined();
      // When file read fails, the function should return safe defaults
      expect(result.ENABLED).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('Error initializing Pi optimizations: Pi detection failed');
    });

    it('should not initialize Pi optimizations when disabled by environment variable', async () => {
      process.env.PI_OPTIMIZATIONS_ENABLED = 'false';

      const result = await piDetector.initPiOptimizations();

      expect(result.ENABLED).toBe(false);
      // When Pi optimizations are disabled, no log message is expected
      expect(logger.info).not.toHaveBeenCalled();

      delete process.env.PI_OPTIMIZATIONS_ENABLED;
    });

    it('should use environment-provided values when initialization fails', async () => {
      // Set environment variables
      process.env.PI_OPTIMIZATIONS_ENABLED = 'true';
      process.env.PI_OPTIMIZATIONS_COMPACT_MODE = 'true';
      process.env.PI_OPTIMIZATIONS_MAX_CONNECTIONS = '2';

      // Mock initialization failure
      fs.readFile.mockRejectedValue(new Error('Detection failed'));

      const result = await piDetector.initPiOptimizations();

      expect(result.ENABLED).toBe(true);
      expect(result.COMPACT_MODE).toBe(true);
      expect(result.MAX_CONNECTIONS).toBe(2);

      // Clean up environment variables
      delete process.env.PI_OPTIMIZATIONS_ENABLED;
      delete process.env.PI_OPTIMIZATIONS_COMPACT_MODE;
      delete process.env.PI_OPTIMIZATIONS_MAX_CONNECTIONS;
    });
  });
});
