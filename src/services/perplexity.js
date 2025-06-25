/**
 * Service for interacting with the Perplexity API
 */
const axios = require('axios');
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
      const response = await axios.post(endpoint, {
        model: options.model || config.API.PERPLEXITY.DEFAULT_MODEL,
        messages: messages,
        max_tokens: options.maxTokens || config.API.PERPLEXITY.MAX_TOKENS.CHAT,
        temperature: options.temperature || config.API.PERPLEXITY.DEFAULT_TEMPERATURE,
      }, {
        headers: this._getHeaders()
      });
      
      return response.data;
    } catch (error) {
      const errorDetails = error?.response?.data || error.message || error;
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

module.exports = new PerplexityService();
