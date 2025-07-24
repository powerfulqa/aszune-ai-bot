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
      
      // First check content-type to determine appropriate parsing method
      const contentType = headers.get('content-type') || '';
      
      // For non-2xx status codes, handle as error
      if (statusCode < 200 || statusCode >= 300) {
        const responseText = await body.text().catch(() => 'Could not read response body');
        let errorInfo;
        
        try {
          errorInfo = JSON.parse(responseText);
        } catch (e) {
          errorInfo = responseText;
        }
        
        console.error('Perplexity API Error:', errorInfo);
        throw new Error(`API request failed with status ${statusCode}`);
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
      if (contentType.includes('application/json')) {
        return await body.json();
      } else {
        // For non-JSON content types, read as text first
        const responseText = await body.text();
        
        // Still try to parse as JSON as some APIs send JSON with wrong content-type
        try {
          return JSON.parse(responseText);
        } catch (parseError) {
          // Not JSON, return as text object
          return { text: responseText };
        }
      }
    } catch (error) {
      console.error('Failed to process API response:', error);
      throw new Error('Failed to parse API response');
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
      return 'Summary generation failed';
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
