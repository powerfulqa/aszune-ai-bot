# Dashboard: Reminders

Page: `dashboard/public/reminder-management.html`. Lists every user's reminders and lets you create,
edit and delete them.

## What a reminder is

A reminder is a one-time message. At the scheduled time the bot posts it in a Discord channel and
pings the user. There are no recurring reminders, no pausing and no per-reminder history.

Users normally create reminders by asking the bot in chat. The dashboard is for looking at them and
for fixing or removing one.

## What it shows

A table with ID, message, scheduled time, status and type, and a filter for **Active Only** or
**Completed**.

## What you can do

All of these need `DASHBOARD_TOKEN`.

- **Create.** Fill in the message, the Discord user ID to ping, the Discord channel ID to post in,
  and the date and time. The picker uses your browser's local time.
- **Edit** the message of an active reminder. The page cannot change the time; to reschedule, delete
  the reminder and create a new one. (The `edit_reminder` socket event does accept a
  `scheduledTime`.)
- **Delete** a reminder.

Changes go through the bot's reminder service, so the running timer is updated straight away.

## Rules

- User ID and channel ID must be Discord IDs (17 to 20 digits). To copy one, enable Developer Mode
  in Discord, then right-click the user or channel and choose "Copy ID".
- The message must not be empty and may be at most 4096 characters.
- A user may have at most 25 active reminders.
- A reminder cannot be edited during the moment it is being delivered; try again a few seconds
  later.

## After a restart

Reminders are stored in SQLite (`data/bot.db`). At startup the bot re-arms every active reminder and
delivers any that came due while it was down.

## Access

Open `http://<host>:3000/` and pick **Reminders** in the header. The dashboard listens on
`127.0.0.1` unless `DASHBOARD_BIND_HOST` is set. If it is bound to anything other than loopback (for
example `DASHBOARD_BIND_HOST=0.0.0.0`), `DASHBOARD_TOKEN` is required even to read: without it every
API call and socket connection is refused and the page stays disconnected. Without `DASHBOARD_TOKEN`
the dashboard is read-only: create, edit and delete only work with a token. Set the token, then open
`http://<host>:3000/#token=YOUR_TOKEN` once; the browser remembers it.

## How it works

Socket.IO events: `request_reminders` (read; the server also accepts `filter_reminders`, which the
page does not use), `create_reminder`, `edit_reminder` and `delete_reminder` (need a token).
`GET /api/reminders` returns the list read-only. The handlers are in
`src/services/web-dashboard/handlers/reminderHandlers.js`.

## Troubleshooting

- **"userId and channelId must be Discord ids".** A name was entered where an ID is expected.
- **The reminder was created but never arrived.** The bot cannot see or post in that channel, or the
  channel ID belongs to another server.
- **Create, Edit and Delete are missing.** No token is set, so the dashboard is read-only.

## See Also

- [Dashboard overview](Dashboard-Features-Complete)
- [Dashboard API reference](../docs/DASHBOARD-API-REFERENCE-v1.9.0.md)
