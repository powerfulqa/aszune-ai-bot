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
      const { body, statusCode, headers } = await request(endpoint, {
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
      
      // Parse successful response based on content type
      // We know this is a successful response (2xx) at this point
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
    } catch (error) {
      // Log the original error for debugging
      console.error('Perplexity API Error:', error);
      
      // Create a more readable error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown API error';
      throw new Error(`API request failed: ${errorMessage}`);
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
