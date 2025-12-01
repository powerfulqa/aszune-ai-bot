const { ErrorHandler } = require('../../utils/error-handler');

function registerLogRoutes(app, service) {
  app.get('/api/logs', handleGetLogs(service));
  app.get('/api/logs/export', handleExportLogs(service));
}

function handleGetLogs(service) {
  return async (req, res) => {
    try {
      const { level = 'ALL', limit = 100, offset = 0, search } = req.query;

      if (search) {
        const results = service.searchLogs(search, parseInt(limit, 10));
        res.json({
          logs: results,
          total: results.length,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const logs = service.getFilteredLogs(level, parseInt(limit, 10), parseInt(offset, 10));
      res.json({
        logs,
        total: service.allLogs.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'getting logs');
      res.status(500).json({
        error: errorResponse.message,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

function handleExportLogs(service) {
  return async (req, res) => {
    try {
      const { format = 'json', level = 'ALL' } = req.query;
      const logs = service.getFilteredLogs(level, service.maxAllLogs);

      if (format === 'csv') {
        service.exportLogsAsCSV(res, logs);
      } else {
        service.exportLogsAsJSON(res, logs);
      }

      res.end();
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'exporting logs');
      res.status(500).json({
        error: errorResponse.message,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

module.exports = { registerLogRoutes };
