const mockExecPromise = jest.fn();

jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

jest.mock('util', () => ({
  promisify: jest.fn(() => mockExecPromise),
}));

jest.mock('dns', () => ({
  promises: {
    resolve4: jest.fn(),
  },
}));

const dns = require('dns');
const NetworkDetector = require('../../../src/services/network-detector');

describe('NetworkDetector', () => {
  const originalPlatform = process.platform;
  const setPlatform = (value) => {
    Object.defineProperty(process, 'platform', {
      value,
      configurable: true,
    });
  };

  afterEach(() => {
    jest.clearAllMocks();
    setPlatform(originalPlatform);
  });

  afterAll(() => {
    setPlatform(originalPlatform);
  });

  it('returns the Linux gateway command when platform is linux', () => {
    setPlatform('linux');
    expect(NetworkDetector._getGatewayCommand()).toContain('ip route');
  });

  it('returns the Windows gateway command when platform is win32', () => {
    setPlatform('win32');
    expect(NetworkDetector._getGatewayCommand()).toContain('route print');
  });

  it('returns not detected when there is no gateway command', async () => {
    setPlatform('aix');
    const result = await NetworkDetector.detectGateway();
    expect(result).toEqual({ gatewayIp: 'Not detected', reachable: false });
  });

  it('detects the gateway when exec resolves with an IP', async () => {
    setPlatform('linux');
    mockExecPromise.mockResolvedValueOnce({ stdout: '192.168.0.1\n' });
    const result = await NetworkDetector.detectGateway();
    expect(result).toEqual({ gatewayIp: '192.168.0.1', reachable: true });
  });

  it('falls back when gateway detection fails', async () => {
    setPlatform('linux');
    mockExecPromise.mockRejectedValue(new Error('timeout'));
    const result = await NetworkDetector.detectGateway();
    expect(result).toEqual({ gatewayIp: 'Not detected', reachable: false });
  });

  it('parses DNS servers from resolv.conf on Linux', async () => {
    setPlatform('linux');
    mockExecPromise.mockResolvedValueOnce({
      stdout: 'nameserver 1.1.1.1\nnameserver 8.8.8.8\n',
    });
    const servers = await NetworkDetector.detectDnsServers();
    expect(servers).toEqual(['1.1.1.1', '8.8.8.8']);
  });

  it('detects DHCP from DietPi config', async () => {
    setPlatform('linux');
    const dietSpy = jest.spyOn(NetworkDetector, '_checkDietPiConfig').mockResolvedValue('DHCP');

    const result = await NetworkDetector.detectDhcpOrStatic();
    expect(result).toBe('DHCP');
    dietSpy.mockRestore();
  });

  it('reports DNS reachability when ping and resolve succeed', async () => {
    setPlatform('linux');
    mockExecPromise.mockResolvedValueOnce({ stdout: '' });
    dns.promises.resolve4.mockResolvedValue(['1.1.1.1']);

    const success = await NetworkDetector._testDns('1.1.1.1');
    expect(success).toBe(true);
  });

  it('reports DNS unreachable when ping fails', async () => {
    setPlatform('linux');
    mockExecPromise.mockRejectedValueOnce(new Error('ping fail'));
    const result = await NetworkDetector._testDns('1.1.1.1');
    expect(result).toBe(false);
  });

  it('ping test for internet returns true when reachable', async () => {
    setPlatform('linux');
    mockExecPromise.mockResolvedValueOnce({ stdout: '' });
    const online = await NetworkDetector._testInternet();
    expect(online).toBe(true);
  });

  it('ping test for internet returns false when ping fails', async () => {
    setPlatform('linux');
    mockExecPromise.mockRejectedValueOnce(new Error('timeout'));
    const online = await NetworkDetector._testInternet();
    expect(online).toBe(false);
  });

  it('assembles network status summary', async () => {
    const gatewaySpy = jest
      .spyOn(NetworkDetector, 'detectGateway')
      .mockResolvedValue({ gatewayIp: '1.2.3.4', reachable: true });
    const dnsSpy = jest.spyOn(NetworkDetector, 'detectDnsServers').mockResolvedValue(['8.8.8.8']);
    const ipSpy = jest.spyOn(NetworkDetector, 'detectDhcpOrStatic').mockResolvedValue('Static');
    const dnsTestSpy = jest.spyOn(NetworkDetector, '_testDns').mockResolvedValue(true);
    const internetSpy = jest.spyOn(NetworkDetector, '_testInternet').mockResolvedValue(false);

    const status = await NetworkDetector.getNetworkStatus();

    expect(status).toEqual({
      connected: true,
      internetReachable: false,
      dnsReachable: true,
      gatewayReachable: true,
      gatewayIp: '1.2.3.4',
      dnsServers: ['8.8.8.8'],
      ipAssignment: 'Static',
    });

    gatewaySpy.mockRestore();
    dnsSpy.mockRestore();
    ipSpy.mockRestore();
    dnsTestSpy.mockRestore();
    internetSpy.mockRestore();
  });
});
