/**
 * Regression tests for the ConversationManager singleton wrapper
 * (src/state/conversationManager.js).
 *
 * `module.exports = conversationManager` assigns the module-level
 * `initializeIntervals` wrapper onto the instance, shadowing the prototype
 * method. A previous implementation called the shadowed instance method from
 * inside the wrapper, causing infinite recursion (RangeError: Maximum call
 * stack size exceeded) that crash-looped the bot on startup.
 *
 * The bug is invisible under NODE_ENV=test because the wrapper short-circuits,
 * so these tests exercise the non-test ("production") path explicitly.
 */

describe('conversationManager singleton — initializeIntervals (production path)', () => {
  let originalEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.resetModules();
  });

  it('initializes without recursing when NODE_ENV !== "test"', async () => {
    process.env.NODE_ENV = 'production';
    const singleton = require('../../src/state/conversationManager');

    expect(singleton.isInitialized()).toBe(false);
    expect(() => singleton.initializeIntervals()).not.toThrow();
    expect(singleton.isInitialized()).toBe(true);

    // Second call is a guarded no-op and must also not throw.
    expect(() => singleton.initializeIntervals()).not.toThrow();

    // Clear the real interval timers the production path created.
    await singleton.destroy();
  });

  it('sets up interval timers on the instance and clears them on destroy', async () => {
    process.env.NODE_ENV = 'production';
    const singleton = require('../../src/state/conversationManager');

    singleton.initializeIntervals();
    expect(singleton.activeIntervals.size).toBeGreaterThan(0);

    await singleton.destroy();
    expect(singleton.activeIntervals.size).toBe(0);
  });
});
