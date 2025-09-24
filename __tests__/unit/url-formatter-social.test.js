/**
 * URL Formatter Social Media Tests
 * Tests for social media link formatting functionality
 */
const urlFormatter = require('../../src/utils/message-chunking/url-formatter');

describe('URL Formatter - Social Media', () => {
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

    it('should handle multiple URLs in one text', () => {
      const input = 'Check reddit.com/r/programming and github.com/user/repo';
      const result = urlFormatter.formatSocialMediaLinks(input);
      expect(result).toContain('(https://reddit.com/r/programming)');
      expect(result).toContain('(https://github.com/user/repo)');
    });

    it('should handle URLs with query parameters', () => {
      const input = 'Visit reddit.com/r/programming?sort=hot';
      const result = urlFormatter.formatSocialMediaLinks(input);
      expect(result).toContain('(https://reddit.com/r/programming?sort=hot)');
    });

    it('should handle URLs with fragments', () => {
      const input = 'Check github.com/user/repo#readme';
      const result = urlFormatter.formatSocialMediaLinks(input);
      expect(result).toContain('(https://github.com/user/repo#readme)');
    });

    it('should handle URLs with www prefix', () => {
      const input = 'Visit www.reddit.com/r/programming';
      const result = urlFormatter.formatSocialMediaLinks(input);
      expect(result).toContain('(https://www.reddit.com/r/programming)');
    });

    it('should handle URLs with https prefix', () => {
      const input = 'Check https://reddit.com/r/programming';
      const result = urlFormatter.formatSocialMediaLinks(input);
      expect(result).toContain('(https://reddit.com/r/programming)');
    });

    it('should handle URLs with http prefix', () => {
      const input = 'Check http://reddit.com/r/programming';
      const result = urlFormatter.formatSocialMediaLinks(input);
      expect(result).toContain('(https://reddit.com/r/programming)');
    });

    it('should handle mixed case URLs', () => {
      const input = 'Check REDDIT.COM/R/PROGRAMMING';
      const result = urlFormatter.formatSocialMediaLinks(input);
      expect(result).toContain('(https://reddit.com/r/programming)');
    });

    it('should handle URLs at end of sentence', () => {
      const input = 'Check out reddit.com/r/programming.';
      const result = urlFormatter.formatSocialMediaLinks(input);
      expect(result).toContain('(https://reddit.com/r/programming)');
    });

    it('should handle URLs at beginning of sentence', () => {
      const input = 'reddit.com/r/programming is great';
      const result = urlFormatter.formatSocialMediaLinks(input);
      expect(result).toContain('(https://reddit.com/r/programming)');
    });
  });
});
