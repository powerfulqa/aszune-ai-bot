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

  /**
   * Get element safely by ID
   * @param {string} id - Element ID
   * @returns {Element|null} Element or null if not found
   * @private
   */
  _getElement(id) {
    return document.getElementById(id);
  }

  /**
   * Set element text content safely
   * @param {string} id - Element ID
   * @param {*} value - Value to set
   * @private
   */
  _setText(id, value) {
    const el = this._getElement(id);
    if (el) el.textContent = value;
  }

  /**
   * Set element HTML content safely
   * @param {string} id - Element ID
   * @param {string} html - HTML to set
   * @private
   */
  _setHTML(id, html) {
    const el = this._getElement(id);
    if (el) el.innerHTML = html;
  }

  /**
   * Set element class safely
   * @param {string} id - Element ID
   * @param {string} className - Class name to set
   * @private
   */
  _setClass(id, className) {
    const el = this._getElement(id);
    if (el) el.className = className;
  }

  /**
   * Fetch and parse JSON safely
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Parsed JSON
   * @private
   */
  async _fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    try {
      return await response.json();
    } catch (error) {
      throw new Error(`Failed to parse response: ${error.message}`);
    }
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
    const tableSelect = this._getElement('database-table-select');
    if (tableSelect) {
      tableSelect.addEventListener('change', (e) => {
        this.loadDatabaseTable(e.target.value);
      });
    }

    // Database search
    const searchInput = this._getElement('database-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterDatabaseTable(e.target.value);
      });
    }

    // Control buttons
    const restartBtn = this._getElement('restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => this.handleRestartClick());
    }

    const gitPullBtn = this._getElement('git-pull-btn');
    if (gitPullBtn) {
      gitPullBtn.addEventListener('click', () => this.handleGitPullClick());
    }
  }

  setConnectionStatus(connected) {
    this.isConnected = connected;
    if (connected) {
      this._setClass('status-dot', 'status-dot connected');
      this._setText('status-text', 'Connected');
    } else {
      this._setClass('status-dot', 'status-dot error');
      this._setText('status-text', 'Disconnected');
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
      const data = await this._fetchJson('/api/version');
      this.updateVersionDisplay(data);
    } catch (error) {
      console.error('Error fetching version info:', error);
    }
  }

  updateVersionDisplay(versionData) {
    this._setText('version-number', versionData.version || '1.8.0');
    this._setText('commit-sha', versionData.commit || 'unknown');
    const commitLink = this._getElement('commit-link');
    if (commitLink && versionData.commitUrl) {
      commitLink.href = versionData.commitUrl;
    }
  }

  updateSystemMetrics(data) {
    // System metrics
    this._setText('system-uptime', data.system.uptimeFormatted);
    this._setText('memory-usage', `${data.system.memory.usagePercent}% (${data.system.memory.usedFormatted})`);
    this._setText('cpu-load', `${data.system.cpu.loadPercent}% (${data.system.cpu.loadAverage[0].toFixed(2)})`);
    this._setText('platform', `${data.system.platform} ${data.system.arch}`);

    // Process Info
    this._setText('process-id', data.system.process.pid);
    this._setText('process-memory', data.system.process.rssFormatted);
    this._setText('heap-usage', `${data.system.process.heapUsedFormatted} / ${data.system.process.heapTotalFormatted}`);
    this._setText('node-version-info', data.system.nodeVersion);

    // Cache Performance
    this._setText('cache-hit-rate', `${data.cache.hitRate}%`);
    this._setText('cache-requests', (data.cache.hits + data.cache.misses).toLocaleString());
    this._setText('cache-memory', data.cache.memoryUsageFormatted);
    this._setText('cache-entries', data.cache.entryCount.toLocaleString());

    this._setText('db-users', data.database.userCount.toLocaleString());
    this._setText('db-messages', data.database.totalMessages.toLocaleString());
    this._setText('db-active-reminders', data.database.reminders.activeReminders.toLocaleString());
    this._setText('db-completed-reminders', data.database.reminders.completedReminders.toLocaleString());

    this._setText('bot-uptime', data.uptime);

    // Poll Discord status separately (not in main metrics)
    this.updateDiscordStatus();
  }

  updateDiscordStatus() {
    if (!this.socket) return;

    this.socket.emit('request_discord_status', {}, (response) => {
      const statusEl = document.getElementById('discord-connection-status');
      const uptimeEl = document.getElementById('discord-uptime');

      if (response && response.connected) {
        if (statusEl) statusEl.textContent = '✓ Connected';
        if (uptimeEl) uptimeEl.textContent = response.uptime || '-';
      } else {
        if (statusEl) {
          const errorMsg = response?.error || 'Disconnected';
          if (errorMsg.includes('rate limit')) {
            statusEl.textContent = '⚠ Rate Limited';
          } else if (errorMsg.includes('not initialized')) {
            statusEl.textContent = '– Not Started';
          } else {
            statusEl.textContent = '✗ Disconnected';
          }
        }
        if (uptimeEl) uptimeEl.textContent = '-';
      }
    });
  }

  updateAnalyticsMetrics(data) {
    if (!data.analytics) return;

    this._setText('analytics-servers', data.analytics.summary.totalServers);
    this._setText('analytics-active-users', data.analytics.summary.totalUsers);
    this._setText('analytics-total-members', data.analytics.summary.totalUsers);
    this._setText('analytics-bots', '-');
    this._setText('analytics-success-rate', `${data.analytics.summary.successRate}%`);
    this._setText('analytics-error-rate', `${data.analytics.summary.errorRate}%`);
    this._setText('analytics-response-time', `${data.analytics.summary.avgResponseTime}ms`);
    this._setText('analytics-commands', data.analytics.summary.totalCommands);
  }

  updateCommandOutputs(data) {
    // /stats command output - show system-wide stats as demo (no user context)
    if (data.database) {
      const totalMessages = data.database.totalMessages || 0;
      const estimatedSummaries = Math.floor(totalMessages * 0.1);
      const activeReminders = data.reminders?.activeReminders || 0;
      this._setText('cmd-stats-messages', totalMessages);
      this._setText('cmd-stats-summaries', estimatedSummaries);
      this._setText('cmd-stats-reminders', activeReminders);
    }

    // /analytics command output
    if (data.analytics) {
      const totalUsers = data.analytics.summary.totalUsers || 0;
      const estimatedOnline = Math.floor(totalUsers * 0.2) || 0;
      this._setText('cmd-analytics-users', totalUsers);
      this._setText('cmd-analytics-online', estimatedOnline);
      this._setText('cmd-analytics-bots', 0);
      this._setText('cmd-analytics-success', '100%');
    }

    // /cache command output
    if (data.cache) {
      this._setText('cmd-cache-hitrate', `${data.cache.hitRate}%`);
      this._setText('cmd-cache-misses', data.cache.misses || 0);
      this._setText('cmd-cache-memory', data.cache.memoryUsageFormatted || '0 B');
      this._setText('cmd-cache-entries', data.cache.entryCount || 0);
    }

    // /dashboard command output (performance dashboard)
    if (data.system) {
      this._setText('cmd-dashboard-status', 'Running');
      this._setText('cmd-dashboard-response', '150ms');
      this._setText('cmd-dashboard-memory', `${data.system.memory.usagePercent}%`);
      this._setText('cmd-dashboard-tier', 'Standard');
    }

    // /resources command output
    if (data.resources) {
      this._setText('cmd-resources-memory', (data.resources.memory.status || 'Good').toUpperCase());
      this._setText('cmd-resources-usage', `${data.resources.memory.used}MB / ${data.resources.memory.free}MB`);
      this._setText('cmd-resources-perf', (data.resources.performance.status || 'Normal').toUpperCase());
      this._setText('cmd-resources-response', `${data.resources.performance.responseTime}ms`);
    }
  }

  updateResourcesMetrics(data) {
    if (!data.resources) return;

    // Memory status
    const memStatus = this.getStatusBadgeClass(data.resources.memory.status);
    this._setText('resource-memory-status', (data.resources.memory.status || 'Unknown').toUpperCase());
    this._setClass('resource-memory-status', `value status-badge ${memStatus}`);

    this._setText('resource-memory-used', `${data.resources.memory.used}MB`);
    this._setText('resource-memory-free', `${data.resources.memory.free}MB`);
    this._setText('resource-memory-percent', `${data.resources.memory.percentage}%`);

    // Performance status
    const perfStatus = this.getStatusBadgeClass(data.resources.performance.status);
    this._setText('resource-performance-status', (data.resources.performance.status || 'Unknown').toUpperCase());
    this._setClass('resource-performance-status', `value status-badge ${perfStatus}`);

    this._setText('resource-response-time', `${data.resources.performance.responseTime}ms`);
    this._setText('resource-load', data.resources.performance.load || 'normal');
    this._setText('resource-optimization-tier', data.resources.optimizationTier || 'Standard');
  }

  getStatusBadgeClass(status) {
    const badgeMap = {
      good: 'good',
      optimal: 'good',
      warning: 'acceptable',
      acceptable: 'acceptable',
      degraded: 'warning',
      critical: 'critical',
    };

    if (!status || status === 'unknown') {
      return 'acceptable';
    }

    const statusLower = status.toLowerCase();
    for (const [key, badge] of Object.entries(badgeMap)) {
      if (statusLower.includes(key)) {
        return badge;
      }
    }

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
    if (!viewer) return;

    if (!this._hasTableData(tableData)) {
      this._renderEmptyTableMessage(viewer, info, tableData);
      return;
    }

    const columns = tableData.columns || Object.keys(tableData.data[0]);
    const tableHtml = this._buildTableHtml(columns, tableData.data);
    viewer.innerHTML = tableHtml;
    this._updateTableInfo(info, tableData);
  }

  _hasTableData(tableData) {
    return tableData.data && tableData.data.length > 0;
  }

  _renderEmptyTableMessage(viewer, info, tableData) {
    viewer.innerHTML = '<div class="db-message">No data in this table</div>';
    if (info) info.textContent = `${tableData.table}: 0 rows`;
  }

  _buildTableHtml(columns, rows) {
    const headerHtml = columns.map((col) => `<th>${col}</th>`).join('');
    const bodyHtml = rows
      .map(
        (row) => `
        <tr>
          ${columns
            .map(
              (col) => `<td>${this.escapeHtml(String(this._formatTableCell(row[col], col)))}</td>`
            )
            .join('')}
        </tr>
      `
      )
      .join('');

    return `
      <table class="database-table">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    `;
  }

  _formatTableCell(value, columnName) {
    const dateColumns = ['last_active', 'first_seen', 'timestamp', 'created_at', 'scheduled_time'];

    if (value === null || value === undefined) {
      return '-';
    }

    if (dateColumns.includes(columnName) && typeof value === 'string') {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toLocaleString('en-US', {
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
        // Keep original value if parsing fails
      }
    }

    if (typeof value === 'string' && value.length > 100) {
      return value.substring(0, 100) + '...';
    }

    return value;
  }

  _updateTableInfo(info, tableData) {
    if (info) {
      info.textContent = `${tableData.table}: ${tableData.totalRows} rows (showing ${tableData.returnedRows})`;
    }
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

  addActivityItem(message, type = 'info', preserveFormatting = false) {
    const activityLog = document.getElementById('activity-log');
    if (!activityLog) {
      console.warn('Activity log element not found');
      return;
    }

    const item = document.createElement('div');
    item.className = `activity-item fade-in status-${type}`;

    const timestamp = new Date().toLocaleTimeString();

    if (preserveFormatting) {
      // For CLI output, preserve line breaks and use monospace font
      item.style.whiteSpace = 'pre-wrap';
      item.style.fontFamily = 'monospace';
      item.style.fontSize = '0.85em';
      item.textContent = `[${timestamp}] ${message}`;
    } else {
      item.textContent = `[${timestamp}] ${message}`;
    }

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

      const usersData = await this._fetchLeaderboardData();
      if (!usersData) {
        return;
      }

      const topUsers = this._getTopLeaderboardUsers(usersData.data);
      if (topUsers.length === 0) {
        this._renderEmptyLeaderboard(leaderboardContainer);
        return;
      }

      if (!this._hasValidUsernames(topUsers)) {
        this._renderDiscordNotConnectedMessage(leaderboardContainer);
        return;
      }

      const leaderboardHtml = this._buildLeaderboardHtml(topUsers);
      leaderboardContainer.innerHTML = leaderboardHtml;
    } catch (error) {
      console.error('Error updating leaderboard:', error);
    }
  }

  async _fetchLeaderboardData() {
    try {
      const response = await fetch('/api/database/user_stats?limit=1000&offset=0');
      if (!response.ok) {
        console.warn('Failed to fetch leaderboard data');
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
      return null;
    }
  }

  _getTopLeaderboardUsers(usersData) {
    if (!usersData || usersData.length === 0) {
      return [];
    }
    return usersData.sort((a, b) => (b.message_count || 0) - (a.message_count || 0)).slice(0, 4);
  }

  _hasValidUsernames(topUsers) {
    return topUsers.some((user) => user.username && user.username.trim() !== '');
  }

  _renderEmptyLeaderboard(container) {
    container.innerHTML =
      '<div style="padding: 10px; text-align: center; color: #999; font-size: 0.9rem;">No users yet</div>';
  }

  _renderDiscordNotConnectedMessage(container) {
    container.innerHTML = `
      <div style="padding: 15px; text-align: center; color: #999; font-size: 0.9rem;">
        <div style="margin-bottom: 8px;">⚠️ Discord Not Connected</div>
        <div style="font-size: 0.8rem;">Usernames will appear when Discord reconnects</div>
      </div>
    `;
  }

  _buildLeaderboardHtml(topUsers) {
    return topUsers
      .map((user, index) => {
        const displayName = user.username?.trim();
        if (!displayName) return '';

        const rank = index + 1;
        const rankClass = rank <= 3 ? `rank-${rank}` : '';
        const interactionCount = user.message_count || 0;

        return `
          <div class="leaderboard-row ${rankClass}">
            <span class="rank-badge">${rank}</span>
            <span class="user-name" title="ID: ${user.user_id}">${this.escapeHtml(displayName)}</span>
            <span class="user-count">${interactionCount}</span>
          </div>
        `;
      })
      .filter((html) => html !== '')
      .join('');
  }

  async handleRestartClick() {
    const btn = this._getElement('restart-btn');
    if (!confirm('Are you sure you want to restart the bot? This will temporarily disconnect the bot.')) {
      return;
    }

    const originalText = btn?.innerHTML;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-label">Restarting...</span>';
    }

    try {
      const data = await this._fetchJson('/api/control/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (data.success) {
        this.addActivityItem('✓ Bot restart initiated', 'info');
      } else {
        this.addActivityItem(`✗ Restart failed: ${data.error}`, 'error');
      }
    } catch (error) {
      this.addActivityItem(`✗ Restart error: ${error.message}`, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  }

  async handleGitPullClick() {
    const btn = this._getElement('git-pull-btn');
    if (!confirm('Pull latest changes from GitHub? The bot may need to restart.')) {
      return;
    }

    const originalText = btn?.innerHTML;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-label">Pulling...</span>';
    }

    try {
      const data = await this._fetchJson('/api/control/git-pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      this.handleGitPullResponse(data);
    } catch (error) {
      this.addActivityItem(`✗ Git pull error: ${error.message}`, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  }

  handleGitPullResponse(data) {
    if (data.success) {
      this.addActivityItem('✓ Git pull completed - changes loaded', 'info');
      if (data.output) {
        this.addActivityItem(data.output, 'info', true);
      } else {
        this.addActivityItem(data.message || 'Pull successful', 'info');
      }
    } else {
      this.addActivityItem(`✗ Git pull failed: ${data.error || 'Unknown error'}`, 'error');
      if (data.details) {
        this.addActivityItem(data.details, 'error', true);
      }
      if (data.output) {
        this.addActivityItem(data.output, 'error', true);
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
