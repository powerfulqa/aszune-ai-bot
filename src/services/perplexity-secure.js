/**
 * Modified version of perplexity-improved.js with secure file permissions
 * This file adds secure file permissions to fix the security issues
 */

/**
 * Service for interacting with the Perplexity API
 * Version 1.4.0 - Refactored for better maintainability and reduced complexity
 */
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const config = require('../config/config');
const logger = require('../utils/logger');
const { ErrorHandler } = require('../utils/error-handler');
const { ApiClient } = require('./api-client');
const { CacheManager } = require('./cache-manager');
const { ResponseProcessor } = require('./response-processor');
const { ThrottlingService } = require('./throttling-service');
const { getCacheStatsErrorResponse } = require('../utils/cache-stats-helper');
const {
  buildRequestPayload,
  getPiSettings,
} = require('./perplexity-secure/helpers/requestBuilder');
const {
  handleApiResponse,
  extractResponseContent,
  handleErrorResponse,
} = require('./perplexity-secure/helpers/responseValidator');

// Simplified lazy loader for tests
const lazyLoadModule = (importPath) => {
  let module;
  return function () {
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

    // Initialize service components
    this.apiClient = new ApiClient(this.apiKey, this.baseUrl);
    this.cacheManager = new CacheManager();
    this.responseProcessor = new ResponseProcessor();
    this.throttlingService = new ThrottlingService();

    // Track active intervals for proper cleanup
    this.activeIntervals = new Set();
  }

  /**
   * Set up cache cleanup routine
   * @private
   */
  _setupCacheCleanup() {
    if (process.env.NODE_ENV !== 'test') {
      // Clean cache every day
      this.cacheCleanupInterval = setInterval(
        () => this._cleanupCache(),
        config.CACHE.CLEANUP_INTERVAL_MS
      );
      this.activeIntervals.add(this.cacheCleanupInterval);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    try {
      if (!this.cacheManager) {
        logger.warn('Cache manager unavailable while retrieving cache stats');
        return getCacheStatsErrorResponse('Cache manager unavailable');
      }
      return this.cacheManager.getStats();
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'getting cache statistics');
      logger.warn(`Cache statistics error: ${errorResponse.message}`);
      return getCacheStatsErrorResponse(errorResponse.message);
    }
  }

  /**
   * Get detailed cache information
   * @returns {Object} Detailed cache information
   */
  getDetailedCacheInfo() {
    return this._executeWithErrorHandling(
      () => this.cacheManager.getDetailedInfo(),
      'getting detailed cache info',
      { entries: [], stats: { hits: 0, misses: 0 }, error: 'Cache unavailable' }
    );
  }

  /**
   * Invalidate cache entries by tag
   * @param {string} tag - Tag to invalidate
   * @returns {number} Number of entries invalidated
   */
  invalidateCacheByTag(tag) {
    return this._executeWithErrorHandling(
      () => this.cacheManager.invalidateByTag(tag),
      'invalidating cache by tag',
      0
    );
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

    // Log final cache statistics
    const finalStats = this.getCacheStats();
    logger.info('Final cache statistics:', finalStats);
  }

  /**
   * Execute operation with unified error handling
   * @param {Function} operation - Operation to execute
   * @param {string} context - Context for error messages
   * @param {*} defaultValue - Default value on error
   * @returns {*} Operation result or default value
   * @private
   */
  _executeWithErrorHandling(operation, context, defaultValue = null) {
    try {
      return operation();
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, context);
      logger.warn(`${context} error: ${errorResponse.message}`);
      return defaultValue;
    }
  }

  /**
   * Extract header value from headers object
   * @param {Object|Headers} headers - Headers object
   * @param {string} key - Header key
   * @returns {string} Header value or empty string
   * @private
   */
  /**
   * Safely extract header value with multiple fallback strategies
   * @private
   */
  _safeGetHeader(headers, key) {
    if (!headers || !key) return '';

    // Try Headers.get() method first (for Fetch API Headers)
    if (typeof headers.get === 'function') {
      try {
        const result = headers.get(key);
        if (result) return result;
      } catch (e) {
        // Fall through to object access
      }
    }

    // Try direct object property access
    if (headers[key]) return headers[key];

    // Try case-insensitive lookups
    if (headers[key.toLowerCase()]) return headers[key.toLowerCase()];
    if (headers[key.toUpperCase()]) return headers[key.toUpperCase()];

    return '';
  }

  _extractHeader(headers, key) {
    return this._safeGetHeader(headers, key);
  }

  /**
   * Track API performance metric
   * @param {string} metricName - Metric name
   * @param {number} value - Metric value
   * @param {Object} metadata - Additional metadata
   * @private
   */
  async _trackMetric(metricName, value, metadata = {}) {
    try {
      const databaseService = require('../services/database');
      await databaseService.logPerformanceMetric(metricName, value, metadata);
    } catch (error) {
      logger.warn(`Failed to log ${metricName}: ${error.message}`);
    }
  }

  /**
   * Create headers for API requests
   * @returns {Object} Headers object
   */
  _getHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
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
    return buildRequestPayload(messages, options);
  }

  async _handleApiResponse(response) {
    return handleApiResponse(response);
  }

  _getPiOptimizationSettings() {
    return getPiSettings();
  }

  async _handleErrorResponse(statusCode, body) {
    return handleErrorResponse(statusCode, body);
  }

  _extractResponseContent(response) {
    return extractResponseContent(response);
  }

  /**
   * Send a chat request to the API
   * @param {Array} messages - Messages to send
   * @param {Object} options - Request options
   * @returns {Promise<Object>} API response
   */
  async sendChatRequest(messages, options = {}) {
    const endpoint = config.API.PERPLEXITY.ENDPOINTS.CHAT_COMPLETIONS;
    const requestPayload = this.apiClient.buildRequestPayload(messages, options);

    // Define API request function
    const makeApiRequest = async () => {
      return await this.apiClient.makeRequest(endpoint, requestPayload);
    };

    try {
      // Get PI optimization settings
      const piOptSettings = getPiSettings();

      let response;
      if (piOptSettings.enabled) {
        response = await this.throttlingService.executeWithThrottling(makeApiRequest);
      } else {
        response = await makeApiRequest();
      }

      return response;
    } catch (error) {
      const errorResponse = ErrorHandler.handleApiError(error, 'Perplexity API');
      logger.error(`API request failed: ${errorResponse.message}`);
      throw error;
    }
  }

  /**
   * Generate chat response for user query
   * @param {Array} history - Chat history
   * @param {Object} options - Options object with caching and other settings
   * @returns {Promise<String>} - The response content
   */
  /**
   * Helper function to generate user-friendly error messages
   * @param {Error} error - The error object
   * @param {Object} errorResponse - Error response from ErrorHandler
   * @returns {string} User-friendly error message
   * @private
   */
  _generateErrorMessage(error, errorResponse) {
    // Error message mappings - ordered by specificity
    const errorMappings = [
      {
        condition: () => error.statusCode === 400,
        message:
          'The service is temporarily unavailable due to configuration issues. Please try again later.',
      },
      {
        condition: () => error.statusCode === 401,
        message: 'Authentication error with the AI service. Please try again later.',
      },
      {
        condition: () => error.statusCode === 429,
        message: 'Rate limit exceeded. Please try again later.',
      },
      {
        condition: () => error.statusCode >= 500,
        message: 'The service is temporarily unavailable. Please try again later.',
      },
      {
        condition: () => error.message?.includes('Network'),
        message: 'Network connection issue. Please check your connection and try again.',
      },
      {
        condition: () => error.message?.includes('Empty response'),
        message: 'Empty response received from the service.',
      },
      {
        condition: () => error.message?.includes('invalid'),
        message: 'Unexpected response format received.',
      },
    ];

    const matchedMapping = errorMappings.find((mapping) => mapping.condition());
    return matchedMapping ? matchedMapping.message : errorResponse.message;
  }

  /**
   * Track performance metrics for API operations (LEGACY - use _trackMetric directly)
   * @param {string} metricName - Name of the metric
   * @param {number} value - Metric value
   * @param {Object} metadata - Additional metadata
   */
  async _trackApiPerformance(metricName, value, metadata = {}) {
    return this._trackMetric(metricName, value, metadata);
  }

  /**
   * Track cache hit performance
   * @param {number} responseTime - Time taken for cache hit
   * @param {number} memoryDelta - Memory usage change
   * @param {number} historyLength - Length of conversation history
   * @param {boolean} cacheEnabled - Whether caching was enabled
   */
  async _trackCacheHitPerformance(responseTime, memoryDelta, historyLength, cacheEnabled) {
    await this._trackMetric('api_cache_hit_time', responseTime, {
      historyLength,
      cacheEnabled,
      operation: 'cache_hit',
    });
    await this._trackMetric('memory_usage_delta', memoryDelta, { operation: 'cache_hit' });
  }

  /**
   * Track API call performance
   * @param {number} totalTime - Total time for API call
   * @param {number} memoryDelta - Memory usage change
   * @param {Object} metrics - Performance metrics
   * @param {number} metrics.totalTime - Total response time
   * @param {number} metrics.memoryDelta - Memory usage change
   * @param {number} metrics.finalMemoryUsage - Final memory usage
   * @param {number} metrics.historyLength - Length of conversation history
   * @param {boolean} metrics.cacheEnabled - Whether caching was enabled
   * @param {number} metrics.contentLength - Length of response content
   */
  async _trackApiCallPerformance(metrics) {
    const { totalTime, memoryDelta, finalMemoryUsage, historyLength, cacheEnabled, contentLength } =
      metrics;
    await this._trackMetric('api_response_time', totalTime, {
      historyLength,
      cacheEnabled,
      cacheHit: false,
      contentLength,
      operation: 'api_call',
    });
    await this._trackMetric('memory_usage_delta', memoryDelta, { operation: 'api_call' });
    await this._trackMetric('memory_usage_current', finalMemoryUsage, {
      operation: 'api_call_end',
    });
  }

  /**
   * Track API error performance
   * @param {number} errorTime - Time taken before error
   * @param {number} memoryDelta - Memory usage change
   * @param {number} historyLength - Length of conversation history
   * @param {string} errorMessage - Error message
   */
  async _trackApiErrorPerformance(errorTime, memoryDelta, historyLength, errorMessage) {
    await this._trackMetric('api_error_time', errorTime, {
      historyLength,
      error: errorMessage,
      operation: 'api_error',
    });
    await this._trackMetric('memory_usage_delta', memoryDelta, {
      operation: 'api_error',
    });
  }

  /**
   * Format messages for API to ensure proper alternation and system message
   * @param {Array} history - Raw conversation history
   * @returns {Array} Formatted messages for API
   * @private
   */
  _formatMessagesForAPI(history) {
    if (!Array.isArray(history) || history.length === 0) {
      return [
        { role: 'system', content: config.SYSTEM_MESSAGES.CHAT },
        { role: 'user', content: 'Hello' },
      ];
    }

    const messages = [{ role: 'system', content: config.SYSTEM_MESSAGES.CHAT }];

    // Clean and ensure alternation
    return this._ensureMessageAlternation(messages, history);
  }

  /**
   * Ensure messages alternate between user and assistant roles
   * @param {Array} messages - Initial messages array (with system message)
   * @param {Array} history - Conversation history to process
   * @returns {Array} Messages with proper alternation
   * @private
   */
  _ensureMessageAlternation(messages, history) {
    let lastRole = 'system';

    for (const msg of history) {
      if (msg.role === 'system') continue; // Skip additional system messages

      const processedMsg = this._processMessageForAlternation(msg, lastRole, messages);
      if (processedMsg.added) {
        lastRole = processedMsg.newRole;
      }
    }

    // Ensure we end with a user message
    if (messages[messages.length - 1].role === 'assistant') {
      messages.push({ role: 'user', content: 'Please continue.' });
    }

    return messages;
  }

  /**
   * Process a single message for proper alternation
   * @param {Object} msg - Message to process
   * @param {string} lastRole - Last message role
   * @param {Array} messages - Messages array to update
   * @returns {Object} Result of processing
   * @private
   */
  _processMessageForAlternation(msg, lastRole, messages) {
    // Handle user message after assistant or system
    if (msg.role === 'user' && (lastRole === 'assistant' || lastRole === 'system')) {
      messages.push({ role: 'user', content: msg.content });
      return { added: true, newRole: 'user' };
    }

    // Handle assistant message after user
    if (msg.role === 'assistant' && lastRole === 'user') {
      messages.push({ role: 'assistant', content: msg.content });
      return { added: true, newRole: 'assistant' };
    }

    // Handle assistant right after system (insert placeholder user message)
    if (msg.role === 'assistant' && lastRole === 'system') {
      messages.push({ role: 'user', content: 'Continue our conversation.' });
      messages.push({ role: 'assistant', content: msg.content });
      return { added: true, newRole: 'assistant' };
    }

    // Handle consecutive same roles - combine content
    if (msg.role === lastRole && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === msg.role) {
        lastMsg.content += '\n' + msg.content;
      }
    }

    return { added: false, newRole: lastRole };
  }

  /**
   * Process chat response generation with caching and API calls
   * @param {Array} history - Conversation history
   * @param {Object} opts - Standardized options
   * @param {Object} cacheConfig - Cache configuration
   * @param {boolean} shouldUseCache - Whether to use cache
   * @returns {Promise<string>} Generated response content
   */
  async _processChatResponse(history, opts, cacheConfig, shouldUseCache) {
    // Try to get from cache first if enabled
    if (shouldUseCache) {
      const cachedContent = await this.cacheManager.tryGetFromCache(history);
      if (cachedContent) return cachedContent;
    }

    // Try to generate new response with retry for rate limits
    const requestFn = () => this.sendChatRequest(history);
    const response = await this.responseProcessor.generateResponseWithRetry(requestFn, opts);

    const content = this.responseProcessor.extractResponseContent(response);

    // Save to cache if enabled
    if (shouldUseCache) {
      await this.cacheManager.trySaveToCache(history, content, cacheConfig.maxEntries);
    }

    return content;
  }

  /**
   * Track response performance metrics
   * @param {number} startTime - Request start time
   * @param {number} initialMemoryUsage - Initial memory usage
   * @param {number} historyLength - Length of conversation history
   * @param {boolean} shouldUseCache - Whether caching was enabled
   * @param {string} content - Response content
   * @private
   */
  async _trackResponsePerformance(
    startTime,
    initialMemoryUsage,
    historyLength,
    shouldUseCache,
    content
  ) {
    const isCacheHit = Date.now() - startTime < 10;
    const responseTime = Date.now() - startTime;
    const finalMemoryUsage = process.memoryUsage().heapUsed;
    const memoryDelta = finalMemoryUsage - initialMemoryUsage;

    if (isCacheHit) {
      await this._trackCacheHitPerformance(
        responseTime,
        memoryDelta,
        historyLength,
        shouldUseCache
      );
    } else {
      await this._trackApiCallPerformance({
        totalTime: responseTime,
        memoryDelta,
        finalMemoryUsage,
        historyLength,
        cacheEnabled: shouldUseCache,
        contentLength: content?.length || 0,
      });
    }
  }

  async generateChatResponse(history, options = {}) {
    const startTime = Date.now();
    const initialMemoryUsage = process.memoryUsage().heapUsed;
    const opts = this.responseProcessor.standardizeOptions(options);

    try {
      const formattedHistory = this._formatMessagesForAPI(history);
      const cacheConfig = this.cacheManager.getCacheConfiguration();
      const shouldUseCache = this.cacheManager.shouldUseCache(opts, cacheConfig);
      const content = await this._processChatResponse(
        formattedHistory,
        opts,
        cacheConfig,
        shouldUseCache
      );

      await this._trackResponsePerformance(
        startTime,
        initialMemoryUsage,
        history?.length || 0,
        shouldUseCache,
        content
      );
      return content;
    } catch (error) {
      const errorTime = Date.now() - startTime;
      const finalMemoryUsage = process.memoryUsage().heapUsed;
      const memoryDelta = finalMemoryUsage - initialMemoryUsage;

      await this._trackApiErrorPerformance(
        errorTime,
        memoryDelta,
        history?.length || 0,
        error.message
      );

      const errorResponse = ErrorHandler.handleError(error, 'generate chat response', {
        historyLength: history?.length || 0,
        shouldUseCache: opts.caching !== false,
      });
      logger.error(`Failed to generate chat response: ${errorResponse.message}`);

      // Re-throw the error to maintain error handling contract
      throw error;
    }
  }

  /**
   * Generate response with retry logic for rate limits
   * @param {Array} history - Conversation history
   * @param {Object} opts - Options including retry settings
   * @returns {Object} API response
   * @private
   */
  async _generateResponseWithRetry(history, opts) {
    let retries = opts.retryOnRateLimit ? config.RATE_LIMITS.MAX_RETRIES : 0;
    let retryDelay = config.RATE_LIMITS.RETRY_DELAY_MS;

    try {
      return await this.sendChatRequest(history);
    } catch (apiError) {
      // Check if it's a retryable error and we should retry
      const isRetryableError = this._isRetryableError(apiError);

      if (isRetryableError && retries > 0) {
        const errorResponse = ErrorHandler.handleError(apiError, 'API retry', { retries });
        logger.info(`Retryable error, retrying after ${retryDelay}ms: ${errorResponse.message}`);

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, retryDelay));

        // Retry the request
        return await this.sendChatRequest(history);
      } else {
        throw apiError; // Not a retryable error or out of retries
      }
    }
  }

  /**
   * Determine if an error is retryable
   * @param {Error} error - The error to check
   * @returns {boolean} - True if the error is retryable
   * @private
   */
  _isRetryableError(error) {
    if (!error || !error.message) return false;

    const message = error.message.toLowerCase();
    return this._isTemporaryError(message) && !this._isPermanentError(message);
  }

  /**
   * Check if error message indicates temporary issue
   * @param {string} message - Error message
   * @returns {boolean} - True if temporary error
   * @private
   */
  _isTemporaryError(message) {
    return (
      message.includes('temporary') ||
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('429')
    );
  }

  /**
   * Check if error message indicates permanent issue
   * @param {string} message - Error message
   * @returns {boolean} - True if permanent error
   * @private
   */
  _isPermanentError(message) {
    return (
      message.includes('permanent') ||
      message.includes('invalid') ||
      message.includes('unauthorized') ||
      message.includes('forbidden')
    );
  }

  /**
   * Get cache configuration from config
   * @returns {Object} Cache configuration object
   * @private
   */
  _getCacheConfiguration() {
    const defaultConfig = {
      enabled: false,
      maxEntries: config.CACHE.DEFAULT_MAX_ENTRIES,
    };

    try {
      if (
        config &&
        typeof config.PI_OPTIMIZATIONS === 'object' &&
        config.PI_OPTIMIZATIONS !== null
      ) {
        const piOptEnabled = Boolean(config.PI_OPTIMIZATIONS.ENABLED);
        if (piOptEnabled) {
          const cacheEnabled = Boolean(config.PI_OPTIMIZATIONS.CACHE_ENABLED);
          const maxEntries =
            typeof config.PI_OPTIMIZATIONS.CACHE_MAX_ENTRIES === 'number'
              ? config.PI_OPTIMIZATIONS.CACHE_MAX_ENTRIES
              : defaultConfig.maxEntries;

          return {
            enabled: cacheEnabled,
            maxEntries: maxEntries,
          };
        }
      }
    } catch (configError) {
      const errorResponse = ErrorHandler.handleError(
        configError,
        'accessing PI_OPTIMIZATIONS config'
      );
      logger.warn(`Config access error: ${errorResponse.message}`);
    }

    return defaultConfig;
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
      const cache = (await this._loadCache()) || {};
      cache[cacheKey] = content;

      // Prune cache if it exceeds max entries
      this._pruneCache(cache, maxEntries);

      await this._saveCache(cache);
    } catch (cacheError) {
      const errorResponse = ErrorHandler.handleFileError(
        cacheError,
        'saving to cache',
        'question_cache.json'
      );
      logger.warn(`Cache save error: ${errorResponse.message}`);
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
      keysToRemove.forEach((key) => delete cache[key]);
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
      const textToSummarize = isText
        ? this._extractTextContent(history)
        : this._formatConversationForSummary(history);

      return await this.generateTextSummary(textToSummarize);
    } catch (error) {
      return this._handleSummaryError(error, history, isText);
    }
  }

  /**
   * Extract text content from history array or string
   * @param {Array|string} history - History to extract from
   * @returns {string} - Extracted text
   * @private
   */
  _extractTextContent(history) {
    return Array.isArray(history) && history[0]?.content ? history[0].content : history;
  }

  /**
   * Format conversation history for summarization
   * @param {Array} history - Conversation history
   * @returns {string} - Formatted conversation text
   * @private
   */
  _formatConversationForSummary(history) {
    return history
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n');
  }

  /**
   * Handle summary generation errors
   * @param {Error} error - The error
   * @param {Array} history - Original history
   * @param {boolean} isText - Whether text mode
   * @returns {string} - Error message
   * @private
   */
  _handleSummaryError(error, history, isText) {
    const errorResponse = ErrorHandler.handleError(error, 'generate summary', {
      historyLength: history?.length || 0,
      isText: isText,
    });
    logger.error(`Failed to generate summary: ${errorResponse.message}`);

    // Error message mapping
    const errorMessages = [
      { condition: () => history.length === 0, message: 'No conversation history provided to summarize.' },
      { condition: () => error.message?.includes('Summary generation failed'), message: 'Unable to generate summary at this time.' },
    ];

    const matchedError = errorMessages.find((e) => e.condition());
    return matchedError ? matchedError.message : errorResponse.message;
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
      { role: 'user', content: text },
    ];

    const options = { maxTokens: config.API.PERPLEXITY.MAX_TOKENS.SUMMARY };
    const response = await this.sendChatRequest(messages, options);
    return this._extractResponseContent(response);
  }

  /**
   * Ensure cache directory exists with secure permissions
   * @param {string} cacheDir - Directory path
   * @returns {Promise<void>}
   * @private
   */
  async _ensureCacheDirectory(cacheDir) {
    try {
      await fs.mkdir(cacheDir, {
        recursive: true,
        mode: this.FILE_PERMISSIONS.DIRECTORY,
      });
    } catch (mkdirError) {
      if (mkdirError.code !== 'EEXIST') {
        throw mkdirError;
      }
    }
  }

  /**
   * Load the cache from disk
   * @returns {Promise<Object>} The loaded cache object
   */
  async _loadCache() {
    const cacheDir = path.join(process.cwd(), 'data');
    const cachePath = path.join(cacheDir, 'question_cache.json');

    try {
      await this._ensureCacheDirectory(cacheDir);

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
      const errorResponse = ErrorHandler.handleFileError(error, 'loading cache', cachePath);
      logger.error(`Failed to load cache: ${errorResponse.message}`);
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
        timestamp: entry.timestamp || timestamp,
      };
    }

    // Otherwise, create a new object with content and timestamp
    return {
      content: entry,
      timestamp,
    };
  }

  /**
   * Save the cache to disk
   * @param {Object} cache - The cache object to save
   * @returns {Promise<void>}
   */
  async _saveCache(cache) {
    const cacheDir = path.join(process.cwd(), 'data');
    const cachePath = path.join(cacheDir, 'question_cache.json');

    try {
      await this._ensureCacheDirectory(cacheDir);

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
      const errorResponse = ErrorHandler.handleFileError(error, 'saving cache', cachePath);
      logger.error(`Failed to save cache: ${errorResponse.message}`);
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
      const errorResponse = ErrorHandler.handleError(error, 'cleaning up cache');
      logger.warn(`Cache cleanup error: ${errorResponse.message}`);
    }
  }
}

module.exports = new PerplexityService();
