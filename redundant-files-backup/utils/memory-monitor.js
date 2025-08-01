/**
 * Memory Monitor mock for testing
 */

const memoryMonitorMock = {
  initialize: jest.fn(),
  shutdown: jest.fn(),
  forceGarbageCollection: jest.fn(),
  getMemoryUsage: jest.fn().mockReturnValue({ rss: 100000000, heapTotal: 50000000, heapUsed: 25000000 }),
  getStatus: jest.fn().mockReturnValue({ memoryUsage: 100, lastGcTime: Date.now() })
};

module.exports = memoryMonitorMock;
