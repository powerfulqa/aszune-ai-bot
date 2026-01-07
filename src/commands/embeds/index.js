/**
 * Embed builders index
 * Re-exports all embed builders for convenient imports
 */

const { buildAnalyticsEmbed } = require('./analytics-embed');
const { buildDashboardEmbed } = require('./dashboard-embed');
const { buildResourcesEmbed } = require('./resources-embed');
const { buildCacheEmbed } = require('./cache-embed');
const { buildUserInfoEmbed, getJoinPosition } = require('./userinfo-embed');
const { buildServerInfoEmbed } = require('./serverinfo-embed');

module.exports = {
  buildAnalyticsEmbed,
  buildDashboardEmbed,
  buildResourcesEmbed,
  buildCacheEmbed,
  buildUserInfoEmbed,
  buildServerInfoEmbed,
  getJoinPosition,
};
