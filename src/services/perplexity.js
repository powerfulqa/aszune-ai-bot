/**
 * Service for interacting with the Perplexity API
 */
const { request } = require('undici');
const config = require('../config/config');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const crypto = require('crypto');

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
   * Safe way to access headers that works with both Headers objects and plain objects
   * @param {Object|Headers} headers - The headers object
   * @param {string} key - The header key to get
   * @returns {string} The header value
   */
  _safeGetHeader(headers, key) {
    // Return empty string if headers or key is missing
    if (!headers || !key) return '';
    try {
      // Check if headers is an object at all
      if (typeof headers !== 'object' && typeof headers !== 'function') {
        return '';
      }
      // Try Headers object API if available (safely check if get exists AND is a function)
      if (headers && headers.get && typeof headers.get === 'function') {
        try {
          return headers.get(key) || '';
        } catch (innerError) {
          // If headers.get fails, fall back to object access
        }
      }
      // Fall back to plain object access (case insensitive)
      if (headers) {
        if (Object.prototype.hasOwnProperty.call(headers, key)) {
          return headers[key] || '';
        }
        if (Object.prototype.hasOwnProperty.call(headers, key.toLowerCase())) {
          return headers[key.toLowerCase()] || '';
        }
        if (Object.prototype.hasOwnProperty.call(headers, key.toUpperCase())) {
          return headers[key.toUpperCase()] || '';
        }
      }
      return '';
    } catch (error) {
      logger.warn(`Error getting header "${key}":`, error);
      return '';
    }
  }

  /**
   * Build API request payload
   * @param {Array} messages - The messages to send
   * @param {Object} options - Request options
   * @returns {Object} - The request payload
   * @private
   */
  _buildRequestPayload(messages, options) {
    const payload = {
      model: options.model || config.API.PERPLEXITY.DEFAULT_MODEL,
      messages: messages,
      max_tokens: options.maxTokens || config.API.PERPLEXITY.MAX_TOKENS.CHAT,
      temperature: options.temperature || config.API.PERPLEXITY.DEFAULT_TEMPERATURE
    };
    // Safely check if PI optimizations are enabled
    let piOptEnabled = false;
    let lowCpuMode = false;
    try {
      if (config && typeof config.PI_OPTIMIZATIONS === 'object' && config.PI_OPTIMIZATIONS !== null) {
        piOptEnabled = Boolean(config.PI_OPTIMIZATIONS.ENABLED);
        if (piOptEnabled) {
          lowCpuMode = Boolean(config.PI_OPTIMIZATIONS.LOW_CPU_MODE);
        }
      }
    } catch (error) {
      logger.warn('Error accessing PI_OPTIMIZATIONS config:', error);
    }
    if (options.stream && piOptEnabled && !lowCpuMode) {
      payload.stream = true;
    }
    return payload;
  }
  
  /**
   * Handle API response
   * @param {Object} response - The API response
   * @returns {Promise<Object>} - The parsed response
   * @private
   */
  async _handleApiResponse(response) {
    if (!response) {
      throw new Error('Invalid response: response is null or undefined');
    }
    const statusCode = response.statusCode || 500;
    const headers = response.headers || {};
    const body = response.body || null;
    if (statusCode < 200 || statusCode >= 300) {
      let responseText = 'Could not read response body';
      if (body && typeof body.text === 'function') {
        responseText = await body.text().catch(() => 'Could not read response body');
      }
      const errorMessage = `API request failed with status ${statusCode}: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`;
      logger.error('Perplexity API Error:', errorMessage);
      throw new Error(errorMessage);
    }
    if (!body || typeof body.json !== 'function') {
      throw new Error('Invalid response body format');
    }
    try {
      return await body.json();
    } catch (error) {
      logger.error('Failed to parse JSON response:', error);
      throw new Error('Failed to parse API response as JSON');
    }
  }
  
  /**
   * Safely extract content from API response
   * @param {Object} response - API response object
   * @returns {string} - Extracted content or default message
   * @private
   */
  _extractResponseContent(response) {
    return response?.choices?.[0]?.message?.content || 'No response generated';
  }

  async sendChatRequest(messages, options = {}) {
    const endpoint = this.baseUrl + config.API.PERPLEXITY.ENDPOINTS.CHAT_COMPLETIONS;
    const requestPayload = this._buildRequestPayload(messages, options);
    const makeApiRequest = async () => {
      return await request(endpoint, {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify(requestPayload)
      });
    };
    try {
      let piOptEnabled = false;
      try {
        piOptEnabled = config && typeof config.PI_OPTIMIZATIONS === 'object' && config.PI_OPTIMIZATIONS !== null && Boolean(config.PI_OPTIMIZATIONS.ENABLED);
      } catch (configError) {
        logger.warn('Error accessing PI_OPTIMIZATIONS config:', configError);
      }
      let response;
      if (piOptEnabled) {
        try {
          const throttler = connectionThrottler();
          response = await throttler.executeRequest(makeApiRequest, 'Perplexity API');
        } catch (throttlerError) {
          logger.warn('Error using connection throttler, falling back to direct request:', throttlerError);
          response = await makeApiRequest();
        }
      } else {
        response = await makeApiRequest();
      }
      return await this._handleApiResponse(response);
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
      let piOptEnabled = false;
      let cacheEnabled = false;
      let maxCacheEntries = 100;
      try {
        if (config && typeof config.PI_OPTIMIZATIONS === 'object' && config.PI_OPTIMIZATIONS !== null) {
          piOptEnabled = Boolean(config.PI_OPTIMIZATIONS.ENABLED);
          if (piOptEnabled) {
            cacheEnabled = Boolean(config.PI_OPTIMIZATIONS.CACHE_ENABLED);
            if (typeof config.PI_OPTIMIZATIONS.CACHE_MAX_ENTRIES === 'number') {
              maxCacheEntries = config.PI_OPTIMIZATIONS.CACHE_MAX_ENTRIES;
            }
          }
        }
      } catch (configError) {
        logger.warn('Error accessing PI_OPTIMIZATIONS config:', configError);
      }
      const shouldUseCache = useCache && piOptEnabled && cacheEnabled;
      if (shouldUseCache) {
        try {
          const cacheKey = this._generateCacheKey(history);
          const cache = await this._loadCache();
          if (cache && cache[cacheKey]) {
            logger.debug('Cache hit for query');
            return typeof cache[cacheKey] === 'object' && cache[cacheKey].content ? cache[cacheKey].content : cache[cacheKey];
          }
        } catch (cacheError) {
          logger.warn('Error reading from cache:', cacheError);
        }
      }
      const response = await this.sendChatRequest(history);
      const content = this._extractResponseContent(response);
      if (shouldUseCache) {
        try {
          const cacheKey = this._generateCacheKey(history);
          const cache = await this._loadCache() || {};
          cache[cacheKey] = content;
          const keys = Object.keys(cache);
          if (keys.length > maxCacheEntries) {
            const removeCount = Math.ceil(maxCacheEntries * 0.2);
            const keysToRemove = keys.slice(0, removeCount);
            keysToRemove.forEach(key => delete cache[key]);
          }
          await this._saveCache(cache);
        } catch (cacheError) {
          logger.warn('Error saving to cache:', cacheError);
        }
      }
      return content;
    } catch (error) {
      logger.error('Failed to generate chat response:', error);
      throw error;
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
      const systemPrompt = isText ? config.SYSTEM_MESSAGES.TEXT_SUMMARY : config.SYSTEM_MESSAGES.SUMMARY;
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history
      ];
      let piOptEnabled = false;
      let lowCpuMode = false;
      let streamingEnabled = false;
      try {
        if (config && typeof config.PI_OPTIMIZATIONS === 'object' && config.PI_OPTIMIZATIONS !== null) {
          piOptEnabled = Boolean(config.PI_OPTIMIZATIONS.ENABLED);
          if (piOptEnabled) {
            lowCpuMode = Boolean(config.PI_OPTIMIZATIONS.LOW_CPU_MODE);
            streamingEnabled = !lowCpuMode;
          }
        }
      } catch (configError) {
        logger.warn('Error accessing PI_OPTIMIZATIONS config:', configError);
      }
      let maxTokens = 500;
      try {
        if (config && config.API && config.API.PERPLEXITY && config.API.PERPLEXITY.MAX_TOKENS) {
          maxTokens = config.API.PERPLEXITY.MAX_TOKENS.SUMMARY || maxTokens;
        }
      } catch (configError) {
        logger.warn('Error accessing MAX_TOKENS config:', configError);
      }
      const response = await this.sendChatRequest(messages, {
        maxTokens: maxTokens,
        stream: streamingEnabled
      });
      return this._extractResponseContent(response) || 'Unable to generate summary.';
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
  
  /**
   * Format a cache entry with timestamp
   * @param {any} entry - The cache entry
   * @param {number} timestamp - The current timestamp
   * @returns {Object} - The formatted entry
   * @private
   */
  _formatCacheEntry(entry, timestamp) {
    if (typeof entry === 'string') {
      return {
        content: entry,
        lastAccessed: timestamp
      };
    } else if (entry && !entry.lastAccessed) {
      return {
        content: entry,
        lastAccessed: timestamp
      };
    } else if (entry) {
      // Just update the timestamp on existing entries
      entry.lastAccessed = timestamp;
      return entry;
    }
    
    // Fallback for unexpected entry types
    return {
      content: String(entry),
      lastAccessed: timestamp
    };
  }

  async _saveCache(cache) {
    try {
      const cacheFile = path.join(__dirname, '../../data/question_cache.json');
      const cacheDir = path.dirname(cacheFile);
      
      // Ensure directory exists
      await fs.mkdir(cacheDir, { recursive: true }).catch(() => {});
      
      // Add timestamp for when items were cached
      const now = Date.now();
      const updatedCache = Object.fromEntries(
        Object.entries(cache).map(([key, value]) => [key, this._formatCacheEntry(value, now)])
      );
      
      await fs.writeFile(cacheFile, JSON.stringify(updatedCache, null, 2));
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
    return crypto.createHash('md5').update(key).digest('hex');
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
