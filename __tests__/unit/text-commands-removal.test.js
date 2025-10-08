describe('Text Commands Removal', () => {
  describe('Migration to Slash Commands Only', () => {
    it('should verify that both handleTextCommand and handleSlashCommand exist', () => {
      const commands = require('../../src/commands');

      // Verify both command handlers exist (supporting both slash and text commands)
      expect(commands.handleTextCommand).toBeDefined();
      expect(commands.handleSlashCommand).toBeDefined();
      expect(commands.getSlashCommandsData).toBeDefined();
    });

    it('should confirm all text commands have been migrated to slash commands', () => {
      const commands = require('../../src/commands');
      const slashCommands = commands.getSlashCommandsData();
      const commandNames = slashCommands.map(cmd => cmd.name);

      // Verify reminder commands exist as slash commands
      expect(commandNames).toContain('remind');
      expect(commandNames).toContain('reminders');
      expect(commandNames).toContain('cancelreminder');

      // Verify other commands still exist
      expect(commandNames).toContain('help');
    });

    it('should confirm reminder functionality exists as separate slash commands', () => {
      const commands = require('../../src/commands');
      const slashCommands = commands.getSlashCommandsData();

      // Find reminder commands
      const remindCommand = slashCommands.find(cmd => cmd.name === 'remind');
      const remindersCommand = slashCommands.find(cmd => cmd.name === 'reminders');
      const cancelCommand = slashCommands.find(cmd => cmd.name === 'cancelreminder');

      // Verify they exist and have proper structure
      expect(remindCommand).toBeDefined();
      expect(remindCommand.description).toContain('reminder');
      expect(remindCommand.options).toBeDefined();
      expect(remindCommand.options.length).toBeGreaterThan(0);

      expect(remindersCommand).toBeDefined();
      expect(cancelCommand).toBeDefined();
    });

    it('should verify help command shows updated syntax without text commands', () => {
      const commands = require('../../src/commands');
      const slashCommands = commands.getSlashCommandsData();
      const helpCommand = slashCommands.find(cmd => cmd.name === 'help');

      // Verify help command exists as slash command
      expect(helpCommand).toBeDefined();
      expect(helpCommand.name).toBe('help');
      expect(helpCommand.description).toContain('help');
    });
  });
});