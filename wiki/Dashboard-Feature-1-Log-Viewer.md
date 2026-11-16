# Dashboard: Log Viewer

Page: `dashboard/public/logs-viewer.html`. Shows the bot's recent log lines and adds new ones as
they are written.

## What it shows

- The last **500** log entries of the running bot process, held in memory. The buffer starts empty
  after every restart; older history is in `logs/bot.log` on the host.
- Each row has a timestamp, a level (Debug, Info, Warnings, Errors) and the message.
- Counters for total entries, errors and warnings, and the time of the last update.

## What you can do

- **Filter by level** with the level drop-down.
- **Search** the loaded entries by text. The search runs in the browser.
- **Pause** and resume auto-scrolling while new entries arrive.
- **Export** the loaded entries, at the selected level, as a CSV file.

The page has no clear button. The server accepts a `clear_logs` event (token required) that empties
the in-memory buffer for every open dashboard; it does not touch the log files on disk.

## Access

Open `http://<host>:3000/` and pick **Logs** in the header. The dashboard listens on `127.0.0.1`
unless `DASHBOARD_BIND_HOST` is set. This page only reads, so it works without a token.

## How it works

The page requests entries with the `request_logs` Socket.IO event (optional `level` and `limit`,
default 100) and receives each new line as a `new_log` event. `clear_logs` empties the buffer and
tells every client with `logs_cleared`. There is no REST or raw WebSocket log API. The handlers are
in `src/services/web-dashboard/handlers/logsHandlers.js`.

## Troubleshooting

- **The viewer is empty.** The bot has just restarted, or someone cleared the buffer. Read
  `logs/bot.log` or run `pm2 logs aszune-ai` for older lines.
- **No new lines appear.** Check the live-connection chip in the header; reload the page if it shows
  disconnected.
- **Debug lines are missing.** The bot only produces them when its log level allows it (see
  `PI_LOG_LEVEL` and `DEBUG` in `.env.example`).

## See Also

- [Dashboard overview](Dashboard-Features-Complete)
- [Dashboard API reference](../docs/DASHBOARD-API-REFERENCE-v1.9.0.md)
