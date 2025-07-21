/**
 * Tests for perplexity service
 */
const { request } = require('undici');
const PerplexityService = require('../../src/services/perplexity');
const config = require('../../src/config/config');
const { mockSuccessResponse, mockErrorResponse } = require('../utils/undici-mock');

jest.mock('undici', () => ({
  request: jest.fn(),
}));

describe('Perplexity Service', () => {
  let perplexityService;

  beforeEach(() => {
    jest.clearAllMocks();
    // The module exports a singleton instance of PerplexityService
    perplexityService = PerplexityService;
  });
  
  describe('sendChatRequest', () => {
    it('sends a request to the API with correct parameters', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Mock response' } }]
      };
      
      request.mockResolvedValueOnce(mockSuccessResponse(mockResponse));
      
      const messages = [{ role: 'user', content: 'Hello' }];
      const response = await perplexityService.sendChatRequest(messages);
      
      expect(request).toHaveBeenCalledWith(
        expect.stringContaining('/chat/completions'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining(config.PERPLEXITY_API_KEY),
            'Content-Type': 'application/json'
          }),
          body: expect.any(String),
        })
      );
      
      expect(response).toEqual(mockResponse);
    });
    
    it('throws an error when API request fails', async () => {
      const mockError = { error: 'Bad request' };
      
      // Use the mock helper for consistent error responses
      request.mockResolvedValueOnce(mockErrorResponse(mockError, 400));
      
      await expect(perplexityService.sendChatRequest([{ role: 'user', content: 'Hello' }]))
        .rejects.toThrow('API request failed with status 400');
    });
  });
  
  describe('generateSummary', () => {
    it('generates a summary with correct system prompt', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Summary text' } }]
      };
      
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
  
  describe('generateTextSummary', () => {
    it('generates a text summary with correct system prompt', async () => {
        const mockResponse = {
            choices: [{ message: { content: 'Text summary' } }]
        };

        jest.spyOn(perplexityService, 'sendChatRequest').mockResolvedValueOnce(mockResponse);

        const messages = [{ role: 'user', content: 'Some text to summarize' }];
        const summary = await perplexityService.generateTextSummary(messages);

        expect(perplexityService.sendChatRequest).toHaveBeenCalledWith(
            expect.arrayContaining([
                { role: 'system', content: config.SYSTEM_MESSAGES.TEXT_SUMMARY },
                ...messages
            ]),
            expect.objectContaining({
                maxTokens: config.API.PERPLEXITY.MAX_TOKENS.SUMMARY,
                temperature: 0.2
            })
        );

        expect(summary).toBe('Text summary');
    });
  });
});
