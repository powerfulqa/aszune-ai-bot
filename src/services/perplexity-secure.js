/**
 * Service for interacting with the Perplexity Agent API.
 * Composes ApiClient, CacheManager, ResponseProcessor and ThrottlingService.
 */
const config = require('../config/config');
const logger = require('../utils/logger');
const { ErrorHandler } = require('../utils/error-handler');
const { ApiClient } = require('./api-client');
const { CacheManager } = require('./cache-manager');
const { ResponseProcessor } = require('./response-processor');
const { ThrottlingService } = require('./throttling-service');
const { getCacheStatsErrorResponse } = require('../utils/cache-stats-helper');
const { getPiSettings } = require('./perplexity-secure/helpers/requestBuilder');
const { extractResponseContent } = require('./perplexity-secure/helpers/responseValidator');

/**
 * Remove a source list the model wrote itself (lines that start with a [N]
 * marker, or a "Sources:"/"References:" heading). The bot appends the real
 * list; the model's own one repeats it or carries invented links.
 * @param {string} content - Answer text
 * @returns {string} Answer without model-written source lines
 */
function stripModelSourceList(content) {
  if (typeof content !== 'string') return content;
  return content
    .split('\n')
    .filter(
      (line) => !/^\s*(?:[-*•]\s*)?(?:\[\d{1,2}\]|[*_]*(?:sources|references)\s*:)/i.test(line)
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

/**
 * Build a numbered source footer matching the inline [N] markers.
 * Lists the sources the answer actually cites; when it cites none, the first
 * few sources the agent used. A URL is listed once: sources the answer already
 * links itself, or that repeat an earlier number, are left out.
 * @param {string} content - Answer text (with [N] markers)
 * @param {Array<string>} citations - Source URLs in result order (1-based ids)
 * @returns {string} Footer to append, or '' when there are no sources
 */
function formatCitationFooter(content, citations) {
  if (!Array.isArray(citations) || citations.length === 0) return '';
  const text = String(content);
  const cited = new Set([...text.matchAll(/\[(\d{1,2})\]/g)].map((m) => Number(m[1])));
  const numbers = cited.size > 0 ? [...cited].sort((a, b) => a - b) : [1, 2, 3, 4, 5];
  const seen = new Set();
  const links = numbers
    .filter((n) => n >= 1 && n <= citations.length)
    .filter((n) => {
      const url = citations[n - 1];
      if (!url || seen.has(url) || text.includes(url)) return false;
      seen.add(url);
      return true;
    })
    .slice(0, 8)
    .map((n) => {
      try {
        const host = new URL(citations[n - 1]).hostname.replace(/^www\./, '');
        return `[${n}] [${host}](${citations[n - 1]})`;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  return links.length > 0 ? `\n\n*Sources: ${links.join(' · ')}*` : '';
}

/**
 * Client for the Perplexity API
 */
class PerplexityService {
  constructor() {
    this.apiKey = config.PERPLEXITY_API_KEY;
    this.baseUrl = config.API.PERPLEXITY.BASE_URL;

    // Initialize service components
    this.apiClient = new ApiClient(this.apiKey, this.baseUrl);
    this.cacheManager = new CacheManager();
    this.responseProcessor = new ResponseProcessor();
    this.throttlingService = new ThrottlingService();
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
   * Shut down the service, logging final cache statistics
   */
  shutdown() {
    logger.info('Final cache statistics:', this.getCacheStats());
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

  _extractResponseContent(response) {
    return extractResponseContent(response);
  }

  /**
   * Runtime facts for the /diag command: the model Perplexity last reported
   * and a summary of the most recent API call.
   * @returns {{ lastModel: string, lastCall: Object|null }}
   */
  getRuntimeInfo() {
    return { lastModel: this.apiClient.lastModel, lastCall: this.apiClient.lastCall };
  }

  /**
   * Send a chat request to the API
   * @param {Array} messages - Messages to send
   * @param {Object} options - Request options
   * @returns {Promise<Object>} API response
   */
  async sendChatRequest(messages, options = {}) {
    const endpoint = this.apiClient.getChatEndpoint();
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
    return this._handleConsecutiveSameRole(msg, lastRole, messages);
  }

  /**
   * Handle consecutive same roles by combining content
   * @private
   */
  _handleConsecutiveSameRole(msg, lastRole, messages) {
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

    // Detect time-sensitive queries and apply recency filter
    const requestOptions = {};
    const recencyKeywords = config.API.PERPLEXITY.SEARCH_RECENCY_KEYWORDS || [];
    if (recencyKeywords.length > 0 && history.length > 0) {
      const lastUserMsg = [...history].reverse().find((m) => m.role === 'user');
      if (lastUserMsg) {
        const lowerContent = lastUserMsg.content.toLowerCase();
        const isRecent = recencyKeywords.some((kw) => lowerContent.includes(kw));
        if (isRecent) {
          requestOptions.searchRecencyFilter = 'month';
        }
      }
    }

    // Try to generate new response with retry for rate limits
    const requestFn = () => this.sendChatRequest(history, requestOptions);
    const response = await this.responseProcessor.generateResponseWithRetry(requestFn, opts);

    let content = stripModelSourceList(this.responseProcessor.extractResponseContent(response));

    content += formatCitationFooter(content, response.citations);

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

      return await this.generateTextSummary(
        textToSummarize,
        isText ? config.SYSTEM_MESSAGES.TEXT_SUMMARY : config.SYSTEM_MESSAGES.SUMMARY
      );
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
    return history.map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n');
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
      {
        condition: () => history.length === 0,
        message: 'No conversation history provided to summarize.',
      },
      {
        condition: () => error.message?.includes('Summary generation failed'),
        message: 'Unable to generate summary at this time.',
      },
    ];

    const matchedError = errorMessages.find((e) => e.condition());
    return matchedError ? matchedError.message : errorResponse.message;
  }

  /**
   * Generate summary of a text
   * @param {string} text - Text to summarize
   * @param {string} [systemPrompt] - Instruction for the model
   * @returns {Promise<string>} - The summary
   */
  async generateTextSummary(text, systemPrompt = config.SYSTEM_MESSAGES.TEXT_SUMMARY) {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ];

    const options = { maxTokens: config.API.PERPLEXITY.MAX_TOKENS.SUMMARY };
    const response = await this.sendChatRequest(messages, options);
    return this._extractResponseContent(response);
  }
}

module.exports = new PerplexityService();
module.exports.formatCitationFooter = formatCitationFooter;
module.exports.stripModelSourceList = stripModelSourceList;
