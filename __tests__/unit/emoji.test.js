// __tests__/emoji.test.js
const appendEmoji = require('../../utils/emoji');

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
});
