const os = require('os');
const fs = require('fs').promises;
const { execSync } = require('child_process');
const piDetector = require('../../src/utils/pi-detector');
const logger = require('../../src/utils/logger');

// Mock dependencies
jest.mock('os');
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn()
  }
}));
jest.mock('child_process', () => ({
  execSync: jest.fn()
}));
jest.mock('../../src/utils/logger');

describe('Pi Detector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Make sure logger methods are properly mocked
    logger.info.mockClear();
    logger.error.mockClear();
    
    // Mock default OS values
    os.platform.mockReturnValue('linux');
    os.cpus.mockReturnValue([{}, {}, {}]); // 3 CPUs
    os.totalmem.mockReturnValue(4 * 1024 * 1024 * 1024); // 4GB
  });

  describe('detectPiModel', () => {
    it('should detect Raspberry Pi 4', async () => {
      // Mock file content for Pi 4
      fs.readFile.mockResolvedValue('Hardware : BCM2711 Raspberry Pi 4 Model B Rev 1.2');
      
      // Mock successful temperature check
      execSync.mockReturnValue('temp=42.3\'C');
      
      const result = await piDetector.detectPiModel();
      
      expect(result.isPi).toBe(true);
      expect(result.model).toBe('pi4');
      expect(result.cores).toBe(3);
      expect(result.cpuInfo.canReadTemp).toBe(true);
    });
    
    it('should handle non-Pi systems', async () => {
      // Mock file read error (non-Pi system won't have the file)
      fs.readFile.mockRejectedValue(new Error('File not found'));
      
      const result = await piDetector.detectPiModel();
      
      expect(result.isPi).toBe(false);
      expect(result.model).toBe('unknown');
    });
    
    it('should handle errors gracefully', async () => {
      // Mock implementation that throws an error
      os.platform.mockImplementation(() => { 
        throw new Error('Test error'); 
      });
      
      // Pre-configure logger.error mock to avoid "not called" issues
      logger.error.mockImplementation(() => {});
      
      const result = await piDetector.detectPiModel();
      
      expect(result.isPi).toBe(false);
      expect(result.model).toBe('unknown');
    });
    
  });

  describe('generateOptimizedConfig', () => {
    it('should generate config for Pi 4 with 2GB', () => {
      const piInfo = {
        isPi: true,
        model: 'pi4',
        ram: 2,
        cores: 4
      };
      
      const config = piDetector.generateOptimizedConfig(piInfo);
      
      expect(config.ENABLED).toBe(true);
      expect(config.COMPACT_MODE).toBe(true);
      expect(config.LOW_CPU_MODE).toBe(false);
    });
    
    it('should generate config for Pi 3', () => {
      const piInfo = {
        isPi: true,
        model: 'pi3',
        ram: 1,
        cores: 4
      };
      
      const config = piDetector.generateOptimizedConfig(piInfo);
      
      expect(config.ENABLED).toBe(true);
      expect(config.COMPACT_MODE).toBe(true);
      expect(config.LOW_CPU_MODE).toBe(true);
      expect(config.MAX_CONNECTIONS).toBe(1);
    });
    
    it('should generate config for non-Pi systems', () => {
      const piInfo = {
        isPi: false,
        model: 'unknown',
        ram: 8,
        cores: 8
      };
      
      const config = piDetector.generateOptimizedConfig(piInfo);
      
      expect(config.COMPACT_MODE).toBe(false);
      expect(config.MAX_CONNECTIONS).toBe(10);
    });
  });

  describe('initPiOptimizations', () => {
    let originalEnv;
    
    beforeEach(() => {
      originalEnv = { ...process.env };
      process.env = { ...process.env }; // Create a copy to avoid side effects
    });
    
    afterEach(() => {
      process.env = originalEnv; // Restore original environment
    });
    
    it('should initialize and return optimized config', async () => {
      // Explicitly enable Pi optimizations for this test
      process.env.ENABLE_PI_OPTIMIZATIONS = 'true';
      
      // Create our own PI info to match what the actual detection would return
      const mockPiInfo = {
        isPi: true,
        model: 'pi4',
        ram: 2,
        cores: 2,
        cpuInfo: {}
      };
      
      // Setup mocked logger.info before running test
      logger.info.mockImplementation(() => {});
      
      // Don't use spyOn since it won't work with async mocking
      // Just directly mock the module function
      piDetector.detectPiModel = jest.fn().mockResolvedValue(mockPiInfo);
      
      const result = await piDetector.initPiOptimizations();
      
      // The result should have ENABLED=true since we set the env var
      expect(result.ENABLED).toBe(true);
    });
    
    it('should handle errors and return safe defaults', async () => {
      // Setup error mock
      logger.error.mockImplementation(() => {});
      
      // Force an error in detection
      const mockDetect = jest.spyOn(piDetector, 'detectPiModel');
      mockDetect.mockClear();
      mockDetect.mockRejectedValue(new Error('Test error'));
      
      // Explicitly set environment variable to false for this test
      process.env.ENABLE_PI_OPTIMIZATIONS = 'false';
      
      const result = await piDetector.initPiOptimizations();
      
      // Check the result
      expect(result.PI_INFO.isPi).toBe(false);
      expect(result.PI_INFO.model).toBe('unknown');
    });
  });
});
