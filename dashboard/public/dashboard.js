// Aszune AI Bot Dashboard JavaScript - Enhanced v2.0

class Dashboard {
  constructor() {
    this.socket = null;
    this.charts = {};
    this.metricsHistory = [];
    this.maxHistoryPoints = 60;
    this.isConnected = false;
    this.currentTable = null;
    this.databaseCache = {};

    this.initializeSocket();
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

  setupEventListeners() {
    // Database table selector
    const tableSelect = document.getElementById('database-table-select');
    if (tableSelect) {
      tableSelect.addEventListener('change', (e) => {
        this.loadDatabaseTable(e.target.value);
      });
    }

    // Database search
    const searchInput = document.getElementById('database-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterDatabaseTable(e.target.value);
      });
    }

    // Control buttons
    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => this.handleRestartClick());
    }

    const gitPullBtn = document.getElementById('git-pull-btn');
    if (gitPullBtn) {
      gitPullBtn.addEventListener('click', () => this.handleGitPullClick());
    }
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
      this.updateErrorLogs(data);
      this.fetchAndUpdateRecommendations();
      this.updateLeaderboard(data);

      this.metricsHistory.push(data);
      if (this.metricsHistory.length > this.maxHistoryPoints) {
        this.metricsHistory.shift();
      }

      this.addActivityItem('Metrics updated');
    } catch (error) {
      console.error('Error updating metrics:', error);
      this.addActivityItem(`Error updating metrics: ${error.message}`, 'error');
    }
  }

  async fetchVersionInfo() {
    try {
      const response = await fetch('/api/version');
      if (!response.ok) throw new Error('Failed to fetch version info');
      const data = await response.json();
      this.updateVersionDisplay(data);
    } catch (error) {
      console.error('Error fetching version info:', error);
    }
  }

  updateVersionDisplay(versionData) {
    const versionNumber = document.getElementById('version-number');
    const commitSha = document.getElementById('commit-sha');
    const commitLink = document.getElementById('commit-link');

    if (versionNumber) versionNumber.textContent = versionData.version || '1.8.0';
    if (commitSha) commitSha.textContent = versionData.commit || 'unknown';
    if (commitLink && versionData.commitUrl) {
      commitLink.href = versionData.commitUrl;
    }
  }

  updateSystemMetrics(data) {
    document.getElementById('system-uptime').textContent = data.system.uptimeFormatted;
    document.getElementById('memory-usage').textContent = 
      `${data.system.memory.usagePercent}% (${data.system.memory.usedFormatted})`;
    document.getElementById('cpu-load').textContent = 
      `${data.system.cpu.loadPercent}% (${data.system.cpu.loadAverage[0].toFixed(2)})`;
    document.getElementById('platform').textContent = 
      `${data.system.platform} ${data.system.arch}`;

    document.getElementById('process-pid').textContent = data.system.process.pid;
    document.getElementById('process-memory').textContent = data.system.process.rssFormatted;
    document.getElementById('heap-usage').textContent = 
      `${data.system.process.heapUsedFormatted} / ${data.system.process.heapTotalFormatted}`;
    document.getElementById('node-version-info').textContent = data.system.nodeVersion;

    document.getElementById('cache-hit-rate').textContent = `${data.cache.hitRate}%`;
    document.getElementById('cache-requests').textContent = 
      (data.cache.hits + data.cache.misses).toLocaleString();
    document.getElementById('cache-memory').textContent = data.cache.memoryUsageFormatted;
    document.getElementById('cache-entries').textContent = data.cache.entryCount.toLocaleString();

    document.getElementById('db-users').textContent = data.database.userCount.toLocaleString();
    document.getElementById('db-messages').textContent = data.database.totalMessages.toLocaleString();
    document.getElementById('db-active-reminders').textContent = 
      data.database.reminders.activeReminders.toLocaleString();
    document.getElementById('db-completed-reminders').textContent = 
      data.database.reminders.completedReminders.toLocaleString();

    document.getElementById('bot-uptime').textContent = data.uptime;
    document.getElementById('last-update').textContent = new Date(data.timestamp).toLocaleTimeString();
  }

  updateAnalyticsMetrics(data) {
    if (!data.analytics) return;
    
    document.getElementById('analytics-servers').textContent = data.analytics.summary.totalServers;
    document.getElementById('analytics-active-users').textContent = data.analytics.summary.totalUsers;
    document.getElementById('analytics-total-members').textContent = data.analytics.summary.totalUsers;
    document.getElementById('analytics-bots').textContent = '-';
    document.getElementById('analytics-success-rate').textContent = 
      `${data.analytics.summary.successRate}%`;
    document.getElementById('analytics-error-rate').textContent = 
      `${data.analytics.summary.errorRate}%`;
    document.getElementById('analytics-response-time').textContent = 
      `${data.analytics.summary.avgResponseTime}ms`;
    document.getElementById('analytics-commands').textContent = data.analytics.summary.totalCommands;
  }

  updateResourcesMetrics(data) {
    if (!data.resources) return;
    
    // Memory status
    const memStatus = this.getStatusBadgeClass(data.resources.memory.status);
    document.getElementById('resource-memory-status').textContent = 
      (data.resources.memory.status || 'Unknown').toUpperCase();
    document.getElementById('resource-memory-status').className = 
      `value status-badge ${memStatus}`;

    document.getElementById('resource-memory-used').textContent = 
      `${data.resources.memory.used}MB`;
    document.getElementById('resource-memory-free').textContent = 
      `${data.resources.memory.free}MB`;
    document.getElementById('resource-memory-percent').textContent = 
      `${data.resources.memory.percentage}%`;

    // Performance status
    const perfStatus = this.getStatusBadgeClass(data.resources.performance.status);
    document.getElementById('resource-performance-status').textContent = 
      (data.resources.performance.status || 'Unknown').toUpperCase();
    document.getElementById('resource-performance-status').className = 
      `value status-badge ${perfStatus}`;

    document.getElementById('resource-response-time').textContent = 
      `${data.resources.performance.responseTime}ms`;
    document.getElementById('resource-load').textContent = 
      data.resources.performance.load || 'normal';
    document.getElementById('resource-optimization-tier').textContent = 
      data.resources.optimizationTier || 'Standard';
  }

  getStatusBadgeClass(status) {
    if (!status || status === 'unknown') return 'acceptable';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('good') || statusLower.includes('optimal')) return 'good';
    if (statusLower.includes('warning') || statusLower.includes('acceptable')) return 'acceptable';
    if (statusLower.includes('degraded')) return 'warning';
    if (statusLower.includes('critical')) return 'critical';
    return 'acceptable';
  }

  async fetchAndUpdateRecommendations() {
    try {
      const response = await fetch('/api/recommendations');
      if (!response.ok) throw new Error('Failed to fetch recommendations');
      const recommendations = await response.json();
      this.updateRecommendations(recommendations);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    }
  }

  updateRecommendations(recommendations) {
    const container = document.getElementById('recommendations-list');
    if (!container) return;

    if (!recommendations || recommendations.length === 0) {
      container.innerHTML = `
        <div class="recommendation-item info">
          <span class="rec-severity info">INFO</span>
          <span class="rec-message">System monitoring active</span>
        </div>
      `;
      return;
    }

    container.innerHTML = recommendations.map(rec => `
      <div class="recommendation-item ${rec.severity || 'info'}">
        <span class="rec-severity ${rec.severity || 'info'}">${(rec.severity || 'info').toUpperCase()}</span>
        <div style="flex: 1;">
          <div class="rec-message"><strong>${rec.message}</strong></div>
          <div class="rec-message" style="font-size: 0.85rem; color: #666;">→ ${rec.action}</div>
        </div>
      </div>
    `).join('');
  }

  updateErrorLogs(data) {
    if (!data.analytics?.recentErrors || data.analytics.recentErrors.length === 0) {
      document.getElementById('error-logs').innerHTML = 
        '<div class="error-log-no-errors">✓ No errors logged - System running smoothly</div>';
      return;
    }

    const errorLogsHtml = data.analytics.recentErrors.map(error => {
      const timestamp = new Date(error.timestamp).toLocaleTimeString();
      const errorMsg = error.error || 'Unknown error';
      return `
        <div class="error-log-item">
          <div class="error-log-time">[${timestamp}]</div>
          <div class="error-log-message">ERROR: ${error.message}</div>
          ${error.error ? `<div class="error-log-detail">→ ${errorMsg}</div>` : ''}
        </div>
      `;
    }).join('');

    document.getElementById('error-logs').innerHTML = errorLogsHtml;
  }

  async loadDatabaseTable(tableName) {
    if (!tableName) {
      document.getElementById('database-viewer').innerHTML = 
        '<div class="db-message">Select a table to view data</div>';
      return;
    }

    this.currentTable = tableName;
    document.getElementById('table-info').textContent = 'Loading...';

    try {
      const response = await fetch(`/api/database/${tableName}?limit=100&offset=0`);
      if (!response.ok) throw new Error('Failed to fetch table data');
      
      const tableData = await response.json();
      this.databaseCache[tableName] = tableData;
      this.renderDatabaseTable(tableData);
    } catch (error) {
      console.error(`Error loading table ${tableName}:`, error);
      document.getElementById('database-viewer').innerHTML = 
        `<div class="db-message">Error loading table: ${error.message}</div>`;
    }
  }

  renderDatabaseTable(tableData) {
    const viewer = document.getElementById('database-viewer');
    const info = document.getElementById('table-info');

    if (!tableData.data || tableData.data.length === 0) {
      viewer.innerHTML = '<div class="db-message">No data in this table</div>';
      info.textContent = `${tableData.table}: 0 rows`;
      return;
    }

    const columns = tableData.columns || Object.keys(tableData.data[0]);
    const tableHtml = `
      <table class="database-table">
        <thead>
          <tr>
            ${columns.map(col => `<th>${col}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${tableData.data.map(row => `
            <tr>
              ${columns.map(col => {
                let value = row[col];
                if (value === null || value === undefined) value = '-';
                if (typeof value === 'string' && value.length > 100) {
                  value = value.substring(0, 100) + '...';
                }
                return `<td>${this.escapeHtml(String(value))}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    viewer.innerHTML = tableHtml;
    info.textContent = `${tableData.table}: ${tableData.totalRows} rows (showing ${tableData.returnedRows})`;
  }

  filterDatabaseTable(searchTerm) {
    if (!this.currentTable || !this.databaseCache[this.currentTable]) return;

    const tableData = this.databaseCache[this.currentTable];
    const filtered = tableData.data.filter(row => {
      return Object.values(row).some(val => 
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

    if (filtered.length === 0) {
      document.getElementById('database-viewer').innerHTML = 
        '<div class="db-message">No matching results</div>';
      return;
    }

    const columns = tableData.columns || Object.keys(tableData.data[0]);
    const tableHtml = `
      <table class="database-table">
        <thead>
          <tr>
            ${columns.map(col => `<th>${col}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${filtered.map(row => `
            <tr>
              ${columns.map(col => {
                let value = row[col];
                if (value === null || value === undefined) value = '-';
                if (typeof value === 'string' && value.length > 100) {
                  value = value.substring(0, 100) + '...';
                }
                return `<td>${this.escapeHtml(String(value))}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    document.getElementById('database-viewer').innerHTML = tableHtml;
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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

  async updateLeaderboard(data) {
    try {
      const leaderboardContainer = document.getElementById('leaderboard');
      if (!leaderboardContainer) return;

      // Fetch users data to get usernames and message counts
      const response = await fetch('/api/database/users?limit=1000&offset=0');
      if (!response.ok) {
        console.warn('Failed to fetch leaderboard data');
        return;
      }

      const usersData = await response.json();
      if (!usersData.data || usersData.data.length === 0) {
        leaderboardContainer.innerHTML = '<div style="padding: 10px; text-align: center; color: #999; font-size: 0.9rem;">No users yet</div>';
        return;
      }

      // Sort users by message count descending and get top 4
      const topUsers = usersData.data
        .sort((a, b) => (b.message_count || 0) - (a.message_count || 0))
        .slice(0, 4);

      // Build leaderboard HTML
      const leaderboardHtml = topUsers.map((user, index) => {
        const rank = index + 1;
        const rankClass = rank <= 3 ? `rank-${rank}` : '';
        const username = user.username || `User ${user.user_id}`;
        const interactionCount = user.message_count || 0;

        return `
          <div class="leaderboard-row ${rankClass}">
            <span class="rank-badge">${rank}</span>
            <span class="user-name">${this.escapeHtml(username)}</span>
            <span class="user-count">${interactionCount}</span>
          </div>
        `;
      }).join('');

      leaderboardContainer.innerHTML = leaderboardHtml;
    } catch (error) {
      console.error('Error updating leaderboard:', error);
    }
  }

  async handleRestartClick() {
    const btn = document.getElementById('restart-btn');
    if (!confirm('Are you sure you want to restart the bot? This will temporarily disconnect the bot.')) {
      return;
    }

    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-label">Restarting...</span>';

    try {
      const response = await fetch('/api/control/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      if (data.success) {
        this.addActivityItem('✓ Bot restart initiated', 'info');
        setTimeout(() => {
          location.reload();
        }, 2000);
      } else {
        this.addActivityItem(`✗ Restart failed: ${data.error}`, 'error');
      }
    } catch (error) {
      this.addActivityItem(`✗ Restart error: ${error.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }

  async handleGitPullClick() {
    const btn = document.getElementById('git-pull-btn');
    if (!confirm('Pull latest changes from GitHub? The bot may need to restart.')) {
      return;
    }

    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-label">Pulling...</span>';

    try {
      const response = await fetch('/api/control/git-pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      if (data.success) {
        this.addActivityItem('✓ Git pull completed - changes loaded', 'info');
        this.addActivityItem(data.output || 'Pull successful', 'info');
      } else {
        this.addActivityItem(`✗ Git pull failed: ${data.error}`, 'error');
        if (data.output) {
          this.addActivityItem(`Error details: ${data.output}`, 'error');
        }
      }
    } catch (error) {
      this.addActivityItem(`✗ Git pull error: ${error.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
    window.dashboard.fetchVersionInfo();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.dashboard && !window.dashboard.isConnected) {
        // Reconnect logic could go here
    }
});
