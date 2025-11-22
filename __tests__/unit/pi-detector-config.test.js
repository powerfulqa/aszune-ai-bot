/**
 * Pi Detector - Config Generation Tests
 * Tests optimized configuration generation for different Pi models
 */

const os = require('os');
const piDetector = require('../../src/utils/pi-detector');
const logger = require('../../src/utils/logger');

// Mock dependencies
jest.mock('os');
jest.mock('../../src/utils/logger');

describe('Pi Detector - Config Generation', () => {
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

  describe('generateOptimizedConfig', () => {
    it('should generate config for Pi 4 with 2GB', () => {
      const piInfo = {
        isPi: true,
        model: 'pi4',
        cores: 4,
        ram: 2, // 2GB
      };

      const config = piDetector.generateOptimizedConfig(piInfo);

      expect(config.ENABLED).toBe(true);
      expect(config.COMPACT_MODE).toBe(false);
      expect(config.MAX_CONNECTIONS).toBe(6);
      expect(config.MAX_HISTORY).toBe(20);
      expect(config.CACHE_SIZE).toBe(100);
    });

    it('should generate config for Pi 4 with 1GB', () => {
      const piInfo = {
        isPi: true,
        model: 'pi4',
        cores: 4,
        ram: 1, // 1GB
      };

      const config = piDetector.generateOptimizedConfig(piInfo);

      expect(config.ENABLED).toBe(true);
      expect(config.COMPACT_MODE).toBe(true);
      expect(config.MAX_CONNECTIONS).toBe(4);
      expect(config.MAX_HISTORY).toBe(15);
      expect(config.CACHE_SIZE).toBe(75);
    });

    it('should generate config for Pi 4 with 4GB', () => {
      const piInfo = {
        isPi: true,
        model: 'pi4',
        cores: 4,
        ram: 4, // 4GB
      };

      const config = piDetector.generateOptimizedConfig(piInfo);

      expect(config.ENABLED).toBe(true);
      expect(config.COMPACT_MODE).toBe(false);
      expect(config.MAX_CONNECTIONS).toBe(10);
      expect(config.MAX_HISTORY).toBe(30);
      expect(config.CACHE_SIZE).toBe(200);
    });

    it('should generate config for Pi 3', () => {
      const piInfo = {
        isPi: true,
        model: 'pi3',
        cores: 4,
        ram: 1, // 1GB
      };

      const config = piDetector.generateOptimizedConfig(piInfo);

      expect(config.ENABLED).toBe(true);
      expect(config.COMPACT_MODE).toBe(true);
      expect(config.MAX_CONNECTIONS).toBe(3);
      expect(config.MAX_HISTORY).toBe(10);
      expect(config.CACHE_SIZE).toBe(50);
    });

    it('should generate config for Pi 5 with 4GB', () => {
      const piInfo = {
        isPi: true,
        model: 'pi5',
        cores: 4,
        ram: 4, // 4GB
      };

      const config = piDetector.generateOptimizedConfig(piInfo);

      expect(config.ENABLED).toBe(true);
      expect(config.COMPACT_MODE).toBe(false);
      expect(config.MAX_CONNECTIONS).toBe(6);
      expect(config.MAX_HISTORY).toBe(25);
      expect(config.CACHE_SIZE).toBe(150);
    });

    it('should generate config for Pi 5 with 8GB', () => {
      const piInfo = {
        isPi: true,
        model: 'pi5',
        cores: 4,
        ram: 8, // 8GB
      };

      const config = piDetector.generateOptimizedConfig(piInfo);

      expect(config.ENABLED).toBe(true);
      expect(config.COMPACT_MODE).toBe(false);
      expect(config.MAX_CONNECTIONS).toBe(8);
      expect(config.MAX_HISTORY).toBe(30);
      expect(config.CACHE_SIZE).toBe(200);
    });

    it('should generate config for unknown Pi model', () => {
      const piInfo = {
        isPi: true,
        model: 'unknown',
        cores: 4,
        ram: 2, // 2GB
      };

      const config = piDetector.generateOptimizedConfig(piInfo);

      expect(config.ENABLED).toBe(true);
      expect(config.COMPACT_MODE).toBe(true);
      expect(config.MAX_CONNECTIONS).toBe(2);
      expect(config.MAX_HISTORY).toBe(10);
      expect(config.CACHE_SIZE).toBe(50);
    });

    it('should generate config for non-Pi systems', () => {
      const piInfo = {
        isPi: false,
        model: 'unknown',
        cores: 8,
        ram: 16, // 16GB
      };

      const config = piDetector.generateOptimizedConfig(piInfo);

      expect(config.ENABLED).toBe(false);
      expect(config.COMPACT_MODE).toBe(false);
      expect(config.MAX_CONNECTIONS).toBe(10);
      expect(config.MAX_HISTORY).toBe(50);
      expect(config.CACHE_SIZE).toBe(500);
    });
  });
});
