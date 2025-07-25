/**
 * Service for interacting with the Perplexity API
 */
const { request } = require('undici');
const config = require('../config/config');

/**
 * Client for the Perplexity API
 */
class PerplexityService {
  constructor() {
    this.apiKey = config.PERPLEXITY_API_KEY;
    this.baseUrl = config.API.PERPLEXITY.BASE_URL;
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
    if (!headers) return '';
    
    try {
      // Try Headers object API if available
      if (typeof headers.get === 'function') {
        return headers.get(key) || '';
      }
      // Fall back to plain object access (case insensitive)
      return headers[key] || headers[key.toLowerCase()] || headers[key.toUpperCase()] || '';
    } catch (error) {
      console.warn(`Error getting header "${key}":`, error.message);
      return '';
    }
  }

  /**
   * Send a chat completion request
   * @param {Array} messages - The messages to send to the API
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - The API response
   */
  async sendChatRequest(messages, options = {}) {
    const endpoint = this.baseUrl + config.API.PERPLEXITY.ENDPOINTS.CHAT_COMPLETIONS;
    
    try {
      const { statusCode, headers, body } = await request(endpoint, {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify({
          model: options.model || config.API.PERPLEXITY.DEFAULT_MODEL,
          messages: messages,
          max_tokens: options.maxTokens || config.API.PERPLEXITY.MAX_TOKENS.CHAT,
          temperature: options.temperature || config.API.PERPLEXITY.DEFAULT_TEMPERATURE,
        }),
      });
      
      // Get content-type using our safe header access method
      const contentType = this._safeGetHeader(headers, 'content-type');
      console.debug('Content-Type header:', contentType);
      
      // For non-2xx status codes, handle as error
      if (statusCode < 200 || statusCode >= 300) {
        const responseText = await body.text().catch(() => 'Could not read response body');
        
        // Create a descriptive error message with status code and response content
        const errorMessage = `API request failed with status ${statusCode}: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`;
        console.error('Perplexity API Error:', errorMessage);
        throw new Error(errorMessage);
      }
      
      // Parse response using our helper method
      return await this._parseApiResponse(body, contentType);
    } catch (err) {
      console.error('Error in Perplexity API call:', err);
      throw err;
    }
  }
  
  /**
   * Parse API response based on content type
   * @param {ReadableStream} body - The response body
   * @param {string} contentType - The content type header value
   * @returns {Promise<object>} Parsed response
   * @private
   */
  async _parseApiResponse(body, contentType) {
    try {
      // For JSON content types, use the built-in json parser
      if (contentType.includes('application/json')) {
        return await body.json();
      }
      
      // For all other content types, get as text first
      const responseText = await body.text();
      
      // Some APIs return JSON with incorrect content-type, so try parsing it
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        // Not valid JSON, return as a text object
        console.debug('JSON parse failed:', parseError);
        return { text: responseText };
      }
    } catch (error) {
      const errorMessage = `Failed to process API response: ${error.message || 'Unknown error'}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Generate a summary from conversation history
   * @param {Array} history - The conversation history
   * @returns {Promise<String>} - The summary text
   */
  async generateSummary(history) {
    try {
      const messages = [
        {
          role: 'system',
          content: config.SYSTEM_MESSAGES.SUMMARY,
        },
        ...history.map(message => ({
          role: message.role,
          content: message.content,
        })),
      ];
      
      const response = await this.sendChatRequest(messages, {
        temperature: 0.2, // Lower temperature for more deterministic results
        maxTokens: config.API.PERPLEXITY.MAX_TOKENS.SUMMARY,
      });
      
      return response?.choices?.[0]?.message?.content || 'No summary generated';
    } catch (error) {
      console.error('Failed to generate summary:', error);
      throw new Error('Summary generation failed');
    }
  }
  
  /**
   * Generate a text summary from messages
   * @param {Array} messages - The messages to summarize
   * @returns {Promise<String>} - The summary text
   */
  async generateTextSummary(messages) {
    try {
      // Create request messages with system prompt
      const requestMessages = [
        {
          role: 'system',
          content: config.SYSTEM_MESSAGES.TEXT_SUMMARY,
        }
      ];
      
      // Add user messages directly rather than joining them
      messages.forEach(message => {
        requestMessages.push(message);
      });
      
      const response = await this.sendChatRequest(requestMessages, {
        temperature: 0.2,
        maxTokens: config.API.PERPLEXITY.MAX_TOKENS.SUMMARY,
      });
      
      return response?.choices?.[0]?.message?.content || 'No summary generated';
    } catch (error) {
      console.error('Failed to generate text summary:', error);
      return 'Text summary generation failed';
    }
  }
  
  /**
   * Generate chat response for user query
   * @param {Array} history - Chat history
   * @returns {Promise<String>} - The chat response
   */
  async generateChatResponse(history) {
    try {
      const response = await this.sendChatRequest(history);
      return response?.choices?.[0]?.message?.content || 'No response generated';
    } catch (error) {
      console.error('Failed to generate chat response:', error);
      throw error; // Re-throw for caller to handle
    }
  }
}

module.exports = new PerplexityService();
