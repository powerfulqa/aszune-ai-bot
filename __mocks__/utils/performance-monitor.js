/**
 * Performance Monitor mock for testing
 */

const performanceMonitorMock = {
  initialize: jest.fn(),
  shutdown: jest.fn(),
  getThrottleFactor: jest.fn().mockReturnValue(1),
  throttleTime: jest.fn(time => time),
  throttleTask: jest.fn(task => task())
};

module.exports = performanceMonitorMock;
