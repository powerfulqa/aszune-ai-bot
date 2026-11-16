/**
 * REST auth middleware with DASHBOARD_TOKEN set: every way of presenting a bad
 * token gets 401 with the exact body, the right token reaches next(), and the
 * guessing guard answers 429 after ten wrong tokens.
 */

jest.mock('../../../../src/services/database', () => ({}));
jest.mock('../../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const TOKEN = 'secret-token';
const BEARER_REQUIRED = { error: 'Unauthorized - Bearer token required' };
const INVALID = { error: 'Unauthorized - Invalid token' };
const TOO_MANY = { error: 'Too many failed attempts - try again in a minute' };

/** Minimal Express response double */
function makeRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('REST token auth middleware', () => {
  let middleware;

  /** Run one request through the middleware and return { res, next } */
  const run = (authorization, ip = '10.0.0.1', method = 'POST') => {
    const res = makeRes();
    const next = jest.fn();
    const headers = authorization === undefined ? {} : { authorization };
    middleware({ method, ip, headers }, res, next);
    return { res, next };
  };

  beforeEach(() => {
    delete process.env.DASHBOARD_TOKEN;
    const service = require('../../../../src/services/web-dashboard');
    service.authToken = TOKEN;
    middleware = service._createAuthMiddleware();
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['a missing Authorization header', undefined],
    ['an empty Authorization header', ''],
    ['a Basic scheme', 'Basic c2VjcmV0LXRva2Vu'],
    ['a lowercase bearer scheme', `bearer ${TOKEN}`],
    ['the bare token without a scheme', TOKEN],
  ])('answers 401 "Bearer token required" for %s', (_name, header) => {
    const { res, next } = run(header);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(BEARER_REQUIRED);
  });

  it.each([
    ['a shorter token', 'Bearer short'],
    ['a longer token', `Bearer ${TOKEN}-and-more`],
    ['a token one character short', `Bearer ${TOKEN.slice(0, -1)}`],
    ['a same-length wrong token', `Bearer ${'x'.repeat(TOKEN.length)}`],
    ['a same-length token differing in the last character', `Bearer ${TOKEN.slice(0, -1)}X`],
    ['an empty token', 'Bearer '],
  ])('answers 401 "Invalid token" for %s', (_name, header) => {
    const { res, next } = run(header);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(INVALID);
  });

  it.each(['GET', 'POST', 'PUT', 'DELETE'])('calls next() for the right token on %s', (method) => {
    const { res, next } = run(`Bearer ${TOKEN}`, '10.0.0.1', method);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  describe('guessing guard', () => {
    it('refuses further attempts from an address after ten wrong tokens, even a right one', () => {
      for (let i = 0; i < 10; i += 1) {
        expect(run('Bearer wrong-token').res.json).toHaveBeenCalledWith(INVALID);
      }

      const { res, next } = run(`Bearer ${TOKEN}`);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(TOO_MANY);
    });

    it('keeps other addresses unaffected', () => {
      for (let i = 0; i < 10; i += 1) run('Bearer wrong-token');

      const { next } = run(`Bearer ${TOKEN}`, '10.0.0.2');

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('allows the address again once the minute is over', () => {
      const start = Date.now();
      const now = jest.spyOn(Date, 'now').mockReturnValue(start);
      for (let i = 0; i < 10; i += 1) run('Bearer wrong-token');
      expect(run(`Bearer ${TOKEN}`).next).not.toHaveBeenCalled();

      now.mockReturnValue(start + 60000);

      expect(run(`Bearer ${TOKEN}`).next).toHaveBeenCalledTimes(1);
    });

    it('does not count a missing header as a guess', () => {
      for (let i = 0; i < 15; i += 1) run(undefined);

      expect(run(`Bearer ${TOKEN}`).next).toHaveBeenCalledTimes(1);
    });
  });
});
