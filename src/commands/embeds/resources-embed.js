/**
 * Resources embed builder
 * Generates Discord embed for /resources command
 */

const os = require('os');

/**
 * Build the resources embed
 * @param {Object} resourceStatus - Resource status from ResourceOptimizer
 * @param {number} actualServerCount - Actual server count
 * @param {string} hostname - System hostname
 * @param {Array} recommendations - Optimization recommendations
 * @returns {Object} Discord embed object
 */
function buildResourcesEmbed(resourceStatus, actualServerCount, hostname, recommendations) {
  return {
    color:
      resourceStatus.memory.status === 'good'
        ? 0x00ff00
        : resourceStatus.memory.status === 'warning'
          ? 0xffa500
          : 0xff0000,
    title: '🔧 Resource Optimization',
    description: '📊 Node.js process memory (heap) - see /cache for cached responses',
    fields: [
      {
        name: '🖥️ System Info',
        value: `Host: \`${hostname}\`\nPID: \`${process.pid}\`\nUser: \`${os.userInfo().username}\``,
        inline: false,
      },
      {
        name: '💾 Memory Status',
        value: `Status: ${resourceStatus.memory.status.toUpperCase()}\nUsed: ${resourceStatus.memory.used}MB\nFree: ${resourceStatus.memory.free}MB\nUsage: ${Math.round(resourceStatus.memory.percentage)}%`,
        inline: true,
      },
      {
        name: '⚙️ Performance',
        value: `Status: ${resourceStatus.performance.status.toUpperCase()}\nResponse Time: ${resourceStatus.performance.responseTime}ms\nLoad: ${resourceStatus.performance.load}`,
        inline: true,
      },
      {
        name: '📈 Optimization Tier',
        value: `Current: ${resourceStatus.optimizationTier}\nServer Count: ${actualServerCount}\nRecommended: Auto-scaling active`,
        inline: true,
      },
      {
        name: '💡 Recommendations',
        value: recommendations.slice(0, 3).join('\n') || '✅ System performance is good - continue monitoring',
        inline: false,
      },
    ],
    footer: {
      text: 'Total memory = used + free (heap allocated) | Free = available within allocated heap',
    },
    timestamp: new Date().toISOString(),
  };
}

module.exports = { buildResourcesEmbed };
