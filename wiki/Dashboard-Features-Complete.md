# Dashboard Overview

The bot ships with a web dashboard for the person who runs it. It is an Express and Socket.IO server
inside the bot process (`src/services/web-dashboard.js`) that serves the static pages in
`dashboard/public/`.

## Opening it

- URL: `http://<host>:3000/`.
- By default it listens on `127.0.0.1` only. Set `DASHBOARD_BIND_HOST` to reach it from another
  machine.
- **Without `DASHBOARD_TOKEN` the dashboard is read-only** and answers only a browser on the same
  machine (add other hostnames with `DASHBOARD_ALLOWED_HOSTS`). Restart, git pull, service control,
  saving configuration, clearing logs and changing reminders all need the token.
- With a token set, open `http://<host>:3000/#token=YOUR_TOKEN` once. The browser stores the token;
  it is never sent in a URL the server or a proxy would log. Repeated wrong tokens from one address
  are throttled.

## Pages

| Page                                               | File                       | Purpose                                                                                 |
| -------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------- |
| Overview                                           | `index.html`               | System overview, recent activity, version, restart and git pull                         |
| [Logs](Dashboard-Feature-1-Log-Viewer)             | `logs-viewer.html`         | Last 500 log entries, live, with level filter and search                                |
| [Services](Dashboard-Feature-2-Service-Management) | `service-management.html`  | Discord connection, instance tracking, PM2 start, stop, restart                         |
| [Config](Dashboard-Feature-3-Config-Editor)        | `config-editor.html`       | Edit `.env` with secrets masked                                                         |
| [Network](Dashboard-Feature-5-Network-Status)      | `network-status.html`      | Interfaces, gateway, DNS and a connectivity test                                        |
| [Reminders](Dashboard-Feature-7-Reminders)         | `reminder-management.html` | List, create, edit and delete reminders                                                 |
| Commands                                           | `commands.html`            | What the slash commands output                                                          |
| Database                                           | `database.html`            | Read-only view of `user_stats`, `user_messages`, `conversation_history` and `reminders` |
| Error logs                                         | `error-logs.html`          | The most recent errors (up to 75, in memory)                                            |

## Layout

A slim sticky header carries the version, a live-connection chip and the page links. Pages are split
into sections that collapse and can be reordered; the choice is remembered per page in the browser.
Dark and light themes follow the operating system until you toggle them.

## Data sources

Everything shown is read from the running bot or the host at the time you look: process memory and
uptime, the SQLite database, PM2, the network interfaces. Nothing is sampled into a history, and
there is no demo data. A value the dashboard cannot read is shown as unavailable.

## Security summary

- Read-only by default; a token unlocks changes.
- The configuration editor can touch only `.env`, masks secrets, and refuses keys that would let an
  editor run code on the host.
- Service control accepts only allowlisted PM2 app names and never builds a shell command.
- The database view is limited to four fixed tables and cannot write.

## API

The pages use Socket.IO events for almost everything; a small set of REST endpoints remains. See
[the API reference](../docs/DASHBOARD-API-REFERENCE-v1.9.0.md).
