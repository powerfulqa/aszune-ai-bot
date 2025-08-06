/**
 * Tests for the enhanced message chunker utility
 */
const { chunkMessage, processSourceReferences } = require('../../src/utils/enhanced-message-chunker');

describe('Enhanced Message Chunker', () => {
  test('processes source references correctly', () => {
    const textWithSources = 'This is a paragraph with a source (1) (https://example.com). ' + 
                           'This is another paragraph with a source (2) (https://youtube.com/watch?v=123).';
    
    const processed = processSourceReferences(textWithSources);
    
    expect(processed).toContain('[(1)](https://example.com)');
    expect(processed).toContain('[(2)](https://youtube.com/watch?v=123)');
  });
  
  test('handles YouTube links in sources correctly', () => {
    const textWithYouTube = 'Check out this video (3) (https://youtube.com/watch?v=123).';
    
    const processed = processSourceReferences(textWithYouTube);
    
    expect(processed).toContain('[(3)](https://youtube.com/watch?v=123)');
    expect(processed).not.toContain('(3) (https://youtube.com/watch?v=123)');
  });
  
  test('preserves formatting for multiple source references', () => {
    const textWithMultipleSources = 'First source (1) (https://example.com). ' +
                                   'Second source (2) (https://test.org). ' +
                                   'Third source (3) (https://youtube.com/watch?v=123).';
    
    const processed = processSourceReferences(textWithMultipleSources);
    
    expect(processed).toContain('[(1)](https://example.com)');
    expect(processed).toContain('[(2)](https://test.org)');
    expect(processed).toContain('[(3)](https://youtube.com/watch?v=123)');
  });
  
  test('chunking preserves source references across chunks', () => {
    const longTextWithSources = 'This is a long paragraph. '.repeat(20) + 
                              'Check this source (1) (https://example.com). ' +
                              'This is another paragraph. '.repeat(20) + 
                              'Another source (2) (https://youtube.com/watch?v=123).';
    
    const chunks = chunkMessage(longTextWithSources, 500);
    
    // Should be split into multiple chunks
    expect(chunks.length).toBeGreaterThan(1);
    
    // Combine chunks to check if links were preserved
    const combinedText = chunks.map(c => c.replace(/^\[\d+\/\d+\]\s*/, '')).join('');
    
    expect(combinedText).toContain('[(1)](https://example.com)');
    expect(combinedText).toContain('[(2)](https://youtube.com/watch?v=123)');
  });
  
  test('handles URLs split between chunks', () => {
    // Create a message that would place a URL at a chunk boundary
    const prefix = 'a'.repeat(490); // Almost at chunk boundary
    const url = 'https://example.com/test';
    const suffix = 'This is content after the URL';
    
    const text = prefix + ' ' + url + ' ' + suffix;
    
    const chunks = chunkMessage(text, 500);
    
    // Check if URL is intact in one of the chunks
    const foundUrl = chunks.some(chunk => chunk.includes(url));
    expect(foundUrl).toBe(true);
  });
});
