/**
 * PerplexitySecure content and error utility coverage split for QLTY.
 */
const {
  setupPerplexityServiceTestContext,
} = require('./perplexity-secure-comprehensive.test.setup');

const { PerplexityService, fs } = setupPerplexityServiceTestContext();

let perplexityService;

beforeEach(() => {
  jest.clearAllMocks();
  perplexityService = PerplexityService;
  fs.readFile.mockRejectedValue(new Error('File not found'));
});

describe('_extractResponseContent method', () => {
  it('should extract content from message.content', () => {
    const response = {
      choices: [
        {
          message: {
            content: 'Test message content',
          },
        },
      ],
    };

    const result = perplexityService._extractResponseContent(response);
    expect(result).toBe('Test message content');
  });

  it('should extract content from choice.content', () => {
    const response = {
      choices: [
        {
          content: 'Direct choice content',
        },
      ],
    };

    const result = perplexityService._extractResponseContent(response);
    expect(result).toBe('Direct choice content');
  });

  it('should handle empty response', () => {
    expect(() => perplexityService._extractResponseContent(null)).toThrow();
  });

  it('should handle empty choices', () => {
    const response = { choices: [] };
    expect(() => perplexityService._extractResponseContent(response)).toThrow();
  });

  it('should return default message for invalid structure', () => {
    const response = {
      choices: [{}],
    };

    const result = perplexityService._extractResponseContent(response);
    expect(result).toBe('Sorry, I could not extract content from the response.');
  });
});
