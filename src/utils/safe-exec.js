/**
 * Shell-free process execution for commands that take request-supplied
 * arguments (service names, line counts). `execFile` passes arguments
 * directly to the program — no shell parses them — so metacharacters such as
 * `;`, `|`, `$()` or backticks are inert. Names are also validated so a
 * value can't be read as a command-line option (e.g. `--help`).
 * @module utils/safe-exec
 */

const { execFile } = require('child_process');
const util = require('util');

const execFileAsync = util.promisify(execFile);

/** systemd / PM2 unit names: letters, digits and @ . _ - ; must not start with '-' */
const SERVICE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9@._-]{0,99}$/;

/**
 * Whether a value is a safe service/unit name to pass as an argument.
 * @param {*} name - Candidate name
 * @returns {boolean}
 */
function isSafeServiceName(name) {
  return typeof name === 'string' && SERVICE_NAME_PATTERN.test(name);
}

/**
 * Throw a client-safe error when a service name is invalid.
 * @param {*} name - Candidate name
 * @throws {Error} When the name is not a safe service name
 */
function assertSafeServiceName(name) {
  if (!isSafeServiceName(name)) {
    const error = new Error('Invalid service name');
    error.statusCode = 400;
    throw error;
  }
}

/**
 * Clamp an integer query value into [min, max], using `def` when it isn't a number.
 * @param {*} value - Raw value
 * @param {object} bounds - { def, min, max }
 * @returns {number}
 */
function clampInt(value, { def, min, max }) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) {
    return def;
  }
  return Math.min(max, Math.max(min, n));
}

module.exports = {
  execFileAsync,
  isSafeServiceName,
  assertSafeServiceName,
  clampInt,
  SERVICE_NAME_PATTERN,
};
