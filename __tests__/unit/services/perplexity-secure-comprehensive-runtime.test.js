/**
 * PerplexitySecure runtime coverage tests split for QLTY compliance.
 */
const {
  setupPerplexityServiceTestContext,
} = require('./perplexity-secure-comprehensive.test.setup');

const { PerplexityService, fs, request, mockSuccessResponse } = setupPerplexityServiceTestContext();

let perplexityService;

beforeEach(() => {
  jest.clearAllMocks();
  perplexityService = PerplexityService;
  fs.readFile.mockRejectedValue(new Error('File not found'));
});

describe('generateTextSummary method', () => {
  it('uses the configured prompt for conversation and for text summaries', async () => {
    const config = require('../../../src/config/config');
    const spy = jest.spyOn(perplexityService, 'generateTextSummary').mockResolvedValue('ok');

    await perplexityService.generateSummary([{ role: 'user', content: 'hello' }]);
    await perplexityService.generateSummary('some text', true);

    expect(spy).toHaveBeenNthCalledWith(1, 'USER: hello', config.SYSTEM_MESSAGES.SUMMARY);
    expect(spy).toHaveBeenNthCalledWith(2, 'some text', config.SYSTEM_MESSAGES.TEXT_SUMMARY);
    spy.mockRestore();
  });

  it('should generate text summary with correct options', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'This is a summary of the text.',
          },
        },
      ],
    };
    request.mockResolvedValueOnce(mockSuccessResponse(mockResponse));

    const text = 'Long text to be summarized...';
    const result = await perplexityService.generateTextSummary(text);

    expect(result).toBe('This is a summary of the text.');
    expect(request).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('Long text to be summarized...'),
      })
    );
  });

  it('should handle text summary errors', async () => {
    request.mockRejectedValueOnce(new Error('Summary API error'));

    const text = 'Text to summarize';
    await expect(perplexityService.generateTextSummary(text)).rejects.toThrow('Summary API error');
  });
});
