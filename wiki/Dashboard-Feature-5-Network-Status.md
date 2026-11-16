# Dashboard: Network Status

Page: `dashboard/public/network-status.html`. Shows how the host is connected and runs a
connectivity test on request.

## What it shows

- **IP addresses:** hostname, local IP, external IP and gateway.
- **Connectivity:** whether the gateway answers.
- **Statistics:** number of interfaces, how many are active, and IPv4 and IPv6 address counts.
- **DNS configuration** and whether the address comes from DHCP or is static.
- **Interfaces:** name, status, IPv4, IPv6 and MAC address of each.

The external IP is looked up from a public service with a 5 second timeout and shows as unknown when
that fails.

## Run Full Test Suite

The button runs five checks on the host and prints the result as text:

1. Gateway reachable.
2. DNS servers detected, each pinged once.
3. DNS resolution of `google.com`.
4. Internet reachable: one ping each to `8.8.8.8` and `1.1.1.1`.
5. Hostname, platform, architecture and active interfaces.

Each ping has a 3 second timeout. The targets are fixed; the page cannot ping a host you choose.

There is no latency, packet-loss or bandwidth measurement and no history.

## Access

Open `http://<host>:3000/` and pick **Network** in the header. The dashboard listens on `127.0.0.1`
unless `DASHBOARD_BIND_HOST` is set. If it is bound to anything other than loopback (for example
`DASHBOARD_BIND_HOST=0.0.0.0`), `DASHBOARD_TOKEN` is required even to read: without it every API
call and socket connection is refused and the page stays disconnected. This page only reads, so on a
loopback bind it works without a token.

## How it works

Socket.IO events: `request_network_status` and `request_network_test`. The handlers are in
`src/services/web-dashboard/handlers/networkHandlers.js`; detection lives in
`src/services/network-detector.js`.

## Troubleshooting

- **Gateway shows as not detected.** The host has no default route, or the tool used to read it is
  missing. Check `ip route` on the host.
- **Pings fail but the bot works.** ICMP may be blocked, or the `ping` command is missing from a
  minimal image. The bot itself only needs outbound HTTPS.
- **External IP is unknown.** The lookup timed out; it is retried on the next refresh.

## See Also

- [Dashboard overview](Dashboard-Features-Complete)
- [Dashboard API reference](../docs/DASHBOARD-API-REFERENCE-v1.9.0.md)
