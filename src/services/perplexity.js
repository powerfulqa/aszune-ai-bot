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
      const { body, statusCode } = await request(endpoint, {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify({
          model: options.model || config.API.PERPLEXITY.DEFAULT_MODEL,
          messages: messages,
          max_tokens: options.maxTokens || config.API.PERPLEXITY.MAX_TOKENS.CHAT,
          temperature: options.temperature || config.API.PERPLEXITY.DEFAULT_TEMPERATURE,
        }),
      });
      
      // Check for success status code (200-299 range)
      if (statusCode < 200 || statusCode >= 300) {
        try {
          const errorDetails = await body.json();
          console.error('Perplexity API Error:', errorDetails);
          throw new Error(`API request failed with status ${statusCode}`);
        } catch (jsonError) {
          // If we can't parse the body as JSON, create a simple error
          console.error('Failed to parse error response body:', jsonError);
          throw new Error(`API request failed with status ${statusCode} (response not parseable)`);
        }
      }
      
      try {
        return await body.json();
      } catch (jsonError) {
        console.error('Failed to parse successful response as JSON:', jsonError);
        throw new Error('Failed to parse API response');
      }
    } catch (error) {
      let errorDetails;
      
      // Handle errors more robustly by checking error existence and properties
      try {
        if (typeof error === 'object' && error !== null) {
          errorDetails = {
            message: error.message || 'Unknown API error',
            originalError: error
          };
          
          // Add additional details if available
          if (error.statusCode) {
            errorDetails.statusCode = error.statusCode;
          }
        } else {
          errorDetails = { message: 'Unknown error', originalError: error };
        }
      } catch (parseError) {
        errorDetails = { message: 'Error parsing error object', originalError: String(error) };
      }
      
      console.error('Perplexity API Error:', errorDetails);
      throw new Error(`API request failed: ${JSON.stringify(errorDetails)}`);
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
        ...history,
      ];
      
      const response = await this.sendChatRequest(messages, {
        maxTokens: config.API.PERPLEXITY.MAX_TOKENS.SUMMARY,
        temperature: 0.2,
      });
      
      return response.choices[0].message.content;
    } catch (error) {
      console.error('Summary Generation Error:', error);
      throw error;
    }
  }
  
  /**
   * Generate a summary of provided text
   * @param {Array} messages - The messages containing text to summarize
   * @returns {Promise<String>} - The summary text
   */
  async generateTextSummary(messages) {
    try {
      const fullMessages = [
        {
          role: 'system',
          content: config.SYSTEM_MESSAGES.TEXT_SUMMARY,
        },
        ...messages,
      ];
      
      const response = await this.sendChatRequest(fullMessages, {
        maxTokens: config.API.PERPLEXITY.MAX_TOKENS.SUMMARY,
        temperature: 0.2,
      });
      
      return response.choices[0].message.content;
    } catch (error) {
      console.error('Text Summary Generation Error:', error);
      throw error;
    }
  }
  
  /**
   * Generate a chat response
   * @param {Array} history - The conversation history
   * @returns {Promise<String>} - The response text
   */
  async generateChatResponse(history) {
    try {
      const messages = [
        {
          role: 'system',
          content: config.SYSTEM_MESSAGES.CHAT,
        },
        ...history,
      ];
      
      const response = await this.sendChatRequest(messages);
      return response.choices[0].message.content;
    } catch (error) {
      console.error('Chat Response Generation Error:', error);
      throw error;
    }
  }
}

// Export the singleton instance for direct use
const perplexityServiceInstance = new PerplexityService();
module.exports = perplexityServiceInstance;
