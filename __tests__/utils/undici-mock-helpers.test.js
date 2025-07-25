const { mockSuccessResponse, mockErrorResponse } = require('./undici-mock-helpers');

describe('Undici mock helpers', () => {
  it('should create a success response with expected structure', () => {
    const response = mockSuccessResponse({ test: true });
    expect(response.statusCode).toBe(200);
    expect(response.headers.get).toBeDefined();
    expect(response.body.json).toBeDefined();
  });

  it('should create an error response with expected structure', () => {
    const response = mockErrorResponse({ error: 'test error' }, 400);
    expect(response.statusCode).toBe(400);
    expect(response.headers.get).toBeDefined();
    expect(response.body.text).toBeDefined();
  });
});
