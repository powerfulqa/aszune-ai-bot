const { preprocessMessage, fixChunkBoundaries, validateChunkBoundaries } = require('../../src/utils/message-chunking/chunk-boundary-handler');
const { ErrorHandler } = require('../../src/utils/error-handler');

// Mock dependencies
jest.mock('../../src/utils/error-handler');

describe('Chunk Boundary Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('preprocessMessage', () => {
    it('should fix numbered list formatting', () => {
      const message = '1. First item\n\n2. Second item';
      const result = preprocessMessage(message);
      
      expect(result).toBe('1. First item\n2. Second item');
    });

    it('should fix missing spaces after numbered list periods', () => {
      const message = '1.First item\n2.Second item';
      const result = preprocessMessage(message);
      
      expect(result).toBe('1. First item\n2. Second item');
    });

    it('should add newlines before numbered lists', () => {
      const message = 'Some text1. First item\n2. Second item';
      const result = preprocessMessage(message);
      
      expect(result).toBe('Some text\n1. First item\n2. Second item');
    });

    it('should fix standalone URLs on their own lines', () => {
      const message = 'Check this out\nwww.example.com\nfor more info';
      const result = preprocessMessage(message);
      
      expect(result).toBe('Check this out www.example.com for more info');
    });

    it('should fix URLs at the end of paragraphs', () => {
      const message = 'Check this out.\nwww.example.com';
      const result = preprocessMessage(message);
      
      expect(result).toBe('Check this out. www.example.com');
    });

    it('should handle YouTube URLs', () => {
      const message = 'Watch this\nhttps://youtu.be/abc123\nfor more info';
      const result = preprocessMessage(message);
      
      expect(result).toBe('Watch this https://youtu.be/abc123 for more info');
    });

    it('should handle fractalsoftworks URLs', () => {
      const message = 'Check the forum\nfractalsoftworks.com/forum\nfor updates';
      const result = preprocessMessage(message);
      
      expect(result).toBe('Check the forum fractalsoftworks.com/forum for updates');
    });

    it('should handle complex message with multiple fixes', () => {
      const message = 'Here are the steps:\n1.First step\n\n2.Second step\nCheck this out.\nwww.example.com';
      const result = preprocessMessage(message);
      
      expect(result).toBe('Here are the steps:\n1. First step\n2. Second step\nCheck this out. www.example.com');
    });

    it('should handle errors and return original message', () => {
      const message = 'Test message';
      const error = new Error('Preprocessing failed');
      jest.spyOn(String.prototype, 'replace').mockImplementation(() => {
        throw error;
      });
      
      const result = preprocessMessage(message);
      
      expect(ErrorHandler.handleError).toHaveBeenCalledWith(error, 'preprocessing message', {
        messageLength: message.length
      });
      expect(result).toBe(message);
    });

    it('should handle null/undefined message', () => {
      const result = preprocessMessage(null);
      
      expect(ErrorHandler.handleError).toHaveBeenCalledWith(
        expect.any(Error),
        'preprocessing message',
        { messageLength: 0 }
      );
      expect(result).toBe(null);
    });
  });

  describe('fixChunkBoundaries', () => {
    it('should fix truncated sentences', () => {
      const chunks = ['This is a sentence that ends', 'without proper punctuation'];
      const result = fixChunkBoundaries(chunks, 100);
      
      expect(result[0]).toBe('This is a sentence that ends');
      expect(result[1]).toBe('without proper punctuation');
    });

    it('should move remaining text to next chunk for incomplete sentences', () => {
      const chunks = ['This is a complete sentence. Incomplete', 'sentence continues here.'];
      const result = fixChunkBoundaries(chunks, 100);
      
      expect(result[0]).toBe('This is a complete sentence.');
      expect(result[1]).toBe('Incomplete sentence continues here.');
    });

    it('should not move text if it makes next chunk too large', () => {
      const chunks = ['Short. Very long text that would make the next chunk exceed the limit', 'next chunk'];
      const result = fixChunkBoundaries(chunks, 20);
      
      // Should not modify chunks if it would exceed limit
      expect(result[0]).toBe('Short. Very long text that would make the next chunk exceed the limit');
      expect(result[1]).toBe('next chunk');
    });

    it('should fix split URLs', () => {
      const chunks = ['Check out https://example.com', 'for more information'];
      const result = fixChunkBoundaries(chunks, 100);
      
      expect(result[0]).toBe('Check out');
      expect(result[1]).toBe('https://example.com for more information');
    });

    it('should fix split domain names', () => {
      const chunks = ['Visit fractalsoftworks.', 'com/forum for updates'];
      const result = fixChunkBoundaries(chunks, 100);
      
      expect(result[0]).toBe('Visit');
      expect(result[1]).toBe('fractalsoftworks.com/forum for updates');
    });

    it('should handle multiple chunks with various issues', () => {
      const chunks = [
        'First sentence. Incomplete',
        'sentence continues. https://example.com',
        'for more info. Another',
        'incomplete sentence here.'
      ];
      const result = fixChunkBoundaries(chunks, 100);
      
      expect(result).toHaveLength(4);
      expect(result[0]).toBe('First sentence.');
      expect(result[1]).toBe('Incomplete sentence continues. https://example.com for more info.');
      expect(result[2]).toBe('Another');
      expect(result[3]).toBe('incomplete sentence here.');
    });

    it('should handle empty chunks', () => {
      const chunks = ['', 'Some text'];
      const result = fixChunkBoundaries(chunks, 100);
      
      expect(result).toEqual(['', 'Some text']);
    });

    it('should handle single chunk', () => {
      const chunks = ['Single chunk'];
      const result = fixChunkBoundaries(chunks, 100);
      
      expect(result).toEqual(['Single chunk']);
    });

    it('should handle errors and return original chunks', () => {
      const chunks = ['chunk1', 'chunk2'];
      const error = new Error('Boundary fixing failed');
      jest.spyOn(Array.prototype, 'forEach').mockImplementation(() => {
        throw error;
      });
      
      const result = fixChunkBoundaries(chunks, 100);
      
      expect(ErrorHandler.handleError).toHaveBeenCalledWith(error, 'fixing chunk boundaries', {
        chunkCount: chunks.length,
        safeMaxLength: 100
      });
      expect(result).toEqual(chunks);
    });

    it('should handle null/undefined chunks', () => {
      const result = fixChunkBoundaries(null, 100);
      
      expect(ErrorHandler.handleError).toHaveBeenCalledWith(
        expect.any(Error),
        'fixing chunk boundaries',
        { chunkCount: 0, safeMaxLength: 100 }
      );
      expect(result).toEqual(null);
    });
  });

  describe('validateChunkBoundaries', () => {
    it('should validate well-formed chunks', () => {
      const chunks = ['This is a complete sentence.', 'Another complete sentence.'];
      const result = validateChunkBoundaries(chunks);
      
      expect(result).toBe(true);
    });

    it('should detect chunks ending with incomplete sentences', () => {
      const chunks = ['This is an incomplete sentence', 'that continues here.'];
      const result = validateChunkBoundaries(chunks);
      
      expect(result).toBe(false);
    });

    it('should detect chunks ending with incomplete URLs', () => {
      const chunks = ['Check out https://example', '.com for more info'];
      const result = validateChunkBoundaries(chunks);
      
      expect(result).toBe(false);
    });

    it('should detect chunks ending with incomplete domain names', () => {
      const chunks = ['Visit fractalsoftworks.', 'com/forum'];
      const result = validateChunkBoundaries(chunks);
      
      expect(result).toBe(false);
    });

    it('should handle empty chunks', () => {
      const chunks = ['', 'Some text'];
      const result = validateChunkBoundaries(chunks);
      
      expect(result).toBe(true);
    });

    it('should handle single chunk', () => {
      const chunks = ['Single chunk'];
      const result = validateChunkBoundaries(chunks);
      
      expect(result).toBe(true);
    });

    it('should handle chunks with proper punctuation', () => {
      const chunks = ['Question?', 'Exclamation!', 'Ellipsis…'];
      const result = validateChunkBoundaries(chunks);
      
      expect(result).toBe(true);
    });

    it('should handle chunks with quotes and brackets', () => {
      const chunks = ['He said "Hello".', 'She replied [yes].'];
      const result = validateChunkBoundaries(chunks);
      
      expect(result).toBe(true);
    });

    it('should handle errors and return false', () => {
      const chunks = ['chunk1', 'chunk2'];
      const error = new Error('Validation failed');
      jest.spyOn(Array.prototype, 'every').mockImplementation(() => {
        throw error;
      });
      
      const result = validateChunkBoundaries(chunks);
      
      expect(ErrorHandler.handleError).toHaveBeenCalledWith(error, 'validating chunk boundaries', {
        chunkCount: chunks.length
      });
      expect(result).toBe(false);
    });

    it('should handle null/undefined chunks', () => {
      const result = validateChunkBoundaries(null);
      
      expect(ErrorHandler.handleError).toHaveBeenCalledWith(
        expect.any(Error),
        'validating chunk boundaries',
        { chunkCount: 0 }
      );
      expect(result).toBe(false);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complex message with multiple boundary issues', () => {
      const message = 'Here are the steps:\n1.First step\n\n2.Second step\nCheck this out.\nwww.example.com';
      const processed = preprocessMessage(message);
      
      expect(processed).toBe('Here are the steps:\n1. First step\n2. Second step\nCheck this out. www.example.com');
    });

    it('should handle chunking with boundary fixing', () => {
      const chunks = [
        'This is a complete sentence. Incomplete',
        'sentence continues. Check out https://example.com',
        'for more information. Another',
        'incomplete sentence here.'
      ];
      
      const fixed = fixChunkBoundaries(chunks, 100);
      const isValid = validateChunkBoundaries(fixed);
      
      expect(fixed).toHaveLength(4);
      expect(isValid).toBe(true);
    });

    it('should handle edge cases with very short chunks', () => {
      const chunks = ['a', 'b', 'c'];
      const result = fixChunkBoundaries(chunks, 10);
      
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should handle chunks with only whitespace', () => {
      const chunks = ['   ', '  \n  ', 'text'];
      const result = fixChunkBoundaries(chunks, 100);
      
      expect(result).toEqual(['   ', '  \n  ', 'text']);
    });
  });
});
