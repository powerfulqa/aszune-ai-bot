/**
 * URL Formatter Tests
 * Comprehensive test coverage for URL formatting functionality
 */
const urlFormatter = require('../../src/utils/message-chunking/url-formatter');

describe('URL Formatter', () => {
  describe('formatSocialMediaLinks', () => {
    it('should format Reddit URLs', () => {
      const input = 'Check out reddit.com/r/programming for discussions';
      const result = urlFormatter.formatSocialMediaLinks(input);
      expect(result).toContain('(https://reddit.com/r/programming)');
    });

    it('should format Reddit subreddit references', () => {
      const input = 'Visit r/javascript for JS discussions';
      const result = urlFormatter.formatSocialMediaLinks(input);
      expect(result).toContain('[Reddit: r/javascript](https://reddit.com/r/javascript)');
    });

    it('should format Imgur URLs', () => {
      const input = 'See this image: imgur.com/abc123';
      const result = urlFormatter.formatSocialMediaLinks(input);
      expect(result).toContain('(https://imgur.com/abc123)');
    });

    it('should format GitHub URLs', () => {
      const input = 'Check out github.com/user/repo';
      const result = urlFormatter.formatSocialMediaLinks(input);
      expect(result).toContain('(https://github.com/');
    });

    it('should format Twitter URLs', () => {
      const input = 'Follow me on twitter.com/username';
      const result = urlFormatter.formatSocialMediaLinks(input);
      expect(result).toContain('(https://twitter.com/username)');
    });

    it('should format X.com URLs', () => {
      const input = 'Follow me on x.com/username';
      const result = urlFormatter.formatSocialMediaLinks(input);
      expect(result).toContain('(https://x.com/username)');
    });

    it('should handle text without URLs', () => {
      const input = 'This is just plain text';
      const result = urlFormatter.formatSocialMediaLinks(input);
      expect(result).toBe(input);
    });

    it('should handle empty input', () => {
      const result = urlFormatter.formatSocialMediaLinks('');
      expect(result).toBe('');
    });

    it('should handle null input', () => {
      const result = urlFormatter.formatSocialMediaLinks(null);
      expect(result).toBe(null);
    });
  });

  describe('formatYouTubeLinks', () => {
    it('should format YouTube URLs', () => {
      const input = 'Watch this: youtube.com/watch?v=abc123';
      const result = urlFormatter.formatYouTubeLinks(input);
      expect(result).toContain('(https://youtube.com/watch?v=abc123)');
    });

    it('should format YouTube short URLs', () => {
      const input = 'Check out youtu.be/abc123';
      const result = urlFormatter.formatYouTubeLinks(input);
      expect(result).toContain('(https://youtu.be/abc123)');
    });

    it('should handle text without YouTube URLs', () => {
      const input = 'This is just plain text';
      const result = urlFormatter.formatYouTubeLinks(input);
      expect(result).toBe(input);
    });
  });

  describe('fixLinkFormatting', () => {
    it('should format HTTP URLs', () => {
      const input = 'Visit http://example.com';
      const result = urlFormatter.fixLinkFormatting(input);
      expect(result).toContain('http://example.com');
    });

    it('should format HTTPS URLs', () => {
      const input = 'Visit https://example.com';
      const result = urlFormatter.fixLinkFormatting(input);
      expect(result).toContain('https://example.com');
    });

    it('should handle text without URLs', () => {
      const input = 'This is just plain text';
      const result = urlFormatter.fixLinkFormatting(input);
      expect(result).toBe(input);
    });
  });

  describe('formatAllUrls', () => {
    it('should format all types of URLs', () => {
      const input = 'Check reddit.com/r/test, youtube.com/watch?v=abc, and https://example.com';
      const result = urlFormatter.formatAllUrls(input);
      expect(result).toContain('reddit.com');
      expect(result).toContain('youtube.com');
      expect(result).toContain('example.com');
    });

    it('should handle complex text with multiple URLs', () => {
      const input = 'Visit r/programming, watch youtube.com/video, and check github.com/user/repo';
      const result = urlFormatter.formatAllUrls(input);
      expect(result).toContain('r/programming');
      expect(result).toContain('youtube.com');
      expect(result).toContain('github.com');
    });

    it('should handle text without URLs', () => {
      const input = 'This is just plain text without any URLs';
      const result = urlFormatter.formatAllUrls(input);
      expect(result).toBe(input);
    });

    it('should handle empty input', () => {
      const result = urlFormatter.formatAllUrls('');
      expect(result).toBe('');
    });

    it('should handle null input', () => {
      const result = urlFormatter.formatAllUrls(null);
      expect(result).toBe(null);
    });
  });

  describe('Error handling', () => {
    it('should handle errors in formatSocialMediaLinks gracefully', () => {
      // Mock ErrorHandler to throw an error
      const originalHandleError = require('../../src/utils/error-handler').ErrorHandler.handleError;
      require('../../src/utils/error-handler').ErrorHandler.handleError = jest.fn().mockImplementation(() => {
        throw new Error('Mock error');
      });

      const result = urlFormatter.formatSocialMediaLinks('test');
      expect(result).toBe('test');

      // Restore original function
      require('../../src/utils/error-handler').ErrorHandler.handleError = originalHandleError;
    });

    it('should handle errors in formatYouTubeLinks gracefully', () => {
      // Mock ErrorHandler to throw an error
      const originalHandleError = require('../../src/utils/error-handler').ErrorHandler.handleError;
      require('../../src/utils/error-handler').ErrorHandler.handleError = jest.fn().mockImplementation(() => {
        throw new Error('Mock error');
      });

      const result = urlFormatter.formatYouTubeLinks('test');
      expect(result).toBe('test');

      // Restore original function
      require('../../src/utils/error-handler').ErrorHandler.handleError = originalHandleError;
    });

    it('should handle errors in fixLinkFormatting gracefully', () => {
      // Mock ErrorHandler to throw an error
      const originalHandleError = require('../../src/utils/error-handler').ErrorHandler.handleError;
      require('../../src/utils/error-handler').ErrorHandler.handleError = jest.fn().mockImplementation(() => {
        throw new Error('Mock error');
      });

      const result = urlFormatter.fixLinkFormatting('test');
      expect(result).toBe('test');

      // Restore original function
      require('../../src/utils/error-handler').ErrorHandler.handleError = originalHandleError;
    });

    it('should handle errors in formatAllUrls gracefully', () => {
      // Mock ErrorHandler to throw an error
      const originalHandleError = require('../../src/utils/error-handler').ErrorHandler.handleError;
      require('../../src/utils/error-handler').ErrorHandler.handleError = jest.fn().mockImplementation(() => {
        throw new Error('Mock error');
      });

      const result = urlFormatter.formatAllUrls('test');
      expect(result).toBe('test');

      // Restore original function
      require('../../src/utils/error-handler').ErrorHandler.handleError = originalHandleError;
    });
  });
});
