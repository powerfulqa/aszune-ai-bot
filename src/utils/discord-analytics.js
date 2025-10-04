/**
 * Discord Analytics - Monitor Discord-specific bot usage patterns and insights
 * Discord server analytics and monitoring for bot optimization
 */

const logger = require('./logger');

class DiscordAnalytics {
  constructor() {
    this.dailyStats = {
      date: new Date().toISOString().split('T')[0],
      serverStats: new Map(),
      commandStats: new Map(),
      userStats: new Map(),
      hourlyActivity: new Array(24).fill(0),
      errors: [],
      startTime: Date.now()
    };
  }

  /**
   * Tracks activity
   * @param {Object} activityData - Activity information
   * @param {string} activityData.serverId - Server ID
   * @param {string} activityData.userId - User ID
   * @param {string} activityData.action - Action performed
   * @param {string} activityData.command - Command name (if applicable)
   * @param {Object} activityData.metadata - Additional tracking data
   */
  static trackServerActivity(activityData = {}) {
    const activity = {
      tracked: true,
      serverId: activityData.serverId || 'unknown',
      userId: activityData.userId || 'unknown',
      action: activityData.action || 'unknown',
      command: activityData.command,
      metadata: activityData.metadata || {},
      timestamp: new Date().toISOString(),
      hour: new Date().getHours()
    };

    // Log the activity tracking
    logger.info('Activity tracked', {
      serverId: activity.serverId,
      action: activity.action,
      command: activity.command
    });

    return activity;
  }

  /**
   * Analyzes Discord usage patterns
   * @param {Array} activityHistory - Historical activity data
   * @returns {Object} - Usage pattern analysis
   */
  static analyzeUsagePatterns(activityHistory) {
    if (!activityHistory || activityHistory.length === 0) {
      return this._getEmptyUsagePatterns();
    }

    const counts = this._extractActivityCounts(activityHistory);
    const commandPopularity = this._getCommandPopularity(counts.commands);
    const serverActivity = this._getServerActivity(counts.servers);
    const userEngagement = this._calculateUserEngagement(activityHistory.length, counts.uniqueUsers.size);
    const peakUsageHours = this._getPeakUsageHours(counts.hours);
    const growthTrend = this._calculateGrowthTrend(activityHistory);

    return {
      commandPopularity,
      serverActivity,
      userEngagement,
      peakUsageHours,
      growthTrend
    };
  }

  /**
   * Returns empty usage patterns structure
   * @private
   */
  static _getEmptyUsagePatterns() {
    return {
      commandPopularity: [],
      serverActivity: [],
      userEngagement: 'low',
      peakUsageHours: [],
      growthTrend: 'stable'
    };
  }

  /**
   * Extracts activity counts from history
   * @private
   */
  static _extractActivityCounts(activityHistory) {
    const commandCounts = {};
    const serverCounts = {};
    const uniqueUsers = new Set();
    const hourCounts = {};

    activityHistory.forEach(activity => {
      if (activity.command) {
        commandCounts[activity.command] = (commandCounts[activity.command] || 0) + 1;
      }
      if (activity.serverId) {
        serverCounts[activity.serverId] = (serverCounts[activity.serverId] || 0) + 1;
      }
      if (activity.userId) {
        uniqueUsers.add(activity.userId);
      }
      if (activity.timestamp) {
        const hour = new Date(activity.timestamp).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    });

    return { commands: commandCounts, servers: serverCounts, uniqueUsers, hours: hourCounts };
  }

  /**
   * Gets sorted command popularity data
   * @private
   */
  static _getCommandPopularity(commandCounts) {
    return Object.entries(commandCounts)
      .map(([command, count]) => ({ command, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Gets sorted server activity data
   * @private
   */
  static _getServerActivity(serverCounts) {
    return Object.entries(serverCounts)
      .map(([serverId, activityCount]) => ({ serverId, activityCount }))
      .sort((a, b) => b.activityCount - a.activityCount);
  }

  /**
   * Calculates user engagement level
   * @private
   */
  static _calculateUserEngagement(totalActivities, uniqueUserCount) {
    const avgActivitiesPerUser = totalActivities / Math.max(uniqueUserCount, 1);
    if (avgActivitiesPerUser > 3) return 'high';
    if (avgActivitiesPerUser > 1.5) return 'medium';
    return 'low';
  }

  /**
   * Gets peak usage hours
   * @private
   */
  static _getPeakUsageHours(hourCounts) {
    return Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => `${hour}:00-${parseInt(hour) + 1}:00`);
  }

  /**
   * Calculates growth trend
   * @private
   */
  static _calculateGrowthTrend(activityHistory) {
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    const recentActivity = activityHistory.filter(a => 
      now - new Date(a.timestamp).getTime() < dayMs
    );
    const olderActivity = activityHistory.filter(a => 
      now - new Date(a.timestamp).getTime() >= dayMs
    );
    
    if (recentActivity.length > olderActivity.length * 1.1) return 'growing';
    if (recentActivity.length < olderActivity.length * 0.9) return 'declining';
    return 'stable';
  }

  /**
   * Generates comprehensive daily report
   * @param {Array} activityHistory - Activity data for the day
   * @returns {Object} - Daily analytics report
   */
  static generateDailyReport(activityHistory = []) {
    const timestamp = new Date().toISOString();
    const summaryData = this._calculateSummaryData(activityHistory);
    const serverBreakdown = this._generateServerBreakdown(activityHistory);
    const commandAnalysis = this._generateCommandAnalysis(activityHistory);
    const performanceMetrics = this._generatePerformanceMetrics(activityHistory);
    const recommendations = this._generateRecommendations(summaryData, activityHistory.length);

    return {
      timestamp,
      summary: summaryData,
      serverBreakdown,
      commandAnalysis,
      performanceMetrics,
      recommendations
    };
  }

  /**
   * Calculate summary data from activity history
   * @private
   */
  static _calculateSummaryData(activityHistory) {
    const uniqueServers = new Set();
    const uniqueUsers = new Set();
    let totalCommands = 0;
    let errors = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    activityHistory.forEach(activity => {
      if (activity.serverId) uniqueServers.add(activity.serverId);
      if (activity.userId) uniqueUsers.add(activity.userId);
      if (activity.action === 'command_executed') totalCommands++;
      if (activity.metadata?.success === false) errors++;
      if (activity.metadata?.responseTime) {
        totalResponseTime += activity.metadata.responseTime;
        responseTimeCount++;
      }
    });

    const totalActivities = activityHistory.length;
    const errorRate = totalActivities > 0 ? Math.round((errors / totalActivities) * 100) : 0;
    const averageResponseTime = responseTimeCount > 0 ? Math.round(totalResponseTime / responseTimeCount) : 0;
    const successRate = Math.max(0, 100 - errorRate);

    return {
      totalServers: uniqueServers.size,
      totalUsers: uniqueUsers.size,
      totalCommands,
      totalActivities,
      errorRate,
      successRate, // Add for analytics command compatibility
      avgResponseTime: averageResponseTime // Add for analytics command compatibility
    };
  }

  /**
   * Generate server breakdown data
   * @private
   */
  static _generateServerBreakdown(activityHistory) {
    const serverStats = {};
    
    activityHistory.forEach(activity => {
      if (!activity.serverId) return;
      if (!serverStats[activity.serverId]) {
        serverStats[activity.serverId] = {
          serverId: activity.serverId,
          activities: 0,
          users: new Set(),
          commands: 0
        };
      }
      serverStats[activity.serverId].activities++;
      if (activity.userId) serverStats[activity.serverId].users.add(activity.userId);
      if (activity.action === 'command_executed') serverStats[activity.serverId].commands++;
    });

    return Object.values(serverStats).map(stats => ({
      serverId: stats.serverId,
      activities: stats.activities,
      users: stats.users.size,
      commands: stats.commands
    }));
  }

  /**
   * Generate command analysis data
   * @private
   */
  static _generateCommandAnalysis(activityHistory) {
    const commandCounts = {};
    
    activityHistory.forEach(activity => {
      if (activity.command) {
        commandCounts[activity.command] = (commandCounts[activity.command] || 0) + 1;
      }
    });

    const popularCommands = Object.entries(commandCounts)
      .map(([command, count]) => ({ command, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalCommands: Object.values(commandCounts).reduce((sum, count) => sum + count, 0),
      uniqueCommands: Object.keys(commandCounts).length,
      popularCommands
    };
  }

  /**
   * Generate performance metrics data
   * @private
   */
  static _generatePerformanceMetrics(activityHistory) {
    let slowestCommand = null;
    let fastestCommand = null;
    let maxResponseTime = 0;
    let minResponseTime = Infinity;
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    activityHistory.forEach(activity => {
      if (activity.metadata?.responseTime) {
        const responseTime = activity.metadata.responseTime;
        totalResponseTime += responseTime;
        responseTimeCount++;
        
        if (activity.command && responseTime > maxResponseTime) {
          maxResponseTime = responseTime;
          slowestCommand = activity.command;
        }
        if (activity.command && responseTime < minResponseTime) {
          minResponseTime = responseTime;
          fastestCommand = activity.command;
        }
      }
    });

    const averageResponseTime = responseTimeCount > 0 ? Math.round(totalResponseTime / responseTimeCount) : 0;

    return {
      averageResponseTime,
      slowestCommand,
      fastestCommand
    };
  }

  /**
   * Generate recommendations based on data
   * @private
   */
  static _generateRecommendations(summaryData, totalActivities) {
    const recommendations = [];
    
    if (totalActivities === 0) {
      recommendations.push('No activity detected today');
    } else {
      if (summaryData.errorRate > 10) {
        recommendations.push('High error rate detected - investigate issues');
      }
      if (summaryData.avgResponseTime > 3000) {
        recommendations.push('Slow response times - consider optimization');
      }
      if (summaryData.totalServers > 50) {
        recommendations.push('Growing server count - consider scaling resources');
      }
    }
    
    return recommendations;
  }

  /**
   * Tracks command usage across servers
   * @param {string} command - Command name
   * @param {Object} serverData - Server information
   * @param {number} responseTime - Command response time
   * @param {boolean} success - Whether command succeeded
   */
  static trackCommandUsage(command, serverData, responseTime, success = true) {
    const usage = {
      command,
      serverId: serverData.id,
      serverName: serverData.name,
      responseTime,
      success,
      timestamp: Date.now(),
      memberCount: serverData.memberCount
    };

    // Log slow commands
    if (responseTime > 3000) {
      logger.warn(`Slow command detected: ${command} took ${responseTime}ms in ${serverData.name}`);
    }

    // Track for analytics
    this._updateCommandStats(command, serverData, { responseTime, success });

    return usage;
  }

  /**
   * Generates insights for a specific server
   * @param {string} serverId - Server ID to analyze
   * @param {Array} activityHistory - Activity history data
   * @returns {Object} - Server-specific insights
   */
  static generateServerInsights(serverId, activityHistory = []) {
    const serverActivities = activityHistory.filter(a => a.serverId === serverId);
    
    if (serverActivities.length === 0) {
      return this._getEmptyServerInsights(serverId);
    }

    const activityMetrics = this._calculateServerActivityMetrics(serverActivities);
    const userAnalysis = this._analyzeServerUsers(serverActivities);
    const commandAnalysis = this._analyzeServerCommands(serverActivities);

    return {
      serverId,
      totalActivities: serverActivities.length,
      uniqueUsers: userAnalysis.uniqueUsers,
      commandsExecuted: activityMetrics.commandsExecuted,
      averageResponseTime: activityMetrics.averageResponseTime,
      errorRate: activityMetrics.errorRate,
      mostActiveUser: userAnalysis.mostActiveUser,
      popularCommands: commandAnalysis.popularCommands
    };
  }

  /**
   * Get empty server insights structure
   * @private
   */
  static _getEmptyServerInsights(serverId) {
    return {
      serverId,
      totalActivities: 0,
      uniqueUsers: 0,
      commandsExecuted: 0,
      averageResponseTime: 0,
      errorRate: 0,
      mostActiveUser: null,
      popularCommands: []
    };
  }

  /**
   * Calculate server activity metrics
   * @private
   */
  static _calculateServerActivityMetrics(serverActivities) {
    let commandsExecuted = 0;
    let errors = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    serverActivities.forEach(activity => {
      if (activity.action === 'command_executed') commandsExecuted++;
      if (activity.metadata?.success === false) errors++;
      if (activity.metadata?.responseTime) {
        totalResponseTime += activity.metadata.responseTime;
        responseTimeCount++;
      }
    });

    const errorRate = serverActivities.length > 0 ? Math.round((errors / serverActivities.length) * 100) : 0;
    const averageResponseTime = responseTimeCount > 0 ? Math.round(totalResponseTime / responseTimeCount) : 0;

    return { commandsExecuted, errorRate, averageResponseTime };
  }

  /**
   * Analyze server user activity
   * @private
   */
  static _analyzeServerUsers(serverActivities) {
    const uniqueUsers = new Set();
    const userCounts = {};

    serverActivities.forEach(activity => {
      if (activity.userId) {
        uniqueUsers.add(activity.userId);
        userCounts[activity.userId] = (userCounts[activity.userId] || 0) + 1;
      }
    });

    let mostActiveUser = null;
    let maxUserActivity = 0;
    Object.entries(userCounts).forEach(([userId, count]) => {
      if (count > maxUserActivity) {
        maxUserActivity = count;
        mostActiveUser = userId;
      }
    });

    return { uniqueUsers: uniqueUsers.size, mostActiveUser };
  }

  /**
   * Analyze server command usage
   * @private
   */
  static _analyzeServerCommands(serverActivities) {
    const commandCounts = {};

    serverActivities.forEach(activity => {
      if (activity.command) {
        commandCounts[activity.command] = (commandCounts[activity.command] || 0) + 1;
      }
    });

    const popularCommands = Object.entries(commandCounts)
      .map(([command, count]) => ({ command, count }))
      .sort((a, b) => b.count - a.count);

    return { popularCommands };
  }

  /**
   * Analyzes server activity patterns
   * @param {Array} activityHistory - Activity data
   * @returns {Object} - Server activity analysis
   * @private
   */
  static _analyzeServerActivity(activityHistory) {
    const serverStats = new Map();

    activityHistory.forEach(activity => {
      if (!serverStats.has(activity.serverId)) {
        serverStats.set(activity.serverId, {
          id: activity.serverId,
          name: activity.serverName,
          memberCount: activity.memberCount,
          messageCount: 0,
          commandCount: 0,
          errorCount: 0,
          lastActivity: activity.timestamp
        });
      }

      const stats = serverStats.get(activity.serverId);
      if (activity.action === 'message') stats.messageCount++;
      if (activity.action === 'command') stats.commandCount++;
      if (activity.action === 'error') stats.errorCount++;
      stats.lastActivity = Math.max(stats.lastActivity, activity.timestamp);
    });

    const topServers = Array.from(serverStats.values())
      .sort((a, b) => (b.messageCount + b.commandCount) - (a.messageCount + a.commandCount))
      .slice(0, 10);

    return { topServers, serverStats };
  }

  /**
   * Analyzes time-based usage patterns
   * @param {Array} activityHistory - Activity data
   * @returns {Object} - Time pattern analysis
   * @private
   */
  static _analyzeTimePatterns(activityHistory) {
    const hourlyActivity = new Array(24).fill(0);
    
    activityHistory.forEach(activity => {
      const hour = new Date(activity.timestamp).getHours();
      hourlyActivity[hour]++;
    });

    const peakHours = hourlyActivity
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(p => `${p.hour}:00-${p.hour + 1}:00`);

    return { peakHours, hourlyActivity };
  }

  /**
   * Analyzes command usage patterns
   * @param {Array} activityHistory - Activity data
   * @returns {Object} - Command pattern analysis
   * @private
   */
  static _analyzeCommandPatterns(activityHistory) {
    const commandStats = new Map();

    activityHistory
      .filter(a => a.action === 'command' && a.metadata?.command)
      .forEach(activity => {
        const cmd = activity.metadata.command;
        if (!commandStats.has(cmd)) {
          commandStats.set(cmd, { count: 0, avgResponseTime: 0, errorCount: 0 });
        }
        
        const stats = commandStats.get(cmd);
        stats.count++;
        if (activity.metadata.responseTime) {
          stats.avgResponseTime = (stats.avgResponseTime + activity.metadata.responseTime) / 2;
        }
        if (!activity.metadata.success) {
          stats.errorCount++;
        }
      });

    const popular = Array.from(commandStats.entries())
      .map(([cmd, stats]) => ({ command: cmd, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { popular, commandStats };
  }

  /**
   * Analyzes user engagement levels
   * @param {Array} activityHistory - Activity data
   * @returns {Object} - User engagement analysis
   * @private
   */
  static _analyzeUserEngagement(activityHistory) {
    const userActivity = new Map();

    activityHistory
      .filter(a => a.metadata?.userId)
      .forEach(activity => {
        const userId = activity.metadata.userId;
        if (!userActivity.has(userId)) {
          userActivity.set(userId, 0);
        }
        userActivity.set(userId, userActivity.get(userId) + 1);
      });

    const totalUsers = userActivity.size;
    const activeUsers = Array.from(userActivity.values()).filter(count => count > 5).length;
    const engagementRatio = totalUsers > 0 ? activeUsers / totalUsers : 0;

    let level = 'low';
    if (engagementRatio > 0.7) level = 'high';
    else if (engagementRatio > 0.4) level = 'medium';

    return { level, totalUsers, activeUsers, engagementRatio };
  }



  /**
   * Generates usage-based recommendations
   * @param {Array} activityHistory - Activity data
   * @returns {Array} - Usage recommendations
   * @private
   */
  static _generateUsageRecommendations(activityHistory) {
    const recommendations = [];
    const patterns = this._analyzeTimePatterns(activityHistory);
    const serverAnalysis = this._analyzeServerActivity(activityHistory);

    // Peak usage recommendations
    if (patterns.peakHours.length > 0) {
      recommendations.push(`Peak usage detected at ${patterns.peakHours[0]} - schedule maintenance outside these hours`);
    }

    // Server engagement recommendations
    const lowEngagementServers = serverAnalysis.topServers.filter(s => 
      (s.messageCount + s.commandCount) < s.memberCount * 0.01
    );

    if (lowEngagementServers.length > 0) {
      recommendations.push(`${lowEngagementServers.length} servers have low engagement - consider outreach`);
    }

    // Performance recommendations
    const errorRate = this._calculateErrorRate(activityHistory);
    if (errorRate > 5) {
      recommendations.push('High error rate detected - investigate common failure patterns');
    }

    return recommendations;
  }

  /**
   * Helper methods for internal calculations
   * @private
   */
  static _updateHourlyActivity(_hour) {
    // Implementation for tracking hourly patterns
  }

  static _updateServerStats(_serverData, _action, _metadata) {
    // Implementation for server statistics
  }

  static _updateCommandStats(_command, _serverData, _metrics = {}) {
    // Implementation for command statistics
  }

  static _updateUserStats(_userId, _serverId, _action) {
    // Implementation for user statistics
  }

  static _analyzePerformanceMetrics(activityHistory) {
    const responseTimes = activityHistory
      .filter(a => a.metadata?.responseTime)
      .map(a => a.metadata.responseTime);

    return {
      avgResponseTime: responseTimes.length > 0 
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0,
      maxResponseTime: Math.max(...responseTimes, 0),
      minResponseTime: Math.min(...responseTimes, 0)
    };
  }

  static _analyzeErrorPatterns(activityHistory) {
    const errors = activityHistory.filter(a => a.action === 'error');
    const errorsByServer = new Map();

    errors.forEach(error => {
      if (!errorsByServer.has(error.serverId)) {
        errorsByServer.set(error.serverId, []);
      }
      errorsByServer.get(error.serverId).push(error);
    });

    return {
      totalErrors: errors.length,
      errorsByServer: Object.fromEntries(errorsByServer),
      commonErrors: this._getCommonErrorTypes(errors)
    };
  }

  static _getCommonErrorTypes(errors) {
    const errorTypes = new Map();
    
    errors.forEach(error => {
      const type = error.metadata?.errorType || 'unknown';
      errorTypes.set(type, (errorTypes.get(type) || 0) + 1);
    });

    return Array.from(errorTypes.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  static _generateDailyRecommendations(todayActivity, patterns) {
    const recommendations = [...patterns.recommendations];

    // Add daily-specific recommendations
    if (todayActivity.length === 0) {
      recommendations.push('No activity detected today - check bot connectivity');
    }

    return recommendations;
  }

  static _countUniqueServers(activityHistory) {
    return new Set(activityHistory.map(a => a.serverId)).size;
  }

  static _countUniqueUsers(activityHistory) {
    return new Set(activityHistory.filter(a => a.metadata?.userId).map(a => a.metadata.userId)).size;
  }

  static _calculateErrorRate(activityHistory) {
    const totalActions = activityHistory.length;
    const errors = activityHistory.filter(a => a.action === 'error').length;
    return totalActions > 0 ? Math.round((errors / totalActions) * 100 * 100) / 100 : 0;
  }
}

module.exports = DiscordAnalytics;
module.exports.DiscordAnalytics = DiscordAnalytics;
module.exports.default = DiscordAnalytics;