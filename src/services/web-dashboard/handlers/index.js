/**
 * Web Dashboard Socket Handlers
 * Central export for all socket handler modules
 * @module web-dashboard/handlers
 */

const networkHandlers = require('./networkHandlers');
const logsHandlers = require('./logsHandlers');
const reminderHandlers = require('./reminderHandlers');
const serviceHandlers = require('./serviceHandlers');
const configHandlers = require('./configHandlers');
const callbackHelpers = require('./callbackHelpers');

module.exports = {
  // Callback helpers (for reducing duplication)
  ...callbackHelpers,

  // Network handlers
  registerNetworkHandlers: networkHandlers.registerNetworkHandlers,
  handleNetworkStatus: networkHandlers.handleNetworkStatus,
  handleNetworkTest: networkHandlers.handleNetworkTest,
  buildNetworkInterfaces: networkHandlers.buildNetworkInterfaces,

  // Logs handlers
  registerLogsHandlers: logsHandlers.registerLogsHandlers,
  handleRequestLogs: logsHandlers.handleRequestLogs,
  handleClearLogs: logsHandlers.handleClearLogs,

  // Reminder handlers
  registerReminderHandlers: reminderHandlers.registerReminderHandlers,
  handleRequestReminders: reminderHandlers.handleRequestReminders,
  handleCreateReminder: reminderHandlers.handleCreateReminder,
  handleEditReminder: reminderHandlers.handleEditReminder,
  handleDeleteReminder: reminderHandlers.handleDeleteReminder,
  handleFilterReminders: reminderHandlers.handleFilterReminders,

  // Service handlers
  registerServiceHandlers: serviceHandlers.registerServiceHandlers,
  handleRequestServices: serviceHandlers.handleRequestServices,
  handleServiceAction: serviceHandlers.handleServiceAction,
  handleQuickServiceAction: serviceHandlers.handleQuickServiceAction,
  handleDiscordStatus: serviceHandlers.handleDiscordStatus,

  // Config handlers
  registerConfigHandlers: configHandlers.registerConfigHandlers,
  handleRequestConfig: configHandlers.handleRequestConfig,
  handleSaveConfig: configHandlers.handleSaveConfig,
  handleValidateConfig: configHandlers.handleValidateConfig,
};
