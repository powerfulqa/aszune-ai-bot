/**
 * Tests for config module
 */
const config = require('../../src/config/config');

describe('Config', () => {
  it('exports required configuration settings', () => {
    // Test basic structure
    expect(config).toHaveProperty('PERPLEXITY_API_KEY');
    expect(config).toHaveProperty('DISCORD_BOT_TOKEN');
    expect(config).toHaveProperty('MAX_HISTORY');
    expect(config).toHaveProperty('RATE_LIMIT_WINDOW');
    
    // Test nested structure
    expect(config).toHaveProperty('API.PERPLEXITY.BASE_URL');
    expect(config).toHaveProperty('API.PERPLEXITY.ENDPOINTS.CHAT_COMPLETIONS');
    expect(config).toHaveProperty('COLORS.PRIMARY');
    expect(config).toHaveProperty('SYSTEM_MESSAGES.CHAT');
    expect(config).toHaveProperty('SYSTEM_MESSAGES.SUMMARY');
    
    // Test emoji reactions
    expect(config).toHaveProperty('REACTIONS');
    expect(config.REACTIONS).toHaveProperty('hello', '👋');
    expect(config.REACTIONS).toHaveProperty('happy', '😊');
  });
});
