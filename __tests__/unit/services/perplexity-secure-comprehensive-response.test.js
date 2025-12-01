/**
 * PerplexitySecure response handling tests split for QLTY compliance.
 */
const { setupPerplexityServiceTestContext } = require('./perplexity-secure-comprehensive.test.setup');

const { PerplexityService, fs } = setupPerplexityServiceTestContext();

let perplexityService;

beforeEach(() => {
  jest.clearAllMocks();
  perplexityService = PerplexityService;
  fs.readFile.mockRejectedValue(new Error('File not found'));
});

describe('_handleApiResponse method', () => {
  it('should throw error for null response', async () => {
    await expect(perplexityService._handleApiResponse(null)).rejects.toThrow(
      'Invalid response: response is null or undefined'
    );
  });

  it('should throw error for undefined response', async () => {
    await expect(perplexityService._handleApiResponse(undefined)).rejects.toThrow(
      'Invalid response: response is null or undefined'
    );
  });

  it('should handle error status codes', async () => {
    const response = {
      statusCode: 400,
      body: {
        text: jest.fn().mockResolvedValue('{"error":"Bad request"}'),
      },
    };

    await expect(perplexityService._handleApiResponse(response)).rejects.toThrow(
      'API request failed'
    );
  });

  it('should handle response without body', async () => {
    const response = {
      statusCode: 200,
      body: null,
    };

    await expect(perplexityService._handleApiResponse(response)).rejects.toThrow(
      'Invalid response: body is missing or does not have json method'
    );
  });

  it('should handle body without json method', async () => {
    const response = {
      statusCode: 200,
      body: {},
    };

    await expect(perplexityService._handleApiResponse(response)).rejects.toThrow(
      'Invalid response: body is missing or does not have json method'
    );
  });

  it('should handle JSON parsing errors', async () => {
    const response = {
      statusCode: 200,
      body: {
        json: jest.fn().mockRejectedValue(new Error('JSON parse error')),
      },
    };

    await expect(perplexityService._handleApiResponse(response)).rejects.toThrow(
      'Failed to parse response as JSON'
    );
  });

  it('should handle invalid response object', async () => {
    const response = {
      statusCode: 200,
      body: {
        json: jest.fn().mockResolvedValue('not-an-object'),
      },
    };

    await expect(perplexityService._handleApiResponse(response)).rejects.toThrow(
      'Invalid response: response is not a valid object'
    );
  });

  it('should handle missing choices array', async () => {
    const response = {
      statusCode: 200,
      body: {
        json: jest.fn().mockResolvedValue({}),
      },
    };

    await expect(perplexityService._handleApiResponse(response)).rejects.toThrow(
      'Invalid response: missing or empty choices array'
    );
  });

  it('should handle invalid choice structure', async () => {
    const response = {
      statusCode: 200,
      body: {
        json: jest.fn().mockResolvedValue({
          choices: ['not-an-object'],
        }),
      },
    };

    await expect(perplexityService._handleApiResponse(response)).rejects.toThrow(
      'Invalid response: invalid choice structure'
    );
  });

  it('should handle missing message field', async () => {
    const response = {
      statusCode: 200,
      body: {
        json: jest.fn().mockResolvedValue({
          choices: [{}],
        }),
      },
    };

    await expect(perplexityService._handleApiResponse(response)).rejects.toThrow(
      'Invalid response: choice missing required message field'
    );
  });

  it('should return valid response data', async () => {
    const responseData = {
      choices: [
        {
          message: {
            content: 'Valid response',
          },
        },
      ],
    };
    const response = {
      statusCode: 200,
      body: {
        json: jest.fn().mockResolvedValue(responseData),
      },
    };

    const result = await perplexityService._handleApiResponse(response);
    expect(result).toEqual(responseData);
  });
});

describe('_handleErrorResponse method', () => {
  it('should handle error response with text body', async () => {
    const body = {
      text: jest.fn().mockResolvedValue('{"error":"Test error"}'),
    };

    await expect(perplexityService._handleErrorResponse(400, body)).rejects.toThrow(
      'API request failed with status 400: {"error":"Test error"}'
    );
  });

  it('should handle error response without body', async () => {
    await expect(perplexityService._handleErrorResponse(500, null)).rejects.toThrow(
      'API request failed with status 500: Could not read response body'
    );
  });

  it('should handle body text error', async () => {
    const body = {
      text: jest.fn().mockRejectedValue(new Error('Text read error')),
    };

    await expect(perplexityService._handleErrorResponse(500, body)).rejects.toThrow(
      'API request failed with status 500: Error reading response body: Text read error'
    );
  });

  it('should handle long error messages', async () => {
    const longError = 'a'.repeat(1000);
    const body = {
      text: jest.fn().mockResolvedValue(longError),
    };

    try {
      await perplexityService._handleErrorResponse(400, body);
    } catch (error) {
      expect(error.message).toContain('API request failed');
      expect(error.statusCode).toBe(400);
    }
  });
});

