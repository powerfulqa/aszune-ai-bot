/**
 * Tests for the tracking-server SQLite persistence layer.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const InstanceStore = require('../../../scripts/instance-store');

function tempDbPath(name) {
  return path.join(os.tmpdir(), `aszune-instance-store-${name}-${process.pid}.db`);
}

function makeInstance(id, overrides = {}) {
  return {
    instanceId: id,
    authorized: true,
    revoked: false,
    location: { actualIp: '203.0.113.5' },
    ...overrides,
  };
}

describe('InstanceStore', () => {
  const created = [];

  afterAll(() => {
    for (const p of created) {
      for (const suffix of ['', '-wal', '-shm']) {
        try {
          fs.unlinkSync(p + suffix);
        } catch {
          // ignore
        }
      }
    }
  });

  it('reports persistent when SQLite opens', () => {
    const dbPath = tempDbPath('persistent');
    created.push(dbPath);
    const store = new InstanceStore(dbPath);
    expect(store.persistent).toBe(true);
    store.close();
  });

  it('round-trips an instance through upsert and loadAll', () => {
    const dbPath = tempDbPath('roundtrip');
    created.push(dbPath);
    const store = new InstanceStore(dbPath);

    store.upsert(makeInstance('inst_1'));
    const loaded = store.loadAll();

    expect(loaded).toHaveLength(1);
    expect(loaded[0].instanceId).toBe('inst_1');
    expect(loaded[0].authorized).toBe(true);
    store.close();
  });

  it('updates an existing instance rather than duplicating it', () => {
    const dbPath = tempDbPath('update');
    created.push(dbPath);
    const store = new InstanceStore(dbPath);

    store.upsert(makeInstance('inst_1', { authorized: false }));
    store.upsert(makeInstance('inst_1', { authorized: true }));

    const loaded = store.loadAll();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].authorized).toBe(true);
    store.close();
  });

  it('persists authorizations across a simulated restart', () => {
    const dbPath = tempDbPath('restart');
    created.push(dbPath);

    const first = new InstanceStore(dbPath);
    first.upsert(makeInstance('inst_persist', { authorized: true }));
    first.close();

    const second = new InstanceStore(dbPath);
    const loaded = second.loadAll();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].instanceId).toBe('inst_persist');
    expect(loaded[0].authorized).toBe(true);
    second.close();
  });

  it('ignores upserts without an instanceId', () => {
    const dbPath = tempDbPath('noid');
    created.push(dbPath);
    const store = new InstanceStore(dbPath);
    store.upsert({ authorized: true });
    expect(store.loadAll()).toHaveLength(0);
    store.close();
  });
});
