const { wrapAsyncHandler, sendValidationError } = require('./routeHelper');

function registerConfigRoutes(app, service) {
  app.get('/api/config/:file', handleGetConfig(service));
  app.post('/api/config/:file', handleUpdateConfig(service));
  app.post('/api/config/:file/validate', handleValidateConfig(service));
}

function handleGetConfig(service) {
  return wrapAsyncHandler(async (req) => {
    const { file } = req.params;
    const content = await service.readConfigFile(file);
    return { file, content };
  }, 'reading config file');
}

function handleUpdateConfig(service) {
  return wrapAsyncHandler(async (req, res) => {
    const { file } = req.params;
    const { content, createBackup = true } = req.body;

    if (!content) {
      sendValidationError(res, 'Content is required');
      return;
    }

    const result = await service.updateConfigFile(file, content, createBackup);
    res.json(result);
  }, 'updating config file');
}

function handleValidateConfig(service) {
  return wrapAsyncHandler(async (req, res) => {
    const { file } = req.params;
    const { content } = req.body;

    if (!content) {
      sendValidationError(res, 'Content is required for validation');
      return;
    }

    const validation = await service.validateConfigFile(file, content);
    res.json(validation);
  }, 'validating config file');
}

module.exports = { registerConfigRoutes };
