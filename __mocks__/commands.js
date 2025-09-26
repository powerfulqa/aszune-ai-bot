// Mock implementation of commands module for tests
const mockCommands = {
  handleTextCommand: jest.fn(),
  handleSlashCommand: jest.fn(),
  getSlashCommandsData: jest.fn().mockReturnValue([
    {
      name: 'test-command',
      description: 'A test command',
    },
  ]),
};

module.exports = mockCommands;

// Add a dummy test to prevent Jest from complaining
describe('Commands Mock', () => {
  it('should exist', () => {
    expect(mockCommands).toBeDefined();
  });
});
