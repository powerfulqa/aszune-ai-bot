/**
 * Mock for Discord.js Client
 */
const clientMock = {
  login: jest.fn().mockResolvedValue(true),
  destroy: jest.fn().mockResolvedValue(),
  user: {
    tag: 'TestBot#0000',
    id: '123456789'
  },
  once: jest.fn((event, callback) => {
    if (event === 'ready') {
      // Simulate the ready event being triggered
      callback();
    }
    return clientMock;
  }),
  on: jest.fn().mockReturnThis(),
};

// Mock the Discord.js Client constructor
const Client = jest.fn().mockImplementation(() => clientMock);

module.exports = {
  Client,
  clientMock
};
