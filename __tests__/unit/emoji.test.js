// __tests__/emoji.test.js
const { default: appendEmoji } = require('../../src/utils/emoji');

describe('appendEmoji', () => {
  it('adds the correct emoji for known keywords', () => {
    expect(appendEmoji('I am happy')).toBe('I am happy 😊');
    expect(appendEmoji('This is awesome')).toBe('This is awesome 😎');
    expect(appendEmoji('Much love')).toBe('Much love ❤️');
  });

  it('does not modify the text if no keyword is present', () => {
    expect(appendEmoji('Nothing matches here')).toBe('Nothing matches here');
  });

  it('is case-insensitive', () => {
    expect(appendEmoji('HELP me')).toBe('HELP me 🆘');
  });

  it('can add multiple emojis', () => {
    expect(appendEmoji('Thanks and congratulations')).toBe('Thanks and congratulations 🎉 🙏');
  });

  it('does not add emoji for keywords inside other words', () => {
    expect(appendEmoji('helpful person')).toBe('helpful person');
    expect(appendEmoji('sadly, it happened')).toBe('sadly, it happened');
  });

  it('adds all matching emojis in correct order', () => {
    expect(appendEmoji('happy love sad')).toBe('happy love sad 😊 ❤️ 😢');
  });

  it('handles empty string', () => {
    expect(appendEmoji('')).toBe('');
  });

  it('handles string with only emojis as keywords', () => {
    expect(appendEmoji('happy sad')).toBe('happy sad 😊 😢');
  });
});
