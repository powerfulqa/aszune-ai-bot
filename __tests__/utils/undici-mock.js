// Mock for undici fetch
const undiciMockHelpers = require('./undici-mock-helpers');

// Add a dummy test to prevent Jest from complaining
describe('Undici Mock', () => {
  it('should exist', () => {
    expect(undiciMockHelpers).toBeDefined();
  });
});