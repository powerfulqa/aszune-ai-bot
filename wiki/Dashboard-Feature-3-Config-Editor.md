# Dashboard: Configuration Editor

Page: `dashboard/public/config-editor.html`. Edits the bot's `.env` file from the browser.

## What it does

- Opens **`.env`** for editing and **`.env.example`** for reference. No other file can be read or
  written.
- **Hides secrets.** Any value whose key looks like a credential (it contains `TOKEN`, `KEY`,
  `SECRET`, `PASSWORD`, `AUTH`, `WEBHOOK` and similar) reaches the browser as `********`, including
  in commented-out lines. Saving a line that still shows `********` keeps the stored value, so you
  can change one setting without retyping the others.
- **Validate** checks the text before you save: every non-comment line must have the form
  `KEY=value`.
- **Diff preview** shows your unsaved changes against the loaded file, and **Revert** discards them.
- **Export** downloads the editor text exactly as shown. Stored secrets appear as `********`, but
  anything you have typed into the editor, such as a replacement API key, is exported in clear text.
  Check the file before sharing it.
- **Save** (needs `DASHBOARD_TOKEN`) first copies the current file to `.env.backup.<timestamp>`
  beside it, then writes the new one.

A saved change takes effect after the bot restarts.

## Limits

- The file may be at most 64 KB.
- Keys that change how Node, PM2, git or the shell load code are refused, for example
  `NODE_OPTIONS`, `PATH`, `LD_PRELOAD`, `GIT_*`, `SSH_*` and `PM2_HOME`. With those, permission to
  edit configuration would become permission to run code on the host.
- Backups are plain copies and contain real secrets. They are ignored by git; delete old ones on the
  host when you no longer need them. The dashboard cannot list or restore them.
- There is no change history.

## Access

Open `http://<host>:3000/` and pick **Config** in the header. The dashboard listens on `127.0.0.1`
unless `DASHBOARD_BIND_HOST` is set. If it is bound to anything other than loopback (for example
`DASHBOARD_BIND_HOST=0.0.0.0`), `DASHBOARD_TOKEN` is required even to read: without it every API
call and socket connection is refused and the page stays disconnected. Without `DASHBOARD_TOKEN` the
dashboard is read-only: saving only works with a token. Set the token, then open
`http://<host>:3000/#token=YOUR_TOKEN` once; the browser remembers it.

## How it works

Socket.IO events: `request_config`, `validate_config` and `save_config`. The handlers are in
`src/services/web-dashboard/handlers/configHandlers.js`.

## Troubleshooting

- **"Access denied".** The file is not `.env` or `.env.example`.
- **A save is refused for one key.** The key is on the blocked list above. Set it in the PM2
  environment on the host instead if you really need it.
- **A setting did not change.** Restart the bot; `.env` is read at startup.
- **To restore a backup,** copy the `.env.backup.<timestamp>` file over `.env` on the host and
  restart.

## See Also

- [Dashboard overview](Dashboard-Features-Complete)
- [Dashboard API reference](../docs/DASHBOARD-API-REFERENCE-v1.9.0.md)
