const { mockSuccessResponse, mockErrorResponse } = require('./undici-mock-helpers');

describe('Undici mock helpers', () => {
  it('should create a success response with expected structure', () => {
    const response = mockSuccessResponse({ test: true });
    expect(response.statusCode).toBe(200);
    expect(response.headers.get).toBeDefined();
    expect(response.body.json).toBeDefined();

    // Test content-type header getter
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('other-header')).toBeNull();

    // Test json and text methods
    return Promise.all([
      response.body.json().then((data) => expect(data).toEqual({ test: true })),
      response.body.text().then((text) => expect(text).toBe(JSON.stringify({ test: true }))),
    ]);
  });

  it('should create an error response with expected structure', () => {
    const response = mockErrorResponse({ error: 'test error' }, 400);
    expect(response.statusCode).toBe(400);
    expect(response.headers.get).toBeDefined();
    expect(response.body.text).toBeDefined();

    // Test content-type header getter
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('other-header')).toBeNull();

    // Test json method rejects and text method
    return Promise.all([
      response.body
        .text()
        .then((text) => expect(text).toBe(JSON.stringify({ error: 'test error' }))),
      response.body.json().catch((error) => expect(error).toBeInstanceOf(Error)),
    ]);
  });

  it('should use default status code for error responses', () => {
    const response = mockErrorResponse({ error: 'test error' });
    expect(response.statusCode).toBe(400);
  });
});
