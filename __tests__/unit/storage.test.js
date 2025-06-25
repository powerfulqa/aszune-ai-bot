const fs = require('fs').promises;
const path = require('path');
const storage = require('../../src/services/storage');
const logger = require('../../src/utils/logger');

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
  },
}));

jest.mock('../../src/utils/logger');

describe('DataStorage', () => {
  beforeEach(() => {
    // Reset mocks before each test
    fs.mkdir.mockReset();
    fs.writeFile.mockReset();
    fs.readFile.mockReset();
    logger.error.mockReset();
    logger.debug.mockReset();
    
    // Reset singleton state
    storage.initialized = false;
  });

  describe('init', () => {
    it('should create data directory if it does not exist', async () => {
      await storage.init();
      expect(fs.mkdir).toHaveBeenCalledWith(storage.dataDir, { recursive: true });
      expect(storage.initialized).toBe(true);
    });

    it('should not create directory if already initialized', async () => {
      storage.initialized = true;
      await storage.init();
      expect(fs.mkdir).not.toHaveBeenCalled();
    });

    it('should throw and log error if mkdir fails', async () => {
      const error = new Error('mkdir failed');
      fs.mkdir.mockRejectedValue(error);
      await expect(storage.init()).rejects.toThrow('mkdir failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to initialize data storage:', error);
    });
  });

  describe('saveUserStats', () => {
    it('should save user stats to file', async () => {
      const stats = new Map([['user1', { messages: 1, summaries: 0 }]]);
      await storage.saveUserStats(stats);
      const statsObj = { user1: { messages: 1, summaries: 0 } };
      const expectedPath = path.join(storage.dataDir, 'user_stats.json');
      expect(fs.writeFile).toHaveBeenCalledWith(expectedPath, JSON.stringify(statsObj, null, 2));
      expect(logger.debug).toHaveBeenCalledWith('User stats saved successfully');
    });

    it('should log error if writeFile fails', async () => {
      const error = new Error('writeFile failed');
      fs.writeFile.mockRejectedValue(error);
      const stats = new Map();
      await storage.saveUserStats(stats);
      expect(logger.error).toHaveBeenCalledWith('Failed to save user stats:', error);
    });
  });

  describe('loadUserStats', () => {
    it('should load user stats from file', async () => {
      const statsObj = { user1: { messages: 1, summaries: 0 } };
      const data = JSON.stringify(statsObj);
      fs.readFile.mockResolvedValue(data);
      const result = await storage.loadUserStats();
      expect(result).toEqual(statsObj);
      expect(logger.debug).toHaveBeenCalledWith('User stats loaded successfully');
    });

    it('should return empty object if file does not exist', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.readFile.mockRejectedValue(error);
      const result = await storage.loadUserStats();
      expect(result).toEqual({});
      expect(logger.debug).toHaveBeenCalledWith('No user stats file found, starting with empty stats');
    });

    it('should return empty object and log error if readFile fails for other reasons', async () => {
      const error = new Error('readFile failed');
      fs.readFile.mockRejectedValue(error);
      const result = await storage.loadUserStats();
      expect(result).toEqual({});
      expect(logger.error).toHaveBeenCalledWith('Failed to load user stats:', error);
    });

    it('should return empty object and log error if JSON parsing fails', async () => {
        fs.readFile.mockResolvedValue('invalid json');
        const result = await storage.loadUserStats();
        expect(result).toEqual({});
        expect(logger.error).toHaveBeenCalledWith('Failed to load user stats:', expect.any(SyntaxError));
      });
  });
});
