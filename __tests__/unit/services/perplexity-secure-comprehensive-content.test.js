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

describe('_generateErrorMessage method', () => {
  it('should return rate limit message for 429 status', () => {
    const error = { statusCode: 429 };
    const errorResponse = { message: 'Rate limit exceeded' };

    const result = perplexityService._generateErrorMessage(error, errorResponse);
    expect(result).toBe('Rate limit exceeded. Please try again later.');
  });

  it('should return service unavailable message for 5xx status', () => {
    const error = { statusCode: 500 };
    const errorResponse = { message: 'Server error' };

    const result = perplexityService._generateErrorMessage(error, errorResponse);
    expect(result).toBe('The service is temporarily unavailable. Please try again later.');
  });

  it('should return network error message for network errors', () => {
    const error = { message: 'Network connection failed' };
    const errorResponse = { message: 'Network error' };

    const result = perplexityService._generateErrorMessage(error, errorResponse);
    expect(result).toBe('Network connection issue. Please check your connection and try again.');
  });

  it('should return empty response message for empty response errors', () => {
    const error = { message: 'Empty response received' };
    const errorResponse = { message: 'Empty response' };

    const result = perplexityService._generateErrorMessage(error, errorResponse);
    expect(result).toBe('Empty response received from the service.');
  });

  it('should return unexpected format message for invalid errors', () => {
    const error = { message: 'invalid response format' };
    const errorResponse = { message: 'Invalid format' };

    const result = perplexityService._generateErrorMessage(error, errorResponse);
    expect(result).toBe('Unexpected response format received.');
  });

  it('should return original error message for unknown errors', () => {
    const error = { message: 'Unknown error' };
    const errorResponse = { message: 'Unknown error occurred' };

    const result = perplexityService._generateErrorMessage(error, errorResponse);
    expect(result).toBe('Unknown error occurred');
  });
});

describe('_isRetryableError method', () => {
  it('should return false for null error', () => {
    const result = perplexityService._isRetryableError(null);
    expect(result).toBe(false);
  });

  it('should return false for error without message', () => {
    const error = {};
    const result = perplexityService._isRetryableError(error);
    expect(result).toBe(false);
  });

  it('should return true for temporary errors', () => {
    const error = { message: 'Temporary service unavailable' };
    const result = perplexityService._isRetryableError(error);
    expect(result).toBe(true);
  });

  it('should return true for network errors', () => {
    const error = { message: 'Network timeout' };
    const result = perplexityService._isRetryableError(error);
    expect(result).toBe(true);
  });

  it('should return true for 429 errors', () => {
    const error = { message: 'Rate limit 429 exceeded' };
    const result = perplexityService._isRetryableError(error);
    expect(result).toBe(true);
  });

  it('should return false for permanent errors', () => {
    const error = { message: 'Permanent API error' };
    const result = perplexityService._isRetryableError(error);
    expect(result).toBe(false);
  });

  it('should return false for invalid errors', () => {
    const error = { message: 'Invalid request format' };
    const result = perplexityService._isRetryableError(error);
    expect(result).toBe(false);
  });

  it('should return false for unauthorized errors', () => {
    const error = { message: 'Unauthorized access' };
    const result = perplexityService._isRetryableError(error);
    expect(result).toBe(false);
  });

  it('should return false for forbidden errors', () => {
    const error = { message: 'Forbidden operation' };
    const result = perplexityService._isRetryableError(error);
    expect(result).toBe(false);
  });

  it('should return false for unknown errors by default', () => {
    const error = { message: 'Some random error' };
    const result = perplexityService._isRetryableError(error);
    expect(result).toBe(false);
  });
});
