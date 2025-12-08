/**
 * Metrics Module - Performance tracking and analytics
 * Aggregates all metrics utilities
 * 
 * @module utils/metrics
 */

const analyticsCore = require('./analytics-core');
const perfMonitor = require('./perf-monitor');
const telemetry = require('./telemetry');
const sessionValidator = require('./session-validator');

module.exports = {
  // Core analytics
  ...analyticsCore,
  
  // Performance monitoring
  getNetworkInfo: perfMonitor.getNetworkInfo,
  getSystemMetrics: perfMonitor.getSystemMetrics,
  captureEnvironment: perfMonitor.captureEnvironment,
  
  // Telemetry
  initializeTelemetry: telemetry.initialize,
  shutdownTelemetry: telemetry.shutdown,
  
  // Session validation
  isSessionValid: sessionValidator.isSessionValid,
  validateRequest: sessionValidator.validateRequest,
  processResponse: sessionValidator.processResponse,
  
  // Convenience
  isReady: () => analyticsCore.isVerified(),
};
