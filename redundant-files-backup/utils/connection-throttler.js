/**
 * Connection Throttler mock for testing
 */

const connectionThrottlerMock = {
  executeRequest: jest.fn(async (requestFn) => await requestFn()),
  clearQueue: jest.fn()
};

module.exports = connectionThrottlerMock;
