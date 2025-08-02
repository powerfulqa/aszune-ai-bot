/**
 * Message chunking utility for handling long messages
 * Splits messages into chunks to prevent Discord's character limit from cutting them off
 */

/**
 * Splits a long message into multiple chunks to avoid truncation
 * @param {string} message - The full response message
 * @param {number} maxLength - Maximum length per message chunk (default: 2000)
 * @return {string[]} Array of message chunks
 */
function chunkMessage(message, maxLength = 2000) {
  // Debug logging
  console.log(`Chunking message of length ${message.length} with max length ${maxLength}`);
  
  // If message is already within limits, return as single chunk
  if (message.length <= maxLength) {
    console.log(`Message within limits, returning single chunk`);
    return [message];
  }

  const chunks = [];
  let currentChunk = '';
  
  // Split by paragraphs to maintain context
  const paragraphs = message.split('\n\n');
  
  for (const paragraph of paragraphs) {
    // If adding this paragraph exceeds max length, start a new chunk
    if ((currentChunk + paragraph).length + 2 > maxLength && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    
    // If a single paragraph is too long, split it further
    if (paragraph.length > maxLength) {
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        if ((currentChunk + sentence).length + 2 > maxLength && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        currentChunk += sentence + ' ';
      }
    } else {
      currentChunk += paragraph + '\n\n';
    }
  }
  
  // Add the final chunk if it has content
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  // Add numbering to chunks for better user experience
  const numberedChunks = chunks.map((chunk, index) => 
    `[${index + 1}/${chunks.length}] ${chunk}`
  );
  
  // Debug logging
  console.log(`Created ${numberedChunks.length} chunks`);
  
  return numberedChunks;
}

module.exports = { chunkMessage };
