const { createSimpleGetHandler } = require('./routeHelper');

function registerNetworkRoutes(app, service) {
  app.get('/api/network/interfaces', handleNetworkInterfaces(service));
  app.get('/api/network/ip', handleIpAddresses(service));
  app.get('/api/network/status', handleNetworkStatus(service));
}

function handleNetworkInterfaces(service) {
  return createSimpleGetHandler(
    service,
    'getNetworkInterfaces',
    'interfaces',
    'getting network interfaces'
  );
}

function handleIpAddresses(service) {
  return createSimpleGetHandler(service, 'getIPAddresses', 'ipInfo', 'getting IP addresses');
}

function handleNetworkStatus(service) {
  return createSimpleGetHandler(service, 'getNetworkStatus', 'status', 'getting network status');
}

module.exports = { registerNetworkRoutes };
