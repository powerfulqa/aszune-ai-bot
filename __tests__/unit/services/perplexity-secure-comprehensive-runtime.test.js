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
    jest.useFakeTimers({ now: new Date('2026-11-16T12:00:00.000Z') });

    const text = 'Long text to be summarized...';
    const result = await perplexityService.generateTextSummary(text);

    expect(result).toBe('This is a summary of the text.');
    expect(request).toHaveBeenCalledTimes(1);
    const [url, { signal, body, ...options }] = request.mock.calls[0];
    expect(url).toBe('https://api.perplexity.ai/v1/agent');
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(options).toEqual({
      method: 'POST',
      headers: { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(body)).toEqual({
      effort: 'medium',
      input: [{ type: 'message', role: 'user', content: text }],
      instructions:
        'Today is 2026-11-16.\n\n' +
        'Summarise the following text in a concise paragraph, using UK English.\n\n' +
        'If someone asks what model, AI or API you use, tell them: you run on the Perplexity Agent API (/v1/agent) at the "medium" effort level, and the effort level picks the model (not reported yet).',
      tools: [{ type: 'web_search' }, { type: 'fetch_url' }],
      max_output_tokens: 1024,
    });
  });

  it('should handle text summary errors', async () => {
    request.mockRejectedValueOnce(new Error('Summary API error'));

    const text = 'Text to summarize';
    await expect(perplexityService.generateTextSummary(text)).rejects.toThrow('Summary API error');
  });
});
