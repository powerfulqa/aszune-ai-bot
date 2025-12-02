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

describe('shutdown method', () => {
  it('should clear all active intervals', () => {
    const mockInterval1 = setInterval(() => {}, 1000);
    const mockInterval2 = setInterval(() => {}, 2000);

    perplexityService.activeIntervals = new Set([mockInterval1, mockInterval2]);

    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    perplexityService.shutdown();

    expect(clearIntervalSpy).toHaveBeenCalledWith(mockInterval1);
    expect(clearIntervalSpy).toHaveBeenCalledWith(mockInterval2);
    expect(perplexityService.activeIntervals.size).toBe(0);

    clearIntervalSpy.mockRestore();
  });

  it('should handle shutdown when no intervals exist', () => {
    perplexityService.activeIntervals = new Set();

    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    perplexityService.shutdown();

    expect(clearIntervalSpy).not.toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
  });
});
