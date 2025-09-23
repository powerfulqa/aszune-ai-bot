module.exports = (content, overrides = {}) => ({
  content,
  author: { bot: false, id: '123' },
  reply: jest.fn(),
  react: jest.fn(),
  channel: {
    sendTyping: jest.fn(),
  },
  ...overrides,
});
