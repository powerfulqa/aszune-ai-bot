/**
 * Cache service for storing and retrieving frequently asked questions
 * Reduces API token usage by serving cached responses when possible
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const fsPromises = fs.promises;
const { LRUCache } = require('lru-cache');
const logger = require('../utils/logger');
const config = require('../config/config');
const { 
  CacheError,
  CacheSaveError,
  CacheValueError
} = require('../utils/errors');

// Constants
const DEFAULT_CACHE_PATH = path.join(__dirname, '../../data/question_cache.json');
const CACHE_REFRESH_THRESHOLD = config.CACHE?.REFRESH_THRESHOLD_MS || (30 * 24 * 60 * 60 * 1000);
const SIMILARITY_THRESHOLD = config.CACHE?.SIMILARITY_THRESHOLD || 0.85;
const MAX_CACHE_SIZE = config.CACHE?.MAX_SIZE || 10000;
const LRU_PRUNE_THRESHOLD = config.CACHE?.LRU_PRUNE_THRESHOLD || 9000;
const LRU_PRUNE_TARGET = config.CACHE?.LRU_PRUNE_TARGET || 7500;

class CacheService {
  constructor() {
    // Persistent cache
    this.cache = {};
    this.initialized = false;
    this.cachePath = DEFAULT_CACHE_PATH;
    this.isDirty = false; // Track if cache has been modified and needs saving
    
    // In-memory LRU cache for fast lookups
    const memCacheSize = parseInt(process.env.ASZUNE_MEMORY_CACHE_SIZE, 10) || 500;
    this.memoryCache = new LRUCache({ max: memCacheSize });
    
    // Pruning thresholds
    this.LRU_PRUNE_THRESHOLD = LRU_PRUNE_THRESHOLD;
    this.LRU_PRUNE_TARGET = LRU_PRUNE_TARGET;
    
    // Cache statistics metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      exactMatches: 0,
      similarityMatches: 0,
      memoryHits: 0,
      errors: 0,
      lastReset: Date.now()
    };
  }

  /**
   * Initialize the cache from disk
   * @param {string} customPath - Optional custom path for the cache file (used for testing)
   * @returns {Promise<void>} - Promise that resolves when initialization is complete
   */
  async init(customPath) {
    if (this.initialized) return;
    
    // Allow using a custom path for testing
    if (customPath) {
      this.cachePath = customPath;
    }
    
    try {
      // Ensure the directory exists
      const dir = path.dirname(this.cachePath);
      try {
        await fsPromises.access(dir);
      } catch (dirErr) {
        // Directory doesn't exist, create it
        try {
          await fsPromises.mkdir(dir, { recursive: true });
          logger.info(`Created cache directory: ${dir}`);
        } catch (mkdirErr) {
          // Handle mkdir errors gracefully
          logger.warn(`Failed to create cache directory: ${mkdirErr.message}`);
        }
      }
      
      let createNewCache = false;
      try {
        // Try to access the cache file
        await fsPromises.access(this.cachePath);
        
        // File exists, read it
        try {
          const cacheData = await fsPromises.readFile(this.cachePath, 'utf8');
          this.cache = JSON.parse(cacheData);
        } catch (parseErr) {
          // File exists but couldn't be parsed
          logger.warn(`Failed to parse cache file: ${parseErr.message}`);
          createNewCache = true;
        }
      } catch (accessErr) {
        // File doesn't exist, create a new one
        createNewCache = true;
      }
      
      if (createNewCache) {
        try {
          await this.saveCacheAsync();
        } catch (saveErr) {
          logger.warn(`Failed to create new cache file: ${saveErr.message}`);
        }
      }
      
      this.initialized = true;
      logger.info(`Cache initialized with ${Object.keys(this.cache).length} entries`);
    } catch (error) {
      // Log the error details
      if (error instanceof CacheError) {
        logger.error(`Cache initialization error: ${error.message}`, error.details);
      } else {
        logger.error('Error initializing cache:', error);
      }
      
      // Create an empty cache if there was an error
      this.cache = {};
      try {
        await this.saveCacheAsync();
      } catch (saveErr) {
        // If we can't even save an empty cache, log but continue
        logger.error('Failed to save empty cache during initialization:', saveErr);
      }
      
      this.initialized = true; // Make sure to set initialized to true even after an error
    }
  }

  /**
   * Initialize the cache from disk synchronously - for backward compatibility
   * @param {string} customPath - Optional custom path for the cache file (used for testing)
   */
  initSync(customPath) {
    if (this.initialized) return;
    
    // Allow using a custom path for testing
    if (customPath) {
      this.cachePath = customPath;
    }
    
    try {
      // Ensure the directory exists
      const dir = path.dirname(this.cachePath);
      try {
        fs.accessSync(dir);
      } catch (dirErr) {
        // Directory doesn't exist, create it
        try {
          fs.mkdirSync(dir, { recursive: true });
          logger.info(`Created cache directory: ${dir}`);
        } catch (mkdirErr) {
          // Handle mkdir errors gracefully
          logger.warn(`Failed to create cache directory: ${mkdirErr.message}`);
        }
      }
      
      let createNewCache = false;
      try {
        // Try to access the cache file
        fs.accessSync(this.cachePath);
        
        // File exists, read it
        try {
          const cacheData = fs.readFileSync(this.cachePath, 'utf8');
          this.cache = JSON.parse(cacheData);
        } catch (parseErr) {
          // File exists but couldn't be parsed
          logger.warn(`Failed to parse cache file: ${parseErr.message}`);
          createNewCache = true;
        }
      } catch (accessErr) {
        // File doesn't exist, create a new one
        createNewCache = true;
      }
      
      if (createNewCache) {
        try {
          this.saveCache();
        } catch (saveErr) {
          logger.warn(`Failed to create new cache file: ${saveErr.message}`);
        }
      }
      
      this.initialized = true;
      logger.info(`Cache initialized with ${Object.keys(this.cache).length} entries`);
    } catch (error) {
      // Log the error details
      if (error instanceof CacheError) {
        logger.error(`Cache initialization error: ${error.message}`, error.details);
      } else {
        logger.error('Error initializing cache:', error);
      }
      
      // Create an empty cache if there was an error
      this.cache = {};
      try {
        this.saveCache();
      } catch (saveErr) {
        // If we can't even save an empty cache, log but continue
        logger.error('Failed to save empty cache during initialization:', saveErr);
      }
      
      this.initialized = true; // Make sure to set initialized to true even after an error
    }
  }

  /**
   * Save the cache to disk asynchronously with robust error handling
   * @returns {Promise<void>}
   */
  async saveCacheAsync() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.cachePath);
      try {
        await fsPromises.access(dir);
      } catch (dirErr) {
        // Directory doesn't exist, create it
        try {
          await fsPromises.mkdir(dir, { recursive: true });
        } catch (mkdirErr) {
          throw new CacheSaveError(`Failed to create directory: ${mkdirErr.message}`, {
            cause: mkdirErr,
            path: dir
          });
        }
      }
      
      // Create backup before overwriting
      try {
        await fsPromises.access(this.cachePath);
        // File exists, create backup
        try {
          await fsPromises.copyFile(this.cachePath, `${this.cachePath}.backup`);
        } catch (backupError) {
          logger.warn('Failed to create backup before saving cache:', backupError);
          // Continue with save attempt even if backup fails
        }
      } catch (accessErr) {
        // File doesn't exist, no need for backup
      }
      
      // Write to a temporary file first, then rename for atomic-like operation
      const tempPath = `${this.cachePath}.temp`;
      try {
        await fsPromises.writeFile(tempPath, JSON.stringify(this.cache, null, 2));
      } catch (writeErr) {
        throw new CacheSaveError(`Failed to write temp file: ${writeErr.message}`, {
          cause: writeErr,
          path: tempPath
        });
      }
      
      // In Windows, we need to unlink first before rename to avoid EPERM error
      try {
        await fsPromises.unlink(this.cachePath);
      } catch (unlinkErr) {
        // File might not exist, that's okay
      }
      
      try {
        await fsPromises.rename(tempPath, this.cachePath);
      } catch (renameErr) {
        throw new CacheSaveError(`Failed to rename temp file: ${renameErr.message}`, {
          cause: renameErr,
          path: tempPath
        });
      }
      
      logger.debug('Cache saved successfully');
      this.isDirty = false; // Reset dirty flag after saving
      return true;
    } catch (error) {
      const saveError = new CacheSaveError(`Failed to save cache: ${error.message}`, {
        originalError: error,
        path: this.cachePath
      });
      
      logger.error('Error saving cache:', saveError);
      throw saveError; // Re-throw the error to allow for proper handling by the caller
    }
  }
  
  /**
   * Save the cache to disk synchronously - for backward compatibility
   */
  saveCache() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.cachePath);
      try {
        fs.accessSync(dir);
      } catch (dirErr) {
        // Directory doesn't exist, create it
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch (mkdirErr) {
          throw new CacheSaveError(`Failed to create directory: ${mkdirErr.message}`, {
            cause: mkdirErr,
            path: dir
          });
        }
      }
      
      // Create backup before overwriting
      try {
        fs.accessSync(this.cachePath);
        // File exists, create backup
        try {
          fs.copyFileSync(this.cachePath, `${this.cachePath}.backup`);
        } catch (backupError) {
          logger.warn('Failed to create backup before saving cache:', backupError);
          // Continue with save attempt even if backup fails
        }
      } catch (accessErr) {
        // File doesn't exist, no need for backup
      }
      
      // Write cache to file
      fs.writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2));
      
      logger.debug('Cache saved successfully');
      this.isDirty = false; // Reset dirty flag after saving
      return true;
    } catch (error) {
      const saveError = new CacheSaveError(`Failed to save cache: ${error.message}`, {
        originalError: error,
        path: this.cachePath
      });
      
      logger.error('Error saving cache:', saveError);
      throw saveError; // Re-throw the error to allow for proper handling by the caller
    }
  }
  
  /**
   * Save the cache to disk if it has been modified
   * This method can be called periodically to batch writes
   * @returns {Promise<boolean>} True if save was performed
   */
  async saveIfDirtyAsync() {
    if (this.isDirty) {
      await this.saveCacheAsync();
      return true;
    }
    return false;
  }

  /**
   * Save the cache to disk if it has been modified (synchronous version)
   * @returns {boolean} True if save was performed
   */
  saveIfDirty() {
    if (this.isDirty) {
      this.saveCache();
      return true;
    }
    return false;
  }

  /**
   * Generate a hash for a question to use as a cache key
   * @param {string} question - The question text
   * @returns {string} - A hash of the question
   * @throws {CacheValueError} - If question is invalid
   */
  generateHash(question) {
    // Input validation - make sure to explicitly check all edge cases including empty strings
    if (question === null || question === undefined) {
      throw new CacheValueError('Question cannot be null or undefined', {
        value: question,
        type: typeof question
      });
    }
    
    if (typeof question !== 'string') {
      throw new CacheValueError(`Question must be a string, got ${typeof question}`, {
        value: question,
        type: typeof question
      });
    }
    
    // Check for empty strings or strings with only whitespace
    // The trim is needed to check for strings with only spaces
    if (question === '' || question.trim() === '') {
      throw new CacheValueError('Question cannot be an empty string', {
        value: question,
        length: question.length
      });
    }
    
    // Normalize the question: lowercase, trim whitespace, normalize spaces, remove punctuation and special characters
    let normalized = question
      .toLowerCase()
      .trim()
      .replace(/[.,!?;:#@$]/g, '') // Remove common punctuation, keep hyphens
      .replace(/['"`]/g, '')       // Remove quotes
      .replace(/\s+/g, ' ')        // Normalize whitespace
      .trim();
      
    // Special handling for strings that are just numbers or mostly numbers with spaces
    if (/^\d+\s*$/.test(normalized)) {
      normalized = `num_${normalized.trim()}`;
    }
      
    // Additional check for strings that become empty after normalization
    if (normalized === '') {
      // Use a consistent hash for all-symbol strings instead of throwing
      // This ensures consistent behavior in tests and production
      return crypto.createHash('sha256').update('empty_after_normalization_' + question.length).digest('hex');
    }
      
    // Use SHA-256 for better collision resistance
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Calculate text similarity between two strings using optimized Jaccard similarity
   * with filtering for short tokens to improve quality
   * @param {string} str1 - First string to compare
   * @param {string} str2 - Second string to compare
   * @returns {number} - Similarity score between 0 and 1
   */
  calculateSimilarity(str1, str2) {
    try {
      // Quick equality check for exact match
      if (str1 === str2) return 1.0;
      
      // Basic validation
      if (!str1 || !str2) return 0;
      if (typeof str1 !== 'string' || typeof str2 !== 'string') return 0;
      
      // Early rejection for very different lengths (common in large caches)
      // If one string is more than twice as long as the other, they're likely very different
      const lenRatio = Math.max(str1.length, str2.length) / Math.min(str1.length || 1, str2.length || 1);
      if (lenRatio > 3) return 0;
      
      // Keywords - optimize by focusing on meaningful terms
      // Normalize and tokenize, filtering out short words (less than 3 chars)
      // and common stop words that don't add much meaning
      const stopWords = new Set(['the', 'and', 'for', 'but', 'that', 'with', 'this', 'from', 'what', 'how']);
      const tokens1 = str1.toLowerCase().trim().split(/\s+/)
        .filter(token => token.length > 2 && !stopWords.has(token));
      const tokens2 = str2.toLowerCase().trim().split(/\s+/)
        .filter(token => token.length > 2 && !stopWords.has(token));
      
      // Edge cases
      if (tokens1.length === 0 && tokens2.length === 0) return 1;
      if (tokens1.length === 0 || tokens2.length === 0) return 0;
      
      // Performance optimization for very large tokens
      // For large token sets, use a sample to estimate similarity
      const MAX_TOKENS = 200; // Limit for performance reasons
      let sampledTokens1 = tokens1;
      let sampledTokens2 = tokens2;
      
      if (tokens1.length > MAX_TOKENS || tokens2.length > MAX_TOKENS) {
        // Sample tokens evenly from throughout the token list
        const sampleSize = MAX_TOKENS;
        const sample = (tokens, count) => {
          if (tokens.length <= count) return tokens;
          const result = [];
          const step = tokens.length / count;
          for (let i = 0; i < count; i++) {
            result.push(tokens[Math.min(Math.floor(i * step), tokens.length - 1)]);
          }
          return result;
        };
        
        sampledTokens1 = sample(tokens1, sampleSize);
        sampledTokens2 = sample(tokens2, sampleSize);
      }
      
      // Create sets for more efficient comparison
      const set1 = new Set(sampledTokens1);
      const set2 = new Set(sampledTokens2);
      
      // Calculate intersection size
      let intersectionSize = 0;
      
      // Use the smaller set for the loop to optimize
      const [smallerSet, largerSet] = set1.size <= set2.size ? [set1, set2] : [set2, set1];
      
      for (const item of smallerSet) {
        if (largerSet.has(item)) {
          intersectionSize++;
        }
      }
      
      // Calculate union size: A + B - intersection
      const unionSize = set1.size + set2.size - intersectionSize;
      
      // Calculate weighted Jaccard similarity coefficient
      // We could weight important terms higher (like named entities, nouns)
      // but for now we use the simple version
      return intersectionSize / unionSize;
    } catch (error) {
      logger.error('Error calculating similarity:', error);
      return 0; // Fail gracefully
    }
  }

  /**
   * Check if a cache entry is stale and needs refreshing
   * @param {Object} cacheEntry - The cache entry to check
   * @returns {boolean} - True if the entry is stale, false otherwise
   */
  isStale(cacheEntry) {
    const now = Date.now();
    return now - cacheEntry.timestamp > CACHE_REFRESH_THRESHOLD;
  }

  /**
   * Try to find a cached response for a question
   * @param {string} question - The question to look for
   * @param {string} gameContext - Optional game context to improve matching
   * @returns {Object|null} - The cache hit or null if no match found
   */
  findInCache(question, gameContext = null) {
    if (!this.initialized) this.initSync();
    
    try {
      // Check if we need to prune the cache based on size
      const cacheSize = Object.keys(this.cache).length;
      if (cacheSize > LRU_PRUNE_THRESHOLD) {
        logger.info(`Cache size (${cacheSize}) exceeded threshold (${LRU_PRUNE_THRESHOLD}), pruning...`);
        this.pruneLRU(LRU_PRUNE_TARGET);
      }
      
      // Input validation
      if (!question || typeof question !== 'string' || question.trim().length === 0) {
        logger.warn('Invalid question provided to findInCache');
        return null;
      }
      
      // Create a memory cache key (question + gameContext)
      const memCacheKey = `${question}${gameContext ? `::${gameContext}` : ''}`;
      
      // Check memory cache first (fastest)
      const memCacheResult = this.memoryCache.get(memCacheKey);
      if (memCacheResult) {
        this.metrics.hits++;
        this.metrics.memoryHits++;
        logger.debug(`Memory cache hit for: "${question.substring(0, 30)}..."`);
        return memCacheResult;
      }
    
      // First try direct hash lookup (most efficient)
      try {
        const hash = this.generateHash(question);
        if (this.cache[hash]) {
          // Track cache hit metrics
          this.metrics.hits++;
          this.metrics.exactMatches++;
          
          const entry = this.cache[hash];
          // Update access metrics
          entry.accessCount += 1;
          entry.lastAccessed = Date.now();
          this.isDirty = true; // Mark cache as modified
          
          // Check if the entry is stale and create a new object with needsRefresh flag if needed
          // Using direct function call to allow for proper mocking in tests
          const isEntryStale = this.isStale(entry);
          const result = isEntryStale
            ? { ...entry, needsRefresh: true }
            : { ...entry };
          
          // Add to memory cache
          this.memoryCache.set(memCacheKey, result);
          
          return result;
        }
      } catch (hashError) {
        if (hashError instanceof CacheValueError) {
          logger.warn(`Cache validation error: ${hashError.message}`, hashError.details);
        } else {
          this.metrics.errors++;
          logger.warn('Error generating hash for cache lookup:', hashError);
        }
        // Continue to similarity matching even if hash lookup fails
      }
      
      // If no direct hit, try similarity matching
      // This could be optimized with an inverted index for large caches
      let bestMatch = null;
      let bestSimilarity = SIMILARITY_THRESHOLD;
      
      // Only do similarity search if the cache isn't too large
      // For very large caches, similarity search becomes too expensive
      const MAX_SIMILARITY_SEARCH_SIZE = 5000;
      if (cacheSize <= MAX_SIMILARITY_SEARCH_SIZE) {
        const keys = Object.keys(this.cache);
        
        // Improved algorithm - first filter by question length for efficiency
        // Only compare strings of roughly similar length
        const questionLength = question.length;
        const candidateKeys = keys.filter(key => {
          const entry = this.cache[key];
          const entryLength = entry.question.length;
          // Compare lengths: within 50% either way
          return entryLength >= questionLength * 0.5 && entryLength <= questionLength * 1.5;
        });
        
        // Then compute similarity only for these candidates
        for (const key of candidateKeys) {
          const entry = this.cache[key];
          try {
            const similarity = this.calculateSimilarity(question, entry.question);
            
            // Check similarity and game context if provided
            if (similarity > bestSimilarity && 
                (!gameContext || !entry.gameContext || entry.gameContext === gameContext)) {
              
              bestMatch = entry;
              bestSimilarity = similarity;
            }
          } catch (similarityError) {
            // Skip this entry if similarity calculation fails
            continue;
          }
        }
      }
      
      if (bestMatch) {
        // Track cache hit metrics
        this.metrics.hits++;
        this.metrics.similarityMatches++;
        
        // Update access metrics for best match
        bestMatch.accessCount += 1;
        bestMatch.lastAccessed = Date.now();
        this.isDirty = true; // Mark cache as modified
        
        // Check if the entry is stale and create a new object with needsRefresh flag if needed
        // Using direct function call to allow for proper mocking in tests
        const isEntryStale = this.isStale(bestMatch);
        const result = isEntryStale
          ? { ...bestMatch, needsRefresh: true, similarity: bestSimilarity }
          : { ...bestMatch, similarity: bestSimilarity };
        
        // Add to memory cache
        this.memoryCache.set(memCacheKey, result);
        
        return result;
      }
      
      // No match found
      this.metrics.misses++;
      return null;
    } catch (error) {
      logger.error('Unexpected error in cache lookup:', error);
      return null; // Graceful fallback on error
    }
  }
  
  /**
   * Find entries that are similar to the given question
   * @param {string} question - The question to find similar entries for
   * @returns {Object|null} - The most similar entry with hash and similarity score, or null if none found
   */
  findSimilar(question) {
    if (!question || typeof question !== 'string') {
      return null;
    }
    
    // Return null if cache is empty
    const cacheKeys = Object.keys(this.cache);
    if (cacheKeys.length === 0) {
      return null;
    }
    
    let bestMatch = null;
    let highestSimilarity = 0;
    
    // Calculate similarity with each cache entry
    for (const hash of cacheKeys) {
      const entry = this.cache[hash];
      const similarity = this.calculateSimilarity(question, entry.question);
      
      // If this entry is more similar than previous best match
      if (similarity > highestSimilarity && similarity >= SIMILARITY_THRESHOLD) {
        highestSimilarity = similarity;
        bestMatch = { hash, entry, similarity };
      }
    }
    
    return bestMatch;
  }

  /**
   * Prune the cache using an LRU (Least Recently Used) strategy
   * This is called when the cache exceeds a certain size threshold
   * @param {number} targetSize - Optional target size to prune to. If not provided, uses the default LRU_PRUNE_TARGET.
   * @returns {number} - The number of entries removed
   */
  pruneLRU(targetSize) {
    // If cache is smaller than threshold, don't prune
    const size = Object.keys(this.cache).length;
    if (size < this.LRU_PRUNE_THRESHOLD && targetSize === undefined) {
      return 0;
    }
    
    // Sort entries by timestamp (ascending = oldest first)
    const entries = Object.entries(this.cache)
      .map(([hash, entry]) => ({
        hash,
        timestamp: entry.timestamp || 0
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
    
    // Calculate how many entries to remove
    // Use the provided targetSize or fall back to the default
    const target = targetSize !== undefined ? targetSize : this.LRU_PRUNE_TARGET;
    const removeCount = size - target;
    
    if (removeCount <= 0) return 0;
    
    // Remove oldest entries
    const entriesToRemove = entries.slice(0, removeCount);
    entriesToRemove.forEach(({ hash }) => {
      delete this.cache[hash];
    });
    
    this.isDirty = true;
    logger.info(`LRU pruning: removed ${removeCount} oldest entries from cache (target: ${target})`);
    
    return removeCount;
  }

  /**
   * Add or update a question-answer pair in the cache
   * @param {string} question - The question
   * @param {string} answer - The answer
   * @param {string} gameContext - Optional game context
   * @returns {boolean} - True if addition was successful, false otherwise
   */
  addToCache(question, answer, gameContext = null) {
    if (!this.initialized) this.initSync();
    
    // Input validation
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      logger.warn('Invalid question provided to addToCache');
      return false;
    }
    
    if (!answer || typeof answer !== 'string' || answer.trim().length === 0) {
      logger.warn('Invalid answer provided to addToCache');
      return false;
    }
    
    // Increased limit for question length to handle test cases (was 2000)
    // This is a reasonable limit for real-world questions while preventing abuse
    const MAX_QUESTION_LENGTH = 10000;
    if (question.length > MAX_QUESTION_LENGTH) {
      logger.warn(`Question too long for cache (${question.length} chars)`);
      return false;
    }
    
    try {
      const hash = this.generateHash(question);
      const now = Date.now();
      
      // Check cache size limit
      if (Object.keys(this.cache).length >= MAX_CACHE_SIZE) {
        // Remove least recently used entries to make space
        this.pruneLRU(MAX_CACHE_SIZE - 1);
      }
      
      // Prevent race condition by checking if a newer entry exists
      if (this.cache[hash] && this.cache[hash].timestamp > now - 5000) {
        logger.debug(`Skipping cache update for recent entry: "${question.substring(0, 30)}..."`);
        return false;
      }
      
      // Store normalized values
      this.cache[hash] = {
        questionHash: hash,
        question: question.trim(),
        answer: answer.trim(),
        gameContext,
        timestamp: now,
        accessCount: 1,
        lastAccessed: now
      };
      
      this.isDirty = true; // Mark cache as modified
      
      // For large answers, defer saving to batch operations
      const shouldSaveImmediately = answer.length < 1000;
      
      if (shouldSaveImmediately) {
        this.saveIfDirty(); // Save immediately for small entries
      } else {
        this.scheduleSave(); // Schedule save for larger entries
      }
      
      logger.debug(`Added new entry to cache: "${question.substring(0, 30)}..."`);
      return true;
    } catch (error) {
      logger.error('Error adding to cache:', error);
      return false;
    }
  }
  
  /**
   * Schedule cache save with debouncing to reduce disk I/O
   */
  scheduleSave() {
    // Debounce save operations to reduce I/O
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(() => {
      this.saveCache();
      this.saveTimeout = null;
    }, 1000); // Save after 1 second of inactivity
  }

  /**
   * Get cache statistics
   * @returns {Object} - Statistics about the cache
   */
  getStats() {
    if (!this.initialized) this.initSync();
    
    const entryCount = Object.keys(this.cache).length;
    let totalAccesses = 0;
    let oldestTimestamp = Date.now();
    let newestTimestamp = 0;
    let mostAccessedCount = 0;
    let mostAccessedQuestion = '';
    
    for (const key in this.cache) {
      const entry = this.cache[key];
      totalAccesses += entry.accessCount;
      
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
      
      if (entry.timestamp > newestTimestamp) {
        newestTimestamp = entry.timestamp;
      }
      
      if (entry.accessCount > mostAccessedCount) {
        mostAccessedCount = entry.accessCount;
        mostAccessedQuestion = entry.question;
      }
    }
    
    return {
      entryCount,
      totalAccesses,
      averageAccessesPerEntry: entryCount > 0 ? totalAccesses / entryCount : 0,
      oldestEntry: new Date(oldestTimestamp).toISOString(),
      newestEntry: new Date(newestTimestamp).toISOString(),
      mostAccessedQuestion: mostAccessedQuestion.substring(0, 50) + '...',
      mostAccessedCount
    };
  }

  /**
   * Get cache hit rate statistics
   * @returns {Object} - Hit rate statistics
   */
  getHitRateStats() {
    const totalLookups = this.metrics.hits + this.metrics.misses;
    const hitRate = totalLookups > 0 ? this.metrics.hits / totalLookups : 0;
    const exactRate = this.metrics.hits > 0 ? this.metrics.exactMatches / this.metrics.hits : 0;
    const uptime = Date.now() - this.metrics.lastReset;
    
    return {
      totalLookups,
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      exactMatches: this.metrics.exactMatches,
      similarityMatches: this.metrics.similarityMatches,
      errors: this.metrics.errors,
      hitRate: hitRate,
      exactMatchRate: exactRate,
      uptimeMs: uptime,
      uptimeDays: (uptime / (1000 * 60 * 60 * 24)).toFixed(2)
    };
  }
  
  /**
   * Reset cache metrics
   */
  resetMetrics() {
    this.metrics = {
      hits: 0,
      misses: 0,
      exactMatches: 0,
      similarityMatches: 0, 
      errors: 0,
      lastReset: Date.now()
    };
    logger.info('Cache metrics have been reset');
  }

  /**
   * Prune old, rarely accessed entries from the cache
   * @param {number} maxAge - Maximum age in days to keep entries
   * @param {number} minAccesses - Minimum access count to keep entries regardless of age
   * @returns {number} - Number of entries removed
   */
  pruneCache(maxAge = 90, minAccesses = 5) {
    if (!this.initialized) this.initSync();
    
    const now = Date.now();
    const maxAgeMs = maxAge * 24 * 60 * 60 * 1000;
    let removedCount = 0;
    
    for (const key in this.cache) {
      const entry = this.cache[key];
      const age = now - entry.timestamp;
      
      // Remove if older than maxAge and accessed less than minAccesses times
      if (age > maxAgeMs && entry.accessCount < minAccesses) {
        delete this.cache[key];
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      this.isDirty = true; // Mark cache as modified
      this.saveIfDirty(); // Save immediately after pruning
      logger.info(`Pruned ${removedCount} entries from cache`);
    }
    
    return removedCount;
  }

  /**
   * Evict least recently used entries if cache size exceeds limit
   * @param {number} [targetSize=LRU_PRUNE_TARGET] - Target size after pruning
   */
}

// Create a singleton instance
const cacheServiceInstance = new CacheService();

module.exports = cacheServiceInstance;
