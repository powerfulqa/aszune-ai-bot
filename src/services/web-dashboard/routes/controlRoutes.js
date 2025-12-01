function registerControlRoutes(app, service) {
  app.post('/api/control/restart', (_req, res) => service._handleRestartRequest(res));
  app.post('/api/control/git-pull', (_req, res) => service._handleGitPullRequest(res));
}

module.exports = { registerControlRoutes };
