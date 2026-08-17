/**
 * Tests for dashboard Socket.IO authentication and destructive-handler gating.
 */

jest.mock('../../../../src/services/database', () => ({}));
jest.mock('../../../../src/utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  registerServiceHandlers,
} = require('../../../../src/services/web-dashboard/handlers/serviceHandlers');
const {
  registerReminderHandlers,
} = require('../../../../src/services/web-dashboard/handlers/reminderHandlers');
const {
  registerConfigHandlers,
} = require('../../../../src/services/web-dashboard/handlers/configHandlers');

function makeFakeSocket() {
  const events = new Set();
  return {
    id: 'sock-1',
    handshake: { auth: {}, headers: {} },
    on: (event) => events.add(event),
    events,
  };
}

describe('WebDashboardService token verification', () => {
  let service;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.DASHBOARD_TOKEN;
    const WebDashboardService = require('../../../../src/services/web-dashboard');
    // Module exports a singleton instance
    service = WebDashboardService;
  });

  it('_verifyToken allows any value when no token configured', () => {
    service.authToken = null;
    expect(service._verifyToken('anything')).toBe(true);
    expect(service._verifyToken(undefined)).toBe(true);
  });

  it('_verifyToken accepts the exact token and rejects others', () => {
    service.authToken = 'correct-horse-battery-staple';
    expect(service._verifyToken('correct-horse-battery-staple')).toBe(true);
    expect(service._verifyToken('wrong')).toBe(false);
    expect(service._verifyToken('')).toBe(false);
    expect(service._verifyToken(undefined)).toBe(false);
  });

  it('_authorizeSocket passes through when no token configured', () => {
    service.authToken = null;
    const next = jest.fn();
    service._authorizeSocket(makeFakeSocket(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('_authorizeSocket rejects a socket without the token', () => {
    service.authToken = 'secret';
    const next = jest.fn();
    service._authorizeSocket(makeFakeSocket(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('_authorizeSocket accepts a socket with the token in handshake auth', () => {
    service.authToken = 'secret';
    const next = jest.fn();
    const socket = makeFakeSocket();
    socket.handshake.auth.token = 'secret';
    service._authorizeSocket(socket, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('_authorizeSocket accepts a bearer Authorization header', () => {
    service.authToken = 'secret';
    const next = jest.fn();
    const socket = makeFakeSocket();
    socket.handshake.headers.authorization = 'Bearer secret';
    service._authorizeSocket(socket, next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('destructive handler gating', () => {
  it('config handlers omit save_config when writes are disallowed', () => {
    const readonly = makeFakeSocket();
    registerConfigHandlers(readonly, {}, { allowWrite: false });
    expect(readonly.events.has('request_config')).toBe(true);
    expect(readonly.events.has('validate_config')).toBe(true);
    expect(readonly.events.has('save_config')).toBe(false);

    const writable = makeFakeSocket();
    registerConfigHandlers(writable, {}, { allowWrite: true });
    expect(writable.events.has('save_config')).toBe(true);
  });

  it('service handlers omit control actions when control is disallowed', () => {
    const readonly = makeFakeSocket();
    registerServiceHandlers(readonly, {}, { allowControl: false });
    expect(readonly.events.has('request_services')).toBe(true);
    expect(readonly.events.has('request_discord_status')).toBe(true);
    expect(readonly.events.has('service_action')).toBe(false);
    expect(readonly.events.has('quick_service_action')).toBe(false);

    const controllable = makeFakeSocket();
    registerServiceHandlers(controllable, {}, { allowControl: true });
    expect(controllable.events.has('service_action')).toBe(true);
    expect(controllable.events.has('quick_service_action')).toBe(true);
  });

  it('reminder handlers omit mutations when writes are disallowed', () => {
    const readonly = makeFakeSocket();
    registerReminderHandlers(readonly, {}, { allowWrite: false });
    expect(readonly.events.has('request_reminders')).toBe(true);
    expect(readonly.events.has('filter_reminders')).toBe(true);
    expect(readonly.events.has('create_reminder')).toBe(false);
    expect(readonly.events.has('edit_reminder')).toBe(false);
    expect(readonly.events.has('delete_reminder')).toBe(false);

    const writable = makeFakeSocket();
    registerReminderHandlers(writable, {}, { allowWrite: true });
    expect(writable.events.has('create_reminder')).toBe(true);
  });

  it('handlers default to registering destructive events (backward compatible)', () => {
    const socket = makeFakeSocket();
    registerServiceHandlers(socket, {});
    expect(socket.events.has('service_action')).toBe(true);
  });
});
