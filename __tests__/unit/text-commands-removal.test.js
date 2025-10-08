it('should verify that handleTextCommand exists for text command support', () => {
  const commands = require('../../src/commands');

  // Verify handleTextCommand is exported for text command support
  expect(commands.handleTextCommand).toBeDefined();

  // Verify slash command handler still exists
  expect(commands.handleSlashCommand).toBeDefined();
  expect(commands.getSlashCommandsData).toBeDefined();
});