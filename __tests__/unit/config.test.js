/**
 * Tests for config module
 */
jest.mock('../../src/utils/pi-detector', () => ({
  initPiOptimizations: jest.fn().mockResolvedValue({
    ENABLED: true,
    COMPACT_MODE: true,
    MAX_CONNECTIONS: 2
  })
}));

describe('Config', () => {
  let originalEnv;
  
  beforeEach(() => {
    // Save original environment variables
    originalEnv = { ...process.env };
    
    // Setup minimal environment for testing
    process.env.PERPLEXITY_API_KEY = 'test-api-key';
    process.env.DISCORD_BOT_TOKEN = 'test-discord-token';
    
    // Reset mocks
    const piDetector = require('../../src/utils/pi-detector');
    piDetector.initPiOptimizations.mockClear();
    piDetector.initPiOptimizations.mockResolvedValue({
      ENABLED: true,
      COMPACT_MODE: true,
      MAX_CONNECTIONS: 2
    });
    
    // Clear module cache for fresh config initialization
    jest.resetModules();
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });
  
  it('exports required configuration settings', () => {
    const config = require('../../src/config/config');
    
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
  
  it('should throw error when missing required environment variables', () => {
    delete process.env.PERPLEXITY_API_KEY;
    
    expect(() => {
      require('../../src/config/config');
    }).toThrow('Missing PERPLEXITY_API_KEY in environment variables.');
  });
  
  it('should have default API configuration', () => {
    const config = require('../../src/config/config');
    expect(config.API).toBeDefined();
    expect(config.API.PERPLEXITY).toBeDefined();
    expect(config.API.PERPLEXITY.BASE_URL).toBeDefined();
  });
  
  it('should have system messages defined', () => {
    const config = require('../../src/config/config');
    expect(config.SYSTEM_MESSAGES).toBeDefined();
    expect(config.SYSTEM_MESSAGES.CHAT).toBeDefined();
    expect(config.SYSTEM_MESSAGES.SUMMARY).toBeDefined();
  });
  
  describe('initializePiOptimizations', () => {
    it('should initialize Pi optimizations when environment variable is set', async () => {
      process.env.ENABLE_PI_OPTIMIZATIONS = 'true';
      
      const config = require('../../src/config/config');
      const piDetector = require('../../src/utils/pi-detector');
      
      // Setup default Pi optimizations
      config.PI_OPTIMIZATIONS = {
        ENABLED: true
      };
      
      const result = await config.initializePiOptimizations();
      
      expect(piDetector.initPiOptimizations).toHaveBeenCalled();
      // The result should be the config object itself
      expect(result).toBe(config);
    });
    
    it('should handle errors during Pi optimization initialization', async () => {
      process.env.ENABLE_PI_OPTIMIZATIONS = 'true';
      
      // Setup default Pi optimizations
      const config = require('../../src/config/config');
      config.PI_OPTIMIZATIONS = {
        ENABLED: true
      };
      
      const piDetector = require('../../src/utils/pi-detector');
      piDetector.initPiOptimizations.mockRejectedValue(new Error('Test error'));
      
      const result = await config.initializePiOptimizations();
      
      expect(piDetector.initPiOptimizations).toHaveBeenCalled();
      // The result should be the config object itself
      expect(result).toBe(config);
    });
    
    it('should not initialize Pi optimizations when disabled by environment variable', async () => {
      process.env.ENABLE_PI_OPTIMIZATIONS = 'false';
      
      const config = require('../../src/config/config');
      // Setup default Pi optimizations
      config.PI_OPTIMIZATIONS = {
        ENABLED: false
      };
      
      const piDetector = require('../../src/utils/pi-detector');
      
      const result = await config.initializePiOptimizations();
      
      expect(piDetector.initPiOptimizations).not.toHaveBeenCalled();
      // The result should be the config object itself
      expect(result).toBe(config);
    });
  });
});
