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
    // Handle invalid inputs
    if (typeof serverCount !== 'number' || isNaN(serverCount) || serverCount < 0) {
      serverCount = 0;
    }
    
    // Determine optimization tier
    let tier = 'small';
    if (serverCount >= 100) tier = 'enterprise';
    else if (serverCount >= 50) tier = 'large';
    else if (serverCount >= 20) tier = 'medium';
    
    // Base configurations for each tier
    const configurations = {
      small: {
        memoryAllocation: 128,
        cacheSize: 50,
        maxConcurrentRequests: 10
      },
      medium: {
        memoryAllocation: 256,
        cacheSize: 100,
        maxConcurrentRequests: 25
      },
      large: {
        memoryAllocation: 512,
        cacheSize: 200,
        maxConcurrentRequests: 50
      },
      enterprise: {
        memoryAllocation: 1024,
        cacheSize: 500,
        maxConcurrentRequests: 100
      }
    };

    const baseConfig = configurations[tier];
    
    // Apply performance adjustments if metrics indicate issues
    let performanceAdjustments = null;
    if (performanceMetrics.avgResponseTime > 3000 || performanceMetrics.errorRate > 5) {
      performanceAdjustments = {
        responseTimeAdjustment: performanceMetrics.avgResponseTime > 3000,
        errorRateAdjustment: performanceMetrics.errorRate > 5
      };
      
      // Increase resources for poor performance
      baseConfig.memoryAllocation = Math.round(baseConfig.memoryAllocation * 1.2);
      baseConfig.maxConcurrentRequests = Math.round(baseConfig.maxConcurrentRequests * 0.8);
    }

    // Apply Pi-specific optimizations if enabled
    let piOptimizations = false;
    try {
      const config = require('../config/config');
      if (config.PI_OPTIMIZATIONS) {
        piOptimizations = true;
        baseConfig.memoryAllocation = Math.min(baseConfig.memoryAllocation * 0.7, 200);
        baseConfig.cacheSize = Math.min(baseConfig.cacheSize * 0.6, 100);
      }
    } catch (error) {
      // Config not available, continue without Pi optimizations
    }

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

    // Log optimization changes
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
      status: this._getMemoryStatus(memoryMB)
    };
    
    // Performance monitoring
    const performance = {
      cpuUsage: systemStats.cpuUsage || 0,
      responseTime: systemStats.avgResponseTime || 0,
      errorRate: systemStats.errorRate || 0,
      status: this._getPerformanceStatus(systemStats)
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
    const recommendations = this._generateResourceRecommendations({ memory, performance });
    
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
    const needsScaling = avgResponseTime > 3000 || errorRate > 5 || serverCount > 50;
    
    if (!needsScaling) {
      return {
        scaled: false,
        reason: 'performance is within acceptable limits - no scaling needed',
        currentConfig
      };
    }
    
    // Apply scaling adjustments
    const newConfig = { ...currentConfig };
    const adjustments = [];
    
    if (avgResponseTime > 3000) {
      newConfig.memoryAllocation = (newConfig.memoryAllocation || 200) * 1.2;
      newConfig.maxConcurrentRequests = Math.max((newConfig.maxConcurrentRequests || 20) * 0.8, 5);
      adjustments.push('Increased memory allocation due to slow response times');
    }
    
    if (errorRate > 5) {
      newConfig.maxConcurrentRequests = Math.max((newConfig.maxConcurrentRequests || 20) * 0.7, 3);
      adjustments.push('Reduced concurrent requests due to high error rate');
    }
    
    if (serverCount > 50) {
      newConfig.cacheSize = (newConfig.cacheSize || 100) * 1.5;
      adjustments.push('Increased cache size for high server count');
    }

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
   * Generates optimization recommendations based on usage patterns
   * @param {Object} analyticsData - Discord analytics data
   * @param {Object} performanceData - Performance metrics
   * @returns {Array} - Optimization recommendations (strings)
   */
  static generateOptimizationRecommendations(analyticsData = {}, performanceData = {}) {
    const recommendations = [];

    // Handle null inputs gracefully
    if (!analyticsData) analyticsData = {};
    if (!performanceData) performanceData = {};
    
    // Extract data safely
    const serverCount = (analyticsData.summary && analyticsData.summary.totalServers) || analyticsData.serverCount || 0;
    const avgResponseTime = performanceData.averageResponseTime || performanceData.avgResponseTime || 0;
    const errorRate = (analyticsData.summary && analyticsData.summary.errorRate) || performanceData.errorRate || 0;

    // Server scaling recommendations
    if (serverCount > 80) {
      recommendations.push('Consider implementing horizontal scaling for large server count');
    } else if (serverCount > 50) {
      recommendations.push('Monitor server performance closely - approaching scaling threshold');
    }

    // Performance recommendations
    if (avgResponseTime > 4000) {
      recommendations.push('Response times are slow - consider performance optimization');
    } else if (avgResponseTime > 2500) {
      recommendations.push('Response times are elevated - monitor performance trends');
    }

    // Error rate recommendations
    if (errorRate > 10) {
      recommendations.push('High error rate detected - investigate reliability issues');
    } else if (errorRate > 5) {
      recommendations.push('Elevated error rate - monitor for patterns');
    }

    // Memory recommendations
    const memoryUsage = performanceData.memoryUsage || 0;
    if (memoryUsage > 400) {
      recommendations.push('High memory usage - consider memory optimization strategies');
    }

    // Default recommendation if no issues
    if (recommendations.length === 0) {
      recommendations.push('System performance is good - continue monitoring');
    }

    return recommendations;
  }

  /**
   * Determines optimization tier based on scale
   * @param {number} serverCount - Number of servers
   * @param {number} activeUsers - Number of active users
   * @returns {string} - Optimization tier
   * @private
   */
  static _determineTier(serverCount, activeUsers) {
    if (serverCount >= 1000 || activeUsers >= 250000) return 'enterprise';
    if (serverCount >= 200 || activeUsers >= 50000) return 'large';
    if (serverCount >= 50 || activeUsers >= 10000) return 'medium';
    return 'small';
  }

  /**
   * Gets base configuration for optimization tier
   * @param {string} tier - Optimization tier
   * @returns {Object} - Base configuration
   * @private
   */
  static _getBaseConfig(tier) {
    const configs = {
      small: {
        cacheSize: 100,
        maxConnections: 5,
        connectionTimeout: 10000,
        debounceDelay: 300,
        memoryLimit: 128,
        enablePriorityQueuing: false,
        maxConcurrentRequests: 3,
        cacheEvictionRate: 'normal'
      },
      medium: {
        cacheSize: 300,
        maxConnections: 10,
        connectionTimeout: 8000,
        debounceDelay: 200,
        memoryLimit: 256,
        enablePriorityQueuing: true,
        maxConcurrentRequests: 6,
        cacheEvictionRate: 'normal'
      },
      large: {
        cacheSize: 500,
        maxConnections: 15,
        connectionTimeout: 6000,
        debounceDelay: 150,
        memoryLimit: 512,
        enablePriorityQueuing: true,
        maxConcurrentRequests: 10,
        cacheEvictionRate: 'lazy'
      },
      enterprise: {
        cacheSize: 1000,
        maxConnections: 25,
        connectionTimeout: 5000,
        debounceDelay: 100,
        memoryLimit: 1024,
        enablePriorityQueuing: true,
        maxConcurrentRequests: 15,
        cacheEvictionRate: 'lazy'
      }
    };

    return configs[tier] || configs.small;
  }

  /**
   * Applies performance-based configuration adjustments
   * @param {Object} baseConfig - Base configuration
   * @param {Object} performanceMetrics - Performance metrics
   * @returns {Object} - Adjusted configuration
   * @private
   */
  static _applyPerformanceAdjustments(baseConfig, performanceMetrics) {
    const adjusted = { ...baseConfig };

    // Adjust based on response time
    if (performanceMetrics.avgResponseTime > 3000) {
      adjusted.maxConnections = Math.min(adjusted.maxConnections + 3, 25);
      adjusted.connectionTimeout = Math.max(adjusted.connectionTimeout - 2000, 3000);
    }

    // Adjust based on error rate
    if (performanceMetrics.errorRate > 10) {
      adjusted.maxConcurrentRequests = Math.max(adjusted.maxConcurrentRequests - 2, 2);
      adjusted.debounceDelay = Math.min(adjusted.debounceDelay + 100, 1000);
    }

    // Adjust based on memory usage
    const memoryMB = (performanceMetrics.memoryUsage || 0) / 1024 / 1024;
    if (memoryMB > 300) {
      adjusted.cacheSize = Math.max(adjusted.cacheSize * 0.7, 50);
      adjusted.cacheEvictionRate = 'aggressive';
    }

    return adjusted;
  }

  /**
   * Applies Pi-specific optimizations
   * @param {Object} config - Configuration to optimize
   * @param {number} serverCount - Number of servers
   * @returns {Object} - Pi-optimized configuration
   * @private
   */
  static _applyPiOptimizations(config, serverCount) {
    const piConfig = { ...config };

    // Reduce resource usage for Pi
    piConfig.cacheSize = Math.min(piConfig.cacheSize * 0.6, 200);
    piConfig.maxConnections = Math.min(piConfig.maxConnections, 8);
    piConfig.memoryLimit = Math.min(piConfig.memoryLimit, 256);

    // Increase timeouts for Pi's slower processing
    piConfig.connectionTimeout = Math.max(piConfig.connectionTimeout * 1.5, 8000);
    piConfig.debounceDelay = Math.max(piConfig.debounceDelay * 1.2, 400);

    // Enable aggressive cleanup for Pi
    piConfig.cacheEvictionRate = 'aggressive';
    piConfig.enablePriorityQueuing = serverCount > 5;

    logger.info('Pi-specific optimizations applied', {
      originalCacheSize: config.cacheSize,
      piCacheSize: piConfig.cacheSize,
      originalConnections: config.maxConnections,
      piConnections: piConfig.maxConnections
    });

    return piConfig;
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