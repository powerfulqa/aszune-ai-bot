/**
 * Regression tests for network socket handlers
 * (src/services/web-dashboard/handlers/networkHandlers.js).
 *
 * `handleNetworkStatus` previously called `dashboard.detectGateway()`, a method
 * that does not exist on the dashboard service, throwing
 * "TypeError: dashboard.detectGateway is not a function" at runtime and leaving
 * the dashboard's network panel blank. Gateway detection lives on
 * NetworkDetector; these tests lock in that the handler uses it.
 */

jest.mock('../../../src/services/network-detector', () => ({
  detectGateway: jest.fn().mockResolvedValue({ gatewayIp: '192.168.1.1', reachable: true }),
}));

jest.mock('../../../src/utils/system-info', () => ({
  buildNetworkInterfaces: jest
    .fn()
    .mockResolvedValue([{ name: 'eth0', internal: false, ipv4: '192.168.1.5' }]),
}));

const NetworkDetector = require('../../../src/services/network-detector');
const { handleNetworkStatus } = require('../../../src/services/web-dashboard/handlers/networkHandlers');

describe('networkHandlers.handleNetworkStatus (gateway detection regression)', () => {
  function makeDashboard() {
    return {
      getNetworkStatus: jest.fn().mockResolvedValue({ connected: true }),
      getExternalIp: jest.fn().mockResolvedValue('203.0.113.10'),
    };
  }

  it('uses NetworkDetector.detectGateway (not a dashboard method) and returns gateway data', async () => {
    const dashboard = makeDashboard();
    const callback = jest.fn();

    await handleNetworkStatus(dashboard, callback);

    expect(NetworkDetector.detectGateway).toHaveBeenCalled();
    expect(callback).toHaveBeenCalledTimes(1);
    const payload = callback.mock.calls[0][0];
    expect(payload.gateway).toBe('192.168.1.1');
    expect(payload.gatewayStatus).toBe(true);
    // A regression (calling dashboard.detectGateway) would surface as an error payload.
    expect(payload.error).toBeUndefined();
  });

  it('does not depend on a detectGateway method existing on the dashboard service', async () => {
    // Dashboard intentionally has no detectGateway method.
    const dashboard = makeDashboard();
    const callback = jest.fn();

    await expect(handleNetworkStatus(dashboard, callback)).resolves.toBeUndefined();
    expect(callback.mock.calls[0][0].error).toBeUndefined();
  });
});
