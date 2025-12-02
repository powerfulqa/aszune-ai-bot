/**
 * Tests for error-helpers.js
 * Shared error handling for message chunking modules
 */

jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/error-handler', () => ({
  ErrorHandler: {
    handleError: jest.fn().mockReturnValue({ message: 'Test error message' }),
    logError: jest.fn(),
  },
}));

const {
  handleTextProcessingError,
  handleChunkProcessingError,
} = require('../../src/utils/message-chunking/error-helpers');
const logger = require('../../src/utils/logger');
const { ErrorHandler } = require('../../src/utils/error-handler');

describe('error-helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleTextProcessingError', () => {
    it('should log error and return original text', () => {
      const error = new Error('Test error');
      const text = 'original text';
      const result = handleTextProcessingError(error, 'test context', text);

      expect(ErrorHandler.handleError).toHaveBeenCalledWith(error, 'test context', {
        textLength: 13,
      });
      expect(logger.error).toHaveBeenCalledWith('test context error: Test error message');
      expect(result).toBe(text);
    });

    it('should handle null text', () => {
      const error = new Error('Test error');
      const result = handleTextProcessingError(error, 'null context', null);

      expect(ErrorHandler.handleError).toHaveBeenCalledWith(error, 'null context', {
        textLength: 0,
      });
      expect(result).toBeNull();
    });

    it('should handle undefined text', () => {
      const error = new Error('Test error');
      const result = handleTextProcessingError(error, 'undefined context', undefined);

      expect(ErrorHandler.handleError).toHaveBeenCalledWith(error, 'undefined context', {
        textLength: 0,
      });
      expect(result).toBeUndefined();
    });

    it('should include additional context', () => {
      const error = new Error('Test error');
      const text = 'test';
      handleTextProcessingError(error, 'extra context', text, { extra: 'info' });

      expect(ErrorHandler.handleError).toHaveBeenCalledWith(error, 'extra context', {
        textLength: 4,
        extra: 'info',
      });
    });
  });

  describe('handleChunkProcessingError', () => {
    it('should log error and return original chunks', () => {
      const error = new Error('Chunk error');
      const chunks = ['chunk1', 'chunk2'];
      const result = handleChunkProcessingError(error, 'chunk context', chunks);

      expect(ErrorHandler.handleError).toHaveBeenCalledWith(error, 'chunk context', {
        chunkCount: 2,
      });
      expect(ErrorHandler.logError).toHaveBeenCalled();
      expect(result).toBe(chunks);
    });

    it('should handle null chunks', () => {
      const error = new Error('Chunk error');
      const result = handleChunkProcessingError(error, 'null chunks', null);

      expect(ErrorHandler.handleError).toHaveBeenCalledWith(error, 'null chunks', {
        chunkCount: 0,
      });
      expect(result).toBeNull();
    });

    it('should handle empty chunks array', () => {
      const error = new Error('Chunk error');
      const chunks = [];
      const result = handleChunkProcessingError(error, 'empty chunks', chunks);

      expect(ErrorHandler.handleError).toHaveBeenCalledWith(error, 'empty chunks', {
        chunkCount: 0,
      });
      expect(result).toBe(chunks);
    });

    it('should include additional context', () => {
      const error = new Error('Chunk error');
      const chunks = ['a', 'b', 'c'];
      handleChunkProcessingError(error, 'extra context', chunks, { safeMaxLength: 1000 });

      expect(ErrorHandler.handleError).toHaveBeenCalledWith(error, 'extra context', {
        chunkCount: 3,
        safeMaxLength: 1000,
      });
    });

    it('should format operation name without spaces', () => {
      const error = new Error('Chunk error');
      const chunks = ['test'];
      handleChunkProcessingError(error, 'fixing chunk boundaries', chunks);

      expect(ErrorHandler.logError).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          operation: 'fixingchunkboundaries',
        })
      );
    });
  });
});
