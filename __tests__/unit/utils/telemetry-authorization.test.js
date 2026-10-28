/**
 * Telemetry must only mark the session verified for an AUTHORIZED instance,
 * so session-validator keeps degrading replies for unapproved instances.
 */

jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/metrics/perf-monitor', () => ({
  captureEnvironment: jest.fn().mockResolvedValue(undefined),
}));

const telemetry = require('../../../src/utils/metrics/telemetry');
const analyticsCore = require('../../../src/utils/metrics/analytics-core');
const verificationState = require('../../../src/utils/metrics/verification-state');

describe('telemetry authorization gate', () => {
  afterEach(async () => {
    // Unverify first so shutdown() sends no network beacon
    analyticsCore.markUnverified();
    await telemetry.shutdown();
  });

  it('does not mark verified when the tracker knows the instance but has not authorized it', async () => {
    verificationState.markVerified('inst_pending', 'instance-tracker');
    verificationState.markAuthorized(false);

    const result = await telemetry.initialize({});

    expect(result).toBe(false);
    expect(analyticsCore.isVerified()).toBe(false);
  });

  it('marks verified when the instance is authorized', async () => {
    verificationState.markVerified('inst_ok', 'instance-tracker');
    verificationState.markAuthorized(true);

    const result = await telemetry.initialize({});

    expect(result).toBe(true);
    expect(analyticsCore.isVerified()).toBe(true);
  });
});
