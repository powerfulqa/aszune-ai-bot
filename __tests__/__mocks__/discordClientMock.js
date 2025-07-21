// Discord client mock with proper Jest naming convention
const mockClientObject = {
  on: jest.fn().mockReturnThis(),
  once: jest.fn().mockImplementation((event, handler) => {
    if (event === 'ready') {
      handler();
    }
    return mockClientObject;
  }),
  login: jest.fn().mockResolvedValue('Logged in'),
  destroy: jest.fn().mockResolvedValue(),
  user: {
    id: 'mock-user-id',
    tag: 'MockUser#0000'
  }
};

module.exports = {
  getMockClient: jest.fn().mockReturnValue(mockClientObject),
  mockClient: mockClientObject
};
