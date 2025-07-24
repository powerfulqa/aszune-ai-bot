/**
 * Service for interacting with the Perplexity API
 */
const { request } = require('undici');
const config = require('../config/config');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

// Simplified lazy loader for tests
const lazyLoadModule = (importPath) => {
  let module;
  return function() {
    if (!module) {
      try {
        module = require(importPath);
      } catch (e) {
        // In test environment, return mock objects if module doesn't exist
        if (process.env.NODE_ENV === 'test') {
          if (importPath === '../utils/connection-throttler') {
            return { executeRequest: async (fn) => await fn() };
          }
          if (importPath === '../utils/cache-pruner') {
            return { pruneCache: () => {} };
          }
        }
        throw e;
      }
    }
    return module;
  };
};

// Lazy load optimization utilities
const connectionThrottler = lazyLoadModule('../utils/connection-throttler');
const getCachePruner = lazyLoadModule('../utils/cache-pruner');

/**
 * Client for the Perplexity API
 */
class PerplexityService {
  constructor() {
    this.apiKey = config.PERPLEXITY_API_KEY;
    this.baseUrl = config.API.PERPLEXITY.BASE_URL;
    
    // Track active intervals for proper cleanup
    this.activeIntervals = new Set();
    
    // Set up cache cleanup interval (if not in test environment)
    this.cacheCleanupInterval = null;
    if (process.env.NODE_ENV !== 'test') {
      // Clean cache every day
      const DAY_MS = 24 * 60 * 60 * 1000;
      this.cacheCleanupInterval = setInterval(() => this._cleanupCache(), DAY_MS);
      this.activeIntervals.add(this.cacheCleanupInterval);
    }
  }
  
  /**
   * Shut down the service, clearing any intervals
   */
  shutdown() {
    // Clear all intervals
    for (const interval of this.activeIntervals) {
      clearInterval(interval);
    }
    this.activeIntervals.clear();
  }

  /**
   * Create headers for API requests
   * @returns {Object} Headers object
   */
  _getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Send a chat completion request
   * @param {Array} messages - The messages to send to the API
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - The API response
   */
  async sendChatRequest(messages, options = {}) {
    const endpoint = this.baseUrl + config.API.PERPLEXITY.ENDPOINTS.CHAT_COMPLETIONS;
    
    // Prepare request payload
    const requestPayload = {
      model: options.model || config.API.PERPLEXITY.DEFAULT_MODEL,
      messages: messages,
      max_tokens: options.maxTokens || config.API.PERPLEXITY.MAX_TOKENS.CHAT,
      temperature: options.temperature || config.API.PERPLEXITY.DEFAULT_TEMPERATURE
    };
    
    // Enable streaming for supported environments if not in low CPU mode
    const piOptEnabled = config.PI_OPTIMIZATIONS && config.PI_OPTIMIZATIONS.ENABLED;
    const lowCpuMode = piOptEnabled && config.PI_OPTIMIZATIONS.LOW_CPU_MODE;
    
    if (options.stream && piOptEnabled && !lowCpuMode) {
      requestPayload.stream = true;
    }
    
    // Create request function to pass to throttler
    const makeApiRequest = async () => {
      return await request(endpoint, {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify(requestPayload)
      });
    };
    
    try {
      // Use throttler if PI optimizations are enabled
      let response;
      if (piOptEnabled) {
        const throttler = connectionThrottler();
        response = await throttler.executeRequest(makeApiRequest, 'Perplexity API');
      } else {
        response = await makeApiRequest();
      }
      
      const { statusCode, headers, body } = response;
      
      // First check content-type to determine appropriate parsing method
      const contentType = headers.get('content-type') || '';
      
      // For non-2xx status codes, handle as error
      if (statusCode < 200 || statusCode >= 300) {
        const responseText = await body.text().catch(() => 'Could not read response body');
        
        // Create a descriptive error message with status code and response content
        const errorMessage = `API request failed with status ${statusCode}: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`;
        console.error('Perplexity API Error:', errorMessage);
        throw new Error(errorMessage);
      }
      
      // Parse response as JSON
      return await body.json();
    } catch (error) {
      logger.error('API request failed:', error);
      throw error;
    }
  }
  
  /**
   * Generate chat response for user query
   * @param {Array} history - Chat history
   * @param {boolean} useCache - Whether to override default cache behavior
   * @returns {Promise<String>} - The response content
   */
  async generateChatResponse(history, useCache = true) {
    try {
      const piOptEnabled = config.PI_OPTIMIZATIONS && config.PI_OPTIMIZATIONS.ENABLED;
      const shouldUseCache = useCache && piOptEnabled && config.PI_OPTIMIZATIONS.CACHE_ENABLED;
      
      if (shouldUseCache) {
        // Try to get from cache
        const cacheKey = this._generateCacheKey(history);
        const cache = await this._loadCache();
        
        if (cache[cacheKey]) {
          logger.debug('Cache hit for query');
          return cache[cacheKey];
        }
      }
      
      // Not in cache, get from API
      const response = await this.sendChatRequest(history);
      const content = response?.choices?.[0]?.message?.content || 'No response generated';
      
      if (shouldUseCache) {
        // Save to cache
        const cacheKey = this._generateCacheKey(history);
        const cache = await this._loadCache();
        cache[cacheKey] = content;
        
        // Get max cache entries from config or use default
        const maxEntries = config.PI_OPTIMIZATIONS?.CACHE_MAX_ENTRIES || 100;
        
        // Trim cache if too large
        const keys = Object.keys(cache);
        if (keys.length > maxEntries) {
          // Remove oldest 20% of entries
          const removeCount = Math.ceil(maxEntries * 0.2);
          const keysToRemove = keys.slice(0, removeCount);
          keysToRemove.forEach(key => delete cache[key]);
        }
        
        await this._saveCache(cache);
      }
      
      return content;
    } catch (error) {
      logger.error('Failed to generate chat response:', error);
      throw error; // Re-throw for caller to handle
    }
  }

  /**
   * Generate summary of conversation or text
   * @param {Array} history - Conversation history or text to summarize
   * @param {boolean} isText - Whether this is text or conversation history
   * @returns {Promise<String>} - The summary
   */
  async generateSummary(history, isText = false) {
    try {
      const systemPrompt = isText ? 
        config.SYSTEM_MESSAGES.TEXT_SUMMARY : 
        config.SYSTEM_MESSAGES.SUMMARY;
      
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history
      ];
      
      // Try streaming for better Pi performance if enabled
      const piOptEnabled = config.PI_OPTIMIZATIONS && config.PI_OPTIMIZATIONS.ENABLED;
      const streamingEnabled = piOptEnabled && !config.PI_OPTIMIZATIONS?.LOW_CPU_MODE;
      
      const response = await this.sendChatRequest(messages, {
        maxTokens: config.API.PERPLEXITY.MAX_TOKENS.SUMMARY,
        stream: streamingEnabled
      });
      
      return response?.choices?.[0]?.message?.content || 'Unable to generate summary.';
    } catch (error) {
      logger.error('Failed to generate summary:', error);
      throw error; // Re-throw for caller to handle
    }
  }

  /**
   * Alias for generateSummary with isText=true
   * @param {Array} text - Text to summarize
   * @returns {Promise<String>} - The summary
   */
  async generateTextSummary(text) {
    return this.generateSummary(text, true);
  }
  
  /**
   * Load the response cache from disk
   * @returns {Promise<Object>} - The cache object
   * @private
   */
  async _loadCache() {
    try {
      const cacheFile = path.join(__dirname, '../../data/question_cache.json');
      const data = await fs.readFile(cacheFile, 'utf8').catch(() => '{}');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error loading cache:', error);
      return {};
    }
  }
  
  /**
   * Save the response cache to disk
   * @param {Object} cache - The cache object to save
   * @returns {Promise<void>}
   * @private
   */
  async _saveCache(cache) {
    try {
      const cacheFile = path.join(__dirname, '../../data/question_cache.json');
      const cacheDir = path.dirname(cacheFile);
      
      // Ensure directory exists
      await fs.mkdir(cacheDir, { recursive: true }).catch(() => {});
      
      // Add timestamp for when items were cached
      const now = Date.now();
      Object.keys(cache).forEach(key => {
        if (!cache[key].lastAccessed) {
          cache[key] = {
            content: cache[key],
            lastAccessed: now
          };
        } else if (typeof cache[key] === 'string') {
          cache[key] = {
            content: cache[key],
            lastAccessed: now
          };
        } else {
          cache[key].lastAccessed = now;
        }
      });
      
      await fs.writeFile(cacheFile, JSON.stringify(cache, null, 2));
    } catch (error) {
      logger.error('Error saving cache:', error);
    }
  }
  
  /**
   * Generate a cache key from conversation history
   * @param {Array} history - Conversation history
   * @returns {String} - Cache key
   * @private
   */
  _generateCacheKey(history) {
    // Use only the last few messages for the cache key to avoid unnecessary cache misses
    const lastMessages = history.slice(-2);
    const key = lastMessages.map(msg => `${msg.role}:${msg.content}`).join('|');
    return require('crypto').createHash('md5').update(key).digest('hex');
  }
  
  /**
   * Clean up old cache entries
   * @private
   */
  async _cleanupCache() {
    try {
      // Skip if in test environment
      if (process.env.NODE_ENV === 'test') return;
      
      logger.debug('Running cache cleanup');
      
      // Load cache
      const cache = await this._loadCache();
      
      // Get keys
      const keys = Object.keys(cache);
      if (keys.length === 0) return;
      
      // Sort by last access time if available
      const keysByAge = keys.sort((a, b) => {
        const aTime = cache[a].lastAccessed || 0;
        const bTime = cache[b].lastAccessed || 0;
        return aTime - bTime; // Oldest first
      });
      
      // Keep only the most recent 80%
      const keepCount = Math.floor(keys.length * 0.8);
      const keysToRemove = keysByAge.slice(0, keys.length - keepCount);
      
      if (keysToRemove.length > 0) {
        keysToRemove.forEach(key => delete cache[key]);
        await this._saveCache(cache);
        logger.info(`Removed ${keysToRemove.length} old cache entries`);
      }
    } catch (error) {
      logger.error('Error during cache cleanup:', error);
    }
  }
}

module.exports = new PerplexityService();
