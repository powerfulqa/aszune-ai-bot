// __tests__/utils.test.js

const { cleanText, formatReply } = require('../utils');

describe('cleanText', () => {
  test('removes extra spaces and trims', () => {
    expect(cleanText('   hello     world   ')).toBe('hello world');
  });

  test('returns the same if text is clean', () => {
    expect(cleanText('hello world')).toBe('hello world');
  });
});

describe('formatReply', () => {
  test('formats the reply with a > prefix', () => {
    expect(formatReply('hello')).toBe('> hello');
  });

  test('works with multiline strings', () => {
    expect(formatReply('line1\nline2')).toBe('> line1\nline2');
  });
});
