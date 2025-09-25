/**
 * Pi Detector - Detection Tests
 * Tests Pi model detection functionality
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

describe('Pi Detector - Detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    it('should detect Raspberry Pi 3', async () => {
      // Mock file content for Pi 3
      fs.readFile.mockResolvedValue('Hardware : BCM2837 Raspberry Pi 3 Model B Rev 1.2');

      // Mock successful temperature check
      execSync.mockReturnValue('temp=45.1\'C');

      const result = await piDetector.detectPiModel();

      expect(result.isPi).toBe(true);
      expect(result.model).toBe('pi3');
      expect(result.cores).toBe(3);
      expect(result.cpuInfo.canReadTemp).toBe(true);
    });

    it('should detect Raspberry Pi 5', async () => {
      // Mock file content for Pi 5
      fs.readFile.mockResolvedValue('Hardware : BCM2712 Raspberry Pi 5 Model B Rev 1.0');

      // Mock successful temperature check
      execSync.mockReturnValue('temp=38.7\'C');

      const result = await piDetector.detectPiModel();

      expect(result.isPi).toBe(true);
      expect(result.model).toBe('pi5');
      expect(result.cores).toBe(3);
      expect(result.cpuInfo.canReadTemp).toBe(true);
    });

    it('should handle CPU frequency detection', async () => {
      fs.readFile.mockResolvedValue('Hardware : BCM2711 Raspberry Pi 4 Model B Rev 1.2\nCPU max MHz: 1500.0\nRevision: c03112');
      execSync.mockReturnValue('temp=42.3\'C');

      const result = await piDetector.detectPiModel();

      expect(result.cpuInfo.maxFrequency).toBeDefined();
      expect(result.cpuInfo.maxFrequency).toBe(1500.0);
    });

    it('should handle temperature reading failure', async () => {
      fs.readFile.mockResolvedValue('Hardware : BCM2711 Raspberry Pi 4 Model B Rev 1.2');
      execSync.mockImplementation(() => {
        throw new Error('Temperature read failed');
      });

      const result = await piDetector.detectPiModel();

      expect(result.isPi).toBe(true);
      expect(result.model).toBe('pi4');
      expect(result.cpuInfo.canReadTemp).toBe(false);
    });

    it('should handle non-Pi systems', async () => {
      fs.readFile.mockResolvedValue('Hardware : Generic x86_64');

      const result = await piDetector.detectPiModel();

      expect(result.isPi).toBe(false);
      expect(result.model).toBe('unknown');
    });

    it('should handle non-Linux systems', async () => {
      os.platform.mockReturnValue('win32');

      const result = await piDetector.detectPiModel();

      expect(result.isPi).toBe(false);
      expect(result.model).toBe('unknown');
    });

    it('should handle errors gracefully', async () => {
      fs.readFile.mockRejectedValue(new Error('File read failed'));

      const result = await piDetector.detectPiModel();

      expect(result.isPi).toBe(false);
      expect(result.model).toBe('unknown');
      expect(logger.error).toHaveBeenCalledWith('Error detecting Pi model:', expect.any(Error));
    });
  });
});
