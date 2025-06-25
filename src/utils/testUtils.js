/**
 * Test utilities and mocks
 * This file contains utility functions for testing the Discord bot
 * See unit/testUtils.test.js for tests of these utilities
 */
const mockReply = jest.fn().mockResolvedValue({});
const mockReact = jest.fn().mockResolvedValue({});
const mockSendTyping = jest.fn().mockResolvedValue({});

/**
 * Create a mock Discord message
 * @param {Object} options - Options for the mock message
 * @returns {Object} - Mock message object
 */
function createMockMessage(options = {}) {
  return {
    content: options.content || '',
    author: {
      bot: options.isBot || false,
      id: options.userId || '12345',
    },
    reply: mockReply,
    react: mockReact,
    channel: {
      sendTyping: mockSendTyping,
    },
    ...options,
  };
}

/**
 * Reset all mocks
 */
function resetMocks() {
  mockReply.mockReset();
  mockReact.mockReset();
  mockSendTyping.mockReset();
}

/**
 * Create a mock interaction
 * @param {Object} options - Options for the mock interaction
 * @returns {Object} - Mock interaction object
 */
function createMockInteraction(options = {}) {
  return {
    user: {
      id: options.userId || '12345',
    },
    commandName: options.commandName || 'help',
    isChatInputCommand: () => true,
    reply: mockReply,
    deferReply: jest.fn(),
    editReply: jest.fn(),
    ...options,
  };
}

module.exports = {
  mockReply,
  mockReact,
  mockSendTyping,
  createMockMessage,
  createMockInteraction,
  resetMocks,
};
