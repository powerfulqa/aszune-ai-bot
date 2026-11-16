# Dashboard: Service Management

Page: `dashboard/public/service-management.html`. Shows whether the bot is connected and lets you
restart it through PM2.

## What it shows

- **Discord Connection:** connected or not, the bot's tag, how long the Discord session has been up,
  and the number of servers it is in.
- **Instance Tracking:** this instance's ID, location and IP as reported to the tracking server,
  plus the list of known instances split into authorised and unauthorised.
- **Services:** the bot process, with its status and whether it starts at boot. Under PM2 the boot
  flag is always shown as enabled.

## What you can do

All of these need `DASHBOARD_TOKEN`.

- **Start, Stop, Restart** the bot's PM2 app. Only the bot can be controlled this way; any other
  name, including the tracking server's, is refused before PM2 is called.
- **Quick Actions:** "Restart all" and "Start all" run the matching `pm2` command for every app.
- **Approve or Revoke** an instance. The dashboard forwards the request to the tracking server using
  `TRACKING_ADMIN_KEY`. A revoked instance is not authorised again automatically.

The dashboard header also has a restart button and a "git pull" button (`POST /api/control/restart`,
`POST /api/control/git-pull`). Restart answers 409 when the bot is not running under PM2, because
nothing would start it again. The git-pull button updates code only; after a release that changes
dependencies, follow [the upgrade guide](../docs/UPGRADE.md) instead.

## Access

Open `http://<host>:3000/` and pick **Services** in the header. The dashboard listens on `127.0.0.1`
unless `DASHBOARD_BIND_HOST` is set. If it is bound to anything other than loopback (for example
`DASHBOARD_BIND_HOST=0.0.0.0`), `DASHBOARD_TOKEN` is required even to read: without it every API
call and socket connection is refused and the page stays disconnected. Without `DASHBOARD_TOKEN` the
dashboard is read-only: the actions above only work with a token. Set the token, then open
`http://<host>:3000/#token=YOUR_TOKEN` once; the browser remembers it.

## How it works

Socket.IO events: `request_services`, `request_discord_status`, `request_instance_status`,
`request_all_instances` (read) and `service_action`, `quick_service_action`, `instance_action` (need
a token). PM2 calls go through `src/utils/pm2-service.js`, which runs `pm2` with a fixed argument
list and never builds a shell command. The handlers are in
`src/services/web-dashboard/handlers/serviceHandlers.js`.

Service control is PM2 only. There is no systemd control and no per-service view of the bot's
internal parts (cache, database, reminders).

## Troubleshooting

- **A button does nothing or is missing.** No token is set, so the dashboard is read-only.
- **"Unknown or disallowed service".** Start, Stop and Restart accept only the bot, under the names
  `aszune-ai`, `aszune-ai-bot` or `aszune-bot` (`src/utils/pm2-service.js`). All three map to the
  bot's PM2 app, `aszune-ai` unless `PM2_APP_NAME` overrides it. `Aszune-analytics` cannot be
  controlled on its own from the dashboard; "Restart all" restarts it with everything else.
- **Restart returns 409.** The bot was started with `node` or `npm start`, not PM2.
- **The bot restarts every 15 seconds.** It is running under PM2 and systemd at once; keep one. See
  `scripts/diagnose-restart-loop.sh`.

## See Also

- [Dashboard overview](Dashboard-Features-Complete)
- [Dashboard API reference](../docs/DASHBOARD-API-REFERENCE-v1.9.0.md)
