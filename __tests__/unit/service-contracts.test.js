/**
 * Contract test: every method src/ calls on the database service or on
 * ErrorHandler must exist on the real class.
 *
 * Most suites replace these two with hand-written mock factories, so a call to
 * a method that does not exist (databaseService.addReminder?.(),
 * ErrorHandler.logError()) passes every mocked test and only fails in
 * production. The call sites are read from the source at test time, so a new
 * call is checked without touching this file.
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../../src');

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

/**
 * Collect "<method> (<file>)" for every call matching one of the patterns.
 * Each pattern captures the method name in group 1. Optional calls (`?.(`)
 * and optional chaining on the receiver are matched too.
 */
function calledMethods(patterns) {
  const found = new Map();
  for (const file of sourceFiles(SRC_DIR)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        if (!found.has(match[1])) found.set(match[1], path.relative(SRC_DIR, file));
      }
    }
  }
  return [...found.entries()].sort(([a], [b]) => a.localeCompare(b));
}

describe('service contracts', () => {
  describe('databaseService', () => {
    const { DatabaseService } = require('../../src/services/database');
    const calls = calledMethods([
      /\bdatabaseService\??\.(\w+)\s*(?:\?\.)?\(/g,
      /require\(['"][./\w-]*services\/database['"]\)\.(\w+)\s*(?:\?\.)?\(/g,
    ]);

    it('finds the call sites it is meant to check', () => {
      const names = calls.map(([name]) => name);
      expect(names).toContain('addUserMessage');
      expect(names).toContain('getDueReminders');
      expect(names).toContain('close');
    });

    it.each(calls)('%s exists on DatabaseService (called in %s)', (method) => {
      expect(typeof DatabaseService.prototype[method]).toBe('function');
    });
  });

  describe('ErrorHandler', () => {
    const { ErrorHandler } = require('../../src/utils/error-handler');
    const calls = calledMethods([/\bErrorHandler\??\.(\w+)\s*(?:\?\.)?\(/g]);

    it('finds the call sites it is meant to check', () => {
      expect(calls.map(([name]) => name)).toContain('handleError');
    });

    it.each(calls)('%s exists on ErrorHandler (called in %s)', (method) => {
      expect(typeof ErrorHandler[method]).toBe('function');
    });
  });
});
