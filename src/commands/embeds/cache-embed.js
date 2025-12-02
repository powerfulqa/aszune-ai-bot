/**
 * Cache embed builder
 * Generates Discord embed for /cache command
 */

const config = require('../../config/config');

/**
 * Build the cache embed
 * @param {Object} cacheStats - Cache statistics from PerplexityService
 * @param {Object} detailedInfo - Detailed cache information
 * @returns {Object} Discord embed object
 */
function buildCacheEmbed(cacheStats, detailedInfo) {
  const embed = {
    color: config.COLORS.PRIMARY,
    title: 'Cache Statistics',
    description:
      cacheStats.entryCount === 0
        ? '💡 Cache is currently empty - memory will increase as API responses are cached'
        : null,
    fields: [
      {
        name: 'Performance',
        value: `Hit Rate: ${cacheStats.hitRate}%\nHits: ${cacheStats.hits}\nMisses: ${cacheStats.misses}`,
        inline: true,
      },
      {
        name: 'Operations',
        value: `Sets: ${cacheStats.sets}\nDeletes: ${cacheStats.deletes}\nEvictions: ${cacheStats.evictions}`,
        inline: true,
      },
      {
        name: 'Cache Memory Usage',
        value: `${cacheStats.memoryUsageFormatted} / ${cacheStats.maxMemoryFormatted}\nEntries: ${cacheStats.entryCount} / ${cacheStats.maxSize}`,
        inline: true,
      },
      {
        name: 'Configuration',
        value: `Strategy: ${cacheStats.evictionStrategy}\nUptime: ${cacheStats.uptimeFormatted}`,
        inline: true,
      },
    ],
    footer: {
      text: 'Cache memory tracks stored responses only - see /resources for total bot memory',
    },
    timestamp: new Date(),
  };

  // Add recent entries if available
  const recentEntriesValue =
    detailedInfo && detailedInfo.recentEntries && detailedInfo.recentEntries.length > 0
      ? detailedInfo.recentEntries
          .map((entry) => `• ${entry.key}: ${entry.value} (TTL: ${entry.ttl}s)`)
          .join('\n')
      : 'No recent entries';

  const recentEntriesField = {
    name: 'Recent Entries',
    value: recentEntriesValue,
    inline: false,
  };

  embed.fields.push(recentEntriesField);

  return embed;
}

module.exports = { buildCacheEmbed };
