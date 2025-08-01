/**
 * Mock image handler for tests
 */
module.exports = {
  processImage: jest.fn().mockResolvedValue({ url: 'https://example.com/image.png' }),
  convertToImageUrl: jest.fn().mockResolvedValue('https://example.com/image.png')
};
