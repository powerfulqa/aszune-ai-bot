/**
 * Web Dashboard Routes Tests
 * Tests for extracted route modules
 */

const { ErrorHandler } = require('../../../src/utils/error-handler');

// Mock error handler
jest.mock('../../../src/utils/error-handler', () => ({
  ErrorHandler: {
    handleError: jest.fn().mockImplementation((error) => ({
      message: error.message || 'An unexpected error occurred',
    })),
  },
}));

describe('Web Dashboard Route Modules', () => {
  // Helper to create mock request/response
  const createMockReq = (overrides = {}) => ({
    params: {},
    query: {},
    body: {},
    ...overrides,
  });

  const createMockRes = () => {
    const res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      write: jest.fn().mockReturnThis(),
    };
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('configRoutes', () => {
    const { registerConfigRoutes } = require('../../../src/services/web-dashboard/routes/configRoutes');

    describe('registerConfigRoutes', () => {
      it('should register config routes on app', () => {
        const mockApp = {
          get: jest.fn(),
          post: jest.fn(),
        };
        const mockService = {};

        registerConfigRoutes(mockApp, mockService);

        expect(mockApp.get).toHaveBeenCalledWith('/api/config/:file', expect.any(Function));
        expect(mockApp.post).toHaveBeenCalledWith('/api/config/:file', expect.any(Function));
        expect(mockApp.post).toHaveBeenCalledWith('/api/config/:file/validate', expect.any(Function));
      });
    });

    describe('handleGetConfig', () => {
      it('should return config file content', async () => {
        const mockService = {
          readConfigFile: jest.fn().mockResolvedValue('config content'),
        };
        const mockApp = { get: jest.fn(), post: jest.fn() };
        registerConfigRoutes(mockApp, mockService);

        const handler = mockApp.get.mock.calls[0][1];
        const req = createMockReq({ params: { file: 'test.json' } });
        const res = createMockRes();

        await handler(req, res);

        expect(mockService.readConfigFile).toHaveBeenCalledWith('test.json');
        expect(res.json).toHaveBeenCalledWith({
          file: 'test.json',
          content: 'config content',
          timestamp: expect.any(String),
        });
      });

      it('should handle read error', async () => {
        const mockService = {
          readConfigFile: jest.fn().mockRejectedValue(new Error('Read failed')),
        };
        const mockApp = { get: jest.fn(), post: jest.fn() };
        registerConfigRoutes(mockApp, mockService);

        const handler = mockApp.get.mock.calls[0][1];
        const req = createMockReq({ params: { file: 'test.json' } });
        const res = createMockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Read failed',
          timestamp: expect.any(String),
        });
      });
    });

    describe('handleUpdateConfig', () => {
      it('should update config file', async () => {
        const mockService = {
          updateConfigFile: jest.fn().mockResolvedValue({ success: true }),
        };
        const mockApp = { get: jest.fn(), post: jest.fn() };
        registerConfigRoutes(mockApp, mockService);

        const handler = mockApp.post.mock.calls[0][1];
        const req = createMockReq({
          params: { file: 'test.json' },
          body: { content: 'new content', createBackup: true },
        });
        const res = createMockRes();

        await handler(req, res);

        expect(mockService.updateConfigFile).toHaveBeenCalledWith('test.json', 'new content', true);
        expect(res.json).toHaveBeenCalledWith({ success: true });
      });

      it('should return error if content is missing', async () => {
        const mockService = {};
        const mockApp = { get: jest.fn(), post: jest.fn() };
        registerConfigRoutes(mockApp, mockService);

        const handler = mockApp.post.mock.calls[0][1];
        const req = createMockReq({ params: { file: 'test.json' }, body: {} });
        const res = createMockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Content is required',
          timestamp: expect.any(String),
        });
      });

      it('should handle update error', async () => {
        const mockService = {
          updateConfigFile: jest.fn().mockRejectedValue(new Error('Update failed')),
        };
        const mockApp = { get: jest.fn(), post: jest.fn() };
        registerConfigRoutes(mockApp, mockService);

        const handler = mockApp.post.mock.calls[0][1];
        const req = createMockReq({
          params: { file: 'test.json' },
          body: { content: 'new content' },
        });
        const res = createMockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Update failed',
          timestamp: expect.any(String),
        });
      });
    });

    describe('handleValidateConfig', () => {
      it('should validate config file', async () => {
        const mockService = {
          validateConfigFile: jest.fn().mockResolvedValue({ valid: true }),
        };
        const mockApp = { get: jest.fn(), post: jest.fn() };
        registerConfigRoutes(mockApp, mockService);

        const handler = mockApp.post.mock.calls[1][1]; // Second post route
        const req = createMockReq({
          params: { file: 'test.json' },
          body: { content: 'content to validate' },
        });
        const res = createMockRes();

        await handler(req, res);

        expect(mockService.validateConfigFile).toHaveBeenCalledWith('test.json', 'content to validate');
        expect(res.json).toHaveBeenCalledWith({ valid: true });
      });

      it('should return error if content is missing for validation', async () => {
        const mockService = {};
        const mockApp = { get: jest.fn(), post: jest.fn() };
        registerConfigRoutes(mockApp, mockService);

        const handler = mockApp.post.mock.calls[1][1];
        const req = createMockReq({ params: { file: 'test.json' }, body: {} });
        const res = createMockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Content is required for validation',
          timestamp: expect.any(String),
        });
      });
    });
  });

  describe('controlRoutes', () => {
    const { registerControlRoutes } = require('../../../src/services/web-dashboard/routes/controlRoutes');

    it('should register control routes on app', () => {
      const mockApp = { post: jest.fn() };
      const mockService = {
        _handleRestartRequest: jest.fn(),
        _handleGitPullRequest: jest.fn(),
      };

      registerControlRoutes(mockApp, mockService);

      expect(mockApp.post).toHaveBeenCalledWith('/api/control/restart', expect.any(Function));
      expect(mockApp.post).toHaveBeenCalledWith('/api/control/git-pull', expect.any(Function));
    });

    it('should call restart handler', () => {
      const mockApp = { post: jest.fn() };
      const mockService = {
        _handleRestartRequest: jest.fn(),
        _handleGitPullRequest: jest.fn(),
      };

      registerControlRoutes(mockApp, mockService);

      const restartHandler = mockApp.post.mock.calls[0][1];
      const res = createMockRes();

      restartHandler({}, res);

      expect(mockService._handleRestartRequest).toHaveBeenCalledWith(res);
    });

    it('should call git-pull handler', () => {
      const mockApp = { post: jest.fn() };
      const mockService = {
        _handleRestartRequest: jest.fn(),
        _handleGitPullRequest: jest.fn(),
      };

      registerControlRoutes(mockApp, mockService);

      const gitPullHandler = mockApp.post.mock.calls[1][1];
      const res = createMockRes();

      gitPullHandler({}, res);

      expect(mockService._handleGitPullRequest).toHaveBeenCalledWith(res);
    });
  });

  describe('logRoutes', () => {
    const { registerLogRoutes } = require('../../../src/services/web-dashboard/routes/logRoutes');

    it('should register log routes on app', () => {
      const mockApp = { get: jest.fn() };
      const mockService = {};

      registerLogRoutes(mockApp, mockService);

      expect(mockApp.get).toHaveBeenCalledWith('/api/logs', expect.any(Function));
      expect(mockApp.get).toHaveBeenCalledWith('/api/logs/export', expect.any(Function));
    });

    describe('handleGetLogs', () => {
      it('should return filtered logs', async () => {
        const mockLogs = [{ level: 'INFO', message: 'test' }];
        const mockService = {
          getFilteredLogs: jest.fn().mockReturnValue(mockLogs),
          allLogs: mockLogs,
        };
        const mockApp = { get: jest.fn() };
        registerLogRoutes(mockApp, mockService);

        const handler = mockApp.get.mock.calls[0][1];
        const req = createMockReq({ query: { level: 'INFO', limit: '50', offset: '0' } });
        const res = createMockRes();

        await handler(req, res);

        expect(mockService.getFilteredLogs).toHaveBeenCalledWith('INFO', 50, 0);
        expect(res.json).toHaveBeenCalledWith({
          logs: mockLogs,
          total: 1,
          timestamp: expect.any(String),
        });
      });

      it('should search logs when search query is provided', async () => {
        const mockResults = [{ level: 'ERROR', message: 'error test' }];
        const mockService = {
          searchLogs: jest.fn().mockReturnValue(mockResults),
        };
        const mockApp = { get: jest.fn() };
        registerLogRoutes(mockApp, mockService);

        const handler = mockApp.get.mock.calls[0][1];
        const req = createMockReq({ query: { search: 'error', limit: '100' } });
        const res = createMockRes();

        await handler(req, res);

        expect(mockService.searchLogs).toHaveBeenCalledWith('error', 100);
        expect(res.json).toHaveBeenCalledWith({
          logs: mockResults,
          total: 1,
          timestamp: expect.any(String),
        });
      });

      it('should handle log retrieval error', async () => {
        const mockService = {
          getFilteredLogs: jest.fn().mockImplementation(() => {
            throw new Error('Log error');
          }),
        };
        const mockApp = { get: jest.fn() };
        registerLogRoutes(mockApp, mockService);

        const handler = mockApp.get.mock.calls[0][1];
        const req = createMockReq({ query: {} });
        const res = createMockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe('handleExportLogs', () => {
      it('should export logs as JSON', async () => {
        const mockLogs = [{ level: 'INFO', message: 'test' }];
        const mockService = {
          getFilteredLogs: jest.fn().mockReturnValue(mockLogs),
          maxAllLogs: 1000,
          exportLogsAsJSON: jest.fn(),
        };
        const mockApp = { get: jest.fn() };
        registerLogRoutes(mockApp, mockService);

        const handler = mockApp.get.mock.calls[1][1];
        const req = createMockReq({ query: { format: 'json', level: 'ALL' } });
        const res = createMockRes();

        await handler(req, res);

        expect(mockService.exportLogsAsJSON).toHaveBeenCalledWith(res, mockLogs);
        expect(res.end).toHaveBeenCalled();
      });

      it('should export logs as CSV', async () => {
        const mockLogs = [{ level: 'INFO', message: 'test' }];
        const mockService = {
          getFilteredLogs: jest.fn().mockReturnValue(mockLogs),
          maxAllLogs: 1000,
          exportLogsAsCSV: jest.fn(),
        };
        const mockApp = { get: jest.fn() };
        registerLogRoutes(mockApp, mockService);

        const handler = mockApp.get.mock.calls[1][1];
        const req = createMockReq({ query: { format: 'csv', level: 'ALL' } });
        const res = createMockRes();

        await handler(req, res);

        expect(mockService.exportLogsAsCSV).toHaveBeenCalledWith(res, mockLogs);
        expect(res.end).toHaveBeenCalled();
      });

      it('should handle export error', async () => {
        const mockService = {
          getFilteredLogs: jest.fn().mockImplementation(() => {
            throw new Error('Export error');
          }),
          maxAllLogs: 1000,
        };
        const mockApp = { get: jest.fn() };
        registerLogRoutes(mockApp, mockService);

        const handler = mockApp.get.mock.calls[1][1];
        const req = createMockReq({ query: {} });
        const res = createMockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });

  describe('networkRoutes', () => {
    const { registerNetworkRoutes } = require('../../../src/services/web-dashboard/routes/networkRoutes');

    it('should register network routes on app', () => {
      const mockApp = { get: jest.fn() };
      const mockService = {};

      registerNetworkRoutes(mockApp, mockService);

      expect(mockApp.get).toHaveBeenCalledWith('/api/network/interfaces', expect.any(Function));
      expect(mockApp.get).toHaveBeenCalledWith('/api/network/ip', expect.any(Function));
      expect(mockApp.get).toHaveBeenCalledWith('/api/network/status', expect.any(Function));
    });

    describe('handleNetworkInterfaces', () => {
      it('should return network interfaces', async () => {
        const mockInterfaces = [{ name: 'eth0', ip: '192.168.1.1' }];
        const mockService = {
          getNetworkInterfaces: jest.fn().mockResolvedValue(mockInterfaces),
        };
        const mockApp = { get: jest.fn() };
        registerNetworkRoutes(mockApp, mockService);

        const handler = mockApp.get.mock.calls[0][1];
        const req = createMockReq();
        const res = createMockRes();

        await handler(req, res);

        expect(res.json).toHaveBeenCalledWith({
          interfaces: mockInterfaces,
          timestamp: expect.any(String),
        });
      });

      it('should handle network interfaces error', async () => {
        const mockService = {
          getNetworkInterfaces: jest.fn().mockRejectedValue(new Error('Network error')),
        };
        const mockApp = { get: jest.fn() };
        registerNetworkRoutes(mockApp, mockService);

        const handler = mockApp.get.mock.calls[0][1];
        const req = createMockReq();
        const res = createMockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe('handleIpAddresses', () => {
      it('should return IP addresses', async () => {
        const mockIpInfo = { internal: '192.168.1.1', external: '1.2.3.4' };
        const mockService = {
          getIPAddresses: jest.fn().mockResolvedValue(mockIpInfo),
        };
        const mockApp = { get: jest.fn() };
        registerNetworkRoutes(mockApp, mockService);

        const handler = mockApp.get.mock.calls[1][1];
        const req = createMockReq();
        const res = createMockRes();

        await handler(req, res);

        expect(res.json).toHaveBeenCalledWith({
          ipInfo: mockIpInfo,
          timestamp: expect.any(String),
        });
      });

      it('should handle IP address error', async () => {
        const mockService = {
          getIPAddresses: jest.fn().mockRejectedValue(new Error('IP error')),
        };
        const mockApp = { get: jest.fn() };
        registerNetworkRoutes(mockApp, mockService);

        const handler = mockApp.get.mock.calls[1][1];
        const req = createMockReq();
        const res = createMockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe('handleNetworkStatus', () => {
      it('should return network status', async () => {
        const mockStatus = { connected: true, latency: 10 };
        const mockService = {
          getNetworkStatus: jest.fn().mockResolvedValue(mockStatus),
        };
        const mockApp = { get: jest.fn() };
        registerNetworkRoutes(mockApp, mockService);

        const handler = mockApp.get.mock.calls[2][1];
        const req = createMockReq();
        const res = createMockRes();

        await handler(req, res);

        expect(res.json).toHaveBeenCalledWith({
          status: mockStatus,
          timestamp: expect.any(String),
        });
      });

      it('should handle network status error', async () => {
        const mockService = {
          getNetworkStatus: jest.fn().mockRejectedValue(new Error('Status error')),
        };
        const mockApp = { get: jest.fn() };
        registerNetworkRoutes(mockApp, mockService);

        const handler = mockApp.get.mock.calls[2][1];
        const req = createMockReq();
        const res = createMockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });

  describe('recommendationRoutes', () => {
    const { registerRecommendationRoutes } = require('../../../src/services/web-dashboard/routes/recommendationRoutes');

    it('should register recommendation routes on app', () => {
      const mockApp = { get: jest.fn() };
      const mockService = {};

      registerRecommendationRoutes(mockApp, mockService);

      expect(mockApp.get).toHaveBeenCalledWith('/api/recommendations', expect.any(Function));
    });

    describe('handleRecommendations', () => {
      it('should return recommendations', async () => {
        const mockRecommendations = [{ type: 'memory', message: 'Reduce memory usage' }];
        const mockService = {
          getDetailedRecommendations: jest.fn().mockResolvedValue(mockRecommendations),
        };
        const mockApp = { get: jest.fn() };
        registerRecommendationRoutes(mockApp, mockService);

        const handler = mockApp.get.mock.calls[0][1];
        const req = createMockReq();
        const res = createMockRes();

        await handler(req, res);

        expect(res.json).toHaveBeenCalledWith(mockRecommendations);
      });

      it('should handle recommendations error', async () => {
        const mockService = {
          getDetailedRecommendations: jest.fn().mockRejectedValue(new Error('Recommendation error')),
        };
        const mockApp = { get: jest.fn() };
        registerRecommendationRoutes(mockApp, mockService);

        const handler = mockApp.get.mock.calls[0][1];
        const req = createMockReq();
        const res = createMockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });

  describe('reminderRoutes', () => {
    const { registerReminderRoutes } = require('../../../src/services/web-dashboard/routes/reminderRoutes');

    it('should register reminder routes on app', () => {
      const mockApp = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() };
      const mockService = {};

      registerReminderRoutes(mockApp, mockService);

      expect(mockApp.get).toHaveBeenCalledWith('/api/reminders', expect.any(Function));
      expect(mockApp.post).toHaveBeenCalledWith('/api/reminders', expect.any(Function));
      expect(mockApp.put).toHaveBeenCalledWith('/api/reminders/:id', expect.any(Function));
      expect(mockApp.delete).toHaveBeenCalledWith('/api/reminders/:id', expect.any(Function));
    });

    describe('handleGetReminders', () => {
      it('should return reminders', async () => {
        const mockReminders = [{ id: 1, message: 'Test' }];
        const mockService = {
          getReminders: jest.fn().mockResolvedValue(mockReminders),
        };
        const mockApp = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() };
        registerReminderRoutes(mockApp, mockService);

        const handler = mockApp.get.mock.calls[0][1];
        const req = createMockReq({ query: { status: 'active' } });
        const res = createMockRes();

        await handler(req, res);

        expect(mockService.getReminders).toHaveBeenCalledWith('active');
        expect(res.json).toHaveBeenCalledWith({
          reminders: mockReminders,
          total: 1,
          timestamp: expect.any(String),
        });
      });

      it('should handle get reminders error', async () => {
        const mockService = {
          getReminders: jest.fn().mockRejectedValue(new Error('Get error')),
        };
        const mockApp = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() };
        registerReminderRoutes(mockApp, mockService);

        const handler = mockApp.get.mock.calls[0][1];
        const req = createMockReq();
        const res = createMockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe('handleCreateReminder', () => {
      it('should create reminder', async () => {
        const mockReminder = { id: 1, message: 'New reminder' };
        const mockService = {
          createReminder: jest.fn().mockResolvedValue(mockReminder),
        };
        const mockApp = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() };
        registerReminderRoutes(mockApp, mockService);

        const handler = mockApp.post.mock.calls[0][1];
        const req = createMockReq({
          body: {
            message: 'New reminder',
            scheduledTime: '2025-12-01T10:00:00Z',
            userId: 'user-1',
            reminderType: 'scheduled',
          },
        });
        const res = createMockRes();

        await handler(req, res);

        expect(mockService.createReminder).toHaveBeenCalledWith(
          'New reminder',
          '2025-12-01T10:00:00Z',
          'user-1',
          'scheduled'
        );
        expect(res.status).toHaveBeenCalledWith(201);
      });

      it('should return error if required fields are missing', async () => {
        const mockService = {};
        const mockApp = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() };
        registerReminderRoutes(mockApp, mockService);

        const handler = mockApp.post.mock.calls[0][1];
        const req = createMockReq({ body: { message: 'Only message' } });
        const res = createMockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Message, scheduledTime, and userId are required',
          timestamp: expect.any(String),
        });
      });

      it('should handle create reminder error', async () => {
        const mockService = {
          createReminder: jest.fn().mockRejectedValue(new Error('Create error')),
        };
        const mockApp = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() };
        registerReminderRoutes(mockApp, mockService);

        const handler = mockApp.post.mock.calls[0][1];
        const req = createMockReq({
          body: {
            message: 'Reminder',
            scheduledTime: '2025-12-01T10:00:00Z',
            userId: 'user-1',
          },
        });
        const res = createMockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe('handleUpdateReminder', () => {
      it('should update reminder', async () => {
        const mockReminder = { id: 1, message: 'Updated' };
        const mockService = {
          updateReminder: jest.fn().mockResolvedValue(mockReminder),
        };
        const mockApp = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() };
        registerReminderRoutes(mockApp, mockService);

        const handler = mockApp.put.mock.calls[0][1];
        const req = createMockReq({
          params: { id: '1' },
          body: { message: 'Updated', scheduledTime: '2025-12-01T12:00:00Z' },
        });
        const res = createMockRes();

        await handler(req, res);

        expect(mockService.updateReminder).toHaveBeenCalledWith('1', 'Updated', '2025-12-01T12:00:00Z');
        expect(res.json).toHaveBeenCalledWith({
          reminder: mockReminder,
          message: 'Reminder updated successfully',
          timestamp: expect.any(String),
        });
      });

      it('should handle update error', async () => {
        const mockService = {
          updateReminder: jest.fn().mockRejectedValue(new Error('Update error')),
        };
        const mockApp = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() };
        registerReminderRoutes(mockApp, mockService);

        const handler = mockApp.put.mock.calls[0][1];
        const req = createMockReq({ params: { id: '1' }, body: {} });
        const res = createMockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });

    describe('handleDeleteReminder', () => {
      it('should delete reminder', async () => {
        const mockService = {
          deleteReminder: jest.fn().mockResolvedValue(true),
        };
        const mockApp = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() };
        registerReminderRoutes(mockApp, mockService);

        const handler = mockApp.delete.mock.calls[0][1];
        const req = createMockReq({ params: { id: '1' } });
        const res = createMockRes();

        await handler(req, res);

        expect(mockService.deleteReminder).toHaveBeenCalledWith('1');
        expect(res.json).toHaveBeenCalledWith({
          message: 'Reminder deleted successfully',
          timestamp: expect.any(String),
        });
      });

      it('should handle delete error', async () => {
        const mockService = {
          deleteReminder: jest.fn().mockRejectedValue(new Error('Delete error')),
        };
        const mockApp = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() };
        registerReminderRoutes(mockApp, mockService);

        const handler = mockApp.delete.mock.calls[0][1];
        const req = createMockReq({ params: { id: '1' } });
        const res = createMockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });
  });

  describe('serviceRoutes', () => {
    const { registerServiceRoutes } = require('../../../src/services/web-dashboard/routes/serviceRoutes');

    it('should register service routes on app', () => {
      const mockApp = { get: jest.fn(), post: jest.fn() };
      const mockService = {};

      registerServiceRoutes(mockApp, mockService);

      expect(mockApp.get).toHaveBeenCalledWith('/api/services', expect.any(Function));
      expect(mockApp.post).toHaveBeenCalledWith('/api/services/:action', expect.any(Function));
      expect(mockApp.get).toHaveBeenCalledWith('/api/services/:service/logs', expect.any(Function));
    });

    describe('handleGetServices', () => {
      it('should return service status', async () => {
        const mockServices = [{ name: 'bot', status: 'running' }];
        const mockService = {
          getServiceStatus: jest.fn().mockResolvedValue(mockServices),
        };
        const mockApp = { get: jest.fn(), post: jest.fn() };
        registerServiceRoutes(mockApp, mockService);

        const handler = mockApp.get.mock.calls[0][1];
        const req = createMockReq();
        const res = createMockRes();

        await handler(req, res);

        expect(res.json).toHaveBeenCalledWith({
          services: mockServices,
          timestamp: expect.any(String),
        });
      });

      it('should handle get services error', async () => {
        const mockService = {
          getServiceStatus: jest.fn().mockRejectedValue(new Error('Service error')),
        };
        const mockApp = { get: jest.fn(), post: jest.fn() };
        registerServiceRoutes(mockApp, mockService);

        const handler = mockApp.get.mock.calls[0][1];
        const req = createMockReq();
        const res = createMockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe('handleManageService', () => {
      it('should manage service with valid action', async () => {
        const mockResult = { success: true };
        const mockService = {
          manageService: jest.fn().mockResolvedValue(mockResult),
        };
        const mockApp = { get: jest.fn(), post: jest.fn() };
        registerServiceRoutes(mockApp, mockService);

        const handler = mockApp.post.mock.calls[0][1];
        const req = createMockReq({
          params: { action: 'restart' },
          body: { service: 'bot' },
        });
        const res = createMockRes();

        await handler(req, res);

        expect(mockService.manageService).toHaveBeenCalledWith('restart', 'bot');
        expect(res.json).toHaveBeenCalledWith(mockResult);
      });

      it('should return error for invalid action', async () => {
        const mockService = {};
        const mockApp = { get: jest.fn(), post: jest.fn() };
        registerServiceRoutes(mockApp, mockService);

        const handler = mockApp.post.mock.calls[0][1];
        const req = createMockReq({
          params: { action: 'invalid' },
          body: { service: 'bot' },
        });
        const res = createMockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Invalid action. Must be start, stop, or restart',
          timestamp: expect.any(String),
        });
      });

      it('should return error if service name is missing', async () => {
        const mockService = {};
        const mockApp = { get: jest.fn(), post: jest.fn() };
        registerServiceRoutes(mockApp, mockService);

        const handler = mockApp.post.mock.calls[0][1];
        const req = createMockReq({
          params: { action: 'restart' },
          body: {},
        });
        const res = createMockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Service name is required',
          timestamp: expect.any(String),
        });
      });

      it('should handle manage service error', async () => {
        const mockService = {
          manageService: jest.fn().mockRejectedValue(new Error('Manage error')),
        };
        const mockApp = { get: jest.fn(), post: jest.fn() };
        registerServiceRoutes(mockApp, mockService);

        const handler = mockApp.post.mock.calls[0][1];
        const req = createMockReq({
          params: { action: 'start' },
          body: { service: 'bot' },
        });
        const res = createMockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    describe('handleServiceLogs', () => {
      it('should return service logs', async () => {
        const mockLogs = ['log 1', 'log 2'];
        const mockService = {
          getServiceLogs: jest.fn().mockResolvedValue(mockLogs),
        };
        const mockApp = { get: jest.fn(), post: jest.fn() };
        registerServiceRoutes(mockApp, mockService);

        const handler = mockApp.get.mock.calls[1][1];
        const req = createMockReq({
          params: { service: 'bot' },
          query: { lines: '100' },
        });
        const res = createMockRes();

        await handler(req, res);

        expect(mockService.getServiceLogs).toHaveBeenCalledWith('bot', 100);
        expect(res.json).toHaveBeenCalledWith({
          service: 'bot',
          logs: mockLogs,
          timestamp: expect.any(String),
        });
      });

      it('should handle service logs error', async () => {
        const mockService = {
          getServiceLogs: jest.fn().mockRejectedValue(new Error('Logs error')),
        };
        const mockApp = { get: jest.fn(), post: jest.fn() };
        registerServiceRoutes(mockApp, mockService);

        const handler = mockApp.get.mock.calls[1][1];
        const req = createMockReq({
          params: { service: 'bot' },
          query: {},
        });
        const res = createMockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });
});
