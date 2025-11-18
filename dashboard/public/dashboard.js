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
    this.lastActivityLogTime = 0;
    this.activityLogThrottle = 5 * 60 * 1000; // 5 minutes in milliseconds

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
      this.updateCommandOutputs(data);
      this.fetchAndUpdateRecommendations();
      this.updateLeaderboard(data);

      this.metricsHistory.push(data);
      if (this.metricsHistory.length > this.maxHistoryPoints) {
        this.metricsHistory.shift();
      }

      // Only log metrics update to activity log every 5 minutes (reduce noise)
      const now = Date.now();
      if (now - this.lastActivityLogTime >= this.activityLogThrottle) {
        this.addActivityItem('Metrics updated');
        this.lastActivityLogTime = now;
      }
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
    // Helper function to safely set element text content
    const safeSetText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    safeSetText('system-uptime', data.system.uptimeFormatted);
    safeSetText(
      'memory-usage',
      `${data.system.memory.usagePercent}% (${data.system.memory.usedFormatted})`
    );
    safeSetText(
      'cpu-load',
      `${data.system.cpu.loadPercent}% (${data.system.cpu.loadAverage[0].toFixed(2)})`
    );
    safeSetText('platform', `${data.system.platform} ${data.system.arch}`);

    // Process Info
    safeSetText('process-id', data.system.process.pid);
    safeSetText('process-memory', data.system.process.rssFormatted);
    safeSetText(
      'heap-usage',
      `${data.system.process.heapUsedFormatted} / ${data.system.process.heapTotalFormatted}`
    );
    safeSetText('node-version-info', data.system.nodeVersion);

    // Cache Performance
    safeSetText('cache-hit-rate', `${data.cache.hitRate}%`);
    safeSetText('cache-requests', (data.cache.hits + data.cache.misses).toLocaleString());
    safeSetText('cache-memory', data.cache.memoryUsageFormatted);
    safeSetText('cache-entries', data.cache.entryCount.toLocaleString());

    safeSetText('db-users', data.database.userCount.toLocaleString());
    safeSetText('db-messages', data.database.totalMessages.toLocaleString());
    safeSetText('db-active-reminders', data.database.reminders.activeReminders.toLocaleString());
    safeSetText(
      'db-completed-reminders',
      data.database.reminders.completedReminders.toLocaleString()
    );

    safeSetText('bot-uptime', data.uptime);
    safeSetText('last-update', new Date(data.timestamp).toLocaleTimeString());
    safeSetText('node-version', data.system.nodeVersion);
  }

  updateAnalyticsMetrics(data) {
    if (!data.analytics) return;

    // Helper function to safely set element text content
    const safeSetText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    safeSetText('analytics-servers', data.analytics.summary.totalServers);
    safeSetText('analytics-active-users', data.analytics.summary.totalUsers);
    safeSetText('analytics-total-members', data.analytics.summary.totalUsers);
    safeSetText('analytics-bots', '-');
    safeSetText('analytics-success-rate', `${data.analytics.summary.successRate}%`);
    safeSetText('analytics-error-rate', `${data.analytics.summary.errorRate}%`);
    safeSetText('analytics-response-time', `${data.analytics.summary.avgResponseTime}ms`);
    safeSetText('analytics-commands', data.analytics.summary.totalCommands);
  }

  updateCommandOutputs(data) {
    // Helper function to safely set element text content
    const safeSetText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    // /stats command output - show system-wide stats as demo (no user context)
    if (data.database) {
      const totalMessages = data.database.totalMessages || 0;
      const estimatedSummaries = Math.floor(totalMessages * 0.1);
      const activeReminders = data.reminders?.activeReminders || 0;
      safeSetText('cmd-stats-messages', totalMessages);
      safeSetText('cmd-stats-summaries', estimatedSummaries);
      safeSetText('cmd-stats-reminders', activeReminders);
    }

    // /analytics command output
    if (data.analytics) {
      const totalUsers = data.analytics.summary.totalUsers || 0;
      const estimatedOnline = Math.floor(totalUsers * 0.2) || 0;
      safeSetText('cmd-analytics-users', totalUsers);
      safeSetText('cmd-analytics-online', estimatedOnline);
      safeSetText('cmd-analytics-bots', 0);
      safeSetText('cmd-analytics-success', '100%');
    }

    // /cache command output
    if (data.cache) {
      safeSetText('cmd-cache-hitrate', `${data.cache.hitRate}%`);
      safeSetText('cmd-cache-misses', data.cache.misses || 0);
      safeSetText('cmd-cache-memory', data.cache.memoryUsageFormatted || '0 B');
      safeSetText('cmd-cache-entries', data.cache.entryCount || 0);
    }

    // /dashboard command output (performance dashboard)
    if (data.system) {
      safeSetText('cmd-dashboard-status', 'Running');
      safeSetText('cmd-dashboard-response', '150ms');
      safeSetText('cmd-dashboard-memory', `${data.system.memory.usagePercent}%`);
      safeSetText('cmd-dashboard-tier', 'Standard');
    }

    // /resources command output
    if (data.resources) {
      safeSetText('cmd-resources-memory', (data.resources.memory.status || 'Good').toUpperCase());
      safeSetText(
        'cmd-resources-usage',
        `${data.resources.memory.used}MB / ${data.resources.memory.free}MB`
      );
      safeSetText(
        'cmd-resources-perf',
        (data.resources.performance.status || 'Normal').toUpperCase()
      );
      safeSetText('cmd-resources-response', `${data.resources.performance.responseTime}ms`);
    }
  }

  updateResourcesMetrics(data) {
    if (!data.resources) return;

    // Helper function to safely set element text content
    const safeSetText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    // Helper function to safely set element class
    const safeSetClass = (id, className) => {
      const el = document.getElementById(id);
      if (el) el.className = className;
    };

    // Memory status
    const memStatus = this.getStatusBadgeClass(data.resources.memory.status);
    safeSetText(
      'resource-memory-status',
      (data.resources.memory.status || 'Unknown').toUpperCase()
    );
    safeSetClass('resource-memory-status', `value status-badge ${memStatus}`);

    safeSetText('resource-memory-used', `${data.resources.memory.used}MB`);
    safeSetText('resource-memory-free', `${data.resources.memory.free}MB`);
    safeSetText('resource-memory-percent', `${data.resources.memory.percentage}%`);

    // Performance status
    const perfStatus = this.getStatusBadgeClass(data.resources.performance.status);
    safeSetText(
      'resource-performance-status',
      (data.resources.performance.status || 'Unknown').toUpperCase()
    );
    safeSetClass('resource-performance-status', `value status-badge ${perfStatus}`);

    safeSetText('resource-response-time', `${data.resources.performance.responseTime}ms`);
    safeSetText('resource-load', data.resources.performance.load || 'normal');
    safeSetText('resource-optimization-tier', data.resources.optimizationTier || 'Standard');
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
    if (!container) return; // Element doesn't exist on this page

    if (!recommendations || recommendations.length === 0) {
      container.innerHTML = `
        <div class="recommendation-item info">
          <span class="rec-severity info">INFO</span>
          <span class="rec-message">System monitoring active</span>
        </div>
      `;
      return;
    }

    container.innerHTML = recommendations
      .map(
        (rec) => `
      <div class="recommendation-item ${rec.severity || 'info'}">
        <span class="rec-severity ${rec.severity || 'info'}">${(rec.severity || 'info').toUpperCase()}</span>
        <div style="flex: 1;">
          <div class="rec-message"><strong>${rec.message}</strong></div>
          <div class="rec-message" style="font-size: 0.85rem; color: #666;">→ ${rec.action}</div>
        </div>
      </div>
    `
      )
      .join('');
  }

  updateErrorLogs(data) {
    const errorLogsElement = document.getElementById('error-logs');
    if (!errorLogsElement) return; // Element doesn't exist on this page

    if (!data.analytics?.recentErrors || data.analytics.recentErrors.length === 0) {
      errorLogsElement.innerHTML =
        '<div class="error-log-no-errors">✓ No errors logged - System running smoothly</div>';
      return;
    }

    const errorLogsHtml = data.analytics.recentErrors
      .map((error) => {
        const timestamp = new Date(error.timestamp).toLocaleTimeString();
        const errorMsg = error.error || 'Unknown error';
        return `
        <div class="error-log-item">
          <div class="error-log-time">[${timestamp}]</div>
          <div class="error-log-message">ERROR: ${error.message}</div>
          ${error.error ? `<div class="error-log-detail">→ ${errorMsg}</div>` : ''}
        </div>
      `;
      })
      .join('');

    errorLogsElement.innerHTML = errorLogsHtml;
  }

  async loadDatabaseTable(tableName) {
    const databaseViewer = document.getElementById('database-viewer');
    const tableInfo = document.getElementById('table-info');
    if (!databaseViewer) return; // Element doesn't exist on this page

    if (!tableName) {
      databaseViewer.innerHTML = '<div class="db-message">Select a table to view data</div>';
      return;
    }

    this.currentTable = tableName;
    if (tableInfo) tableInfo.textContent = 'Loading...';

    try {
      const response = await fetch(`/api/database/${tableName}?limit=100&offset=0`);
      if (!response.ok) throw new Error('Failed to fetch table data');

      const tableData = await response.json();
      this.databaseCache[tableName] = tableData;
      this.renderDatabaseTable(tableData);
    } catch (error) {
      console.error(`Error loading table ${tableName}:`, error);
      databaseViewer.innerHTML = `<div class="db-message">Error loading table: ${error.message}</div>`;
    }
  }

  renderDatabaseTable(tableData) {
    const viewer = document.getElementById('database-viewer');
    const info = document.getElementById('table-info');
    if (!viewer) return; // Element doesn't exist on this page

    if (!tableData.data || tableData.data.length === 0) {
      viewer.innerHTML = '<div class="db-message">No data in this table</div>';
      if (info) info.textContent = `${tableData.table}: 0 rows`;
      return;
    }

    const columns = tableData.columns || Object.keys(tableData.data[0]);
    const dateColumns = ['last_active', 'first_seen', 'timestamp', 'created_at', 'scheduled_time'];

    const tableHtml = `
      <table class="database-table">
        <thead>
          <tr>
            ${columns.map((col) => `<th>${col}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${tableData.data
            .map(
              (row) => `
            <tr>
              ${columns
                .map((col) => {
                  let value = row[col];
                  if (value === null || value === undefined) {
                    value = '-';
                  } else if (dateColumns.includes(col) && typeof value === 'string') {
                    // Format ISO date strings to readable format
                    try {
                      const date = new Date(value);
                      if (!isNaN(date.getTime())) {
                        value = date.toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: true,
                        });
                      }
                    } catch (e) {
                      // If date parsing fails, keep original value
                    }
                  } else if (typeof value === 'string' && value.length > 100) {
                    value = value.substring(0, 100) + '...';
                  }
                  return `<td>${this.escapeHtml(String(value))}</td>`;
                })
                .join('')}
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `;

    viewer.innerHTML = tableHtml;
    if (info)
      info.textContent = `${tableData.table}: ${tableData.totalRows} rows (showing ${tableData.returnedRows})`;
  }

  filterDatabaseTable(searchTerm) {
    if (!this.currentTable || !this.databaseCache[this.currentTable]) return;

    const databaseViewer = document.getElementById('database-viewer');
    if (!databaseViewer) return;

    const tableData = this.databaseCache[this.currentTable];
    const filtered = tableData.data.filter((row) => {
      return Object.values(row).some((val) =>
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

    if (filtered.length === 0) {
      databaseViewer.innerHTML = '<div class="db-message">No matching results</div>';
      return;
    }

    const columns = tableData.columns || Object.keys(tableData.data[0]);
    const tableHtml = `
      <table class="database-table">
        <thead>
          <tr>
            ${columns.map((col) => `<th>${col}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${filtered
            .map(
              (row) => `
            <tr>
              ${columns
                .map((col) => {
                  let value = row[col];
                  if (value === null || value === undefined) value = '-';
                  if (typeof value === 'string' && value.length > 100) {
                    value = value.substring(0, 100) + '...';
                  }
                  return `<td>${this.escapeHtml(String(value))}</td>`;
                })
                .join('')}
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `;

    databaseViewer.innerHTML = tableHtml;
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
    if (!activityLog) {
      console.warn('Activity log element not found');
      return;
    }

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
      const response = await fetch('/api/database/user_stats?limit=1000&offset=0');
      if (!response.ok) {
        console.warn('Failed to fetch leaderboard data');
        return;
      }

      const usersData = await response.json();
      if (!usersData.data || usersData.data.length === 0) {
        leaderboardContainer.innerHTML =
          '<div style="padding: 10px; text-align: center; color: #999; font-size: 0.9rem;">No users yet</div>';
        return;
      }

      // Sort users by message count descending and get top 4
      const topUsers = usersData.data
        .sort((a, b) => (b.message_count || 0) - (a.message_count || 0))
        .slice(0, 4);

      // Build leaderboard HTML
      const leaderboardHtml = topUsers
        .map((user, index) => {
          const rank = index + 1;
          const rankClass = rank <= 3 ? `rank-${rank}` : '';

          // Display username if available, otherwise show a cleaned-up user ID
          let displayName = user.username;
          if (!displayName || displayName.trim() === '') {
            // Format user ID for better display (show last 8 digits)
            const userIdStr = String(user.user_id);
            displayName = `User ${userIdStr.slice(-8)}`;
          }

          const interactionCount = user.message_count || 0;

          return `
          <div class="leaderboard-row ${rankClass}">
            <span class="rank-badge">${rank}</span>
            <span class="user-name" title="ID: ${user.user_id}">${this.escapeHtml(displayName)}</span>
            <span class="user-count">${interactionCount}</span>
          </div>
        `;
        })
        .join('');

      leaderboardContainer.innerHTML = leaderboardHtml;
    } catch (error) {
      console.error('Error updating leaderboard:', error);
    }
  }

  async handleRestartClick() {
    const btn = document.getElementById('restart-btn');
    if (
      !confirm(
        'Are you sure you want to restart the bot? This will temporarily disconnect the bot.'
      )
    ) {
      return;
    }

    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-label">Restarting...</span>';

    try {
      const response = await fetch('/api/control/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
      });

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error(`Failed to parse response: ${parseError.message}`);
      }

      this.handleGitPullResponse(response, data);
    } catch (error) {
      this.addActivityItem(`✗ Git pull error: ${error.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }

  handleGitPullResponse(response, data) {
    if (response.ok && data.success) {
      this.addActivityItem('✓ Git pull completed - changes loaded', 'info');
      this.addActivityItem(data.output || data.message || 'Pull successful', 'info');
    } else if (!response.ok) {
      const errorMsg = data.error || data.message || 'Unknown error';
      this.addActivityItem(`✗ Git pull failed (HTTP ${response.status}): ${errorMsg}`, 'error');
      if (data.details) {
        this.addActivityItem(`Details: ${data.details}`, 'error');
      }
      if (data.output) {
        this.addActivityItem(`Output: ${data.output}`, 'error');
      }
    } else {
      this.addActivityItem(`✗ Git pull failed: ${data.error || 'Unknown error'}`, 'error');
      if (data.output) {
        this.addActivityItem(`Error details: ${data.output}`, 'error');
      }
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
