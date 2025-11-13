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
      this.updateCharts(data);
    });

    this.socket.on('error', (error) => {
      this.addActivityItem(`Error: ${error.message}`, 'error');
    });
  }

  initializeCharts() {
    // Memory usage chart
    const memoryCtx = document.getElementById('memoryChart').getContext('2d');
    this.charts.memory = new Chart(memoryCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Memory Usage (%)',
          data: [],
          borderColor: '#3498db',
          backgroundColor: 'rgba(52, 152, 219, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });

    // Cache performance chart
    const cacheCtx = document.getElementById('cacheChart').getContext('2d');
    this.charts.cache = new Chart(cacheCtx, {
      type: 'doughnut',
      data: {
        labels: ['Cache Hits', 'Cache Misses'],
        datasets: [{
          data: [0, 0],
          backgroundColor: ['#27ae60', '#e74c3c'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
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

      // Store metrics for charts
      this.metricsHistory.push(data);
      if (this.metricsHistory.length > this.maxHistoryPoints) {
        this.metricsHistory.shift();
      }

    } catch (error) {
      console.error('Error updating metrics:', error);
      this.addActivityItem(`Error updating metrics: ${error.message}`, 'error');
    }
  }

  updateCharts(data) {
    try {
      // Update memory chart with incremental data
      if (this.charts.memory) {
        // Use incremental update instead of rebuilding entire dataset
        const memoryValue = data.system.memory.usagePercent;
        const timeLabel = new Date(data.timestamp).toLocaleTimeString();

        // Add new data point
        this.charts.memory.data.labels.push(timeLabel);
        this.charts.memory.data.datasets[0].data.push(memoryValue);

        // Remove oldest data point if exceeding max history
        if (this.charts.memory.data.labels.length > this.maxHistoryPoints) {
          this.charts.memory.data.labels.shift();
          this.charts.memory.data.datasets[0].data.shift();
        }

        // Update chart efficiently (no animation for performance)
        this.charts.memory.update('none');
      }

      // Update cache chart
      if (this.charts.cache) {
        this.charts.cache.data.datasets[0].data = [data.cache.hits, data.cache.misses];
        this.charts.cache.update('none');
      }

    } catch (error) {
      console.error('Error updating charts:', error);
    }
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