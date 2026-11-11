/**
 * Config: Perplexity Agent API settings read at startup.
 * jest.setup.js resets modules before each test, so every require re-reads env.
 */
describe('Config - Agent API settings', () => {
  const KEYS = ['AGENT_EFFORT', 'AGENT_PRESET', 'SEARCH_DOMAIN_FILTER'];
  let saved;

  beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
    KEYS.forEach((key) => delete process.env[key]);
    process.env.DISCORD_BOT_TOKEN = 'test-token';
    process.env.PERPLEXITY_API_KEY = 'test-key';
  });

  afterEach(() => {
    KEYS.forEach((key) => {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    });
  });

  const effort = () => require('../../src/config/config').API.PERPLEXITY.AGENT_PRESET;

  it('defaults the effort level to medium', () => {
    expect(effort()).toBe('medium');
  });

  it('still reads the old AGENT_PRESET name', () => {
    process.env.AGENT_PRESET = 'low';
    expect(effort()).toBe('low');
  });

  it('prefers AGENT_EFFORT over AGENT_PRESET', () => {
    process.env.AGENT_PRESET = 'low';
    process.env.AGENT_EFFORT = 'high@2026-10-28.0';
    expect(effort()).toBe('high@2026-10-28.0');
  });

  it('accepts 20 search domains, ignoring blanks', () => {
    const domains = Array.from({ length: 20 }, (_, i) => `site${i}.example`);
    process.env.SEARCH_DOMAIN_FILTER = `${domains.join(', ')}, ,`;
    expect(require('../../src/config/config').API.PERPLEXITY.SEARCH_DOMAIN_FILTER).toEqual(domains);
  });

  it('refuses to start with more than 20 search domains', () => {
    process.env.SEARCH_DOMAIN_FILTER = Array.from(
      { length: 21 },
      (_, i) => `site${i}.example`
    ).join(',');
    expect(() => require('../../src/config/config')).toThrow(
      'SEARCH_DOMAIN_FILTER allows at most 20 domains.'
    );
  });
});
