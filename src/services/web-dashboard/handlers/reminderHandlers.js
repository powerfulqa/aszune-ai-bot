/**
 * Reminder Socket Handlers for Web Dashboard
 * Handles reminder-related socket events
 * @module web-dashboard/handlers/reminderHandlers
 */

const logger = require('../../../utils/logger');
const databaseService = require('../../database');
const {
  sendError,
  sendCreateError,
  sendUpdateError,
  sendDeleteError,
  sendErrorWithEmptyArray,
} = require('./callbackHelpers');

/**
 * Register reminder-related socket event handlers
 * @param {Socket} socket - Socket.IO socket instance
 * @param {WebDashboardService} _dashboard - Dashboard service instance (unused, for API consistency)
 */
function registerReminderHandlers(socket, _dashboard) {
  socket.on('request_reminders', (data, callback) => {
    handleRequestReminders(data, callback);
  });

  socket.on('create_reminder', (data, callback) => {
    handleCreateReminder(data, callback);
  });

  socket.on('edit_reminder', (data, callback) => {
    handleEditReminder(data, callback);
  });

  socket.on('delete_reminder', (data, callback) => {
    handleDeleteReminder(data, callback);
  });

  socket.on('filter_reminders', (data, callback) => {
    handleFilterReminders(data, callback);
  });
}

/**
 * Handle request for reminders
 * @param {Object} data - Request data with userId and status filter
 * @param {Function} callback - Response callback
 */
function handleRequestReminders(data, callback) {
  try {
    const { userId = null, status = null } = data || {};

    // Get ALL reminders from database (not just future active ones)
    let reminders = databaseService.getAllReminders(userId);

    // Apply status filter if requested
    if (status === 'completed') {
      reminders = reminders.filter((r) => r.status === 'completed');
    } else if (status === 'active') {
      reminders = reminders.filter((r) => r.status === 'active' || r.status === 'pending');
    }

    const stats = databaseService.getReminderStats();

    if (callback) {
      callback({
        reminders: reminders || [],
        stats,
        total: reminders?.length || 0,
        timestamp: new Date().toISOString(),
      });
    }

    logger.debug(`Reminders requested: ${reminders?.length || 0} found`);
  } catch (error) {
    logger.error('Error retrieving reminders:', error);
    sendError(callback, error.message, { reminders: [], stats: {} });
  }
}

/**
 * Handle create reminder request
 * @param {Object} data - Reminder data
 * @param {Function} callback - Response callback
 */
function handleCreateReminder(data, callback) {
  try {
    const { userId, message, scheduledTime, channelId } = data;

    if (!userId || !message || !scheduledTime) {
      const error = new Error('Missing required fields: userId, message, scheduledTime');
      sendCreateError(callback, error.message);
      return;
    }

    const reminder = databaseService.createReminder(userId, message, scheduledTime, {
      channelId,
    });

    if (callback) {
      callback({
        created: true,
        reminder,
        timestamp: new Date().toISOString(),
      });
    }

    logger.info(`Reminder created: ${reminder.id} for user ${userId}`);
  } catch (error) {
    logger.error('Error creating reminder:', error);
    sendCreateError(callback, error.message);
  }
}

/**
 * Handle edit reminder request
 * @param {Object} data - Reminder update data
 * @param {Function} callback - Response callback
 */
function handleEditReminder(data, callback) {
  try {
    const { reminderId, userId, message, scheduledTime } = data;

    if (!reminderId || !userId) {
      const error = new Error('Missing required fields: reminderId, userId');
      sendUpdateError(callback, error.message);
      return;
    }

    const allReminders = databaseService.getActiveReminders(userId);
    const reminder = allReminders?.find((r) => r.id === reminderId);

    if (!reminder) {
      const error = new Error(`Reminder not found: ${reminderId}`);
      sendUpdateError(callback, error.message);
      return;
    }

    if (message) reminder.message = message;
    if (scheduledTime) reminder.scheduled_time = scheduledTime;

    logger.info(`Reminder ${reminderId} updated`);

    if (callback) {
      callback({
        updated: true,
        reminder,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Error editing reminder:', error);
    sendUpdateError(callback, error.message);
  }
}

/**
 * Handle delete reminder request
 * @param {Object} data - Delete request data
 * @param {Function} callback - Response callback
 */
function handleDeleteReminder(data, callback) {
  try {
    const { reminderId, userId } = data;

    if (!reminderId || !userId) {
      const error = new Error('Missing required fields: reminderId, userId');
      sendDeleteError(callback, error.message);
      return;
    }

    const deleted = databaseService.deleteReminder(reminderId, userId);

    if (!deleted) {
      const error = new Error(`Reminder not found or already deleted: ${reminderId}`);
      sendDeleteError(callback, error.message);
      return;
    }

    logger.info(`Reminder deleted: ${reminderId}`);

    if (callback) {
      callback({
        deleted: true,
        reminderId,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Error deleting reminder:', error);
    sendDeleteError(callback, error.message);
  }
}

/**
 * Handle filter reminders request
 * @param {Object} data - Filter criteria
 * @param {Function} callback - Response callback
 */
function handleFilterReminders(data, callback) {
  try {
    const { userId = null, status = null, searchText = null } = data || {};

    let reminders = databaseService.getActiveReminders(userId);

    if (status) {
      reminders = reminders.filter((r) => r.status === status);
    }

    if (searchText) {
      const searchLower = searchText.toLowerCase();
      reminders = reminders.filter((r) => r.message.toLowerCase().includes(searchLower));
    }

    if (callback) {
      callback({
        reminders: reminders || [],
        total: reminders?.length || 0,
        filters: { userId, status, searchText },
        timestamp: new Date().toISOString(),
      });
    }

    logger.debug(`Reminders filtered: ${reminders?.length || 0} results`);
  } catch (error) {
    logger.error('Error filtering reminders:', error);
    sendErrorWithEmptyArray(callback, error.message, 'reminders');
  }
}

module.exports = {
  registerReminderHandlers,
  handleRequestReminders,
  handleCreateReminder,
  handleEditReminder,
  handleDeleteReminder,
  handleFilterReminders,
};
