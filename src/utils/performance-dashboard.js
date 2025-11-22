/**
 * Performance Dashboard - Unified dashboard for Discord bot monitoring and optimization
 * Performance dashboard combining analytics and resource optimization
 */

const DiscordAnalytics = require('./discord-analytics');
const ResourceOptimizer = require('./resource-optimizer');
const PerformanceTracker = require('./performance-tracker');
const logger = require('./logger');

class PerformanceDashboard {
  constructor() {
    this.lastReport = null;
    this.alertThresholds = {
      errorRate: 5,
      responseTime: 3000,
      memoryUsage: 300,
      securityThreats: 10,
    };
  }

  /**
   * Generates comprehensive dashboard report
   * @param {Array} activityHistory - Discord activity history
   * @param {Array} performanceMetrics - Performance tracking data
   * @returns {Object} - Complete dashboard report
   */
  static generateDashboardReport(activityHistory = [], performanceMetrics = []) {
    const timestamp = new Date().toISOString();

    // Collect all data components with error handling
    let dataComponents;
    try {
      dataComponents = this._collectDashboardData(activityHistory, performanceMetrics);
    } catch (error) {
      logger.error('Failed to collect dashboard data, using fallback data.', { error });
      // Fallback if services fail
      dataComponents = {
        analyticsReport: { summary: { totalServers: 0, totalUsers: 0, errorRate: 0 } },
        usagePatterns: { commandPopularity: [], userEngagement: 'low', growthTrend: 'stable' },
        performanceAnalysis: { averageResponseTime: 0, slowOperations: 0, totalOperations: 0 },
        performanceReport: { summary: 'Service unavailable' },
        optimizedConfig: { tier: 'small' },
        resourceMonitoring: {
          memory: { used: 0, status: 'unknown' },
          performance: { status: 'unknown' },
        },
        optimizationRecommendations: ['Services unavailable - using fallback data'],
      };
    }

    // Compile comprehensive report
    const dashboardReport = this._compileDashboardReport(timestamp, dataComponents);

    // Log dashboard generation
    logger.info('Performance dashboard generated', {
      serverCount: dashboardReport.overview.serverCount,
      status: dashboardReport.overview.status,
      actionItems: dashboardReport.actionItems.length,
    });

    return dashboardReport;
  }

  /**
   * Collects all data components for dashboard
   * @param {Array} activityHistory - Activity history
   * @param {Array} performanceMetrics - Performance metrics
   * @returns {Object} - Data components
   * @private
   */
  static _collectDashboardData(activityHistory, performanceMetrics) {
    const analyticsData = this._getAnalyticsData(activityHistory);
    const performanceData = this._getPerformanceData(performanceMetrics);
    const resourceData = this._getResourceData(analyticsData, performanceData);

    return {
      ...analyticsData,
      ...performanceData,
      ...resourceData,
    };
  }

  /**
   * Gets analytics data with error handling
   * @private
   */
  static _getAnalyticsData(activityHistory) {
    try {
      return {
        analyticsReport: DiscordAnalytics.generateDailyReport(activityHistory),
        usagePatterns: DiscordAnalytics.analyzeUsagePatterns(activityHistory),
      };
    } catch (error) {
      return {
        analyticsReport: { summary: { totalServers: 0, totalUsers: 0, errorRate: 0 } },
        usagePatterns: { commandPopularity: [], userEngagement: 'low', growthTrend: 'stable' },
      };
    }
  }

  /**
   * Gets performance data with error handling
   * @private
   */
  static _getPerformanceData(performanceMetrics) {
    try {
      return {
        performanceAnalysis: PerformanceTracker.analyzePerformanceTrends(performanceMetrics),
        performanceReport: PerformanceTracker.generatePerformanceReport(performanceMetrics),
      };
    } catch (error) {
      return {
        performanceAnalysis: { averageResponseTime: 0, slowOperations: 0, totalOperations: 0 },
        performanceReport: { summary: 'Performance service unavailable' },
      };
    }
  }

  /**
   * Gets resource optimization data with error handling
   * @private
   */
  static _getResourceData(analyticsData, performanceData) {
    const serverCount = analyticsData.analyticsReport?.summary?.totalServers || 0;
    const activeUsers = analyticsData.analyticsReport?.summary?.totalUsers || 0;
    const avgResponseTime = performanceData.performanceAnalysis?.averageResponseTime || 0;
    const errorRate = analyticsData.analyticsReport?.summary?.errorRate || 0;

    try {
      return {
        optimizedConfig: ResourceOptimizer.optimizeForServerCount(serverCount, activeUsers, {
          avgResponseTime,
          errorRate,
        }),
        resourceMonitoring: ResourceOptimizer.monitorResources({
          avgResponseTime,
          errorRate,
          cpuUsage: 0,
        }),
        optimizationRecommendations: ResourceOptimizer.generateOptimizationRecommendations(
          analyticsData.analyticsReport,
          performanceData.performanceAnalysis
        ),
      };
    } catch (error) {
      return {
        optimizedConfig: { tier: 'unknown' },
        resourceMonitoring: {
          memory: { used: 0, status: 'unknown' },
          performance: { status: 'unknown' },
        },
        optimizationRecommendations: ['Resource optimization service unavailable'],
      };
    }
  }

  /**
   * Compiles final dashboard report
   * @param {string} timestamp - Report timestamp
   * @param {Object} dataComponents - Data components
   * @returns {Object} - Dashboard report
   * @private
   */
  static _compileDashboardReport(timestamp, dataComponents) {
    const {
      analyticsReport,
      usagePatterns,
      performanceAnalysis,
      performanceReport,
      optimizedConfig,
      resourceMonitoring,
      optimizationRecommendations,
    } = dataComponents;

    return {
      timestamp,
      overview: this._buildOverviewSection(
        analyticsReport,
        performanceAnalysis,
        resourceMonitoring,
        optimizedConfig
      ),
      analytics: this._buildAnalyticsSection(analyticsReport, usagePatterns),
      performance: this._buildPerformanceSection(performanceAnalysis, performanceReport),
      resources: this._buildResourcesSection(
        resourceMonitoring,
        optimizedConfig,
        optimizationRecommendations
      ),
      security: this._buildSecuritySection(),
      actionItems: this._buildActionItemsSection(
        analyticsReport,
        performanceAnalysis,
        resourceMonitoring
      ),
      nextSteps: this._buildNextStepsSection(analyticsReport, performanceAnalysis, optimizedConfig),
    };
  }

  /**
   * Builds the overview section of the dashboard
   * @param {Object} analyticsReport - Analytics report
   * @param {Object} performanceAnalysis - Performance analysis
   * @param {Object} resourceMonitoring - Resource monitoring data
   * @param {Object} optimizedConfig - Optimized configuration
   * @returns {Object} - Overview section
   * @private
   */
  static _buildOverviewSection(
    analyticsReport,
    performanceAnalysis,
    resourceMonitoring,
    optimizedConfig
  ) {
    return {
      status: this._calculateOverallStatus(
        analyticsReport,
        performanceAnalysis,
        resourceMonitoring
      ),
      serverCount:
        analyticsReport && analyticsReport.summary ? analyticsReport.summary.totalServers : 0,
      activeUsers:
        analyticsReport && analyticsReport.summary ? analyticsReport.summary.totalUsers : 0,
      totalCommands:
        analyticsReport && analyticsReport.summary ? analyticsReport.summary.totalCommands : 0,
      errorRate:
        analyticsReport && analyticsReport.summary ? `${analyticsReport.summary.errorRate}%` : '0%',
      responseTime: performanceAnalysis ? `${performanceAnalysis.averageResponseTime}ms` : '0ms',
      averageResponseTime: performanceAnalysis
        ? `${performanceAnalysis.averageResponseTime}ms`
        : '0ms',
      memoryUsage:
        resourceMonitoring && resourceMonitoring.memory
          ? `${resourceMonitoring.memory.used}MB`
          : '0MB',
      optimizationTier: optimizedConfig ? optimizedConfig.tier : 'unknown',
    };
  }

  /**
   * Builds the analytics section of the dashboard
   * @param {Object} analyticsReport - Analytics report
   * @param {Object} usagePatterns - Usage patterns
   * @returns {Object} - Analytics section
   * @private
   */
  static _buildAnalyticsSection(analyticsReport, usagePatterns) {
    return {
      daily: analyticsReport,
      patterns: usagePatterns,
      insights: this._generateInsights(analyticsReport, usagePatterns),
    };
  }

  /**
   * Builds the performance section of the dashboard
   * @param {Object} performanceAnalysis - Performance analysis
   * @param {Object} performanceReport - Performance report
   * @returns {Object} - Performance section
   * @private
   */
  static _buildPerformanceSection(performanceAnalysis, performanceReport) {
    return {
      trends: performanceAnalysis,
      report: performanceReport,
      alerts: this._checkPerformanceAlerts(performanceAnalysis),
    };
  }

  /**
   * Builds the resources section of the dashboard
   * @param {Object} resourceMonitoring - Resource monitoring data
   * @param {Object} optimizedConfig - Optimized configuration
   * @param {Array} optimizationRecommendations - Optimization recommendations
   * @returns {Object} - Resources section
   * @private
   */
  static _buildResourcesSection(resourceMonitoring, optimizedConfig, optimizationRecommendations) {
    return {
      current: resourceMonitoring,
      optimized: optimizedConfig,
      recommendations: optimizationRecommendations,
    };
  }

  /**
   * Builds the security section of the dashboard
   * @returns {Object} - Security section
   * @private
   */
  static _buildSecuritySection() {
    return {
      summary: this._getSecuritySummary([]), // Will pass activityHistory in real implementation
      recommendations: this._getSecurityRecommendations([]),
    };
  }

  /**
   * Builds the action items section of the dashboard
   * @param {Object} analyticsReport - Analytics report
   * @param {Object} performanceAnalysis - Performance analysis
   * @param {Object} resourceMonitoring - Resource monitoring data
   * @returns {Array} - Action items
   * @private
   */
  static _buildActionItemsSection(analyticsReport, performanceAnalysis, resourceMonitoring) {
    return this._generateActionItems(analyticsReport, performanceAnalysis, resourceMonitoring);
  }

  /**
   * Builds the next steps section of the dashboard
   * @param {Object} analyticsReport - Analytics report
   * @param {Object} performanceAnalysis - Performance analysis
   * @param {Object} optimizedConfig - Optimized configuration
   * @returns {Array} - Next steps
   * @private
   */
  static _buildNextStepsSection(analyticsReport, performanceAnalysis, optimizedConfig) {
    return this._generateNextSteps(analyticsReport, performanceAnalysis, optimizedConfig);
  }

  /**
   * Generates real-time status update
   * @returns {Object} - Real-time status
   */
  static getRealTimeStatus() {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: Math.round(uptime),
        formatted: this._formatUptime(uptime),
      },
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
      },
      status: 'online',
      lastUpdate: new Date().toISOString(),
    };
  }

  /**
   * Generates alerts based on current metrics
   * @param {Object} currentMetrics - Current system metrics
   * @returns {Array} - Active alerts
   */
  static generateAlerts(currentMetrics) {
    const alerts = [];
    const timestamp = new Date().toISOString();

    // Collect all alert types
    alerts.push(...this._checkMemoryAlerts(currentMetrics, timestamp));
    alerts.push(...this._checkPerformanceResponseAlerts(currentMetrics, timestamp));
    alerts.push(...this._checkReliabilityAlerts(currentMetrics, timestamp));

    return alerts;
  }

  /**
   * Checks memory-related alerts
   * @param {Object} currentMetrics - Current metrics
   * @param {string} timestamp - Alert timestamp
   * @returns {Array} - Memory alerts
   * @private
   */
  static _checkMemoryAlerts(currentMetrics, timestamp) {
    const alerts = [];

    if (!currentMetrics || currentMetrics.memoryUsage === undefined) {
      return alerts;
    }

    if (currentMetrics.memoryUsage > 400) {
      alerts.push({
        type: 'memory',
        severity: 'critical',
        message: 'Memory usage is critically high',
        value: `${currentMetrics.memoryUsage}MB`,
        threshold: '400MB',
        timestamp,
      });
    } else if (currentMetrics.memoryUsage > 200) {
      alerts.push({
        type: 'memory',
        severity: 'warning',
        message: 'Memory usage is elevated',
        value: `${currentMetrics.memoryUsage}MB`,
        threshold: '200MB',
        timestamp,
      });
    }

    return alerts;
  }

  /**
   * Checks performance-related alerts
   * @param {Object} currentMetrics - Current metrics
   * @param {string} timestamp - Alert timestamp
   * @returns {Array} - Performance alerts
   * @private
   */
  static _checkPerformanceResponseAlerts(currentMetrics, timestamp) {
    const alerts = [];

    if (!currentMetrics || currentMetrics.avgResponseTime === undefined) {
      return alerts;
    }

    if (currentMetrics.avgResponseTime > 5000) {
      alerts.push({
        type: 'performance',
        severity: 'critical',
        message: 'Response time is very slow',
        value: `${currentMetrics.avgResponseTime}ms`,
        threshold: '5000ms',
        timestamp,
      });
    } else if (currentMetrics.avgResponseTime > 3000) {
      alerts.push({
        type: 'performance',
        severity: 'warning',
        message: 'Response time is slower than expected',
        value: `${currentMetrics.avgResponseTime}ms`,
        threshold: '3000ms',
        timestamp,
      });
    }

    return alerts;
  }

  /**
   * Checks reliability-related alerts
   * @param {Object} currentMetrics - Current metrics
   * @param {string} timestamp - Alert timestamp
   * @returns {Array} - Reliability alerts
   * @private
   */
  static _checkReliabilityAlerts(currentMetrics, timestamp) {
    const alerts = [];

    if (!currentMetrics || currentMetrics.errorRate === undefined) {
      return alerts;
    }

    if (currentMetrics.errorRate > 10) {
      alerts.push({
        type: 'reliability',
        severity: 'critical',
        message: 'Error rate is critically high',
        value: `${currentMetrics.errorRate}%`,
        threshold: '10%',
        timestamp,
      });
    } else if (currentMetrics.errorRate > 5) {
      alerts.push({
        type: 'reliability',
        severity: 'warning',
        message: 'Error rate is elevated',
        value: `${currentMetrics.errorRate}%`,
        threshold: '5%',
        timestamp,
      });
    }

    return alerts;
  }

  /**
   * Exports dashboard data for external monitoring
   * @param {Object} dashboardData - Dashboard report data
   * @param {string} format - Export format (json, csv, text)
   * @returns {string} - Formatted export data
   */
  static exportDashboardData(dashboardData, format = 'json') {
    switch (format.toLowerCase()) {
    case 'json':
      return JSON.stringify(dashboardData, null, 2);

    case 'csv':
      return this._exportToCSV(dashboardData);

    case 'text':
      return this._exportToText(dashboardData);

    default:
      return JSON.stringify(dashboardData, null, 2);
    }
  }

  /**
   * Calculates overall system status
   * @param {Object} analytics - Analytics data
   * @param {Object} performance - Performance data
   * @param {Object} resources - Resource data
   * @returns {string} - Overall status
   * @private
   */
  static _calculateOverallStatus(analytics, performance, resources) {
    const issues = this._collectSystemIssues(analytics, performance, resources);
    return this._determineStatusFromIssues(issues);
  }

  /**
   * Collects system issues from all monitoring sources
   * @param {Object} analytics - Analytics data
   * @param {Object} performance - Performance data
   * @param {Object} resources - Resource data
   * @returns {Array} - List of issues
   * @private
   */
  static _collectSystemIssues(analytics, performance, resources) {
    const issues = [];

    // Check analytics
    if (analytics && analytics.summary) {
      if (analytics.summary.errorRate > 10) issues.push('high_error_rate');
      // Removed: totalCommands === 0 check - this is normal for quiet periods
    }

    // Check performance
    if (performance) {
      if (performance.averageResponseTime > 5000) issues.push('slow_performance');
      if (performance.slowOperations > performance.totalOperations * 0.2)
        issues.push('many_slow_ops');
    }

    // Check resources
    if (resources) {
      if (resources.memory && resources.memory.status === 'critical')
        issues.push('memory_critical');
      if (resources.performance && resources.performance.status === 'poor')
        issues.push('performance_poor');
    }

    return issues;
  }

  /**
   * Determines status from collected issues
   * @param {Array} issues - List of system issues
   * @returns {string} - Overall status
   * @private
   */
  static _determineStatusFromIssues(issues) {
    if (issues.length === 0) return 'healthy';

    const criticalIssues = ['memory_critical', 'performance_poor', 'high_error_rate'];
    if (issues.some((i) => criticalIssues.includes(i))) return 'critical';

    if (issues.length > 2) return 'degraded';
    return 'warning';
  }

  /**
   * Generates insights from analytics data
   * @param {Object} analyticsReport - Analytics report
   * @param {Object} usagePatterns - Usage patterns
   * @returns {Array} - Generated insights
   * @private
   */
  static _generateInsights(analyticsReport, usagePatterns) {
    const insights = [];

    // Growth insights
    if (usagePatterns.growthTrend === 'growing') {
      insights.push('Bot usage is growing - consider scaling resources');
    } else if (usagePatterns.growthTrend === 'declining') {
      insights.push('Bot usage is declining - investigate user experience issues');
    }

    // Engagement insights
    if (usagePatterns.userEngagement === 'high') {
      insights.push('Users are highly engaged - great job on user experience!');
    } else if (usagePatterns.userEngagement === 'low') {
      insights.push('Low user engagement detected - consider feature improvements');
    }

    // Command insights
    if (usagePatterns.commandPopularity.length > 0) {
      const topCommand = usagePatterns.commandPopularity[0];
      insights.push(`Most popular command: ${topCommand.command} (${topCommand.count} uses)`);
    }

    // Peak usage insights
    if (usagePatterns && usagePatterns.peakUsageHours && usagePatterns.peakUsageHours.length > 0) {
      insights.push(`Peak usage occurs during: ${usagePatterns.peakUsageHours.join(', ')}`);
    }

    return insights;
  }

  /**
   * Checks for performance alerts
   * @param {Object} performanceAnalysis - Performance analysis data
   * @returns {Array} - Performance alerts
   * @private
   */
  static _checkPerformanceAlerts(performanceAnalysis) {
    const alerts = [];

    if (!performanceAnalysis) {
      return alerts;
    }

    if (performanceAnalysis.averageResponseTime && performanceAnalysis.averageResponseTime > 5000) {
      alerts.push({
        type: 'response_time',
        severity: 'critical',
        value: performanceAnalysis.averageResponseTime,
      });
    }

    if (performanceAnalysis.successRate !== undefined && performanceAnalysis.successRate < 90) {
      alerts.push({
        type: 'success_rate',
        severity: 'warning',
        value: performanceAnalysis.successRate,
      });
    }

    if (
      performanceAnalysis.slowOperations &&
      performanceAnalysis.totalOperations &&
      performanceAnalysis.slowOperations > performanceAnalysis.totalOperations * 0.3
    ) {
      alerts.push({
        type: 'slow_operations',
        severity: 'warning',
        value: performanceAnalysis.slowOperations,
      });
    }

    return alerts;
  }

  /**
   * Gets security summary from activity history
   * @param {Array} activityHistory - Activity history
   * @returns {Object} - Security summary
   * @private
   */
  static _getSecuritySummary(activityHistory) {
    const securityEvents = activityHistory.filter(
      (a) => a.action === 'security_threat' || a.metadata?.securityViolation
    );

    return {
      totalSecurityEvents: securityEvents.length,
      threatLevel:
        securityEvents.length > 10 ? 'high' : securityEvents.length > 3 ? 'medium' : 'low',
      lastThreatDetected:
        securityEvents.length > 0 ? securityEvents[securityEvents.length - 1].timestamp : null,
    };
  }

  /**
   * Gets security recommendations
   * @param {Array} activityHistory - Activity history
   * @returns {Array} - Security recommendations
   * @private
   */
  static _getSecurityRecommendations(activityHistory) {
    const recommendations = [];
    const securitySummary = this._getSecuritySummary(activityHistory);

    if (securitySummary.threatLevel === 'high') {
      recommendations.push(
        'Review security logs and consider implementing stricter input validation'
      );
    }

    if (securitySummary.totalSecurityEvents > 0) {
      recommendations.push('Monitor security events closely and update threat detection patterns');
    }

    return recommendations;
  }

  /**
   * Generates action items based on current state
   * @param {Object} analytics - Analytics data
   * @param {Object} performance - Performance data
   * @param {Object} resources - Resource data
   * @returns {Array} - Action items
   * @private
   */
  static _generateActionItems(analytics, performance, resources) {
    const actionItems = [];

    actionItems.push(...this._getHighPriorityActions(performance, resources));
    actionItems.push(...this._getMediumPriorityActions(analytics, performance));
    actionItems.push(...this._getLowPriorityActions(analytics));

    return actionItems;
  }

  /**
   * Gets high priority action items
   * @param {Object} performance - Performance data
   * @param {Object} resources - Resource data
   * @returns {Array} - High priority actions
   * @private
   */
  static _getHighPriorityActions(performance, resources) {
    const actions = [];

    if (resources && resources.memory && resources.memory.status === 'critical') {
      actions.push({ priority: 'high', action: 'Restart bot or clear cache immediately' });
    }

    if (performance && performance.averageResponseTime && performance.averageResponseTime > 5000) {
      actions.push({ priority: 'high', action: 'Investigate performance bottlenecks' });
    }

    return actions;
  }

  /**
   * Gets medium priority action items
   * @param {Object} analytics - Analytics data
   * @param {Object} performance - Performance data
   * @returns {Array} - Medium priority actions
   * @private
   */
  static _getMediumPriorityActions(analytics, performance) {
    const actions = [];

    if (analytics && analytics.summary && analytics.summary.errorRate > 5) {
      actions.push({ priority: 'medium', action: 'Investigate error patterns and causes' });
    }

    if (performance && performance.slowOperations && performance.slowOperations > 5) {
      actions.push({ priority: 'medium', action: 'Optimize slow operations' });
    }

    return actions;
  }

  /**
   * Gets low priority action items
   * @param {Object} analytics - Analytics data
   * @returns {Array} - Low priority actions
   * @private
   */
  static _getLowPriorityActions(analytics) {
    const actions = [];

    if (analytics && analytics.summary && analytics.summary.totalCommands > 100) {
      actions.push({ priority: 'low', action: 'Consider analytics-driven feature improvements' });
    }

    return actions;
  }

  /**
   * Generates next steps recommendations
   * @param {Object} analytics - Analytics data
   * @param {Object} performance - Performance data
   * @param {Object} optimizedConfig - Optimized configuration
   * @returns {Array} - Next steps
   * @private
   */
  static _generateNextSteps(analytics, performance, optimizedConfig) {
    const nextSteps = [];

    // Configuration updates
    if (optimizedConfig && optimizedConfig.tier && optimizedConfig.tier !== 'small') {
      nextSteps.push(`Apply ${optimizedConfig.tier} tier optimizations for better performance`);
    }

    // Scaling recommendations
    if (analytics && analytics.summary && analytics.summary.totalServers > 50) {
      nextSteps.push('Consider implementing horizontal scaling for growing server count');
    }

    // Monitoring improvements
    nextSteps.push('Set up automated alerts for critical metrics');
    nextSteps.push('Schedule regular performance reviews');

    return nextSteps;
  }

  /**
   * Formats uptime in human-readable format
   * @param {number} uptime - Uptime in seconds
   * @returns {string} - Formatted uptime
   * @private
   */
  static _formatUptime(uptime) {
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    return `${days}d ${hours}h ${minutes}m`;
  }

  /**
   * Exports dashboard data to CSV format
   * @param {Object} dashboardData - Dashboard data
   * @returns {string} - CSV formatted data
   * @private
   */
  static _exportToCSV(dashboardData) {
    const overview = dashboardData.overview;
    return (
      'Status,Server Count,Active Users,Commands,Error Rate,Response Time,Memory Usage\n' +
      `${overview.status},${overview.serverCount},${overview.activeUsers},${overview.totalCommands},${overview.errorRate},${overview.averageResponseTime},${overview.memoryUsage}`
    );
  }

  /**
   * Exports dashboard data to text format
   * @param {Object} dashboardData - Dashboard data
   * @returns {string} - Text formatted data
   * @private
   */
  static _exportToText(dashboardData) {
    const overview = dashboardData.overview;
    return (
      'Discord Bot Performance Dashboard\n' +
      `Generated: ${dashboardData.timestamp}\n\n` +
      `Status: ${overview.status}\n` +
      `Servers: ${overview.serverCount}\n` +
      `Active Users: ${overview.activeUsers}\n` +
      `Commands Today: ${overview.totalCommands}\n` +
      `Error Rate: ${overview.errorRate}\n` +
      `Avg Response Time: ${overview.averageResponseTime}\n` +
      `Memory Usage: ${overview.memoryUsage}\n` +
      `Optimization Tier: ${overview.optimizationTier}`
    );
  }
}

module.exports = PerformanceDashboard;
module.exports.PerformanceDashboard = PerformanceDashboard;
module.exports.default = PerformanceDashboard;
