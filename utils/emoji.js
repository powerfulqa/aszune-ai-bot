// utils/emoji.js
const emojiMap = {
  happy: '😊',
  love: '❤️',
  sad: '😢',
  congratulations: '🎉',
  thanks: '🙏',
  awesome: '😎',
  help: '🆘',
  welcome: '👋',
};

function appendEmoji(text) {
  let result = text;
  for (const [keyword, emoji] of Object.entries(emojiMap)) {
    // Only match whole words (case-insensitive)
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(text)) {
      result += ` ${emoji}`;
    }
  }
  return result;
}

module.exports = appendEmoji;
