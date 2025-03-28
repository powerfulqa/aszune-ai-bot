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
    if (text.toLowerCase().includes(keyword)) {
      result += ` ${emoji}`;
    }
  }
  return result;
}

module.exports = appendEmoji;
