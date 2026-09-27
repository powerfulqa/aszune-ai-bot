/**
 * Tests for shell-free execution helpers
 */

const {
  isSafeServiceName,
  assertSafeServiceName,
  clampInt,
} = require('../../../src/utils/safe-exec');

describe('safe-exec', () => {
  describe('isSafeServiceName', () => {
    it.each(['nginx', 'aszune-ai', 'getty@tty1', 'user.slice', 'a_b-c.d'])('accepts %p', (name) => {
      expect(isSafeServiceName(name)).toBe(true);
    });

    it.each([
      'nginx; reboot',
      '$(id)',
      '`id`',
      'a b',
      'a|b',
      'a&b',
      '../etc',
      '-rf',
      '--help',
      '',
      null,
      undefined,
      42,
      'x'.repeat(101),
    ])('rejects %p', (name) => {
      expect(isSafeServiceName(name)).toBe(false);
    });
  });

  it('assertSafeServiceName throws a 400 error for an unsafe name', () => {
    expect(() => assertSafeServiceName('a;b')).toThrow('Invalid service name');
    try {
      assertSafeServiceName('a;b');
    } catch (error) {
      expect(error.statusCode).toBe(400);
    }
  });

  describe('clampInt', () => {
    const bounds = { def: 50, min: 1, max: 1000 };

    it('keeps in-range values', () => {
      expect(clampInt('200', bounds)).toBe(200);
    });

    it('clamps to the bounds', () => {
      expect(clampInt('0', bounds)).toBe(1);
      expect(clampInt(5000, bounds)).toBe(1000);
    });

    it('uses the default for non-numbers', () => {
      expect(clampInt('abc', bounds)).toBe(50);
      expect(clampInt(undefined, bounds)).toBe(50);
    });
  });
});
