/**
 * Performance Tracker - Monitor and analyze bot performance metrics
 * Enterprise-grade performance monitoring and analysis
 */

class PerformanceTracker {
  constructor() {
    this.metrics = [];
    this.thresholds = {
      slowOperation: 5000,    // 5 seconds
      verySlowOperation: 10000, // 10 seconds
      maxMetrics: 1000        // Keep last 1000 metrics
    };
  }
  
  /**
   * Tracks an API call or operation performance
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {boolean} success - Whether operation succeeded
   * @param {Object} metadata - Additional metadata
   * @returns {Object} - Performance metrics
   */
  static trackApiCall(operation, duration, success, metadata = {}) {
    const metrics = {
      operation,
      duration,
      success,
      metadata,
      timestamp: new Date().toISOString(),
      memoryUsage: process.memoryUsage()
    };
    
    // Log performance issues
    const logger = require('./logger');
    
    if (duration > 10000) { // 10 second threshold
      logger.warn(`Very slow operation detected: ${operation} took ${duration}ms`, metadata);
    } else if (duration > 5000) { // 5 second threshold
      logger.info(`Slow operation detected: ${operation} took ${duration}ms`, metadata);
    }
    
    // Log memory issues
    const memMB = metrics.memoryUsage.heapUsed / 1024 / 1024;
    if (memMB > 100) { // 100MB threshold
      logger.warn(`High memory usage detected: ${memMB.toFixed(2)}MB during ${operation}`);
    }
    
    return metrics;
  }
  
  /**
   * Analyzes performance trends over time
   * @param {Array} metricsList - List of performance metrics
   * @returns {Object} - Performance analysis
   */
  static analyzePerformanceTrends(metricsList) {
    if (!metricsList || metricsList.length === 0) {
      return {
        averageResponseTime: 0,
        successRate: 100,
        slowOperations: 0,
        memoryTrend: 'stable',
        totalOperations: 0
      };
    }
    
    const analysis = PerformanceTracker._calculateBasicMetrics(metricsList);
    const memoryTrend = PerformanceTracker._analyzeMemoryTrend(metricsList);
    
    return {
      ...analysis,
      memoryTrend,
      totalOperations: metricsList.length
    };
  }
  
  /**
   * Calculates basic performance metrics
   * @param {Array} metricsList - List of metrics
   * @returns {Object} - Basic metrics
   * @private
   */
  static _calculateBasicMetrics(metricsList) {
    const durations = metricsList.map(m => m.duration);
    const successes = metricsList.filter(m => m.success).length;
    const slowOps = metricsList.filter(m => m.duration > 5000).length;
    
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const successRate = (successes / metricsList.length) * 100;
    
    return {
      averageResponseTime: Math.round(avgDuration),
      successRate: Math.round(successRate * 100) / 100,
      slowOperations: slowOps
    };
  }
  
  /**
   * Analyzes memory usage trends
   * @param {Array} metricsList - List of metrics
   * @returns {string} - Memory trend
   * @private
   */
  static _analyzeMemoryTrend(metricsList) {
    if (metricsList.length < 5) return 'insufficient_data';
    
    const recentMetrics = metricsList.slice(-5);
    const memoryValues = recentMetrics.map(m => m.memoryUsage.heapUsed);
    
    const avgEarly = memoryValues.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
    const avgLate = memoryValues.slice(-2).reduce((a, b) => a + b, 0) / 2;
    
    const changePercent = ((avgLate - avgEarly) / avgEarly) * 100;
    
    if (changePercent > 20) return 'increasing';
    if (changePercent < -10) return 'decreasing';
    return 'stable';
  }
  
  /**
   * Generates performance summary report
   * @param {Array} metricsList - List of metrics
   * @returns {Object} - Performance report
   */
  static generatePerformanceReport(metricsList) {
    const analysis = PerformanceTracker.analyzePerformanceTrends(metricsList);
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalOperations: analysis.totalOperations,
        averageResponseTime: `${analysis.averageResponseTime}ms`,
        successRate: `${analysis.successRate}%`,
        slowOperations: analysis.slowOperations,
        memoryTrend: analysis.memoryTrend
      },
      recommendations: PerformanceTracker._generateRecommendations(analysis)
    };
    
    return report;
  }
  
  /**
   * Generates performance recommendations
   * @param {Object} analysis - Performance analysis
   * @returns {Array} - List of recommendations
   * @private
   */
  static _generateRecommendations(analysis) {
    const recommendations = [];
    
    if (analysis.averageResponseTime > 3000) {
      recommendations.push('Consider optimizing API response times');
    }
    
    if (analysis.successRate < 95) {
      recommendations.push('Investigate error causes to improve success rate');
    }
    
    if (analysis.slowOperations > (analysis.totalOperations * 0.1)) {
      recommendations.push('High number of slow operations detected');
    }
    
    if (analysis.memoryTrend === 'increasing') {
      recommendations.push('Memory usage is increasing, check for memory leaks');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Performance metrics are within acceptable ranges');
    }
    
    return recommendations;
  }
}

module.exports = PerformanceTracker;
module.exports.PerformanceTracker = PerformanceTracker;
module.exports.default = PerformanceTracker;