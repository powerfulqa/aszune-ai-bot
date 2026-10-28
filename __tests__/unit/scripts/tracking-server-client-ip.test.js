/**
 * Tracking server: client address comes from the TCP peer (X-Forwarded-For is
 * ignored without TRACKING_TRUST_PROXY), and first-instance auto-authorization
 * is limited to loopback callers.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const ADMIN_KEY = 'test-admin-key';
const dbFiles = [];

async function startServer(env) {
  const dbPath = path.join(os.tmpdir(), `aszune-tracker-ip-${process.pid}-${dbFiles.length}.db`);
  dbFiles.push(dbPath);
  Object.assign(process.env, { TRACKING_ADMIN_KEY: ADMIN_KEY, INSTANCE_DB_PATH: dbPath }, env);
  jest.resetModules();
  const app = require('../../../scripts/tracking-server');
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

function register(base, instanceKey, xff) {
  const headers = { 'Content-Type': 'application/json' };
  if (xff) headers['X-Forwarded-For'] = xff;
  return fetch(`${base}/api/beacon`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'register', instanceKey, client: {}, location: {} }),
  }).then((r) => r.json());
}

async function listInstances(base) {
  const r = await fetch(`${base}/api/instances`, {
    headers: { Authorization: `Bearer ${ADMIN_KEY}` },
  });
  return r.json();
}

describe('tracking server client address', () => {
  let server;
  const savedEnv = { ...process.env };

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
    process.env = { ...savedEnv };
  });

  afterAll(() => {
    for (const p of dbFiles) {
      for (const suffix of ['', '-wal', '-shm']) {
        try {
          fs.unlinkSync(p + suffix);
        } catch {
          // ignore
        }
      }
    }
  });

  it('ignores X-Forwarded-For and records the socket address', async () => {
    let base;
    ({ server, base } = await startServer({ TRACKING_TRUST_PROXY: '' }));

    const res = await register(base, 'k-local', '203.0.113.9');
    const [instance] = await listInstances(base);

    expect(res.authorized).toBe(true);
    expect(instance.location.actualIp).toMatch(/^(::ffff:)?127\.0\.0\.1$/);
  });

  it('does not auto-authorize a non-loopback first instance', async () => {
    let base;
    ({ server, base } = await startServer({ TRACKING_TRUST_PROXY: 'loopback' }));

    const res = await register(base, 'k-remote', '203.0.113.9');
    const [instance] = await listInstances(base);

    expect(res.authorized).toBe(false);
    expect(instance.location.actualIp).toBe('203.0.113.9');
  });
});
