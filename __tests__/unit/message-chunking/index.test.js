const messageChunking = require('../../src/utils/message-chunking');
const config = require('../../src/config/config');
const { ErrorHandler } = require('../../src/utils/error-handler');
const originalChunker = require('../../src/utils/message-chunker');

// Mock dependencies
jest.mock('../../src/config/config');
jest.mock('../../src/utils/error-handler');
jest.mock('../../src/utils/message-chunker');
jest.mock('../../src/utils/message-chunking/source-reference-processor');
jest.mock('../../src/utils/message-chunking/url-formatter');
jest.mock('../../src/utils/message-chunking/chunk-boundary-handler');

const { processSourceReferences } = require('../../src/utils/message-chunking/source-reference-processor');
const { formatAllUrls } = require('../../src/utils/message-chunking/url-formatter');
const { preprocessMessage, fixChunkBoundaries, validateChunkBoundaries } = require('../../src/utils/message-chunking/chunk-boundary-handler');

describe('Message Chunking Index', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    config.MESSAGE_LIMITS = {
      DISCORD_MAX_LENGTH: 2000,
      SAFE_CHUNK_OVERHEAD: 50
    };
    
    originalChunker.chunkMessage.mockReturnValue(['chunk1', 'chunk2']);
    processSourceReferences.mockImplementation(text => text);
    formatAllUrls.mockImplementation(text => text);
    preprocessMessage.mockImplementation(text => text);
    fixChunkBoundaries.mockImplementation(chunks => chunks);
    validateChunkBoundaries.mockReturnValue(true);
  });

  describe('chunkMessage (enhancedChunkMessage)', () => {
    it('should chunk a simple message', () => {
      const message = 'This is a test message';
      const result = messageChunking.chunkMessage(message);
      
      expect(preprocessMessage).toHaveBeenCalledWith(message);
      expect(processSourceReferences).toHaveBeenCalledWith(message);
      expect(originalChunker.chunkMessage).toHaveBeenCalledWith(message, 1950); // 2000 - 50
      expect(fixChunkBoundaries).toHaveBeenCalled();
      expect(validateChunkBoundaries).toHaveBeenCalled();
      expect(result).toEqual(['chunk1', 'chunk2']);
    });

    it('should use custom maxLength when provided', () => {
      const message = 'This is a test message';
      const customMaxLength = 1000;
      messageChunking.chunkMessage(message, customMaxLength);
      
      expect(originalChunker.chunkMessage).toHaveBeenCalledWith(message, 950); // 1000 - 50
    });

    it('should handle source reference processing', () => {
      const message = 'Message with [source:1] reference';
      const processedMessage = 'Message with processed reference';
      processSourceReferences.mockReturnValue(processedMessage);
      
      messageChunking.chunkMessage(message);
      
      expect(processSourceReferences).toHaveBeenCalledWith(message);
      expect(originalChunker.chunkMessage).toHaveBeenCalledWith(processedMessage, 1950);
    });

    it('should handle URL formatting', () => {
      const message = 'Check out https://example.com';
      const formattedMessage = 'Check out (https://example.com)';
      formatAllUrls.mockReturnValue(formattedMessage);
      
      messageChunking.chunkMessage(message);
      
      expect(formatAllUrls).toHaveBeenCalled();
    });

    it('should handle chunk boundary fixing', () => {
      const message = 'This is a test message';
      const fixedChunks = ['fixed chunk1', 'fixed chunk2'];
      fixChunkBoundaries.mockReturnValue(fixedChunks);
      
      const result = messageChunking.chunkMessage(message);
      
      expect(fixChunkBoundaries).toHaveBeenCalledWith(['chunk1', 'chunk2'], 1950);
      expect(result).toEqual(fixedChunks);
    });

    it('should handle validation failure gracefully', () => {
      const message = 'This is a test message';
      validateChunkBoundaries.mockReturnValue(false);
      
      const result = messageChunking.chunkMessage(message);
      
      expect(validateChunkBoundaries).toHaveBeenCalled();
      expect(result).toEqual(['chunk1', 'chunk2']); // Should still return chunks
    });

    it('should handle errors and fallback to original chunker', () => {
      const message = 'This is a test message';
      const error = new Error('Enhanced chunking failed');
      preprocessMessage.mockImplementation(() => {
        throw error;
      });
      
      const result = messageChunking.chunkMessage(message);
      
      expect(ErrorHandler.handleError).toHaveBeenCalledWith(error, 'enhanced message chunking', {
        messageLength: message.length,
        maxLength: 2000
      });
      expect(originalChunker.chunkMessage).toHaveBeenCalledWith(message, 2000);
      expect(result).toEqual(['chunk1', 'chunk2']);
    });

    it('should handle fallback chunker failure and return original message', () => {
      const message = 'This is a test message';
      const error = new Error('Enhanced chunking failed');
      const fallbackError = new Error('Fallback chunking failed');
      
      preprocessMessage.mockImplementation(() => {
        throw error;
      });
      originalChunker.chunkMessage.mockImplementation(() => {
        throw fallbackError;
      });
      
      const result = messageChunking.chunkMessage(message);
      
      expect(ErrorHandler.handleError).toHaveBeenCalledWith(fallbackError, 'fallback message chunking', {
        messageLength: message.length,
        maxLength: 2000
      });
      expect(result).toEqual([message]);
    });

    it('should handle null/undefined message', () => {
      const result = messageChunking.chunkMessage(null);
      
      expect(ErrorHandler.handleError).toHaveBeenCalledWith(
        expect.any(Error),
        'enhanced message chunking',
        { messageLength: 0, maxLength: 2000 }
      );
    });
  });

  describe('formatUrls', () => {
    it('should format URLs in text', () => {
      const text = 'Check out https://example.com';
      const formattedText = 'Check out (https://example.com)';
      formatAllUrls.mockReturnValue(formattedText);
      
      const result = messageChunking.formatUrls(text);
      
      expect(formatAllUrls).toHaveBeenCalledWith(text);
      expect(result).toBe(formattedText);
    });

    it('should handle errors and return original text', () => {
      const text = 'Check out https://example.com';
      const error = new Error('URL formatting failed');
      formatAllUrls.mockImplementation(() => {
        throw error;
      });
      
      const result = messageChunking.formatUrls(text);
      
      expect(ErrorHandler.handleError).toHaveBeenCalledWith(error, 'formatting URLs', {
        textLength: text.length
      });
      expect(result).toBe(text);
    });

    it('should handle null/undefined text', () => {
      const result = messageChunking.formatUrls(null);
      
      expect(ErrorHandler.handleError).toHaveBeenCalledWith(
        expect.any(Error),
        'formatting URLs',
        { textLength: 0 }
      );
      expect(result).toBe(null);
    });
  });

  describe('getChunkingStats', () => {
    it('should calculate chunking statistics', () => {
      const chunks = ['chunk1', 'chunk2', 'chunk3'];
      const result = messageChunking.getChunkingStats(chunks);
      
      expect(result).toEqual({
        chunkCount: 3,
        totalLength: 18, // 'chunk1' + 'chunk2' + 'chunk3' = 6 + 6 + 6
        avgChunkLength: 6,
        maxChunkLength: 6,
        minChunkLength: 6,
        isBalanced: true
      });
    });

    it('should handle empty chunks array', () => {
      const result = messageChunking.getChunkingStats([]);
      
      expect(result).toEqual({
        chunkCount: 0,
        totalLength: 0,
        avgChunkLength: 0,
        maxChunkLength: 0,
        minChunkLength: 0,
        isBalanced: false
      });
    });

    it('should calculate balance correctly for unbalanced chunks', () => {
      const chunks = ['a', 'very long chunk that exceeds the average by a lot'];
      const result = messageChunking.getChunkingStats(chunks);
      
      expect(result.chunkCount).toBe(2);
      expect(result.isBalanced).toBe(false);
    });

    it('should handle errors and return default stats', () => {
      const error = new Error('Stats calculation failed');
      jest.spyOn(Array.prototype, 'reduce').mockImplementation(() => {
        throw error;
      });
      
      const result = messageChunking.getChunkingStats(['chunk1', 'chunk2']);
      
      expect(ErrorHandler.handleError).toHaveBeenCalledWith(error, 'getting chunking stats', {
        chunkCount: 2
      });
      expect(result).toEqual({
        chunkCount: 0,
        totalLength: 0,
        avgChunkLength: 0,
        maxChunkLength: 0,
        minChunkLength: 0,
        isBalanced: false
      });
    });

    it('should handle null/undefined chunks', () => {
      const result = messageChunking.getChunkingStats(null);
      
      expect(ErrorHandler.handleError).toHaveBeenCalledWith(
        expect.any(Error),
        'getting chunking stats',
        { chunkCount: 0 }
      );
      expect(result).toEqual({
        chunkCount: 0,
        totalLength: 0,
        avgChunkLength: 0,
        maxChunkLength: 0,
        minChunkLength: 0,
        isBalanced: false
      });
    });
  });

  describe('processSourceReferences', () => {
    it('should re-export processSourceReferences function', () => {
      expect(messageChunking.processSourceReferences).toBe(processSourceReferences);
    });
  });

  describe('Backward compatibility exports', () => {
    it('should re-export original chunker functions', () => {
      expect(messageChunking._processParagraph).toBe(originalChunker._processParagraph);
      expect(messageChunking._processSentence).toBe(originalChunker._processSentence);
      expect(messageChunking._processLongSentence).toBe(originalChunker._processLongSentence);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complex message with all processing steps', () => {
      const message = 'Check out [source:1] https://example.com for more info';
      const processedMessage = 'Check out processed reference https://example.com for more info';
      const formattedMessage = 'Check out processed reference (https://example.com) for more info';
      const chunks = ['chunk1', 'chunk2'];
      const fixedChunks = ['fixed chunk1', 'fixed chunk2'];
      
      preprocessMessage.mockReturnValue(processedMessage);
      processSourceReferences.mockReturnValue(processedMessage);
      formatAllUrls.mockReturnValue(formattedMessage);
      originalChunker.chunkMessage.mockReturnValue(chunks);
      fixChunkBoundaries.mockReturnValue(fixedChunks);
      
      const result = messageChunking.chunkMessage(message);
      
      expect(preprocessMessage).toHaveBeenCalledWith(message);
      expect(processSourceReferences).toHaveBeenCalledWith(processedMessage);
      expect(originalChunker.chunkMessage).toHaveBeenCalledWith(processedMessage, 1950);
      expect(fixChunkBoundaries).toHaveBeenCalledWith(chunks, 1950);
      expect(result).toEqual(fixedChunks);
    });

    it('should handle very long message that needs chunking', () => {
      const longMessage = 'a'.repeat(5000);
      const chunks = ['chunk1', 'chunk2', 'chunk3'];
      originalChunker.chunkMessage.mockReturnValue(chunks);
      
      const result = messageChunking.chunkMessage(longMessage);
      
      expect(originalChunker.chunkMessage).toHaveBeenCalledWith(longMessage, 1950);
      expect(result).toEqual(chunks);
    });
  });
});
