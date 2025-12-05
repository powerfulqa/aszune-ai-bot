/**
 * Alert Factory Utilities
 *
 * Provides a unified pattern for creating metric-based alerts
 * to reduce code duplication in performance-dashboard.js.
 */

/**
 * Alert threshold configuration
 * @typedef {Object} ThresholdConfig
 * @property {number} critical - Critical threshold value
 * @property {number} warning - Warning threshold value
 * @property {string} criticalMsg - Critical alert message
 * @property {string} warningMsg - Warning alert message
 * @property {string} unit - Unit suffix for display (e.g., 'MB', 'ms', '%')
 */

/**
 * Create an alert object
 * @param {string} type - Alert type (memory, performance, reliability)
 * @param {string} severity - Alert severity (critical, warning)
 * @param {string} message - Alert message
 * @param {*} value - Current value
 * @param {string} threshold - Threshold value as string
 * @param {string} timestamp - Alert timestamp
 * @returns {Object} Alert object
 */
function createAlert(type, severity, message, value, threshold, timestamp) {
  return {
    type,
    severity,
    message,
    value,
    threshold,
    timestamp,
  };
}

/**
 * Check metric value against thresholds and generate alerts
 * Generic factory function that eliminates the duplicate pattern:
 * - Check if metrics exist
 * - Check against critical threshold
 * - Check against warning threshold
 *
 * @param {Object} currentMetrics - Current metrics object
 * @param {string} metricKey - Key in currentMetrics to check
 * @param {string} alertType - Type of alert (memory, performance, reliability)
 * @param {ThresholdConfig} config - Threshold configuration
 * @param {string} timestamp - Timestamp for alerts
 * @returns {Array} Array of alerts (0-1 items)
 */
function checkMetricAlerts(currentMetrics, metricKey, alertType, config, timestamp) {
  const alerts = [];

  if (!currentMetrics || currentMetrics[metricKey] === undefined) {
    return alerts;
  }

  const value = currentMetrics[metricKey];
  const { critical, warning, criticalMsg, warningMsg, unit } = config;

  if (value > critical) {
    alerts.push(
      createAlert(
        alertType,
        'critical',
        criticalMsg,
        `${value}${unit}`,
        `${critical}${unit}`,
        timestamp
      )
    );
  } else if (value > warning) {
    alerts.push(
      createAlert(
        alertType,
        'warning',
        warningMsg,
        `${value}${unit}`,
        `${warning}${unit}`,
        timestamp
      )
    );
  }

  return alerts;
}

/**
 * Pre-configured alert checkers for common metric types
 */
const ALERT_CONFIGS = {
  memory: {
    critical: 400,
    warning: 200,
    criticalMsg: 'Memory usage is critically high',
    warningMsg: 'Memory usage is elevated',
    unit: 'MB',
  },
  responseTime: {
    critical: 5000,
    warning: 3000,
    criticalMsg: 'Response time is very slow',
    warningMsg: 'Response time is slower than expected',
    unit: 'ms',
  },
  errorRate: {
    critical: 10,
    warning: 5,
    criticalMsg: 'Error rate is critically high',
    warningMsg: 'Error rate is elevated',
    unit: '%',
  },
};

/**
 * Check memory alerts using pre-configured thresholds
 * @param {Object} currentMetrics - Current metrics
 * @param {string} timestamp - Alert timestamp
 * @returns {Array} Memory alerts
 */
function checkMemoryAlerts(currentMetrics, timestamp) {
  return checkMetricAlerts(currentMetrics, 'memoryUsage', 'memory', ALERT_CONFIGS.memory, timestamp);
}

/**
 * Check performance/response time alerts using pre-configured thresholds
 * @param {Object} currentMetrics - Current metrics
 * @param {string} timestamp - Alert timestamp
 * @returns {Array} Performance alerts
 */
function checkPerformanceAlerts(currentMetrics, timestamp) {
  return checkMetricAlerts(
    currentMetrics,
    'avgResponseTime',
    'performance',
    ALERT_CONFIGS.responseTime,
    timestamp
  );
}

/**
 * Check reliability/error rate alerts using pre-configured thresholds
 * @param {Object} currentMetrics - Current metrics
 * @param {string} timestamp - Alert timestamp
 * @returns {Array} Reliability alerts
 */
function checkReliabilityAlerts(currentMetrics, timestamp) {
  return checkMetricAlerts(
    currentMetrics,
    'errorRate',
    'reliability',
    ALERT_CONFIGS.errorRate,
    timestamp
  );
}

module.exports = {
  createAlert,
  checkMetricAlerts,
  checkMemoryAlerts,
  checkPerformanceAlerts,
  checkReliabilityAlerts,
  ALERT_CONFIGS,
};
