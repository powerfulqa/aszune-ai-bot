/**
 * Message Formatter mock for testing
 */

const messageFormatterMock = {
  formatResponse: jest.fn(content => content),
  createCompactEmbed: jest.fn(embed => embed)
};

module.exports = messageFormatterMock;
