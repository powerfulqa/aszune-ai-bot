/**
 * Tests for perplexity service
 */
const axios = require('axios');
const perplexityService = require('../../src/services/perplexity');
const config = require('../../src/config/config');

jest.mock('axios');

describe('Perplexity Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('sendChatRequest', () => {
    it('sends a request to the API with correct parameters', async () => {
      const mockResponse = {
        data: {
          choices: [{ message: { content: 'Mock response' } }]
        }
      };
      
      axios.post.mockResolvedValueOnce(mockResponse);
      
      const messages = [{ role: 'user', content: 'Hello' }];
      const response = await perplexityService.sendChatRequest(messages);
      
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/chat/completions'),
        expect.objectContaining({
          model: config.API.PERPLEXITY.DEFAULT_MODEL,
          messages: messages,
          max_tokens: config.API.PERPLEXITY.MAX_TOKENS.CHAT
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining(config.PERPLEXITY_API_KEY),
            'Content-Type': 'application/json'
          })
        })
      );
      
      expect(response).toEqual(mockResponse.data);
    });
    
    it('throws an error when API request fails', async () => {
      const mockError = {
        response: {
          status: 400,
          data: { error: 'Bad request' }
        }
      };
      
      axios.post.mockRejectedValueOnce(mockError);
      
      await expect(perplexityService.sendChatRequest([{ role: 'user', content: 'Hello' }]))
        .rejects.toThrow('API request failed');
    });
  });
  
  describe('generateSummary', () => {
    it('generates a summary with correct system prompt', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Summary text' } }]
      };
      
      // Mock the sendChatRequest method to return our mock response
      jest.spyOn(perplexityService, 'sendChatRequest').mockResolvedValueOnce(mockResponse);
      
      const history = [{ role: 'user', content: 'Hello' }];
      const summary = await perplexityService.generateSummary(history);
      
      expect(perplexityService.sendChatRequest).toHaveBeenCalledWith(
        expect.arrayContaining([
          { role: 'system', content: config.SYSTEM_MESSAGES.SUMMARY },
          ...history
        ]),
        expect.objectContaining({
          maxTokens: config.API.PERPLEXITY.MAX_TOKENS.SUMMARY,
          temperature: 0.2
        })
      );
      
      expect(summary).toBe('Summary text');
    });
  });
  
  describe('generateChatResponse', () => {
    it('generates a chat response with correct system prompt', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Chat response' } }]
      };
      
      // Mock the sendChatRequest method to return our mock response
      jest.spyOn(perplexityService, 'sendChatRequest').mockResolvedValueOnce(mockResponse);
      
      const history = [{ role: 'user', content: 'Hello' }];
      const response = await perplexityService.generateChatResponse(history);
      
      expect(perplexityService.sendChatRequest).toHaveBeenCalledWith(
        expect.arrayContaining([
          { role: 'system', content: config.SYSTEM_MESSAGES.CHAT },
          ...history
        ])
      );
      
      expect(response).toBe('Chat response');
    });
  });
});
