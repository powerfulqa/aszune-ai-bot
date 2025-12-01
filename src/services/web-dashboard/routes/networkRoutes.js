const { ErrorHandler } = require('../../../utils/error-handler');

function registerNetworkRoutes(app, service) {
  app.get('/api/network/interfaces', handleNetworkInterfaces(service));
  app.get('/api/network/ip', handleIpAddresses(service));
  app.get('/api/network/status', handleNetworkStatus(service));
}

function handleNetworkInterfaces(service) {
  return async (req, res) => {
    try {
      const interfaces = await service.getNetworkInterfaces();
      res.json({
        interfaces,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'getting network interfaces');
      res.status(500).json({
        error: errorResponse.message,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

function handleIpAddresses(service) {
  return async (req, res) => {
    try {
      const ipInfo = await service.getIPAddresses();
      res.json({
        ipInfo,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'getting IP addresses');
      res.status(500).json({
        error: errorResponse.message,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

function handleNetworkStatus(service) {
  return async (req, res) => {
    try {
      const status = await service.getNetworkStatus();
      res.json({
        status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'getting network status');
      res.status(500).json({
        error: errorResponse.message,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

module.exports = { registerNetworkRoutes };
