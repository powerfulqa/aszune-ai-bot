const { chunkMessage } = require('../src/utils/message-chunker');

const longSentence = 'This is a very long sentence that contains important information about Starsector assigning operatives to do missions through the campaign interface by interacting with contacts who offer missions and then selecting an officer to carry out the mission.';
const nextSentence = 'The general process includes obtaining a mission, assigning an officer, and awaiting the mission outcome.';
const longText = longSentence + ' ' + nextSentence;

const chunks = chunkMessage(longText, longSentence.length - 20);

// eslint-disable-next-line no-console
console.log('Chunks:');
// eslint-disable-next-line no-console
chunks.forEach((chunk, i) => console.log(`Chunk ${i+1}: ${chunk}`));

// eslint-disable-next-line no-console
console.log('\nReconstruction:');
const cleanChunks = chunks.map(chunk => chunk.replace(/^\[\d+\/\d+\]\s*/, ''));
// eslint-disable-next-line no-console
console.log(cleanChunks.join(''));
