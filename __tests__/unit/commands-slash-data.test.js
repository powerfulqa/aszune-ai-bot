/**
 * Commands - Slash Commands Data Tests
 * Tests slash command data generation
 */

jest.useFakeTimers();

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/perplexity-secure');

const { getSlashCommandsData } = require('../../src/commands');

describe('Commands - Slash Commands Data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSlashCommandsData', () => {
    it('should return an array of slash command data', () => {
      const commands = getSlashCommandsData();

      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(0);

      // Check that each command has required properties
      commands.forEach((command) => {
        expect(command).toHaveProperty('name');
        expect(command).toHaveProperty('description');
      });
    });
  });
});
