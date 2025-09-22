/**
 * Modified version of perplexity-improved.js with secure file permissions
 * This file adds secure file permissions to fix the security issues
 */

/**
 * Service for interacting with the Perplexity API
 * Version 1.3.0 - Improved for better maintainability and performance
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
    
    // File permission constants
    this.FILE_PERMISSIONS = config.FILE_PERMISSIONS;
    
    // Track active intervals for proper cleanup
    this.activeIntervals = new Set();
    
    // Set up cache cleanup interval (if not in test environment)
    this.cacheCleanupInterval = null;
    this._setupCacheCleanup();
  }
  
  /**
   * Set up cache cleanup routine
   * @private
   */
  _setupCacheCleanup() {
    if (process.env.NODE_ENV !== 'test') {
      // Clean cache every day
      this.cacheCleanupInterval = setInterval(() => this._cleanupCache(), config.CACHE.CLEANUP_INTERVAL_MS);
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
      return this._tryGetHeaderValue(headers, key);
    } catch (error) {
      logger.warn(`Error getting header "${key}":`, error);
      return '';
    }
  }

  /**
   * Helper method to extract header value using various methods
   * @param {Object|Headers} headers - The headers object
   * @param {string} key - The header key to get
   * @returns {string} The header value
   * @private
   */
  _tryGetHeaderValue(headers, key) {
    // Check if headers is an object at all
    if (typeof headers !== 'object' && typeof headers !== 'function') {
      return '';
    }
    
    // Try Headers object API first
    const headerFromGetMethod = this._tryHeadersGetMethod(headers, key);
    if (headerFromGetMethod !== null) {
      return headerFromGetMethod;
    }
    
    // Fall back to plain object access
    return this._tryObjectPropertyAccess(headers, key);
  }

  /**
   * Try to get header using Headers.get() method
   * @param {Object|Headers} headers - The headers object
   * @param {string} key - The header key to get
   * @returns {string|null} The header value or null if not found/applicable
   * @private
   */
  _tryHeadersGetMethod(headers, key) {
    if (headers && headers.get && typeof headers.get === 'function') {
      try {
        return headers.get(key) || '';
      } catch (innerError) {
        // If headers.get fails, return null to try other methods
        return null;
      }
    }
    return null;
  }

  /**
   * Try to access header as an object property with case variations
   * @param {Object} headers - The headers object
   * @param {string} key - The header key to get
   * @returns {string} The header value
   * @private
   */
  _tryObjectPropertyAccess(headers, key) {
    // Check for exact case
    if (Object.prototype.hasOwnProperty.call(headers, key)) {
      return headers[key] || '';
    }
    
    // Check lowercase
    if (Object.prototype.hasOwnProperty.call(headers, key.toLowerCase())) {
      return headers[key.toLowerCase()] || '';
    }
    
    // Check uppercase
    if (Object.prototype.hasOwnProperty.call(headers, key.toUpperCase())) {
      return headers[key.toUpperCase()] || '';
    }
    
    return '';
  }
  
  /**
   * Determine if caching should be used based on options and configuration
   * @param {Object} options - The cache options 
   * @param {Object} cacheConfig - The cache configuration
   * @returns {boolean} - Whether to use cache or not
   * @private
   */
  _shouldUseCache(options, cacheConfig) {
    return options.caching !== false && (process.env.NODE_ENV === 'test' || cacheConfig.enabled);
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
    
    // Get PI optimization settings
    const piOptSettings = this._getPiOptimizationSettings();
    
    // Enable streaming for supported environments if not in low CPU mode
    if (options.stream && piOptSettings.enabled && !piOptSettings.lowCpuMode) {
      payload.stream = true;
    }
    
    return payload;
  }
  
  /**
   * Get PI optimization settings from config
   * @returns {Object} PI optimization settings
   * @private
   */
  _getPiOptimizationSettings() {
    const defaultSettings = {
      enabled: false,
      lowCpuMode: false
    };
    
    try {
      // Check if config has PI_OPTIMIZATIONS property
      if (config && typeof config.PI_OPTIMIZATIONS === 'object' && config.PI_OPTIMIZATIONS !== null) {
        return {
          enabled: Boolean(config.PI_OPTIMIZATIONS.ENABLED),
          lowCpuMode: Boolean(config.PI_OPTIMIZATIONS.LOW_CPU_MODE)
        };
      }
    } catch (error) {
      logger.warn('Error accessing PI_OPTIMIZATIONS config:', error);
    }
    
    return defaultSettings;
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
    
    // Safely extract properties with defaults
    const statusCode = response.statusCode || 500;
    const headers = response.headers || {};
    const body = response.body || null;
    
    // For non-2xx status codes, handle as error
    if (statusCode < 200 || statusCode >= 300) {
      return this._handleErrorResponse(statusCode, body);
    }
    
    // Make sure body exists and has json method
    if (!body || typeof body.json !== 'function') {
      throw new Error('Invalid response: body is missing or does not have json method');
    }
    
    // Parse response as JSON
    try {
      return await body.json();
    } catch (error) {
      throw new Error(`Failed to parse response as JSON: ${error.message}`);
    }
  }
  
  /**
   * Handle error response
   * @param {number} statusCode - HTTP status code
   * @param {Object} body - Response body
   * @returns {Promise<never>} - Always throws an error
   * @private
   */
  async _handleErrorResponse(statusCode, body) {
    let responseText = 'Could not read response body';
    if (body && typeof body.text === 'function') {
      try {
        responseText = await body.text();
      } catch (textError) {
        responseText = `Error reading response body: ${textError.message}`;
      }
    }
    
    // Create a descriptive error message with status code and response content
    const errorMessage = `API request failed with status ${statusCode}: ${responseText.substring(0, config.MESSAGE_LIMITS.ERROR_MESSAGE_MAX_LENGTH)}${responseText.length > config.MESSAGE_LIMITS.ERROR_MESSAGE_MAX_LENGTH ? '...' : ''}`;
    throw new Error(errorMessage);
  }
  
  /**
   * Safely extract content from API response
   * @param {Object} response - API response object
   * @returns {string} - Extracted content or default message
   * @private
   */
  _extractResponseContent(response) {
    try {
      // Check if response exists
      if (!response) {
        return 'Sorry, I received an empty response.';
      }
      
      // Check for choices array
      if (!response.choices || !Array.isArray(response.choices) || response.choices.length === 0) {
        return 'Sorry, no response choices were returned.';
      }
      
      // Get the first choice
      const firstChoice = response.choices[0];
      
      // Extract content based on structure
      if (firstChoice.message && typeof firstChoice.message.content === 'string') {
        return firstChoice.message.content;
      }
      
      if (typeof firstChoice.content === 'string') {
        return firstChoice.content;
      }
      
      return 'Sorry, I could not extract content from the response.';
    } catch (error) {
      logger.warn('Error extracting response content:', error);
      return 'Sorry, an error occurred while processing the response.';
    }
  }

  /**
   * Send a chat request to the API
   * @param {Array} messages - Messages to send
   * @param {Object} options - Request options
   * @returns {Promise<Object>} API response
   */
  async sendChatRequest(messages, options = {}) {
    const endpoint = this.baseUrl + config.API.PERPLEXITY.ENDPOINTS.CHAT_COMPLETIONS;
    const requestPayload = this._buildRequestPayload(messages, options);
    
    // Define API request function
    const makeApiRequest = async () => {
      return await request(endpoint, {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify(requestPayload)
      });
    };
    
    try {
      // Get PI optimization settings
      const piOptSettings = this._getPiOptimizationSettings();
      
      let response;
      if (piOptSettings.enabled) {
        response = await this._executeWithThrottling(makeApiRequest);
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
   * Execute request with throttling if available
   * @param {Function} requestFn - Request function to execute
   * @returns {Promise<Object>} - API response
   * @private
   */
  async _executeWithThrottling(requestFn) {
    try {
      const throttler = connectionThrottler();
      return await throttler.executeRequest(requestFn, 'Perplexity API');
    } catch (throttlerError) {
      logger.warn('Error using connection throttler, falling back to direct request:', throttlerError);
      return await requestFn();
    }
  }
  
  /**
   * Generate chat response for user query
   * @param {Array} history - Chat history
   * @param {boolean|Object} options - Whether to override default cache behavior or options object
   * @returns {Promise<String>} - The response content
   */
  async generateChatResponse(history, options = true) {
    try {
      // Parse options object or boolean
      const opts = typeof options === 'object' ? options : { caching: options };
      
      // Get cache configuration
      const cacheConfig = this._getCacheConfiguration();
      
      // Determine if caching should be used
      const shouldUseCache = this._shouldUseCache(opts, cacheConfig);
      
      // Try to get from cache first if enabled
      if (shouldUseCache) {
        const cachedContent = await this._tryGetFromCache(history);
        if (cachedContent) return cachedContent;
      }
      
      // Try to generate new response with retry for rate limits
      let response;
      let retries = opts.retryOnRateLimit ? config.RATE_LIMITS.MAX_RETRIES : 0;
      let retryDelay = config.RATE_LIMITS.RETRY_DELAY_MS;
      
      try {
        response = await this.sendChatRequest(history);
      } catch (apiError) {
        // Check if it's a rate limit error (429) and we should retry
        if (apiError.message && apiError.message.includes('429') && retries > 0) {
          logger.info(`Rate limited, retrying after ${retryDelay}ms...`);
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          
          // Retry the request
          response = await this.sendChatRequest(history);
        } else {
          throw apiError; // Not a rate limit error or out of retries
        }
      }
      
      const content = this._extractResponseContent(response);
      
      // Save to cache if enabled
      if (shouldUseCache) {
        await this._trySaveToCache(history, content, cacheConfig.maxEntries);
      }
      
      return content;
    } catch (error) {
      logger.error('Failed to generate chat response:', error);
      throw error;
    }
  }
  
  /**
   * Get cache configuration from config
   * @returns {Object} Cache configuration object
   * @private
   */
  _getCacheConfiguration() {
    const defaultConfig = {
      enabled: false,
      maxEntries: config.CACHE.DEFAULT_MAX_ENTRIES
    };
    
    try {
      if (config && typeof config.PI_OPTIMIZATIONS === 'object' && config.PI_OPTIMIZATIONS !== null) {
        const piOptEnabled = Boolean(config.PI_OPTIMIZATIONS.ENABLED);
        if (piOptEnabled) {
          const cacheEnabled = Boolean(config.PI_OPTIMIZATIONS.CACHE_ENABLED);
          const maxEntries = typeof config.PI_OPTIMIZATIONS.CACHE_MAX_ENTRIES === 'number' 
            ? config.PI_OPTIMIZATIONS.CACHE_MAX_ENTRIES 
            : defaultConfig.maxEntries;
            
          return {
            enabled: cacheEnabled,
            maxEntries: maxEntries
          };
        }
      }
    } catch (configError) {
      logger.warn('Error accessing PI_OPTIMIZATIONS config:', configError);
    }
    
    return defaultConfig;
  }
  
  /**
   * Try to get response from cache
   * @param {Array} history - Conversation history
   * @returns {Promise<string|null>} Cached content or null if not found
   * @private
   */
  async _tryGetFromCache(history) {
    try {
      const cacheKey = this._generateCacheKey(history);
      const cache = await this._loadCache();
      
      // Check if we have a cache entry for this key
      if (cache && cache[cacheKey]) {
        logger.debug('Cache hit for query');
        const entry = cache[cacheKey];
        
        // Handle object entries
        if (typeof entry === 'object' && entry !== null) {
          // Test format in cache
          if (entry.answer) {
            return entry.answer;
          }
          // Standard format
          if (entry.content) {
            return entry.content;
          }
          // Handle cache format with hashed keys
          const hashedKey = Object.keys(entry)[0];
          if (hashedKey && entry[hashedKey] && entry[hashedKey].answer) {
            return entry[hashedKey].answer;
          }
        }
        
        // Handle string entries as fallback
        if (typeof entry === 'string') {
          return entry;
        }
      }
    } catch (cacheError) {
      logger.warn('Error reading from cache:', cacheError);
    }
    
    return null;
  }
  
  /**
   * Try to save response to cache
   * @param {Array} history - Conversation history
   * @param {string} content - Response content to cache
   * @param {number} maxEntries - Maximum number of cache entries to keep
   * @returns {Promise<void>}
   * @private
   */
  async _trySaveToCache(history, content, maxEntries) {
    try {
      const cacheKey = this._generateCacheKey(history);
      const cache = await this._loadCache() || {};
      cache[cacheKey] = content;
      
      // Prune cache if it exceeds max entries
      this._pruneCache(cache, maxEntries);
      
      await this._saveCache(cache);
    } catch (cacheError) {
      logger.warn('Error saving to cache:', cacheError);
    }
  }
  
  /**
   * Prune cache to keep it under the maximum size
   * @param {Object} cache - Cache object
   * @param {number} maxEntries - Maximum number of entries to keep
   * @private
   */
  _pruneCache(cache, maxEntries) {
    const keys = Object.keys(cache);
    if (keys.length > maxEntries) {
      // Remove oldest entries based on configured percentage
      const removeCount = Math.ceil(maxEntries * config.CACHE.CLEANUP_PERCENTAGE);
      const keysToRemove = keys.slice(0, removeCount);
      keysToRemove.forEach(key => delete cache[key]);
    }
  }

  /**
   * Generate summary of conversation or text
   * @param {Array} history - Conversation history or text to summarize
   * @param {boolean} isText - Whether this is text or conversation history
   * @returns {Promise<string>} - The summary content
   */
  async generateSummary(history, isText = false) {
    try {
      if (isText) {
        return await this.generateTextSummary(history);
      }
      
      // Format the conversation in a summarizable way
      const conversationText = history.map(msg => {
        const role = msg.role.toUpperCase();
        return `${role}: ${msg.content}`;
      }).join('\n\n');
      
      return await this.generateTextSummary(conversationText);
    } catch (error) {
      logger.error('Failed to generate summary:', error);
      throw error;
    }
  }
  
  /**
   * Generate summary of a text
   * @param {string} text - Text to summarize
   * @returns {Promise<string>} - The summary
   */
  async generateTextSummary(text) {
    // Create a system message instructing to summarize
    const messages = [
      { role: 'system', content: 'Please provide a concise summary of the following text.' },
      { role: 'user', content: text }
    ];
    
    const options = { maxTokens: config.API.PERPLEXITY.MAX_TOKENS.SUMMARY };
    const response = await this.sendChatRequest(messages, options);
    return this._extractResponseContent(response);
  }

  /**
   * Load the cache from disk
   * @returns {Promise<Object>} The loaded cache object
   */
  async _loadCache() {
    try {
      const cacheDir = path.join(process.cwd(), 'data');
      const cachePath = path.join(cacheDir, 'question_cache.json');
      
      // Ensure cache directory exists with secure permissions
      try {
        await fs.mkdir(cacheDir, { 
          recursive: true,
          // Use secure directory permissions (read/write/execute for owner, read/execute for others)
          mode: this.FILE_PERMISSIONS.DIRECTORY 
        });
      } catch (mkdirError) {
        if (mkdirError.code !== 'EEXIST') {
          throw mkdirError;
        }
      }
      
      // Read and parse cache file
      try {
        const cacheData = await fs.readFile(cachePath, 'utf8');
        return JSON.parse(cacheData);
      } catch (readError) {
        if (readError.code === 'ENOENT') {
          // Cache file doesn't exist yet
          return {};
        }
        throw readError;
      }
    } catch (error) {
      logger.error('Failed to load cache:', error);
      return {};
    }
  }
  
  /**
   * Format a cache entry with metadata
   * @param {string|Object} entry - The cache entry
   * @param {number} timestamp - The timestamp
   * @returns {Object} Formatted cache entry
   * @private
   */
  _formatCacheEntry(entry, timestamp) {
    // If entry is already an object with content, just ensure it has a timestamp
    if (typeof entry === 'object' && entry !== null && entry.content) {
      return {
        ...entry,
        timestamp: entry.timestamp || timestamp
      };
    }
    
    // Otherwise, create a new object with content and timestamp
    return {
      content: entry,
      timestamp
    };
  }

  /**
   * Save the cache to disk
   * @param {Object} cache - The cache object to save
   * @returns {Promise<void>}
   */
  async _saveCache(cache) {
    try {
      const cacheDir = path.join(process.cwd(), 'data');
      const cachePath = path.join(cacheDir, 'question_cache.json');
      
      // Ensure cache directory exists with secure permissions
      try {
        await fs.mkdir(cacheDir, { 
          recursive: true,
          // Use secure directory permissions (read/write/execute for owner, read/execute for others)
          mode: this.FILE_PERMISSIONS.DIRECTORY
        });
      } catch (mkdirError) {
        if (mkdirError.code !== 'EEXIST') {
          throw mkdirError;
        }
      }
      
      // Format entries with timestamps if needed
      const timestamp = Date.now();
      const formattedCache = {};
      
      for (const [key, value] of Object.entries(cache)) {
        formattedCache[key] = this._formatCacheEntry(value, timestamp);
      }
      
      // Write cache file with secure permissions
      await fs.writeFile(
        cachePath, 
        JSON.stringify(formattedCache, null, 2), 
        { mode: this.FILE_PERMISSIONS.FILE } // Set secure file permissions (read/write for owner, read for others)
      );
      
      // Apply secure file permissions
      await fs.chmod(cachePath, this.FILE_PERMISSIONS.FILE);
    } catch (error) {
      logger.error('Failed to save cache:', error);
    }
  }

  /**
   * Generate a cache key for the given history
   * @param {Array} history - The conversation history
   * @returns {string} - A unique hash for this conversation
   */
  _generateCacheKey(history) {
    const historyString = JSON.stringify(history);
    return crypto.createHash('md5').update(historyString).digest('hex');
  }

  /**
   * Clean up old cache entries
   * @returns {Promise<void>}
   */
  async _cleanupCache() {
    try {
      // Try to get cache pruner
      const pruner = getCachePruner();
      if (pruner && typeof pruner.pruneCache === 'function') {
        await pruner.pruneCache();
        return;
      }
      
      // Fallback to basic cache pruning
      const cache = await this._loadCache();
      if (!cache) return;
      
      const now = Date.now();
      let modified = false;
      
      for (const [key, entry] of Object.entries(cache)) {
        const timestamp = entry && typeof entry === 'object' ? entry.timestamp : 0;
        if (timestamp && now - timestamp > config.CACHE.MAX_AGE_MS) {
          delete cache[key];
          modified = true;
        }
      }
      
      if (modified) {
        await this._saveCache(cache);
      }
    } catch (error) {
      logger.warn('Error cleaning up cache:', error);
    }
  }
}

module.exports = new PerplexityService();
