/**
 * Resource Optimizer - reads the bot's own process memory and turns it into a
 * status, an optimization tier and recommendations. Only real readings are
 * reported: nothing in the bot records response times or error rates.
 */

class ResourceOptimizer {
  /**
   * Monitors process memory and suggests optimizations
   * @returns {Object} - { memory, overall, recommendations, optimizationTier, piOptimized? }
   */
  static monitorResources() {
    const memory = ResourceOptimizer._getMemoryMonitoring();
    const recommendations = ResourceOptimizer._generateResourceRecommendations(memory);

    const monitoring = {
      memory,
      overall: { status: ResourceOptimizer._getOverallStatus(memory) },
      recommendations,
      optimizationTier: ResourceOptimizer._determineOptimizationTier(memory),
    };

    return ResourceOptimizer._addPiOptimizations(monitoring, recommendations);
  }

  /**
   * Gets memory monitoring data
   * @returns {Object} - Memory monitoring data
   * @private
   */
  static _getMemoryMonitoring() {
    const memoryUsage = process.memoryUsage();
    const memoryMB = memoryUsage.heapUsed / 1024 / 1024;
    const totalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const usedMB = Math.round(memoryMB);

    return {
      used: usedMB,
      total: totalMB,
      free: Math.max(0, totalMB - usedMB),
      percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
      status: ResourceOptimizer._getMemoryStatus(memoryMB),
    };
  }

  /**
   * Calculates overall system status from memory
   * @param {Object} memory - Memory monitoring data
   * @returns {string} - healthy | warning | degraded | critical
   * @private
   */
  static _getOverallStatus(memory) {
    if (memory.status === 'critical') return 'critical';
    if (memory.status === 'high') return 'degraded';
    if (memory.percentage > 70) return 'warning';
    return 'healthy';
  }

  /**
   * Adds Pi note when Pi optimizations are enabled
   * @param {Object} monitoring - Monitoring data
   * @param {Array} recommendations - Recommendations array
   * @returns {Object} - Updated monitoring data
   * @private
   */
  static _addPiOptimizations(monitoring, recommendations) {
    try {
      const config = require('../config/config');
      if (config.PI_OPTIMIZATIONS && config.PI_OPTIMIZATIONS.ENABLED) {
        monitoring.piOptimized = true;
        recommendations.push('Pi-specific optimizations enabled - monitor memory usage closely');
      }
    } catch (error) {
      // Config not available
    }

    return monitoring;
  }

  /**
   * Gets memory status based on usage
   * @param {number} memoryMB - Memory usage in MB
   * @returns {string} - Memory status
   * @private
   */
  static _getMemoryStatus(memoryMB) {
    if (memoryMB > 400) return 'critical';
    if (memoryMB > 200) return 'high';
    if (memoryMB > 100) return 'normal';
    return 'good';
  }

  /**
   * Generates memory-based recommendations
   * @param {Object} memory - Memory monitoring data
   * @returns {Array} - Recommendations
   * @private
   */
  static _generateResourceRecommendations(memory) {
    const recommendations = [];

    if (memory.status === 'critical') {
      recommendations.push(
        'CRITICAL: Memory usage is very high - restart bot or reduce cache size'
      );
    } else if (memory.status === 'high') {
      recommendations.push('WARNING: High memory usage detected - consider cache cleanup');
    }

    if (memory.percentage > 80) {
      recommendations.push('Consider enabling aggressive cache eviction');
    }

    return recommendations;
  }

  /**
   * Determines optimization tier from memory
   * @param {Object} memory - Memory monitoring data
   * @returns {string} - Optimization tier
   * @private
   */
  static _determineOptimizationTier(memory) {
    if (memory.status === 'critical') return 'Critical';
    if (memory.status === 'high') return 'High';
    if (memory.percentage > 60) return 'Standard';
    return 'Optimal';
  }
}

module.exports = ResourceOptimizer;
module.exports.ResourceOptimizer = ResourceOptimizer;
module.exports.default = ResourceOptimizer;
