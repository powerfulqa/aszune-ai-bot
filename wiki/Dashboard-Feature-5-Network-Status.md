# Dashboard Feature 5: Network & Connectivity Status

**Version:** v1.9.0 | **Status:** Production Ready | **Last Updated:** 2024

## Overview

The Network & Connectivity Status dashboard provides comprehensive monitoring of network interfaces,
internet connectivity, and connection quality. Ideal for Raspberry Pi deployments and remote systems
where network reliability is critical.

## Features

### Core Capabilities

- **Interface Monitoring:** Real-time IP addresses and status for all network interfaces (Ethernet,
  WiFi, etc.)
- **Public IP Detection:** Automatic detection and display of public-facing IP address
- **Connectivity Checks:** Ping tests to multiple endpoints for reliable internet detection
- **Connection Quality:** Latency measurements and signal strength metrics
- **DNS Resolution:** Test DNS server functionality and resolution times
- **Historical Data:** Track network status trends over 24-hour period
- **Bandwidth Monitoring:** Track upload/download speeds
- **Gateway Information:** Display default gateway and route information
- **Firewall Status:** Show open ports and connection states

## Features Explained

### Network Interfaces

#### Ethernet Interface (eth0)

```
Display:
- Interface name: eth0
- Status: UP/DOWN
- IP Address: 192.168.1.100
- Subnet Mask: 255.255.255.0
- MAC Address: b8:27:eb:ab:cd:ef
- Speed: 1000 Mbps (if available)
- RX Bytes: 2.5 GB
- TX Bytes: 1.2 GB
```

#### WiFi Interface (wlan0)

```
Display:
- Interface name: wlan0
- Status: UP/DOWN
- IP Address: 192.168.1.101
- Subnet Mask: 255.255.255.0
- MAC Address: aa:bb:cc:dd:ee:ff
- Signal Strength: -42 dBm (excellent)
- Link Quality: 70/70
- SSID: MyNetwork
- Speed: 72 Mbps
```

### Connectivity Detection

#### Internet Connectivity

```
Tests connectivity to:
1. Google Public DNS (8.8.8.8)
2. Cloudflare DNS (1.1.1.1)
3. GitHub (github.com)
4. Perplexity API (api.perplexity.ai)

Status indicators:
- Connected: ✓ All endpoints reachable
- Partial: ⚠ Some endpoints unreachable
- Disconnected: ✗ No connectivity
```

#### Public IP Detection

```
Retrieves and displays:
- Public IPv4 address
- Public IPv6 address (if available)
- IP geolocation (country, region)
- ISP information
- Connection type (residential, commercial, etc.)
```

### Quality Metrics

#### Latency (Ping)

```
Measures round-trip time to:
- Google DNS: ~15ms (excellent)
- Cloudflare DNS: ~12ms (excellent)
- GitHub: ~25ms (good)
- Perplexity API: ~45ms (acceptable)

Color coding:
- < 50ms: Green (excellent)
- 50-100ms: Yellow (good)
- 100-200ms: Orange (acceptable)
- > 200ms: Red (poor)
```

#### Packet Loss

```
Shows packet loss percentage:
- 0%: No loss (excellent)
- 1-5%: Acceptable
- 5-10%: Degraded
- > 10%: Poor connection quality
```

#### Signal Strength (WiFi)

```
For WiFi interfaces only:
- -30 dBm: Excellent
- -67 dBm: Good
- -70 dBm: Fair
- -80 dBm: Weak
- < -80 dBm: Very poor
```

## Usage Guide

### Accessing Network Dashboard

1. Start the bot: `npm start` or `npm run dev`
2. Navigate to `http://localhost:3000/dashboard`
3. Click on **Network & Connectivity Status** or navigate to `/network`

### Monitoring Network Health

#### Daily Health Checks

```
Each morning verify:
1. All interfaces show UP status
2. Each interface has valid IP address
3. Public IP address matches expected value
4. Internet connectivity shows CONNECTED
5. Latency to all endpoints < 100ms
6. Packet loss < 1%
```

#### Identifying Network Issues

```
Slow bot performance may indicate:
1. Check latency to Perplexity API
2. Verify no packet loss
3. Check WiFi signal strength if wireless
4. Review bandwidth usage
5. Look for packet retransmissions
```

#### WiFi Optimisation

```
If WiFi connection is weak:
1. Check signal strength in dB (aim for > -60dBm)
2. Verify SSID and connection status
3. Consider moving closer to router
4. Check for interference on 2.4GHz/5GHz
5. Consider Ethernet alternative for stability
```

### Bandwidth Analysis

#### Monitor Throughput

```
1. View RX Bytes: Data received
2. View TX Bytes: Data transmitted
3. Calculate rate: (Current - Previous) / Time interval
4. Identify peak usage periods
5. Troubleshoot if slower than expected
```

#### Historical Trends

```
1. Check 24-hour graph
2. Identify peak usage times
3. Look for traffic patterns
4. Detect anomalies or spikes
5. Plan maintenance during low usage
```

## API Reference

### REST Endpoints

#### Get Network Status

```http
GET /api/network/status
```

**Response:**

```json
{
  "success": true,
  "connectivity": {
    "status": "connected",
    "publicIp": "203.0.113.42",
    "publicIpv6": "2001:db8::1",
    "geolocation": {
      "country": "US",
      "region": "California",
      "city": "San Francisco"
    }
  },
  "interfaces": [
    {
      "name": "eth0",
      "status": "UP",
      "ip": "192.168.1.100",
      "ipv6": "fe80::1",
      "mac": "b8:27:eb:ab:cd:ef",
      "subnet": "255.255.255.0",
      "speed": 1000,
      "rxBytes": 2684354560,
      "txBytes": 1288490240
    },
    {
      "name": "wlan0",
      "status": "DOWN",
      "ip": null,
      "mac": "aa:bb:cc:dd:ee:ff",
      "signal": -68,
      "linkQuality": 65
    }
  ]
}
```

#### Get Connectivity Details

```http
GET /api/network/connectivity
```

**Response:**

```json
{
  "success": true,
  "connected": true,
  "endpoints": [
    {
      "host": "8.8.8.8",
      "name": "Google DNS",
      "reachable": true,
      "latency": 15,
      "packetLoss": 0
    },
    {
      "host": "1.1.1.1",
      "name": "Cloudflare DNS",
      "reachable": true,
      "latency": 12,
      "packetLoss": 0
    },
    {
      "host": "api.perplexity.ai",
      "name": "Perplexity API",
      "reachable": true,
      "latency": 45,
      "packetLoss": 0
    }
  ],
  "overallStatus": "healthy"
}
```

#### Get Interface Details

```http
GET /api/network/interfaces/:name
```

**Response:**

```json
{
  "success": true,
  "interface": {
    "name": "eth0",
    "type": "ethernet",
    "status": "UP",
    "ip": "192.168.1.100",
    "ipv6": "fe80::1",
    "mac": "b8:27:eb:ab:cd:ef",
    "subnet": "255.255.255.0",
    "gateway": "192.168.1.1",
    "broadcast": "192.168.1.255",
    "speed": 1000,
    "mtu": 1500,
    "flags": ["UP", "BROADCAST", "RUNNING", "MULTICAST"],
    "stats": {
      "rxBytes": 2684354560,
      "rxPackets": 3245678,
      "rxErrors": 0,
      "rxDropped": 0,
      "txBytes": 1288490240,
      "txPackets": 2156789,
      "txErrors": 0,
      "txDropped": 0
    }
  }
}
```

#### Get Ping Statistics

```http
GET /api/network/ping/:host
```

**Response:**

```json
{
  "success": true,
  "host": "api.perplexity.ai",
  "statistics": {
    "sent": 4,
    "received": 4,
    "loss": 0,
    "minTime": 42,
    "maxTime": 48,
    "avgTime": 45,
    "stdDev": 2.2
  }
}
```

#### Get DNS Status

```http
GET /api/network/dns
```

**Response:**

```json
{
  "success": true,
  "dns": {
    "servers": ["8.8.8.8", "1.1.1.1"],
    "tests": [
      {
        "domain": "google.com",
        "resolved": "142.250.185.46",
        "resolutionTime": 12,
        "status": "success"
      }
    ]
  }
}
```

### WebSocket Connection

**Endpoint:** `ws://localhost:3000/ws/network`

**Real-Time Updates:**

```javascript
// Server sends network updates every 5 seconds
{
  "type": "network_update",
  "data": {
    "timestamp": "2024-01-15T10:35:00Z",
    "connectivity": "connected",
    "latency": 45,
    "packetLoss": 0,
    "publicIp": "203.0.113.42",
    "interfaces": [
      { "name": "eth0", "status": "UP", "traffic": { "rx": 1024, "tx": 512 } }
    ]
  }
}
```

## Network Troubleshooting

### No Internet Connectivity

```
Steps to diagnose:
1. Check interfaces show UP status
2. Verify interfaces have IP addresses
3. Check connectivity endpoints - which are unreachable?
4. Test DNS resolution
5. Ping gateway: 192.168.1.1
6. Check firewall rules
7. Restart router if all else fails
```

### High Latency

```
If latency > 200ms:
1. Check number of hops to target (tracert/traceroute)
2. Verify no packet loss
3. Check WiFi signal strength
4. Test on Ethernet to isolate WiFi issues
5. Check for heavy traffic/downloads
6. Verify ISP isn't throttling connection
7. Contact ISP if latency persists
```

### Packet Loss

```
If packet loss > 1%:
1. Test from different host to isolate
2. Check for WiFi interference
3. Verify cable connections
4. Check for failing router
5. Test on wired connection first
6. Update network drivers if on Linux
7. Consider equipment replacement if persistent
```

### DNS Resolution Failure

```
If DNS tests fail:
1. Verify DNS servers configured
2. Test with alternate DNS (8.8.8.8)
3. Check if ISP DNS blocking queries
4. Verify firewall allows DNS (port 53)
5. Restart network services
6. Check /etc/resolv.conf (Linux) or network settings
```

### WiFi Connection Issues

```
If WiFi signal is weak:
1. Check signal strength (aim for > -60 dBm)
2. Verify you're connected to correct SSID
3. Move closer to router
4. Check for interference from microwaves, cordless phones
5. Try 5GHz instead of 2.4GHz
6. Consider WiFi extender or mesh network
7. Update WiFi driver
```

## Integration Examples

### Monitor Raspberry Pi Network

```
1. Daily check at 8am
2. Verify eth0 or wlan0 UP
3. Confirm public IP correct
4. Check API latency < 100ms
5. Alert if packet loss detected
6. Track internet reliability
```

### Diagnose Slow Bot

```
1. Check Perplexity API latency
2. Verify no packet loss to API
3. Check WiFi signal if wireless
4. Measure actual throughput
5. Compare with ISP speedtest
6. Identify network bottleneck
```

### Network Performance Trending

```
1. Track daily latency average
2. Record WiFi signal strength
3. Monitor packet loss trends
4. Identify peak usage times
5. Plan network upgrades if needed
6. Document improvements
```

## Backend Implementation

**File:** `src/services/web-dashboard.js`

**Key Methods:**

- `setupNetworkRoutes()` - Initialize network endpoints
- `getNetworkInterfaces()` - Query all network interfaces
- `checkConnectivity()` - Test endpoint reachability
- `pingHost()` - Perform ping tests
- `getPublicIp()` - Detect public IP address
- `monitorBandwidth()` - Track network throughput
- `getDnsStatus()` - Verify DNS functionality

**Configuration:**

```javascript
NETWORK: {
  CHECK_INTERVAL: 30000, // 30 seconds
  PING_TIMEOUT: 5000, // 5 seconds
  CONNECTIVITY_ENDPOINTS: [
    '8.8.8.8',
    '1.1.1.1',
    'github.com',
    'api.perplexity.ai'
  ],
  HISTORY_RETENTION: 86400000 // 24 hours
}
```

## Performance Optimisation

### WiFi Tips for Raspberry Pi

```
1. Use 5GHz band if available (less interference)
2. Position antenna at right angles (try multiple orientations)
3. Keep away from metal objects
4. Avoid channels shared with neighbors
5. Consider wired Ethernet for stability
```

### Network Tuning

```
Increase buffer sizes:
- net.core.rmem_max = 134217728
- net.core.wmem_max = 134217728

Enable TCP window scaling:
- net.ipv4.tcp_window_scaling = 1

Increase connection backlog:
- net.core.somaxconn = 1024
```

## Advanced Topics

### Bandwidth Shaping

```javascript
// Limit bot traffic to prevent network saturation
BANDWIDTH_LIMITS: {
  MAX_DOWNLOAD: 10, // Mbps
  MAX_UPLOAD: 5,    // Mbps
  BURST_ALLOWED: true
}
```

### Route Monitoring

```bash
# View default route
ip route show

# Add alternate route for failover
ip route add 8.8.8.8 via 192.168.1.1 dev eth0
```

## See Also

- [Dashboard Feature 1: Log Viewer](Dashboard-Feature-1-Log-Viewer.md)
- [Dashboard Feature 2: Service Management](Dashboard-Feature-2-Service-Management.md)
- [Dashboard Feature 7: Reminder Management](Dashboard-Feature-7-Reminders.md)
- [Pi Optimisation Guide](Pi-Optimization-Guide.md)
- [Deployment Guide](Deployment-Guide.md)

## Demo

Interactive page: [`network-status.html`](../dashboard/public/network-status.html)

Launch with: `npm start` → Navigate to `http://localhost:3000/dashboard` → Select "Network &
Connectivity Status"
