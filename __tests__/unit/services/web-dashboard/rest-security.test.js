/**
 * Security tests for the dashboard REST layer: without DASHBOARD_TOKEN the REST API is
 * read-only (matches the socket rule); token auth; Host/Origin guard; HTTP headers.
 */

jest.mock('../../../../src/services/database', () => ({}));
jest.mock('../../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
/** Minimal Express response double */
function makeRes() {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((body) => {
    res.body = body;
    return res;
  });
  return res;
}

describe('dashboard REST security', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.DASHBOARD_TOKEN;
    service = require('../../../../src/services/web-dashboard');
  });

  describe('auth middleware without a token (read-only)', () => {
    beforeEach(() => {
      service.authToken = null;
    });

    it.each(['GET', 'HEAD', 'OPTIONS'])('allows %s', (method) => {
      const next = jest.fn();
      const res = makeRes();
      service._createAuthMiddleware()({ method, headers: { host: 'localhost:3000' } }, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it.each([
      ['a rebound Host', { host: 'evil.example:3000' }],
      ['a cross-site Origin', { host: 'localhost:3000', origin: 'https://evil.example' }],
      ['no Host', {}],
    ])('refuses GET with %s', (_name, headers) => {
      const next = jest.fn();
      const res = makeRes();
      service._createAuthMiddleware()({ method: 'GET', headers }, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('accepts a hostname listed in DASHBOARD_ALLOWED_HOSTS', () => {
      process.env.DASHBOARD_ALLOWED_HOSTS = 'pi.lan';
      const next = jest.fn();
      const req = { method: 'GET', headers: { host: 'pi.lan' } };
      service._createAuthMiddleware()(req, makeRes(), next);
      delete process.env.DASHBOARD_ALLOWED_HOSTS;
      expect(next).toHaveBeenCalledTimes(1);
    });

    it.each(['POST', 'PUT', 'DELETE', 'PATCH'])('refuses %s with 403', (method) => {
      const next = jest.fn();
      const res = makeRes();
      service._createAuthMiddleware()({ method, headers: { host: 'localhost:3000' } }, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('Dashboard is read-only: set DASHBOARD_TOKEN to enable changes');
    });
  });

  describe('auth middleware without a token on a network bind', () => {
    beforeEach(() => {
      service.authToken = null;
      service.bindHost = '0.0.0.0';
    });

    afterEach(() => {
      service.bindHost = '127.0.0.1';
    });

    it.each(['GET', 'POST'])('refuses %s with 403', (method) => {
      const next = jest.fn();
      const res = makeRes();
      service._createAuthMiddleware()({ method, headers: { host: 'localhost:3000' } }, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe(
        'Dashboard is reachable from the network: set DASHBOARD_TOKEN to enable access'
      );
    });
  });

  describe('auth middleware with a token', () => {
    beforeEach(() => {
      service.authToken = 'secret-token';
    });

    it('rejects a POST without a bearer token', () => {
      const next = jest.fn();
      const res = makeRes();
      service._createAuthMiddleware()({ method: 'POST', headers: {} }, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
    });

    it('allows a POST with the correct bearer token', () => {
      const next = jest.fn();
      const res = makeRes();
      service._createAuthMiddleware()(
        { method: 'POST', headers: { authorization: 'Bearer secret-token' } },
        res,
        next
      );
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});

describe('dashboard HTTP headers', () => {
  let service;
  let server;
  let baseUrl;

  beforeEach(async () => {
    delete process.env.DASHBOARD_TOKEN;
    const express = require('express');
    service = require('../../../../src/services/web-dashboard');
    service.authToken = null;
    service.bindHost = '127.0.0.1';
    service.corsOrigin = null;
    service.app = express();
    service.setupMiddleware();
    service.app.get('/api/ping', (req, res) => res.json({ ok: true }));
    await new Promise((resolve) => {
      server = service.app.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('sends security headers and hides x-powered-by', async () => {
    const res = await fetch(`${baseUrl}/api/ping`);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-powered-by')).toBeNull();
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('content-security-policy')).toContain("connect-src 'self'");
  });

  it('echoes an allowed localhost origin and ignores any other', async () => {
    const allowed = await fetch(`${baseUrl}/api/ping`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');

    const other = await fetch(`${baseUrl}/api/ping`, {
      headers: { Origin: 'http://evil.example' },
    });
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('answers a CORS preflight without reaching the routes', async () => {
    const res = await fetch(`${baseUrl}/api/ping`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-headers')).toContain('Authorization');
  });
});
