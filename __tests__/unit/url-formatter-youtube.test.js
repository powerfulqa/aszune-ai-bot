/**
 * URL Formatter YouTube Tests
 * Tests for YouTube link formatting functionality
 */
const urlFormatter = require('../../src/utils/message-chunking/url-formatter');

describe('URL Formatter - YouTube', () => {
  describe('formatYouTubeLinks', () => {
    it('should format YouTube URLs', () => {
      const input = 'Watch this: youtube.com/watch?v=abc123';
      const result = urlFormatter.formatYouTubeLinks(input);
      expect(result).toContain('[YouTube Video](https://youtube.com/watch?v=abc123)');
    });

    it('should format YouTube short URLs', () => {
      const input = 'Check out youtu.be/abc123';
      const result = urlFormatter.formatYouTubeLinks(input);
      expect(result).toContain('[YouTube Video](https://youtu.be/abc123)');
    });

    it('should handle text without YouTube URLs', () => {
      const input = 'This is just plain text';
      const result = urlFormatter.formatYouTubeLinks(input);
      expect(result).toBe(input);
    });

    it('should handle multiple YouTube URLs', () => {
      const input = 'Watch youtube.com/watch?v=abc123 and youtu.be/def456';
      const result = urlFormatter.formatYouTubeLinks(input);
      expect(result).toContain('[YouTube Video](https://youtube.com/watch?v=abc123)');
      expect(result).toContain('[YouTube Video](https://youtu.be/def456)');
    });
  });

  describe('fixLinkFormatting', () => {
    it('should fix malformed markdown links', () => {
      const input = 'Check [this link](https://example.com';
      const result = urlFormatter.fixLinkFormatting(input);
      expect(result).toContain('[this link](https://example.com)');
    });

    it('should handle properly formatted links', () => {
      const input = 'Check [this link](https://example.com)';
      const result = urlFormatter.fixLinkFormatting(input);
      expect(result).toBe(input);
    });

    it('should handle text without links', () => {
      const input = 'This is just plain text';
      const result = urlFormatter.fixLinkFormatting(input);
      expect(result).toBe(input);
    });

    it('should fix multiple malformed links', () => {
      const input = 'Check [link1](https://example1.com and [link2](https://example2.com';
      const result = urlFormatter.fixLinkFormatting(input);
      expect(result).toContain('[link1](https://example1.com)');
      expect(result).toContain('[link2](https://example2.com)');
    });
  });

  describe('formatAllUrls', () => {
    it('should format all types of URLs', () => {
      const input = 'Check reddit.com/r/programming and youtube.com/watch?v=abc123';
      const result = urlFormatter.formatAllUrls(input);
      expect(result).toContain('(https://reddit.com/r/programming)');
      expect(result).toContain('[YouTube Video](https://youtube.com/watch?v=abc123)');
    });

    it('should handle text without URLs', () => {
      const input = 'This is just plain text';
      const result = urlFormatter.formatAllUrls(input);
      expect(result).toBe(input);
    });

    it('should handle mixed content', () => {
      const input =
        'Check reddit.com/r/programming, youtube.com/watch?v=abc123, and github.com/user/repo';
      const result = urlFormatter.formatAllUrls(input);
      expect(result).toContain('(https://reddit.com/r/programming)');
      expect(result).toContain('[YouTube Video](https://youtube.com/watch?v=abc123)');
      expect(result).toContain('(https://github.com/user/repo)');
    });
  });

  describe('Error handling', () => {
    it('should handle null input', () => {
      expect(() => urlFormatter.formatSocialMediaLinks(null)).not.toThrow();
      expect(() => urlFormatter.formatYouTubeLinks(null)).not.toThrow();
      expect(() => urlFormatter.fixLinkFormatting(null)).not.toThrow();
      expect(() => urlFormatter.formatAllUrls(null)).not.toThrow();
    });

    it('should handle undefined input', () => {
      expect(() => urlFormatter.formatSocialMediaLinks(undefined)).not.toThrow();
      expect(() => urlFormatter.formatYouTubeLinks(undefined)).not.toThrow();
      expect(() => urlFormatter.fixLinkFormatting(undefined)).not.toThrow();
      expect(() => urlFormatter.formatAllUrls(undefined)).not.toThrow();
    });

    it('should handle empty string input', () => {
      const result1 = urlFormatter.formatSocialMediaLinks('');
      const result2 = urlFormatter.formatYouTubeLinks('');
      const result3 = urlFormatter.fixLinkFormatting('');
      const result4 = urlFormatter.formatAllUrls('');

      expect(result1).toBe('');
      expect(result2).toBe('');
      expect(result3).toBe('');
      expect(result4).toBe('');
    });

    it('should handle non-string input', () => {
      expect(() => urlFormatter.formatSocialMediaLinks(123)).not.toThrow();
      expect(() => urlFormatter.formatYouTubeLinks({})).not.toThrow();
      expect(() => urlFormatter.fixLinkFormatting([])).not.toThrow();
      expect(() => urlFormatter.formatAllUrls(true)).not.toThrow();
    });
  });
});
