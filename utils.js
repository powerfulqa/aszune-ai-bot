// utils.js

// Cleans up a string by trimming and reducing multiple spaces
function cleanText(text) {
  return text.trim().replace(/\s+/g, ' ');
}

// Formats a Discord message (e.g., for replies)
function formatReply(text) {
  return `> ${text}`;
}

module.exports = {
  cleanText,
  formatReply,
};
