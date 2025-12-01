const { ErrorHandler } = require('../../utils/error-handler');

function registerConfigRoutes(app, service) {
  app.get('/api/config/:file', handleGetConfig(service));
  app.post('/api/config/:file', handleUpdateConfig(service));
  app.post('/api/config/:file/validate', handleValidateConfig(service));
}

function handleGetConfig(service) {
  return async (req, res) => {
    try {
      const { file } = req.params;
      const content = await service.readConfigFile(file);
      res.json({
        file,
        content,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'reading config file');
      res.status(400).json({
        error: errorResponse.message,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

function handleUpdateConfig(service) {
  return async (req, res) => {
    try {
      const { file } = req.params;
      const { content, createBackup = true } = req.body;

      if (!content) {
        res.status(400).json({
          error: 'Content is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const result = await service.updateConfigFile(file, content, createBackup);
      res.json(result);
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'updating config file');
      res.status(400).json({
        error: errorResponse.message,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

function handleValidateConfig(service) {
  return async (req, res) => {
    try {
      const { file } = req.params;
      const { content } = req.body;

      if (!content) {
        res.status(400).json({
          error: 'Content is required for validation',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const validation = await service.validateConfigFile(file, content);
      res.json(validation);
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'validating config file');
      res.status(400).json({
        error: errorResponse.message,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

module.exports = { registerConfigRoutes };
