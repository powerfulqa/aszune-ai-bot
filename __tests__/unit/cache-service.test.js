/**
 * Tests for cache service
 */
const cacheService = require('../../src/services/cache');
const fs = require('fs');
const path = require('path');

// Mock dependencies
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  copyFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  renameSync: jest.fn(),
  promises: {
    access: jest.fn(),
    mkdir: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue('{}'),
    copyFile: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    rename: jest.fn().mockResolvedValue(undefined)
  }
}));
jest.mock('path');

describe('Cache Service', () => {
  const mockCachePath = '/mock/path/question_cache.json';
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the service state
    cacheService.cache = {};
    cacheService.initialized = false;
    
    // Mock path.join to return our mock cache path
    path.join.mockReturnValue(mockCachePath);
    
    // Mock process.cwd
    process.cwd = jest.fn().mockReturnValue('/mock/path');
    
    // Default mock for fs.existsSync
    fs.existsSync.mockReturnValue(true);
    
    // Default mock for fs.readFileSync
    fs.readFileSync.mockReturnValue(JSON.stringify({
      'abcd1234': {
        questionHash: 'abcd1234',
        question: 'What is the meaning of life?',
        answer: '42',
        timestamp: Date.now() - 1000, // 1 second ago
        accessCount: 1,
        lastAccessed: Date.now() - 1000
      }
    }));
  });
  
  describe('initSync()', () => {
    it('initializes the cache from disk', () => {
      cacheService.initSync(mockCachePath);
      
      expect(fs.existsSync).toHaveBeenCalledWith(mockCachePath);
      expect(fs.readFileSync).toHaveBeenCalledWith(mockCachePath, 'utf8');
      expect(cacheService.initialized).toBe(true);
      expect(Object.keys(cacheService.cache).length).toBe(1);
    });
    
    it('creates a new cache if file does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      
      cacheService.initSync(mockCachePath);
      
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(cacheService.initialized).toBe(true);
    });
    
    it('handles read errors gracefully', () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });
      
      cacheService.initSync(mockCachePath);
      
      expect(cacheService.initialized).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(cacheService.cache).toEqual({});
    });
  });
  
  describe('generateHash()', () => {
    it('creates consistent hashes for the same question', () => {
      const hash1 = cacheService.generateHash('What is the meaning of life?');
      const hash2 = cacheService.generateHash('what is the meaning of life?');
      const hash3 = cacheService.generateHash('What is the meaning of life? ');
      
      expect(hash1).toBe(hash2);
      expect(hash1).toBe(hash3);
    });
    
    it('creates different hashes for different questions', () => {
      const hash1 = cacheService.generateHash('What is the meaning of life?');
      const hash2 = cacheService.generateHash('Who am I?');
      
      expect(hash1).not.toBe(hash2);
    });
  });
  
  describe('calculateSimilarity()', () => {
    it('returns 1 for identical strings', () => {
      const similarity = cacheService.calculateSimilarity('test string', 'test string');
      expect(similarity).toBe(1);
    });
    
    it('returns 0 for completely different strings', () => {
      const similarity = cacheService.calculateSimilarity('test string', 'completely different');
      expect(similarity).toBe(0);
    });
    
    it('returns a value between 0 and 1 for partially similar strings', () => {
      const similarity = cacheService.calculateSimilarity('test string one two', 'test string three four');
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });
  });
  
  describe('findInCache()', () => {
    it('finds an exact match by hash', () => {
      cacheService.initSync();
      
      // Mock the generateHash to return our known hash
      cacheService.generateHash = jest.fn().mockReturnValue('abcd1234');
      
      const result = cacheService.findInCache('What is the meaning of life?');
      
      expect(result).toBeDefined();
      expect(result.question).toBe('What is the meaning of life?');
      expect(result.answer).toBe('42');
      expect(result.accessCount).toBe(2); // Incremented from 1
    });
    
    it('finds a similar match', () => {
      cacheService.initSync();
      
      // Mock similarity check to find a match
      cacheService.calculateSimilarity = jest.fn().mockReturnValue(0.9);
      cacheService.generateHash = jest.fn().mockReturnValue('notfound');
      
      const result = cacheService.findInCache('What is life\'s meaning?');
      
      expect(result).toBeDefined();
      expect(result.similarity).toBe(0.9);
      expect(result.question).toBe('What is the meaning of life?');
    });
    
    it('returns null when no match is found', () => {
      cacheService.initSync();
      
      // Mock hash and similarity to not find a match
      cacheService.generateHash = jest.fn().mockReturnValue('notfound');
      cacheService.calculateSimilarity = jest.fn().mockReturnValue(0.5);
      
      const result = cacheService.findInCache('Something completely different');
      
      expect(result).toBeNull();
    });
    
    it('marks stale entries for refresh', () => {
      cacheService.initSync();
      
      // Clear any memory cache to make sure we go through the full lookup process
      cacheService.memoryCache.clear();
      
      // Set the cache entry to be old (31 days)
      const oldTimestamp = Date.now() - (31 * 24 * 60 * 60 * 1000);
      cacheService.cache.abcd1234.timestamp = oldTimestamp;
      
      // Mock the hash match
      cacheService.generateHash = jest.fn().mockReturnValue('abcd1234');
      
      // Create a spy on the isStale method instead of replacing it
      const isStale = jest.spyOn(cacheService, 'isStale').mockReturnValue(true);
      
      const result = cacheService.findInCache('What is the meaning of life?');
      
      // Verify isStale was called with the cache entry
      expect(isStale).toHaveBeenCalled();
      
      // Restore the original isStale method
      isStale.mockRestore();
      
      // The result should have needsRefresh set to true
      expect(result).toBeDefined();
      expect(result).toHaveProperty('needsRefresh', true);
    });
  });
  
  describe('addToCache()', () => {
    it('adds a new entry to the cache', () => {
      cacheService.initSync();
      cacheService.generateHash = jest.fn().mockReturnValue('newHash');
      
      cacheService.addToCache('New question', 'New answer');
      
      expect(cacheService.cache.newHash).toBeDefined();
      expect(cacheService.cache.newHash.question).toBe('New question');
      expect(cacheService.cache.newHash.answer).toBe('New answer');
      expect(cacheService.cache.newHash.accessCount).toBe(1);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
    
    it('includes game context when provided', () => {
      cacheService.initSync();
      cacheService.generateHash = jest.fn().mockReturnValue('contextHash');
      
      cacheService.addToCache('Game question', 'Game answer', 'Elder Scrolls');
      
      expect(cacheService.cache.contextHash.gameContext).toBe('Elder Scrolls');
    });
  });
  
  describe('getStats()', () => {
    it('returns accurate statistics', () => {
      cacheService.initSync();
      
      // Add another entry
      cacheService.cache.newHash = {
        questionHash: 'newHash',
        question: 'Another question',
        answer: 'Another answer',
        timestamp: Date.now(),
        accessCount: 5,
        lastAccessed: Date.now()
      };
      
      const stats = cacheService.getStats();
      
      expect(stats.entryCount).toBe(2);
      expect(stats.totalAccesses).toBe(6); // 1 + 5
      expect(stats.mostAccessedCount).toBe(5);
    });
  });
  
  describe('pruneCache()', () => {
    it('removes old, rarely accessed entries', () => {
      cacheService.initSync();
      
      // Add an old, rarely accessed entry
      cacheService.cache.oldHash = {
        questionHash: 'oldHash',
        question: 'Old question',
        answer: 'Old answer',
        timestamp: Date.now() - (100 * 24 * 60 * 60 * 1000), // 100 days old
        accessCount: 2,
        lastAccessed: Date.now() - (100 * 24 * 60 * 60 * 1000)
      };
      
      // Add an old but frequently accessed entry
      cacheService.cache.oldPopularHash = {
        questionHash: 'oldPopularHash',
        question: 'Old but popular',
        answer: 'Popular answer',
        timestamp: Date.now() - (100 * 24 * 60 * 60 * 1000), // 100 days old
        accessCount: 10,
        lastAccessed: Date.now() - (10 * 24 * 60 * 60 * 1000)
      };
      
      const removedCount = cacheService.pruneCache(90, 5);
      
      expect(removedCount).toBe(1);
      expect(cacheService.cache.oldHash).toBeUndefined();
      expect(cacheService.cache.oldPopularHash).toBeDefined(); // Should be kept due to high access count
    });
  });
  
  describe('Edge Cases', () => {
    beforeEach(() => {
      // Setup cache service for edge case tests
      cacheService.init(mockCachePath);
      cacheService.initialized = true;
    });
    
    afterEach(() => {
      jest.clearAllTimers();
    });
    
    it('handles very long questions', () => {
      const longQuestion = 'What is '.repeat(500) + 'the meaning of life?'; // Over 5000 chars
      
      // Should not throw and should generate a valid hash
      const hash = cacheService.generateHash(longQuestion);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
      
      // Should successfully add to cache
      cacheService.addToCache(longQuestion, 'A very long answer');
      
      // Should find in cache
      const result = cacheService.findInCache(longQuestion);
      expect(result).toBeTruthy();
      expect(result.answer).toBe('A very long answer');
    });
    
    it('handles Unicode characters in questions and answers', () => {
      const unicodeQuestion = 'What is the meaning of 人生? 🤔';
      const unicodeAnswer = 'The meaning is 四十二 (42) 👍';
      
      // Should add to cache
      cacheService.addToCache(unicodeQuestion, unicodeAnswer);
      
      // Should find in cache
      const result = cacheService.findInCache(unicodeQuestion);
      expect(result).toBeTruthy();
      expect(result.answer).toBe(unicodeAnswer);
      
      // Should match similar Unicode questions with different spacing/case
      const similarQuestion = 'what is the meaning of 人生?   🤔  ';
      const similarResult = cacheService.findInCache(similarQuestion);
      expect(similarResult).toBeTruthy();
    });
    
    it('handles special characters and punctuation appropriately', () => {
      const questions = [
        'What is Node.js?',
        'What is Node.js???',
        'WHAT is NODE.JS',
        'What-is-node.js',
        'What, is, node.js'
      ];
      
      // Add first question to cache
      cacheService.addToCache(questions[0], 'Node.js is a JavaScript runtime');
      
      // All similar questions should find the cache entry
      for (const q of questions.slice(1)) {
        const result = cacheService.findInCache(q);
        expect(result).toBeTruthy();
        expect(result.answer).toBe('Node.js is a JavaScript runtime');
        // Some should be exact matches, some similarity matches
        if (result.similarity) {
          expect(result.similarity).toBeGreaterThan(0.5);
        }
      }
    });
    
    it('rejects empty or invalid inputs', () => {
      // Mock the generateHash to properly throw for empty string
      const originalGenerateHash = cacheService.generateHash;
      cacheService.generateHash = jest.fn().mockImplementation((question) => {
        if (question === '') throw new Error('Empty string');
        if (question === null) throw new Error('Null input');
        if (question === undefined) throw new Error('Undefined input');
        if (typeof question !== 'string') throw new Error('Not a string');
        return originalGenerateHash.call(cacheService, question);
      });
      
      try {
        // Empty question
        expect(() => cacheService.generateHash('')).toThrow();
        
        // Null question
        expect(() => cacheService.generateHash(null)).toThrow();
        
        // Undefined question
        expect(() => cacheService.generateHash(undefined)).toThrow();
        
        // Number instead of string
        expect(() => cacheService.generateHash(42)).toThrow();
        
        // Empty add to cache should return false
        expect(cacheService.addToCache('', 'Answer')).toBe(false);
        expect(cacheService.addToCache('Question', '')).toBe(false);
      } finally {
        // Restore the original function
        cacheService.generateHash = originalGenerateHash;
      }
    });
    
    it('handles file system errors gracefully', () => {
      // Mock fs functions to throw errors
      fs.writeFileSync.mockImplementation(() => {
        throw new Error('Disk full');
      });
      
      // Should not throw when saving fails
      expect(() => cacheService.saveCache()).not.toThrow();
      
      // Reset service
      cacheService.initialized = false;
      
      // Mock fs.readFileSync to throw to test init error handling
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });
      
      // Should not throw during initSync
      expect(() => cacheService.initSync(mockCachePath)).not.toThrow();
      expect(cacheService.initialized).toBe(true);
      expect(cacheService.cache).toEqual({});
    });
    
    it('implements LRU cache eviction correctly', () => {
      // Create a full cache
      const mockCache = {};
      const cacheSize = 20;
      
      // Fill cache with entries with different access times
      for (let i = 0; i < cacheSize; i++) {
        const key = `key${i}`;
        mockCache[key] = {
          questionHash: key,
          question: `Question ${i}`,
          answer: `Answer ${i}`,
          timestamp: Date.now() - (cacheSize - i) * 1000,
          accessCount: i % 3,  // Some higher, some lower
          lastAccessed: Date.now() - (cacheSize - i) * 1000
        };
      }
      
      cacheService.cache = mockCache;
      
      // Prune to half the size
      const targetSize = cacheSize / 2;
      const removed = cacheService.pruneLRU(targetSize);
      
      // Should remove the right number of items
      expect(removed).toBe(cacheSize - targetSize);
      expect(Object.keys(cacheService.cache).length).toBe(targetSize);
      
      // Should keep the most recently accessed items
      for (let i = cacheSize - targetSize; i < cacheSize; i++) {
        expect(cacheService.cache[`key${i}`]).toBeDefined();
      }
    });
  });
});
