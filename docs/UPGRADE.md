# Upgrade Guide

## Upgrading an existing deployment (in-place, e.g. the Raspberry Pi)

The modernization release changes the Node floor and several dependency majors, so a plain
`git pull` + restart is **not** enough — the existing `node_modules` and Node runtime must be
updated too. Do this over SSH; do **not** use the dashboard's "git pull" self-update button for this
upgrade (it pulls code but does not reinstall dependencies).

### 1. Check the Node version first (the #1 blocker)

```bash
node -v
```

The floor is now **>=22.19.0** (see `.nvmrc` = 24). If the host is on Node 20 or older, upgrade Node
**before** anything else — the new dependencies (better-sqlite3 13, undici 8, ESLint 10) will not
load on Node 20.

### 2. Set `TRACKING_ADMIN_KEY` before restarting

The tracking server previously fell back to a hardcoded default admin key. That default has been
removed, so **the tracking server (`Aszune-analytics`) now refuses to start without
`TRACKING_ADMIN_KEY`**. Add it to your environment / PM2 env. If you don't run the tracking server,
skip it and don't start that app.

### 3. Pull and reinstall dependencies (required)

```bash
cd /path/to/aszune-ai-bot
git status              # confirm a clean working tree, no local edits to tracked files
git checkout main      # if the host was on a different branch
git pull origin main
npm ci                 # REQUIRED: old node_modules is stale; also rebuilds the native
                       # better-sqlite3 binding for this platform (ARM64 on the Pi)
```

A plain `git pull` without `npm ci` will crash on startup — the new code expects the new dependency
majors.

### 4. Restart under PM2

```bash
pm2 restart aszune-ai        # canonical app name; and Aszune-analytics if you run it
pm2 logs aszune-ai           # confirm a clean startup
```

On the Pi, start via `start-pi-optimized.sh` if you are doing a full restart rather than a hot
`pm2 restart`.

### Notes

- **Your data is safe.** SQLite's on-disk format is stable across the better-sqlite3 12 -> 13 jump,
  so `data/bot.db` and `data/instances.db` are read as-is. No migration step is required.
- **Dashboard is read-only by default.** Destructive dashboard operations (service control, config
  editor, reminder edits) now require `DASHBOARD_TOKEN`. Set it, then open the dashboard once as
  `http://<host>:3000/?token=YOUR_TOKEN` (the token is saved in the browser).
- **Perplexity Agent API** stays OFF. Leave `USE_AGENT_API` unset — the Agent API path
  (`/v1/agent`) has not been validated against the live endpoint yet; the bot runs on the proven
  Chat Completions path by default.
- **Optional env vars:** `SEARCH_DOMAIN_FILTER` (comma-separated Perplexity allowlist) and
  `USE_AGENT_API` both default to off/empty and can be omitted.

### If startup fails

Capture the logs and work back from the first error:

```bash
pm2 logs aszune-ai --lines 100
```

Common causes: Node version below 22.19 (step 1), `node_modules` not reinstalled (step 3), or
`TRACKING_ADMIN_KEY` unset while the tracking server is enabled (step 2).
