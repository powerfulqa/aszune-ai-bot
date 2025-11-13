// Aszune AI Bot Dashboard JavaScript

class Dashboard {
  constructor() {
    this.socket = null;
    this.charts = {};
    this.metricsHistory = [];
    this.maxHistoryPoints = 60; // Keep 60 points (1 minute at 1-second intervals)
    this.isConnected = false;

    this.initializeSocket();
    this.initializeCharts();
    this.setupEventListeners();
  }

  initializeSocket() {
    this.socket = io();

    this.socket.on('connect', () => {
      this.setConnectionStatus(true);
      this.addActivityItem('Connected to dashboard server');
    });

    this.socket.on('disconnect', () => {
      this.setConnectionStatus(false);
      this.addActivityItem('Disconnected from dashboard server');
    });

    this.socket.on('metrics', (data) => {
      this.updateMetrics(data);
    });

    this.socket.on('error', (error) => {
      this.addActivityItem(`Error: ${error.message}`, 'error');
    });
  }

  initializeCharts() {
    // Charts disabled - using full dashboard data instead
  }

  setupEventListeners() {
    // Request fresh metrics on button click (if we add one later)
    // For now, metrics are pushed automatically
  }

  setConnectionStatus(connected) {
    this.isConnected = connected;
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');

    if (connected) {
      statusDot.className = 'status-dot connected';
      statusText.textContent = 'Connected';
    } else {
      statusDot.className = 'status-dot error';
      statusText.textContent = 'Disconnected';
    }
  }

  updateMetrics(data) {
    try {
      this.updateSystemMetrics(data);
      this.updateAnalyticsMetrics(data);
      this.updateResourcesMetrics(data);

      // Store metrics for potential future use
      this.metricsHistory.push(data);
      if (this.metricsHistory.length > this.maxHistoryPoints) {
        this.metricsHistory.shift();
      }

    } catch (error) {
      console.error('Error updating metrics:', error);
      this.addActivityItem(`Error updating metrics: ${error.message}`, 'error');
    }
  }

  updateSystemMetrics(data) {
    // System metrics
    document.getElementById('system-uptime').textContent = data.system.uptimeFormatted;
    document.getElementById('memory-usage').textContent = `${data.system.memory.usagePercent}% (${data.system.memory.usedFormatted})`;
    document.getElementById('cpu-load').textContent = `${data.system.cpu.loadPercent}% (${data.system.cpu.loadAverage[0].toFixed(2)})`;
    document.getElementById('platform').textContent = `${data.system.platform} ${data.system.arch}`;

    // Process metrics
    document.getElementById('process-pid').textContent = data.system.process.pid;
    document.getElementById('process-memory').textContent = data.system.process.rssFormatted;
    document.getElementById('heap-usage').textContent = `${data.system.process.heapUsedFormatted} / ${data.system.process.heapTotalFormatted}`;
    document.getElementById('node-version-info').textContent = data.system.nodeVersion;

    // Cache metrics
    document.getElementById('cache-hit-rate').textContent = `${data.cache.hitRate}%`;
    document.getElementById('cache-requests').textContent = (data.cache.hits + data.cache.misses).toLocaleString();
    document.getElementById('cache-memory').textContent = data.cache.memoryUsageFormatted;
    document.getElementById('cache-entries').textContent = data.cache.entryCount.toLocaleString();

    // Database metrics
    document.getElementById('db-users').textContent = data.database.userCount.toLocaleString();
    document.getElementById('db-messages').textContent = data.database.totalMessages.toLocaleString();
    document.getElementById('db-active-reminders').textContent = data.database.reminders.activeReminders.toLocaleString();
    document.getElementById('db-completed-reminders').textContent = data.database.reminders.completedReminders.toLocaleString();

    // Bot metrics
    document.getElementById('bot-uptime').textContent = data.uptime;
    document.getElementById('last-update').textContent = new Date(data.timestamp).toLocaleTimeString();
  }

  updateAnalyticsMetrics(data) {
    if (!data.analytics) return;
    
    document.getElementById('analytics-servers').textContent = data.analytics.summary.totalServers;
    document.getElementById('analytics-active-users').textContent = data.analytics.summary.totalUsers;
    document.getElementById('analytics-total-members').textContent = data.analytics.summary.totalUsers;
    document.getElementById('analytics-bots').textContent = '-';
    document.getElementById('analytics-success-rate').textContent = `${data.analytics.summary.successRate}%`;
    document.getElementById('analytics-error-rate').textContent = `${data.analytics.summary.errorRate}%`;
    document.getElementById('analytics-response-time').textContent = `${data.analytics.summary.avgResponseTime}ms`;
    document.getElementById('analytics-commands').textContent = data.analytics.summary.totalCommands;
  }

  updateResourcesMetrics(data) {
    if (!data.resources) return;
    
    document.getElementById('resource-memory-status').textContent = data.resources.memory.status.toUpperCase();
    document.getElementById('resource-memory-used').textContent = `${data.resources.memory.used}MB`;
    document.getElementById('resource-memory-free').textContent = `${data.resources.memory.free}MB`;
    document.getElementById('resource-memory-percent').textContent = `${data.resources.memory.percentage}%`;
    document.getElementById('resource-performance-status').textContent = data.resources.performance.status.toUpperCase();
    document.getElementById('resource-response-time').textContent = `${data.resources.performance.responseTime}ms`;
    document.getElementById('resource-load').textContent = data.resources.performance.load;
    document.getElementById('resource-optimization-tier').textContent = data.resources.optimizationTier;
    
    // Recommendations
    const recommendationsText = data.analytics?.recommendations?.length > 0 
      ? data.analytics.recommendations.join('\n')
      : 'System monitoring active';
    document.getElementById('resource-recommendations').textContent = recommendationsText;
  }

  addActivityItem(message, type = 'info') {
    const activityLog = document.getElementById('activity-log');
    const item = document.createElement('div');
    item.className = `activity-item fade-in status-${type}`;

    const timestamp = new Date().toLocaleTimeString();
    item.textContent = `[${timestamp}] ${message}`;

    activityLog.appendChild(item);

    // Keep only last 50 items
    while (activityLog.children.length > 50) {
      activityLog.removeChild(activityLog.firstChild);
    }

    // Auto-scroll to bottom
    activityLog.scrollTop = activityLog.scrollHeight;
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});

// Handle page visibility changes to reconnect socket if needed
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.dashboard && !window.dashboard.isConnected) {
        // Reconnect logic would go here if needed
    }
});