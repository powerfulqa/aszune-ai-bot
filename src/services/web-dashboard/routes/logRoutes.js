const { wrapAsyncHandler, createApiResponse } = require('./routeHelper');

function registerLogRoutes(app, service) {
  app.get('/api/logs', handleGetLogs(service));
  app.get('/api/logs/export', handleExportLogs(service));
}

function handleGetLogs(service) {
  return wrapAsyncHandler(async (req, res) => {
    const { level = 'ALL', limit = 100, offset = 0, search } = req.query;

    if (search) {
      const results = service.searchLogs(search, parseInt(limit, 10));
      res.json(createApiResponse({ logs: results, total: results.length }));
      return;
    }

    const logs = service.getFilteredLogs(level, parseInt(limit, 10), parseInt(offset, 10));
    res.json(createApiResponse({ logs, total: service.allLogs.length }));
  }, 'getting logs');
}

function handleExportLogs(service) {
  return wrapAsyncHandler(async (req, res) => {
    const { format = 'json', level = 'ALL' } = req.query;
    const logs = service.getFilteredLogs(level, service.maxAllLogs);

    if (format === 'csv') {
      service.exportLogsAsCSV(res, logs);
    } else {
      service.exportLogsAsJSON(res, logs);
    }

    res.end();
  }, 'exporting logs');
}

module.exports = { registerLogRoutes };
