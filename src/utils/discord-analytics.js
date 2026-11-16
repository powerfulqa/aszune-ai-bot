/**
 * Discord Analytics - Monitor Discord-specific bot usage patterns and insights
 * Discord server analytics and monitoring for bot optimization
 */

/**
 * Count commands from activity history and return sorted popular commands
 * @param {Array} activities - Activity history array
 * @returns {Object} Command counts and sorted popular commands
 * @private
 */
function _countCommands(activities) {
  const commandCounts = {};

  activities.forEach((activity) => {
    if (activity.command) {
      commandCounts[activity.command] = (commandCounts[activity.command] || 0) + 1;
    }
  });

  const popularCommands = Object.entries(commandCounts)
    .map(([command, count]) => ({ command, count }))
    .sort((a, b) => b.count - a.count);

  return { commandCounts, popularCommands };
}

class DiscordAnalytics {
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
    const userEngagement = this._calculateUserEngagement(
      activityHistory.length,
      counts.uniqueUsers.size
    );
    const peakUsageHours = this._getPeakUsageHours(counts.hours);
    const growthTrend = this._calculateGrowthTrend(activityHistory);

    return {
      commandPopularity,
      serverActivity,
      userEngagement,
      peakUsageHours,
      growthTrend,
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
      growthTrend: 'stable',
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

    activityHistory.forEach((activity) => {
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
      .sort(([, a], [, b]) => b - a)
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

    const recentActivity = activityHistory.filter(
      (a) => now - new Date(a.timestamp).getTime() < dayMs
    );
    const olderActivity = activityHistory.filter(
      (a) => now - new Date(a.timestamp).getTime() >= dayMs
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
      recommendations,
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

    activityHistory.forEach((activity) => {
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
    const averageResponseTime =
      responseTimeCount > 0 ? Math.round(totalResponseTime / responseTimeCount) : 0;
    const successRate = Math.max(0, 100 - errorRate);

    return {
      totalServers: uniqueServers.size,
      totalUsers: uniqueUsers.size,
      totalCommands,
      totalActivities,
      errorRate,
      successRate, // Add for analytics command compatibility
      avgResponseTime: averageResponseTime, // Add for analytics command compatibility
    };
  }

  /**
   * Generate server breakdown data
   * @private
   */
  static _generateServerBreakdown(activityHistory) {
    const serverStats = {};

    activityHistory.forEach((activity) => {
      if (!activity.serverId) return;
      if (!serverStats[activity.serverId]) {
        serverStats[activity.serverId] = {
          serverId: activity.serverId,
          activities: 0,
          users: new Set(),
          commands: 0,
        };
      }
      serverStats[activity.serverId].activities++;
      if (activity.userId) serverStats[activity.serverId].users.add(activity.userId);
      if (activity.action === 'command_executed') serverStats[activity.serverId].commands++;
    });

    return Object.values(serverStats).map((stats) => ({
      serverId: stats.serverId,
      activities: stats.activities,
      users: stats.users.size,
      commands: stats.commands,
    }));
  }

  /**
   * Generate command analysis data
   * @private
   */
  static _generateCommandAnalysis(activityHistory) {
    const { commandCounts, popularCommands } = _countCommands(activityHistory);

    return {
      totalCommands: Object.values(commandCounts).reduce((sum, count) => sum + count, 0),
      uniqueCommands: Object.keys(commandCounts).length,
      popularCommands,
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

    activityHistory.forEach((activity) => {
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

    const averageResponseTime =
      responseTimeCount > 0 ? Math.round(totalResponseTime / responseTimeCount) : 0;

    return {
      averageResponseTime,
      slowestCommand,
      fastestCommand,
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
}

module.exports = DiscordAnalytics;
module.exports.DiscordAnalytics = DiscordAnalytics;
module.exports.default = DiscordAnalytics;
