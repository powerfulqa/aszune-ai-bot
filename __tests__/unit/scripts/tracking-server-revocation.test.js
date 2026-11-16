/**
 * Tracking server: a revocation must hold. A revoked instance cannot get
 * authorized again by registering under a new key from the same address.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const ADMIN_KEY = 'test-admin-key-0123456789';
const dbPath = path.join(os.tmpdir(), `aszune-tracker-revoke-${process.pid}.db`);

function post(base, route, body, admin = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (admin) headers.Authorization = `Bearer ${ADMIN_KEY}`;
  return fetch(`${base}${route}`, { method: 'POST', headers, body: JSON.stringify(body) }).then(
    (r) => r.json()
  );
}

const register = (base, instanceKey) =>
  post(base, '/api/beacon', { action: 'register', instanceKey, client: {}, location: {} });

describe('tracking server revocation', () => {
  let server;
  let base;
  const savedEnv = { ...process.env };

  beforeEach(async () => {
    Object.assign(process.env, { TRACKING_ADMIN_KEY: ADMIN_KEY, INSTANCE_DB_PATH: dbPath });
    jest.resetModules();
    const app = require('../../../scripts/tracking-server');
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
    process.env = { ...savedEnv };
    for (const suffix of ['', '-wal', '-shm']) {
      fs.rmSync(dbPath + suffix, { force: true });
    }
  });

  it('leaves a new registration from a revoked address pending', async () => {
    const first = await register(base, 'key-one');
    expect(first.authorized).toBe(true); // first instance, over loopback

    const revoked = await post(base, '/api/revoke', { instanceId: first.instanceId }, true);
    expect(revoked).toEqual({ success: true, message: 'Instance revoked' });

    const again = await register(base, 'key-two');
    expect(again.authorized).toBe(false);
    expect(again.message).toBe('Instance registered - pending authorization');
  });

  it('still auto-authorizes a second instance from an address in good standing', async () => {
    await register(base, 'key-one');
    const second = await register(base, 'key-two');
    expect(second.authorized).toBe(true);
  });

  it('rate limits the unauthenticated beacon per address', async () => {
    let last;
    for (let i = 0; i < 31; i++) {
      last = await fetch(`${base}/api/beacon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'heartbeat', instanceId: 'none' }),
      });
    }
    expect(last.status).toBe(429);
  });
});
