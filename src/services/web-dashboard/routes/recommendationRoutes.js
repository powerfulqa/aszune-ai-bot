const { wrapAsyncHandler } = require('./routeHelper');

function registerRecommendationRoutes(app, service) {
  app.get('/api/recommendations', handleRecommendations(service));
}

function handleRecommendations(service) {
  return wrapAsyncHandler(async (_req, res) => {
    const recommendations = await service.getDetailedRecommendations();
    res.json(recommendations);
  }, 'getting recommendations');
}

module.exports = { registerRecommendationRoutes };
