/**
 * SQLite-backed persistence for the instance tracking server.
 *
 * Instances (and their authorized/revoked state) are mirrored to SQLite so
 * they survive a tracker restart. If the database cannot be opened the store
 * degrades to in-memory only, logging a warning, so the tracker still runs.
 *
 * @module scripts/instance-store
 */

const path = require('path');
const fs = require('fs');

class InstanceStore {
  /**
   * @param {string} dbPath - Path to the SQLite database file
   */
  constructor(dbPath) {
    this.db = null;
    this.dbPath = dbPath;

    try {
      const Database = require('better-sqlite3');
      const dir = path.dirname(dbPath);
      if (dir && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db
        .prepare('CREATE TABLE IF NOT EXISTS instances (instance_id TEXT PRIMARY KEY, data TEXT)')
        .run();
    } catch (error) {
      this.db = null;
      // eslint-disable-next-line no-console
      console.warn(`[STORE] SQLite unavailable, using in-memory only: ${error.message}`);
    }
  }

  /** @returns {boolean} Whether persistence is active */
  get persistent() {
    return this.db !== null;
  }

  /**
   * Load all persisted instances.
   * @returns {Array<Object>} Parsed instance records
   */
  loadAll() {
    if (!this.db) return [];
    try {
      const rows = this.db.prepare('SELECT data FROM instances').all();
      return rows.map((row) => JSON.parse(row.data));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`[STORE] Failed to load instances: ${error.message}`);
      return [];
    }
  }

  /**
   * Insert or update an instance record.
   * @param {Object} instance - Instance data (must have instanceId)
   */
  upsert(instance) {
    if (!this.db || !instance?.instanceId) return;
    try {
      this.db
        .prepare(
          'INSERT INTO instances (instance_id, data) VALUES (?, ?) ' +
            'ON CONFLICT(instance_id) DO UPDATE SET data = excluded.data'
        )
        .run(instance.instanceId, JSON.stringify(instance));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`[STORE] Failed to persist instance ${instance.instanceId}: ${error.message}`);
    }
  }

  /** Close the database handle. */
  close() {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // ignore
      }
      this.db = null;
    }
  }
}

module.exports = InstanceStore;
