const { ErrorHandler } = require('../../../utils/error-handler');

function registerServiceRoutes(app, service) {
  app.get('/api/services', handleGetServices(service));
  app.post('/api/services/:action', handleManageService(service));
  app.get('/api/services/:service/logs', handleServiceLogs(service));
}

function handleGetServices(service) {
  return async (req, res) => {
    try {
      const services = await service.getServiceStatus();
      res.json({
        services,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'getting service status');
      res.status(500).json({
        error: errorResponse.message,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

function handleManageService(service) {
  return async (req, res) => {
    try {
      const { action } = req.params;
      const { service: serviceName } = req.body;

      if (!['start', 'stop', 'restart'].includes(action)) {
        res.status(400).json({
          error: 'Invalid action. Must be start, stop, or restart',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!serviceName) {
        res.status(400).json({
          error: 'Service name is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const result = await service.manageService(action, serviceName);
      res.json(result);
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'managing service');
      res.status(500).json({
        error: errorResponse.message,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

function handleServiceLogs(service) {
  return async (req, res) => {
    try {
      const { service: serviceName } = req.params;
      const { lines = 50 } = req.query;
      const logs = await service.getServiceLogs(serviceName, parseInt(lines, 10));
      res.json({
        service: serviceName,
        logs,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'getting service logs');
      res.status(500).json({
        error: errorResponse.message,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

module.exports = { registerServiceRoutes };
