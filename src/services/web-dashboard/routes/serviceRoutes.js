const {
  createSimpleGetHandler,
  wrapAsyncHandler,
  sendValidationError,
} = require('./routeHelper');

function registerServiceRoutes(app, service) {
  app.get('/api/services', handleGetServices(service));
  app.post('/api/services/:action', handleManageService(service));
  app.get('/api/services/:service/logs', handleServiceLogs(service));
}

function handleGetServices(service) {
  return createSimpleGetHandler(service, 'getServiceStatus', 'services', 'getting service status');
}

function handleManageService(service) {
  return wrapAsyncHandler(async (req, res) => {
    const { action } = req.params;
    const { service: serviceName } = req.body;

    if (!['start', 'stop', 'restart'].includes(action)) {
      sendValidationError(res, 'Invalid action. Must be start, stop, or restart');
      return;
    }

    if (!serviceName) {
      sendValidationError(res, 'Service name is required');
      return;
    }

    const result = await service.manageService(action, serviceName);
    res.json(result);
  }, 'managing service');
}

function handleServiceLogs(service) {
  return wrapAsyncHandler(async (req) => {
    const { service: serviceName } = req.params;
    const { lines = 50 } = req.query;
    const logs = await service.getServiceLogs(serviceName, parseInt(lines, 10));
    return { service: serviceName, logs };
  }, 'getting service logs');
}

module.exports = { registerServiceRoutes };
