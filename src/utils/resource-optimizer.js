/**
 * Resource Optimizer - Dynamic resource allocation and scaling for Discord bot
 * Automatic performance optimization and resource monitoring
 */

const logger = require('./logger');

class ResourceOptimizer {
  constructor() {
    this.currentConfig = {
      serverCount: 0,
      lastOptimization: Date.now(),
      optimizationLevel: 'basic'
    };
    
    this.thresholds = {
      small: { servers: 10, users: 1000 },
      medium: { servers: 50, users: 10000 },
      large: { servers: 200, users: 50000 },
      enterprise: { servers: 1000, users: 250000 }
    };
  }

  /**
   * Optimizes resources based on current server count and activity
   * @param {number} serverCount - Current number of servers
   * @param {number} activeUsers - Current number of active users
   * @param {Object} performanceMetrics - Current performance data
   * @returns {Object} - Optimized configuration
   */
  static optimizeForServerCount(serverCount = 0, activeUsers = 0, performanceMetrics = {}) {
    const validatedServerCount = ResourceOptimizer._validateServerCount(serverCount);
    const tier = ResourceOptimizer._determineTier(validatedServerCount, activeUsers);
    const baseConfig = ResourceOptimizer._getBaseConfig(tier);
    
    const performanceAdjustments = ResourceOptimizer._applyPerformanceAdjustments(baseConfig, performanceMetrics);
    const piOptimizations = ResourceOptimizer._applyPiOptimizations(baseConfig);
    
    const result = ResourceOptimizer._buildOptimizationResult(
      tier, baseConfig, validatedServerCount, activeUsers, 
      performanceAdjustments, piOptimizations
    );

    ResourceOptimizer._logOptimization(validatedServerCount, tier, result);
    return result;
  }

  /**
   * Validates server count input
   * @private
   */
  static _validateServerCount(serverCount) {
    if (typeof serverCount !== 'number' || isNaN(serverCount) || serverCount < 0) {
      return 0;
    }
    return serverCount;
  }

  /**
   * Applies performance adjustments based on metrics
   * @private
   */
  static _applyPerformanceAdjustments(baseConfig, performanceMetrics) {
    if (performanceMetrics.avgResponseTime > 3000 || performanceMetrics.errorRate > 5) {
      const adjustments = {
        responseTimeAdjustment: performanceMetrics.avgResponseTime > 3000,
        errorRateAdjustment: performanceMetrics.errorRate > 5
      };
      
      baseConfig.memoryAllocation = Math.round(baseConfig.memoryAllocation * 1.2);
      baseConfig.maxConcurrentRequests = Math.round(baseConfig.maxConcurrentRequests * 0.8);
      
      return adjustments;
    }
    return null;
  }

  /**
   * Applies Pi-specific optimizations
   * @private
   */
  static _applyPiOptimizations(baseConfig) {
    try {
      const config = require('../config/config');
      if (config.PI_OPTIMIZATIONS) {
        baseConfig.memoryAllocation = Math.min(baseConfig.memoryAllocation * 0.7, 200);
        baseConfig.cacheSize = Math.min(baseConfig.cacheSize * 0.6, 100);
        return true;
      }
    } catch (error) {
      // Config not available, continue without Pi optimizations
    }
    return false;
  }

  /**
   * Builds the optimization result object
   * @private
   */
  static _buildOptimizationResult(tier, baseConfig, serverCount, activeUsers, performanceAdjustments, piOptimizations) {
    const result = {
      tier,
      memoryAllocation: baseConfig.memoryAllocation,
      cacheSize: baseConfig.cacheSize,
      maxConcurrentRequests: baseConfig.maxConcurrentRequests,
      optimizedAt: new Date().toISOString(),
      serverCount,
      activeUsers
    };

    if (performanceAdjustments) {
      result.performanceAdjustments = performanceAdjustments;
    }
    
    if (piOptimizations) {
      result.piOptimizations = piOptimizations;
    }

    return result;
  }

  /**
   * Determines tier based on server count and users
   * @private
   */
  static _determineTier(serverCount, activeUsers) {
    if (serverCount >= 100 || activeUsers >= 100000) return 'enterprise';
    if (serverCount >= 50 || activeUsers >= 25000) return 'large';
    if (serverCount >= 20 || activeUsers >= 5000) return 'medium';
    return 'small';
  }

  /**
   * Gets base configuration for tier
   * @private
   */
  static _getBaseConfig(tier) {
    const configs = {
      small: { memoryAllocation: 128, cacheSize: 50, maxConcurrentRequests: 20 },
      medium: { memoryAllocation: 256, cacheSize: 100, maxConcurrentRequests: 40 },
      large: { memoryAllocation: 400, cacheSize: 200, maxConcurrentRequests: 80 },
      enterprise: { memoryAllocation: 512, cacheSize: 300, maxConcurrentRequests: 100 }
    };
    return { ...configs[tier] };
  }

  /**
   * Logs optimization changes
   * @private
   */
  static _logOptimization(serverCount, tier, result) {
    logger.info(`Resource optimization applied for ${serverCount} servers (${tier} tier)`, {
      tier,
      memoryAllocation: result.memoryAllocation,
      cacheSize: result.cacheSize,
      maxConcurrentRequests: result.maxConcurrentRequests
    });

    return result;
  }

  /**
   * Monitors system resources and suggests optimizations
   * @param {Object} systemStats - Current system statistics
   * @returns {Object} - Resource monitoring results
   */
  static monitorResources(systemStats = {}) {
    // Handle null/undefined inputs
    if (!systemStats) systemStats = {};
    
    const memoryUsage = process.memoryUsage();
    const memoryMB = memoryUsage.heapUsed / 1024 / 1024;
    
    // Memory monitoring
    const memory = {
      used: Math.round(memoryMB),
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
      status: ResourceOptimizer._getMemoryStatus(memoryMB)
    };
    
    // Performance monitoring
    const performance = {
      cpuUsage: systemStats.cpuUsage || 0,
      responseTime: systemStats.avgResponseTime || 0,
      errorRate: systemStats.errorRate || 0,
      status: ResourceOptimizer._getPerformanceStatus(systemStats)
    };
    
    // Network monitoring (placeholder)
    const network = {
      status: 'normal',
      latency: 0,
      throughput: 100
    };
    
    // Overall status
    let overallStatus = 'healthy';
    if (memory.status === 'critical' || performance.status === 'poor') {
      overallStatus = 'critical';
    } else if (memory.status === 'high' || performance.status === 'degraded') {
      overallStatus = 'degraded';
    } else if (memory.percentage > 70 || performance.responseTime > 3000) {
      overallStatus = 'warning';
    }
    
    const overall = { status: overallStatus };
    
    // Generate recommendations
    const recommendations = ResourceOptimizer._generateResourceRecommendations({ memory, performance });
    
    const monitoring = {
      memory,
      performance,
      network,
      overall,
      recommendations
    };

    // Check for Pi optimizations
    try {
      const config = require('../config/config');
      if (config.PI_OPTIMIZATIONS) {
        monitoring.piOptimized = true;
        recommendations.push('Pi-specific optimizations enabled - monitor memory usage closely');
      }
    } catch (error) {
      // Config not available
    }

    return monitoring;
  }

  /**
   * Applies dynamic scaling based on current load
   * @param {Object} currentConfig - Current configuration
   * @param {Object} metrics - Current system metrics
   * @returns {Object} - Scaling result
   */
  static applyDynamicScaling(currentConfig, metrics = {}) {
    // Handle invalid inputs
    if (!currentConfig) currentConfig = {};
    if (!metrics) metrics = {};
    
    const avgResponseTime = metrics.avgResponseTime || 0;
    const errorRate = metrics.errorRate || 0;
    const serverCount = metrics.serverCount || 0;
    
    // Determine if scaling is needed
    if (!ResourceOptimizer._shouldScale(avgResponseTime, errorRate, serverCount)) {
      return {
        scaled: false,
        reason: 'performance is within acceptable limits - no scaling needed',
        currentConfig
      };
    }
    
    // Apply scaling adjustments
    const newConfig = { ...currentConfig };
    const adjustments = [];
    
    ResourceOptimizer._applyResponseTimeScaling(newConfig, avgResponseTime, adjustments);
    ResourceOptimizer._applyErrorRateScaling(newConfig, errorRate, adjustments);
    ResourceOptimizer._applyServerCountScaling(newConfig, serverCount, adjustments);

    logger.info('Dynamic scaling applied', {
      avgResponseTime,
      errorRate,
      serverCount,
      adjustments: adjustments.length
    });

    return {
      scaled: true,
      adjustments,
      newConfig,
      appliedAt: new Date().toISOString()
    };
  }

  /**
   * Determines if scaling is needed based on metrics
   * @private
   */
  static _shouldScale(avgResponseTime, errorRate, serverCount) {
    return avgResponseTime > 3000 || errorRate > 5 || serverCount > 50;
  }

  /**
   * Applies response time scaling adjustments
   * @private
   */
  static _applyResponseTimeScaling(config, avgResponseTime, adjustments) {
    if (avgResponseTime > 3000) {
      config.memoryAllocation = (config.memoryAllocation || 200) * 1.2;
      config.maxConcurrentRequests = Math.max((config.maxConcurrentRequests || 20) * 0.8, 5);
      adjustments.push('Increased memory allocation due to slow response times');
    }
  }

  /**
   * Applies error rate scaling adjustments
   * @private
   */
  static _applyErrorRateScaling(config, errorRate, adjustments) {
    if (errorRate > 5) {
      config.maxConcurrentRequests = Math.max((config.maxConcurrentRequests || 20) * 0.7, 3);
      adjustments.push('Reduced concurrent requests due to high error rate');
    }
  }

  /**
   * Applies server count scaling adjustments
   * @private
   */
  static _applyServerCountScaling(config, serverCount, adjustments) {
    if (serverCount > 50) {
      config.cacheSize = (config.cacheSize || 100) * 1.5;
      adjustments.push('Increased cache size for high server count');
    }
  }

  /**
   * Generates optimization recommendations based on usage patterns
   * @param {Object} analyticsData - Discord analytics data
   * @param {Object} performanceData - Performance metrics
   * @returns {Array} - Optimization recommendations (strings)
   */
  static generateOptimizationRecommendations(analyticsData = {}, performanceData = {}) {
    const recommendations = [];
    const metrics = ResourceOptimizer._extractMetrics(analyticsData, performanceData);
    
    ResourceOptimizer._addServerRecommendations(metrics.serverCount, recommendations);
    ResourceOptimizer._addPerformanceRecommendations(metrics.avgResponseTime, recommendations);
    ResourceOptimizer._addErrorRateRecommendations(metrics.errorRate, recommendations);
    ResourceOptimizer._addMemoryRecommendations(metrics.memoryUsage, recommendations);    if (recommendations.length === 0) {
      recommendations.push('System performance is good - continue monitoring');
    }

    return recommendations;
  }

  /**
   * Extracts metrics from analytics and performance data
   * @private
   */
  static _extractMetrics(analyticsData = {}, performanceData = {}) {
    // Handle null inputs
    if (!analyticsData) analyticsData = {};
    if (!performanceData) performanceData = {};
    
    return {
      serverCount: (analyticsData.summary && analyticsData.summary.totalServers) || analyticsData.serverCount || 0,
      avgResponseTime: performanceData.averageResponseTime || performanceData.avgResponseTime || 0,
      errorRate: (analyticsData.summary && analyticsData.summary.errorRate) || performanceData.errorRate || 0,
      memoryUsage: performanceData.memoryUsage || 0
    };
  }

  /**
   * Adds server scaling recommendations
   * @private
   */
  static _addServerRecommendations(serverCount, recommendations) {
    if (serverCount > 80) {
      recommendations.push('Consider implementing horizontal scaling for large server count');
    } else if (serverCount > 50) {
      recommendations.push('Monitor server performance closely - approaching scaling threshold');
    }
  }

  /**
   * Adds performance recommendations
   * @private
   */
  static _addPerformanceRecommendations(avgResponseTime, recommendations) {
    if (avgResponseTime > 4000) {
      recommendations.push('Response times are slow - consider performance optimization');
    } else if (avgResponseTime > 2500) {
      recommendations.push('Response times are elevated - monitor performance trends');
    }
  }

  /**
   * Adds error rate recommendations
   * @private
   */
  static _addErrorRateRecommendations(errorRate, recommendations) {
    if (errorRate > 10) {
      recommendations.push('High error rate detected - investigate reliability issues');
    } else if (errorRate > 5) {
      recommendations.push('Elevated error rate - monitor for patterns');
    }
  }

  /**
   * Adds memory usage recommendations
   * @private
   */
  /**
   * Adds memory usage recommendations
   * @private
   */
  static _addMemoryRecommendations(memoryUsage, recommendations) {
    if (memoryUsage > 400) {
      recommendations.push('High memory usage - consider memory optimization strategies');
    }
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
    return 'low';
  }

  /**
   * Gets performance status
   * @param {Object} systemStats - System statistics
   * @returns {string} - Performance status
   * @private
   */
  static _getPerformanceStatus(systemStats) {
    const responseTime = systemStats.avgResponseTime || 0;
    const errorRate = systemStats.errorRate || 0;

    if (responseTime > 5000 || errorRate > 15) return 'poor';
    if (responseTime > 2000 || errorRate > 5) return 'degraded';
    if (responseTime < 1000 && errorRate < 2) return 'excellent';
    return 'good';
  }

  /**
   * Generates resource-based recommendations
   * @param {Object} monitoring - Monitoring data
   * @returns {Array} - Resource recommendations
   * @private
   */
  static _generateResourceRecommendations(monitoring) {
    const recommendations = [];

    // Memory recommendations
    if (monitoring.memory.status === 'critical') {
      recommendations.push('CRITICAL: Memory usage is very high - restart bot or reduce cache size');
    } else if (monitoring.memory.status === 'high') {
      recommendations.push('WARNING: High memory usage detected - consider cache cleanup');
    }

    // Performance recommendations
    if (monitoring.performance.status === 'poor') {
      recommendations.push('URGENT: Poor performance detected - check system resources');
    } else if (monitoring.performance.status === 'degraded') {
      recommendations.push('NOTICE: Performance is degraded - monitor system closely');
    }

    // Optimization recommendations
    if (monitoring.memory.percentage > 80) {
      recommendations.push('Consider enabling aggressive cache eviction');
    }

    if (monitoring.performance.responseTime > 3000) {
      recommendations.push('Response time is slow - consider increasing connection pool');
    }

    return recommendations;
  }
}

module.exports = ResourceOptimizer;
module.exports.ResourceOptimizer = ResourceOptimizer;
module.exports.default = ResourceOptimizer;