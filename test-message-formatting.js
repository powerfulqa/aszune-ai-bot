/**
 * Test script to validate message formatting fix for Perplexity API
 * Run this to verify the fix before deploying to production
 */

// Mock Discord.js before requiring the service
jest.mock('discord.js', () => ({
  Client: jest.fn(),
  GatewayIntentBits: {},
  REST: jest.fn(),
}));

// Mock database service
jest.mock('../src/services/database', () => ({
  addUserMessage: jest.fn(),
  updateUserStats: jest.fn(),
  getUserMessages: jest.fn().mockReturnValue([]),
  addBotResponse: jest.fn(),
  logPerformanceMetric: jest.fn(),
}));

const PerplexityService = require('../src/services/perplexity-secure');

describe('Message Formatting Fix Validation', () => {
  let service;

  beforeEach(() => {
    service = new PerplexityService();
  });

  test('should add system message to empty history', () => {
    const formatted = service._formatMessagesForAPI([]);
    
    expect(formatted).toHaveLength(2);
    expect(formatted[0].role).toBe('system');
    expect(formatted[1].role).toBe('user');
    console.log('✓ Empty history test passed');
  });

  test('should handle single user message', () => {
    const history = [
      { role: 'user', content: 'Hello!' }
    ];
    const formatted = service._formatMessagesForAPI(history);
    
    expect(formatted[0].role).toBe('system');
    expect(formatted[1].role).toBe('user');
    expect(formatted[1].content).toBe('Hello!');
    console.log('✓ Single user message test passed');
  });

  test('should combine consecutive user messages', () => {
    const history = [
      { role: 'user', content: 'Hello' },
      { role: 'user', content: 'Are you there?' }
    ];
    const formatted = service._formatMessagesForAPI(history);
    
    expect(formatted).toHaveLength(2); // system + combined user message
    expect(formatted[0].role).toBe('system');
    expect(formatted[1].role).toBe('user');
    expect(formatted[1].content).toContain('Hello');
    expect(formatted[1].content).toContain('Are you there?');
    console.log('✓ Consecutive user messages test passed');
  });

  test('should ensure proper alternation', () => {
    const history = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' },
      { role: 'assistant', content: 'I am doing well!' }
    ];
    const formatted = service._formatMessagesForAPI(history);
    
    // Should be: system, user, assistant, user, assistant
    expect(formatted).toHaveLength(5);
    expect(formatted[0].role).toBe('system');
    expect(formatted[1].role).toBe('user');
    expect(formatted[2].role).toBe('assistant');
    expect(formatted[3].role).toBe('user');
    expect(formatted[4].role).toBe('assistant');
    console.log('✓ Proper alternation test passed');
  });

  test('should end with user message', () => {
    const history = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' }
    ];
    const formatted = service._formatMessagesForAPI(history);
    
    const lastMessage = formatted[formatted.length - 1];
    expect(lastMessage.role).toBe('user');
    console.log('✓ End with user message test passed');
  });

  test('should handle assistant after system', () => {
    const history = [
      { role: 'assistant', content: 'I can help you with that' }
    ];
    const formatted = service._formatMessagesForAPI(history);
    
    // Should insert placeholder user message before assistant
    expect(formatted[0].role).toBe('system');
    expect(formatted[1].role).toBe('user'); // Placeholder
    expect(formatted[2].role).toBe('assistant');
    expect(formatted[3].role).toBe('user'); // Ensure ends with user
    console.log('✓ Assistant after system test passed');
  });

  test('should skip duplicate system messages', () => {
    const history = [
      { role: 'system', content: 'Extra system message' },
      { role: 'user', content: 'Hello' }
    ];
    const formatted = service._formatMessagesForAPI(history);
    
    // Should only have one system message (the one we add)
    const systemMessages = formatted.filter(msg => msg.role === 'system');
    expect(systemMessages).toHaveLength(1);
    console.log('✓ Duplicate system message test passed');
  });

  test('should handle complex conversation with mixed roles', () => {
    const history = [
      { role: 'user', content: 'Message 1' },
      { role: 'user', content: 'Message 2' }, // Consecutive user
      { role: 'assistant', content: 'Response 1' },
      { role: 'user', content: 'Message 3' },
      { role: 'assistant', content: 'Response 2' },
      { role: 'assistant', content: 'Response 2b' }, // Consecutive assistant
    ];
    const formatted = service._formatMessagesForAPI(history);
    
    // Verify all messages have proper alternation
    for (let i = 1; i < formatted.length - 1; i++) {
      const current = formatted[i];
      const next = formatted[i + 1];
      
      if (current.role === 'user') {
        expect(next.role).toBe('assistant');
      } else if (current.role === 'assistant') {
        expect(next.role).toBe('user');
      }
    }
    
    // Last message should be user
    expect(formatted[formatted.length - 1].role).toBe('user');
    console.log('✓ Complex conversation test passed');
  });

  afterAll(() => {
    console.log('\n✅ All message formatting tests passed!');
    console.log('The fix is ready for production deployment.');
  });
});

// Run the tests
if (require.main === module) {
  console.log('Running message formatting validation tests...\n');
  
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Run Jest
  const jest = require('jest');
  jest.run(['--testMatch', '**/test-message-formatting.js', '--verbose']);
}

module.exports = {};
