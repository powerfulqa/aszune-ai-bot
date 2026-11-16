/**
 * Web Dashboard Routes Tests
 * Tests for extracted route modules
 */

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

  describe('controlRoutes', () => {
    const {
      registerControlRoutes,
    } = require('../../../src/services/web-dashboard/routes/controlRoutes');

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

  describe('recommendationRoutes', () => {
    const {
      registerRecommendationRoutes,
    } = require('../../../src/services/web-dashboard/routes/recommendationRoutes');

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
          getDetailedRecommendations: jest
            .fn()
            .mockRejectedValue(new Error('Recommendation error')),
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
    const {
      registerReminderRoutes,
    } = require('../../../src/services/web-dashboard/routes/reminderRoutes');

    it('should register reminder routes on app', () => {
      const mockApp = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() };
      const mockService = {};

      registerReminderRoutes(mockApp, mockService);

      // Read-only: writes go over the socket, through the reminder service
      expect(mockApp.get).toHaveBeenCalledWith('/api/reminders', expect.any(Function));
      expect(mockApp.post).not.toHaveBeenCalled();
      expect(mockApp.put).not.toHaveBeenCalled();
      expect(mockApp.delete).not.toHaveBeenCalled();
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
  });
});
