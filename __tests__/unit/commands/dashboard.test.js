/**
 * Dashboard Command Tests
 * Tests the Discord dashboard command functionality
 */

jest.useFakeTimers();

// Mock dependencies
jest.mock('../../../src/config/config', () => require('../../../__mocks__/configMock'));
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/performance-dashboard', () => ({
  generateDashboardReport: jest.fn(),
  getRealTimeStatus: jest.fn()
}));
jest.mock('../../../src/utils/error-handler');

const { handleSlashCommand } = require('../../../src/commands/index');
const PerformanceDashboard = require('../../../src/utils/performance-dashboard');
const { ErrorHandler } = require('../../../src/utils/error-handler');

// Mock the conversation module
jest.mock('../../../src/utils/conversation', () => {
  const mockInstance = {
    clearHistory: jest.fn(),
    getHistory: jest.fn().mockReturnValue([]),
    getUserStats: jest.fn().mockReturnValue({ messages: 10, summaries: 2 }),
    updateUserStats: jest.fn(),
    addMessage: jest.fn(),
  };
  return jest.fn(() => mockInstance);
});

describe('Dashboard Command', () => {
  const mockInteraction = {
    commandName: 'dashboard',
    reply: jest.fn(),
    deferReply: jest.fn(),
    editReply: jest.fn(),
    user: {
      id: 'test-user-123',
      username: 'testuser'
    },
    guild: {
      id: 'test-guild-123'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default successful mocks
    PerformanceDashboard.generateDashboardReport.mockResolvedValue({
      overview: {
        status: 'healthy',
        memoryUsage: '245 MB',
        responseTime: '1.2s',
        errorRate: '2.1%',
        optimizationTier: 'Standard',
        serverCount: 5,
        activeUsers: 150,
        totalCommands: 1250
      },
      alerts: []
    });

    PerformanceDashboard.getRealTimeStatus.mockReturnValue({
      uptime: {
        formatted: '5d 12h 30m'
      }
    });

    ErrorHandler.handleError = jest.fn().mockReturnValue({
      message: 'An unexpected error occurred. Please try again later.',
      type: 'GENERAL_ERROR'
    });
  });

  test('should handle dashboard command successfully', async () => {
    await handleSlashCommand(mockInteraction);
    
    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(PerformanceDashboard.generateDashboardReport).toHaveBeenCalled();
    expect(PerformanceDashboard.getRealTimeStatus).toHaveBeenCalled();
    
    // Use flexible matching to avoid emoji encoding issues
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            color: 0x00FF00,
            title: expect.stringContaining('Performance Dashboard'),
            fields: expect.arrayContaining([
              expect.objectContaining({
                name: expect.stringContaining('System Status'),
                value: expect.stringContaining('HEALTHY'),
                inline: true
              }),
              expect.objectContaining({
                name: expect.stringContaining('Performance'),
                value: expect.stringContaining('1.2s'),
                inline: true
              }),
              expect.objectContaining({
                name: expect.stringContaining('Activity'),
                value: expect.stringContaining('Servers: 5'),
                inline: true
              })
            ]),
            footer: expect.objectContaining({
              text: expect.stringContaining('Aszai Bot Dashboard')
            }),
            timestamp: expect.any(String)
          })
        ])
      })
    );
  });

  test('should handle dashboard command error', async () => {
    const error = new Error('Dashboard service unavailable');
    PerformanceDashboard.generateDashboardReport.mockRejectedValue(error);

    await handleSlashCommand(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(ErrorHandler.handleError).toHaveBeenCalledWith(error, 'dashboard_command');
    expect(mockInteraction.editReply).toHaveBeenCalledWith({
      content: 'An unexpected error occurred. Please try again later.'
    });
  });

  test('should handle dashboard with degraded performance', async () => {
    PerformanceDashboard.generateDashboardReport.mockResolvedValue({
      overview: {
        status: 'warning',
        memoryUsage: '890 MB',
        responseTime: '5.7s',
        errorRate: '15.2%',
        optimizationTier: 'High',
        serverCount: 12,
        activeUsers: 450,
        totalCommands: 2500
      },
      alerts: [
        { severity: 'critical', message: 'High memory usage detected' },
        { severity: 'warning', message: 'Response time degraded' }
      ]
    });

    PerformanceDashboard.getRealTimeStatus.mockReturnValue({
      uptime: {
        formatted: '1d 2h 15m'
      }
    });

    await handleSlashCommand(mockInteraction);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            color: 0xFFA500,
            title: expect.stringContaining('Performance Dashboard'),
            fields: expect.arrayContaining([
              expect.objectContaining({
                name: expect.stringContaining('System Status'),
                value: expect.stringContaining('WARNING'),
                inline: true
              }),
              expect.objectContaining({
                name: expect.stringContaining('Performance'),
                value: expect.stringContaining('5.7s'),
                inline: true
              }),
              expect.objectContaining({
                name: expect.stringContaining('Activity'),
                value: expect.stringContaining('Servers: 12'),
                inline: true
              }),
              expect.objectContaining({
                name: expect.stringContaining('Active Alerts'),
                value: expect.stringContaining('High memory usage detected'),
                inline: false
              })
            ]),
            footer: expect.objectContaining({
              text: expect.stringContaining('Aszai Bot Dashboard')
            }),
            timestamp: expect.any(String)
          })
        ])
      })
    );
  });
});