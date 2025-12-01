const { ErrorHandler } = require('../../utils/error-handler');

function registerRecommendationRoutes(app, service) {
  app.get('/api/recommendations', handleRecommendations(service));
}

function handleRecommendations(service) {
  return async (req, res) => {
    try {
      const recommendations = await service.getDetailedRecommendations();
      res.json(recommendations);
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'getting recommendations');
      res.status(500).json({
        error: errorResponse.message,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

module.exports = { registerRecommendationRoutes };
