/**
 * Dashboard page shell — shared by every page.
 *
 * Include as the first element inside `<div class="dashboard">`:
 *   <script src="shell.js"></script>
 * It synchronously inserts the header and navigation in its own place (so the
 * ids dashboard.js looks up exist before DOMContentLoaded), marks the current
 * page's nav link, and provides small shared helpers for page scripts:
 *   - Poller.every(fn, ms)       polling that pauses in hidden tabs, never overlaps
 *   - showToast(message, type)   non-blocking notification (replaces alert())
 *   - whenDashboardReady(fn)     run fn(socket) once the dashboard socket is connected
 */

(function renderShell() {
  const NAV_ITEMS = [
    { href: 'index.html', icon: '📊', label: 'Dashboard', title: 'Dashboard' },
    { href: 'logs-viewer.html', icon: '📋', label: 'Logs', title: 'Real-Time Log Viewer' },
    {
      href: 'service-management.html',
      icon: '🔧',
      label: 'Services',
      title: 'Service Status & Management',
    },
    { href: 'config-editor.html', icon: '⚙️', label: 'Config', title: 'Configuration Editor' },
    {
      href: 'network-status.html',
      icon: '🌐',
      label: 'Network',
      title: 'Network & Connectivity Status',
    },
    {
      href: 'reminder-management.html',
      icon: '⏰',
      label: 'Reminders',
      title: 'Reminder Management Interface',
    },
    { href: 'database.html', icon: '💾', label: 'Database', title: 'View Database Contents' },
    { href: 'error-logs.html', icon: '⚠️', label: 'Errors', title: 'View Error Logs' },
  ];

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  const navHtml = NAV_ITEMS.map((item) => {
    const active = item.href === currentPage;
    return `<a href="${item.href}" class="navbar-item${active ? ' active' : ''}" title="${item.title}"${
      active ? ' aria-current="page"' : ''
    }>
          <span class="navbar-icon">${item.icon}</span>
          <span class="navbar-label">${item.label}</span>
        </a>`;
  }).join('');

  const shellHtml = `
    <header class="dashboard-header">
      <div class="header-left">
        <h1>Aszune AI Bot Dashboard</h1>
        <div class="version-info">
          <span class="version-badge" id="version-badge">
            <span class="version-text">v<span id="version-number">…</span></span>
            <span class="commit-text">Commit:
              <a id="commit-link" href="#" target="_blank" rel="noopener noreferrer"><span id="commit-sha">unknown</span></a>
            </span>
          </span>
        </div>
      </div>
      <div class="header-right">
        <div class="control-buttons">
          <button id="git-pull-btn" class="control-btn git-pull-btn" title="Pull latest changes from GitHub">
            <span class="btn-icon">⬇️</span>
            <span class="btn-label">Git Pull</span>
          </button>
          <button id="restart-btn" class="control-btn restart-btn" title="Restart the bot">
            <span class="btn-icon">🔄</span>
            <span class="btn-label">Restart</span>
          </button>
        </div>
        <div class="status-indicator">
          <span class="status-dot connecting" id="status-dot"></span>
          <span id="status-text">Connecting...</span>
        </div>
      </div>
    </header>
    <nav class="dashboard-navbar" aria-label="Dashboard pages">
      <div class="navbar-content">${navHtml}</div>
    </nav>`;

  const script = document.currentScript;
  if (script) {
    script.insertAdjacentHTML('beforebegin', shellHtml);
  }
})();

/**
 * Polling loop for page data. Unlike setInterval it waits for one run to
 * finish before scheduling the next (a slow server can't pile up requests),
 * skips ticks while the tab is hidden, and refreshes as soon as the tab is
 * visible again.
 */
const Poller = {
  active: new Set(),
  listening: false,

  /**
   * @param {Function} task - Sync or async function to run each tick
   * @param {number} intervalMs - Delay between the end of one run and the next
   * @param {object} [opts] - { immediate: run once right away }
   * @returns {{stop: Function, trigger: Function}} Handle
   */
  every(task, intervalMs, { immediate = false } = {}) {
    const handle = {
      timer: null,
      running: false,
      stopped: false,
      pendingResume: false,
      async run() {
        if (this.stopped || this.running) return;
        clearTimeout(this.timer);
        if (document.hidden) {
          this.pendingResume = true;
          return;
        }
        this.running = true;
        try {
          await task();
        } catch (err) {
          console.error('Poller task failed:', err);
        } finally {
          this.running = false;
        }
        this.schedule();
      },
      schedule() {
        if (!this.stopped) this.timer = setTimeout(() => this.run(), intervalMs);
      },
      trigger() {
        return this.run();
      },
      stop() {
        this.stopped = true;
        clearTimeout(this.timer);
        Poller.active.delete(this);
      },
    };
    Poller.active.add(handle);
    Poller.listen();
    if (immediate) handle.run();
    else handle.schedule();
    return handle;
  },

  listen() {
    if (this.listening) return;
    this.listening = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      this.active.forEach((handle) => {
        if (handle.pendingResume) {
          handle.pendingResume = false;
          handle.run();
        }
      });
    });
  },
};
window.Poller = Poller;

/**
 * Show a non-blocking toast.
 * @param {string} message - Plain text (never interpreted as HTML)
 * @param {'info'|'success'|'warning'|'error'} [type] - Visual style
 * @param {number} [durationMs] - How long it stays
 */
function showToast(message, type = 'info', durationMs = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-leaving');
    setTimeout(() => toast.remove(), 300);
  }, durationMs);
}
window.showToast = showToast;

/**
 * Run `fn(socket)` once dashboard.js has created its socket and it is
 * connected. Replaces the per-page `setTimeout(init, 100)` retry loops,
 * which only waited for the socket object to exist, not to connect.
 * @param {Function} fn - Receives the connected socket
 */
function whenDashboardReady(fn) {
  const socket = window.dashboard?.socket;
  if (!socket) {
    setTimeout(() => whenDashboardReady(fn), 100);
    return;
  }
  if (socket.connected) {
    fn(socket);
  } else {
    socket.once('connect', () => fn(socket));
  }
}
window.whenDashboardReady = whenDashboardReady;
