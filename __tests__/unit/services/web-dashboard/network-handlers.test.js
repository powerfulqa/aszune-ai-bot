/**
 * Socket handlers for the network page: status payload, ping argv and the
 * connectivity test report. child_process, dns, os and the gateway detector
 * are mocked, so nothing touches the network.
 */

jest.mock('../../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('child_process', () => ({
  exec: jest.fn(),
  execFile: jest.fn(),
  spawn: jest.fn(),
}));
jest.mock('dns', () => ({ promises: { resolve4: jest.fn() } }));
jest.mock('../../../../src/services/network-detector', () => ({
  detectGateway: jest.fn(),
  detectDnsServers: jest.fn(),
  getNetworkStatus: jest.fn(),
}));

const os = require('os');

// jest.setup.js resets modules before each test: take mock references after requiring.
let childProcess;
let dns;
let NetworkDetector;
let handlers;

const LOOPBACK = [
  { family: 'IPv4', address: '127.0.0.1', internal: true, mac: '00:00:00:00:00:00' },
];
const ETH0 = [
  { family: 'IPv4', address: '192.168.1.20', internal: false, mac: 'aa:bb:cc:dd:ee:ff' },
];

const realPlatform = process.platform;
const setPlatform = (value) => Object.defineProperty(process, 'platform', { value });

const ok = (file, args, opts, cb) => cb(null, { stdout: '', stderr: '' });

/** [file, args, options] of every spawn so far */
const spawned = () =>
  childProcess.execFile.mock.calls.map(([file, args, opts]) => [file, args, opts]);
const pingArgv = (host) => ['ping', ['-c', '1', host], { timeout: 3000 }];

beforeEach(() => {
  jest.clearAllMocks();
  childProcess = require('child_process');
  dns = require('dns');
  NetworkDetector = require('../../../../src/services/network-detector');
  handlers = require('../../../../src/services/web-dashboard/handlers/networkHandlers');
  childProcess.execFile.mockImplementation(ok);
  jest.spyOn(os, 'hostname').mockReturnValue('pi-test');
  jest.spyOn(os, 'platform').mockReturnValue('linux');
  jest.spyOn(os, 'arch').mockReturnValue('arm64');
  jest.spyOn(os, 'networkInterfaces').mockReturnValue({ lo: LOOPBACK, eth0: ETH0 });
  setPlatform('linux');
});

afterEach(() => {
  jest.restoreAllMocks();
  setPlatform(realPlatform);
});

describe('handleNetworkStatus', () => {
  const dashboard = (overrides) => ({
    getExternalIp: jest.fn().mockResolvedValue('203.0.113.9'),
    getNetworkStatus: jest.fn().mockResolvedValue({ online: true }),
    ...overrides,
  });

  const interfaces = [
    {
      name: 'lo',
      ipv4: '127.0.0.1',
      ipv6: null,
      mac: '00:00:00:00:00:00',
      internal: true,
      status: 'LOOPBACK',
    },
    {
      name: 'eth0',
      ipv4: '192.168.1.20',
      ipv6: null,
      mac: 'aa:bb:cc:dd:ee:ff',
      internal: false,
      status: 'UP',
    },
  ];

  it('sends the exact status payload', async () => {
    NetworkDetector.detectGateway.mockResolvedValue({ gatewayIp: '192.168.1.1', reachable: true });
    const callback = jest.fn();

    await handlers.handleNetworkStatus(dashboard(), callback);

    expect(callback).toHaveBeenCalledTimes(1);
    const payload = callback.mock.calls[0][0];
    expect(typeof payload.timestamp).toBe('string');
    expect(payload).toEqual({
      hostname: 'pi-test',
      localIp: '192.168.1.20',
      gateway: '192.168.1.1',
      gatewayStatus: true,
      externalIp: '203.0.113.9',
      interfaces,
      connectivity: { online: true },
      timestamp: payload.timestamp,
    });
  });

  it('uses null for an undetected gateway and a failed external lookup, localhost without a LAN address', async () => {
    NetworkDetector.detectGateway.mockResolvedValue({
      gatewayIp: 'Not detected',
      reachable: false,
    });
    os.networkInterfaces.mockReturnValue({ lo: LOOPBACK });
    const callback = jest.fn();

    await handlers.handleNetworkStatus(
      dashboard({ getExternalIp: jest.fn().mockRejectedValue(new Error('offline')) }),
      callback
    );

    const payload = callback.mock.calls[0][0];
    expect(payload).toEqual({
      hostname: 'pi-test',
      localIp: 'localhost',
      gateway: null,
      gatewayStatus: false,
      externalIp: null,
      interfaces: [interfaces[0]],
      connectivity: { online: true },
      timestamp: payload.timestamp,
    });
  });

  it('answers a failure with only the error message', async () => {
    NetworkDetector.detectGateway.mockRejectedValue(new Error('detect failed'));
    const callback = jest.fn();

    await handlers.handleNetworkStatus(dashboard(), callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ error: 'detect failed' });
  });
});

describe('pingOnce', () => {
  it.each([
    ['linux', ['-c', '1', '9.9.9.9']],
    ['win32', ['-n', '1', '9.9.9.9']],
  ])('on %s runs ping with separate arguments', async (platform, args) => {
    setPlatform(platform);

    expect(await handlers.pingOnce('9.9.9.9')).toBe(true);
    expect(spawned()).toEqual([['ping', args, { timeout: 3000 }]]);
  });

  it('is false when ping fails', async () => {
    childProcess.execFile.mockImplementation((file, args, opts, cb) => cb(new Error('timeout')));
    expect(await handlers.pingOnce('9.9.9.9')).toBe(false);
  });
});

describe('handleNetworkTest', () => {
  const SUITE = [
    '=== NETWORK CONNECTIVITY TEST SUITE ===\n',
    'Test 1: Gateway Connectivity',
    '✓ Gateway (192.168.1.1) is reachable\n',
    'Test 2: DNS Server Detection & Testing',
    '  Detected DNS Servers: 192.168.1.1, 9.9.9.9',
    '  ✓ DNS Server 192.168.1.1 is reachable',
    '  ✗ DNS Server 9.9.9.9 not reachable',
    '  ✓ At least one DNS server is accessible\n',
    'Test 3: DNS Resolution Test',
    '✓ DNS resolution working (google.com → 142.250.1.1)\n',
    'Test 4: Internet Connectivity',
    '✓ Google DNS (8.8.8.8) is reachable',
    '✗ Cloudflare DNS (1.1.1.1) not reachable',
    '',
    'Test 5: Network Configuration',
    '  Hostname: pi-test',
    '  Platform: linux',
    '  Architecture: arm64',
    '  Active Interfaces: eth0',
    '\n=== TEST SUITE COMPLETE ===',
  ];

  // The dashboard has no DNS detection of its own; the handler must ask the detector.
  const dashboard = () => ({});

  beforeEach(() => {
    NetworkDetector.detectDnsServers.mockResolvedValue(['192.168.1.1', '9.9.9.9']);
    NetworkDetector.detectGateway.mockResolvedValue({ gatewayIp: '192.168.1.1', reachable: true });
    dns.promises.resolve4.mockResolvedValue(['142.250.1.1']);
    // Everything answers except 9.9.9.9 and 1.1.1.1
    childProcess.execFile.mockImplementation((file, args, opts, cb) =>
      ['9.9.9.9', '1.1.1.1'].includes(args[2])
        ? cb(new Error('no reply'))
        : ok(file, args, opts, cb)
    );
  });

  it('runs every test and sends the exact report', async () => {
    const callback = jest.fn();

    await handlers.handleNetworkTest(dashboard(), {}, callback);

    expect(callback).toHaveBeenCalledTimes(1);
    const payload = callback.mock.calls[0][0];
    expect(typeof payload.timestamp).toBe('string');
    expect(payload).toEqual({
      success: true,
      message: 'Network test completed',
      results: SUITE.join('\n'),
      timestamp: payload.timestamp,
    });
    expect(dns.promises.resolve4).toHaveBeenCalledWith('google.com');
  });

  it('pings the gateway, each DNS server and the two public hosts without a shell', async () => {
    await handlers.handleNetworkTest(dashboard(), {}, jest.fn());

    expect(spawned()).toEqual(
      ['192.168.1.1', '192.168.1.1', '9.9.9.9', '8.8.8.8', '1.1.1.1'].map(pingArgv)
    );
    expect(childProcess.exec).not.toHaveBeenCalled();
  });

  it('reports a missing gateway, failed DNS detection and failed resolution inside the report', async () => {
    NetworkDetector.detectGateway.mockResolvedValue({ gatewayIp: 'Not detected' });
    dns.promises.resolve4.mockRejectedValue(new Error('ESERVFAIL'));
    const callback = jest.fn();

    NetworkDetector.detectDnsServers.mockRejectedValue(new Error('no resolv.conf'));
    await handlers.handleNetworkTest(dashboard(), {}, callback);

    const { success, results } = callback.mock.calls[0][0];
    expect(success).toBe(true);
    expect(results.split('\n')).toEqual([
      '=== NETWORK CONNECTIVITY TEST SUITE ===',
      '',
      'Test 1: Gateway Connectivity',
      '✗ Gateway not detected',
      '',
      'Test 2: DNS Server Detection & Testing',
      '✗ DNS detection failed: no resolv.conf',
      '',
      'Test 3: DNS Resolution Test',
      '✗ DNS resolution failed: ESERVFAIL',
      '',
      'Test 4: Internet Connectivity',
      '✓ Google DNS (8.8.8.8) is reachable',
      '✗ Cloudflare DNS (1.1.1.1) not reachable',
      '',
      'Test 5: Network Configuration',
      '  Hostname: pi-test',
      '  Platform: linux',
      '  Architecture: arm64',
      '  Active Interfaces: eth0',
      '',
      '=== TEST SUITE COMPLETE ===',
    ]);
  });

  it('reports a failed gateway ping inside the report and still succeeds', async () => {
    childProcess.execFile.mockImplementation((file, args, opts, cb) => cb(new Error('no reply')));
    const callback = jest.fn();

    await handlers.handleNetworkTest(dashboard(), {}, callback);

    const { success, results } = callback.mock.calls[0][0];
    expect(success).toBe(true);
    expect(results).toContain('✗ Gateway ping failed: no reply\n');
    expect(results).toContain('  ✗ No DNS servers are reachable\n');
  });

  it('answers an unexpected failure with success:false and the message', async () => {
    os.hostname.mockImplementation(() => {
      throw new Error('hostname unavailable');
    });
    const callback = jest.fn();

    await handlers.handleNetworkTest(dashboard(), {}, callback);

    expect(callback).toHaveBeenCalledTimes(1);
    const payload = callback.mock.calls[0][0];
    expect(payload).toEqual({
      success: false,
      error: 'hostname unavailable',
      timestamp: payload.timestamp,
    });
  });
});

describe('registerNetworkHandlers', () => {
  it('registers both network events', () => {
    const socket = { on: jest.fn() };
    handlers.registerNetworkHandlers(socket, {});
    expect(socket.on.mock.calls.map(([event]) => event)).toEqual([
      'request_network_status',
      'request_network_test',
    ]);
  });
});
