/**
 * Cache service for storing and retrieving frequently asked questions
 * Reduces API token usage by serving cached responses when possible
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');
const config = require('../config/config');

// Cache settings
const CACHE_REFRESH_THRESHOLD = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
const SIMILARITY_THRESHOLD = 0.85; // Minimum similarity score to consider a cache hit
const DEFAULT_CACHE_PATH = path.join(process.cwd(), 'data', 'question_cache.json');

// New configurable cache size limits
const MAX_CACHE_SIZE = parseInt(process.env.ASZUNE_MAX_CACHE_SIZE, 10) || 10000; // Default 10K entries
const LRU_PRUNE_THRESHOLD = parseInt(process.env.ASZUNE_LRU_PRUNE_THRESHOLD, 10) || 9000; // When to trigger auto-prune
const LRU_PRUNE_TARGET = parseInt(process.env.ASZUNE_LRU_PRUNE_TARGET, 10) || 7500; // Target size after pruning

class CacheService {
  constructor() {
    this.cache = {};
    this.initialized = false;
    this.cachePath = DEFAULT_CACHE_PATH;
    this.isDirty = false; // Track if cache has been modified and needs saving
    
    // Cache statistics metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      exactMatches: 0,
      similarityMatches: 0,
      errors: 0,
      lastReset: Date.now()
    };
  }

  /**
   * Initialize the cache from disk
   * @param {string} customPath - Optional custom path for the cache file (used for testing)
   */
  init(customPath) {
    if (this.initialized) return;
    
    // Allow using a custom path for testing
    if (customPath) {
      this.cachePath = customPath;
    }
    
    try {
      // Ensure the directory exists
      const dir = path.dirname(this.cachePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`Created cache directory: ${dir}`);
      }
      
      // Create cache file if it doesn't exist
      if (!fs.existsSync(this.cachePath)) {
        this.saveCache();
      } else {
        const cacheData = fs.readFileSync(this.cachePath, 'utf8');
        this.cache = JSON.parse(cacheData);
      }
      this.initialized = true;
      logger.info(`Cache initialized with ${Object.keys(this.cache).length} entries`);
    } catch (error) {
      logger.error('Error initializing cache:', error);
      // Create an empty cache if there was an error
      this.cache = {};
      this.saveCache();
      this.initialized = true; // Make sure to set initialized to true even after an error
    }
  }

  /**
   * Save the cache to disk with robust error handling
   */
  saveCache() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.cachePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Create backup before overwriting
      if (fs.existsSync(this.cachePath)) {
        try {
          fs.copyFileSync(this.cachePath, `${this.cachePath}.backup`);
        } catch (backupError) {
          logger.warn('Failed to create backup before saving cache:', backupError);
          // Continue with save attempt even if backup fails
        }
      }
      
      // Write to a temporary file first, then rename for atomic-like operation
      const tempPath = `${this.cachePath}.temp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.cache, null, 2));
      
      // In Windows, we need to unlink first before rename to avoid EPERM error
      if (fs.existsSync(this.cachePath)) {
        fs.unlinkSync(this.cachePath);
      }
      
      fs.renameSync(tempPath, this.cachePath);
      
      logger.debug('Cache saved successfully');
      this.isDirty = false; // Reset dirty flag after saving
    } catch (error) {
      logger.error('Error saving cache:', error);
      
      // Restore from backup if available
      const backupPath = `${this.cachePath}.backup`;
      if (fs.existsSync(backupPath)) {
        try {
          fs.copyFileSync(backupPath, this.cachePath);
          logger.info('Cache restored from backup after failed save');
        } catch (restoreError) {
          logger.error('Failed to restore cache from backup:', restoreError);
        }
      }
    }
  }
  
  /**
   * Save the cache to disk if it has been modified
   * This method can be called periodically to batch writes
   */
  saveIfDirty() {
    if (this.isDirty) {
      this.saveCache();
    }
  }

  /**
   * Generate a hash for a question to use as a cache key
   * @param {string} question - The question text
   * @returns {string} - A hash of the question
   * @throws {Error} - If question is invalid
   */
  generateHash(question) {
    // Input validation - make sure to explicitly check all edge cases including empty strings
    if (question === null || question === undefined) {
      throw new Error('Question cannot be null or undefined');
    }
    
    if (typeof question !== 'string') {
      throw new Error(`Question must be a string, got ${typeof question}`);
    }
    
    // Check for empty strings or strings with only whitespace
    // The trim is needed to check for strings with only spaces
    if (question === '' || question.trim() === '') {
      throw new Error('Question cannot be an empty string');
    }
    
    // Normalize the question: lowercase, trim whitespace, normalize spaces, remove only specific punctuation
    const normalizedQuestion = question
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // normalize multiple spaces to single space
      .replace(/[.,!?;:]/g, '') // only remove sentence punctuation, keep meaningful chars
      .replace(/["'`]/g, ''); // remove quote marks
      
    // Use SHA-256 for better collision resistance
    return crypto.createHash('sha256').update(normalizedQuestion).digest('hex');
  }

  /**
   * Calculate text similarity between two strings using Jaccard similarity
   * with filtering for short tokens to improve quality
   * @param {string} str1 - First string to compare
   * @param {string} str2 - Second string to compare
   * @returns {number} - Similarity score between 0 and 1
   */
  calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    // Normalize and tokenize, filtering out short words (less than 3 chars)
    const tokens1 = str1.toLowerCase().trim().split(/\s+/).filter(token => token.length > 2);
    const tokens2 = str2.toLowerCase().trim().split(/\s+/).filter(token => token.length > 2);
    
    // Edge cases
    if (tokens1.length === 0 && tokens2.length === 0) return 1;
    if (tokens1.length === 0 || tokens2.length === 0) return 0;
    
    // Create sets for more efficient comparison
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    
    // Calculate intersection and union directly using Set operations
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    // Calculate Jaccard similarity coefficient
    return intersection.size / union.size;
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
    if (!this.initialized) this.init();
    
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
          
          // If the entry is stale, return it but mark for refresh
          if (this.isStale(entry)) {
            return { 
              ...entry, 
              needsRefresh: true 
            };
          }
          return entry;
        }
      } catch (hashError) {
        this.metrics.errors++;
        logger.warn('Error generating hash for cache lookup:', hashError);
        // Continue to similarity matching even if hash lookup fails
      }
      
      // If no direct hit, try similarity matching
      // This could be optimized with an inverted index for large caches
      let bestMatch = null;
      let bestSimilarity = SIMILARITY_THRESHOLD;
      
      for (const key of Object.keys(this.cache)) {
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
      
      if (bestMatch) {
        // Track cache hit metrics
        this.metrics.hits++;
        this.metrics.similarityMatches++;
        
        // Update access metrics for best match
        bestMatch.accessCount += 1;
        bestMatch.lastAccessed = Date.now();
        this.isDirty = true; // Mark cache as modified
        
        // If the entry is stale, return it but mark for refresh
        if (this.isStale(bestMatch)) {
          return { 
            ...bestMatch, 
            needsRefresh: true,
            similarity: bestSimilarity 
          };
        }
        return { ...bestMatch, similarity: bestSimilarity };
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
   * Prune cache using LRU (Least Recently Used) strategy
   * @param {number} targetSize - Target number of entries to keep
   * @returns {number} - Number of entries removed
   */
  pruneLRU(targetSize) {
    if (!this.initialized) this.init();
    
    const cacheSize = Object.keys(this.cache).length;
    if (cacheSize <= targetSize) return 0;
    
    // Create array of all entries with their keys
    const entries = Object.entries(this.cache).map(([key, entry]) => ({
      key,
      lastAccessed: entry.lastAccessed || 0,
      accessCount: entry.accessCount || 0
    }));
    
    // Sort by last accessed time (oldest first)
    entries.sort((a, b) => a.lastAccessed - b.lastAccessed);
    
    // Calculate how many to remove
    const removeCount = cacheSize - targetSize;
    const toRemove = entries.slice(0, removeCount);
    
    // Remove the entries
    for (const item of toRemove) {
      delete this.cache[item.key];
    }
    
    if (toRemove.length > 0) {
      this.isDirty = true;
      this.saveIfDirty();
      logger.info(`LRU pruning removed ${toRemove.length} entries from cache`);
    }
    
    return toRemove.length;
  }

  /**
   * Add or update a question-answer pair in the cache
   * @param {string} question - The question
   * @param {string} answer - The answer
   * @param {string} gameContext - Optional game context
   * @returns {boolean} - True if addition was successful, false otherwise
   */
  addToCache(question, answer, gameContext = null) {
    if (!this.initialized) this.init();
    
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
    if (!this.initialized) this.init();
    
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
    if (!this.initialized) this.init();
    
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
  evictLRU(targetSize = LRU_PRUNE_TARGET) {
    if (!this.initialized) this.init();
    
    const keys = Object.keys(this.cache);
    if (keys.length <= targetSize) return; // No eviction needed
    
    // Sort keys by last accessed time (least recently used first)
    keys.sort((a, b) => this.cache[a].lastAccessed - this.cache[b].lastAccessed);
    
    // Evict entries until we reach the target size
    let removedCount = 0;
    while (keys.length > targetSize) {
      const keyToRemove = keys.shift(); // Remove the oldest key
      delete this.cache[keyToRemove];
      removedCount++;
    }
    
    if (removedCount > 0) {
      this.isDirty = true; // Mark cache as modified
      this.saveIfDirty(); // Save immediately after eviction
      logger.info(`Evicted ${removedCount} LRU entries from cache`);
    }
  }

  /**
   * Periodic maintenance to optimize cache
   * This should be called regularly to perform background tasks
   */
  maintain() {
    this.saveIfDirty();
    
    // Evict LRU entries if configured
    const currentSize = Object.keys(this.cache).length;
    if (currentSize > LRU_PRUNE_THRESHOLD) {
      this.evictLRU();
    }
  }
}

module.exports = new CacheService();
