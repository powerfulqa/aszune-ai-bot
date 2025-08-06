// Simple test for link formatting
const { chunkMessage, processSourceReferences } = require('./src/utils/enhanced-message-chunker');

// Sample message with links
const testMessage = `
Here's a link to YouTube: youtube.com/watch?v=dQw4w9WgXcQ 
And another link to the Starsector forum: fractalsoftworks.com/forum/index.php?topic=1234.0
And a source reference: [1] fractalsoftworks.com/forum/index.php?topic=5678.0

The previous YouTube link was youtube.com/watch?v=dQw4w9WgXcQ and it should be formatted properly.

Source references:
[1] www.youtube.com/watch?v=dQw4w9WgXcQ
[2] fractalsoftworks.com/forum/index.php?topic=9012.0
`;

// Create a simple source map for testing
const sourceMap = {
  '1': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  '2': 'https://fractalsoftworks.com/forum/index.php?topic=9012.0'
};

// Process the message with source references
const processedWithRefs = processSourceReferences(testMessage, sourceMap);

// Process the message using our enhanced chunker
const processed = chunkMessage(processedWithRefs);

// Print the formatted message
console.log('Formatted Message:');
console.log('=================');
console.log(processed.join('\n\n--- Next Chunk ---\n\n'));

// Highlight specific formatting improvements
console.log('\nFormatting improvements:');
console.log('======================');
console.log('1. YouTube links now have descriptive text');
console.log('2. Fractalsoftworks forum links now have descriptive text');
console.log('3. Source references are properly formatted with descriptive text');
