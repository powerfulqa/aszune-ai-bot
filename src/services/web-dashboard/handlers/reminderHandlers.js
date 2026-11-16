/**
 * Reminder Socket Handlers for Web Dashboard
 * Handles reminder-related socket events
 * @module web-dashboard/handlers/reminderHandlers
 */

const logger = require('../../../utils/logger');
const databaseService = require('../../database');
const reminderService = require('../../reminder-service');
const {
  sendError,
  sendSuccess,
  sendCreateError,
  sendUpdateError,
  sendDeleteError,
  sendErrorWithEmptyArray,
} = require('./callbackHelpers');
const {
  processReminderRequest,
  processFilterReminders,
} = require('../../../utils/reminder-filters');

/**
 * Register reminder-related socket event handlers
 * @param {Socket} socket - Socket.IO socket instance
 * @param {WebDashboardService} _dashboard - Dashboard service instance (unused, for API consistency)
 */
function registerReminderHandlers(socket, _dashboard, options = {}) {
  const { allowWrite = true } = options;

  socket.on('request_reminders', (data, callback) => {
    handleRequestReminders(data, callback);
  });

  socket.on('filter_reminders', (data, callback) => {
    handleFilterReminders(data, callback);
  });

  // create/edit/delete mutate reminder records; only register when writes are allowed
  if (allowWrite) {
    socket.on('create_reminder', (data, callback) => {
      handleCreateReminder(data, callback);
    });

    socket.on('edit_reminder', (data, callback) => {
      handleEditReminder(data, callback);
    });

    socket.on('delete_reminder', (data, callback) => {
      handleDeleteReminder(data, callback);
    });
  }
}

/**
 * Handle request for reminders
 * @param {Object} data - Request data with userId and status filter
 * @param {Function} callback - Response callback
 */
function handleRequestReminders(data, callback) {
  try {
    const result = processReminderRequest(databaseService, data);
    sendSuccess(callback, result);
    logger.debug(`Reminders requested: ${result.total} found`);
  } catch (error) {
    logger.error('Error retrieving reminders:', error);
    sendError(callback, error.message, { reminders: [], stats: {} });
  }
}

const SNOWFLAKE = /^\d{17,20}$/;

/**
 * Handle create reminder request. Goes through the reminder service so the
 * reminder is scheduled as well as stored.
 * @param {Object} data - Reminder data
 * @param {Function} callback - Response callback
 */
async function handleCreateReminder(data, callback) {
  try {
    const { userId, message, scheduledTime, channelId } = data || {};

    if (!userId || !message || !scheduledTime || !channelId) {
      sendCreateError(
        callback,
        'Missing required fields: userId, channelId, message, scheduledTime'
      );
      return;
    }
    // A reminder is delivered as a ping in a channel, so both must be real Discord ids.
    if (!SNOWFLAKE.test(userId) || !SNOWFLAKE.test(channelId)) {
      sendCreateError(callback, 'userId and channelId must be Discord ids');
      return;
    }

    const reminder = await reminderService.createReminder(userId, {
      message,
      scheduledTime,
      channelId,
    });

    sendSuccess(callback, { created: true, reminder, timestamp: new Date().toISOString() });
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
async function handleEditReminder(data, callback) {
  try {
    const { reminderId, userId, message, scheduledTime } = data || {};

    if (!reminderId || !userId) {
      sendUpdateError(callback, 'Missing required fields: reminderId, userId');
      return;
    }

    const reminder = await reminderService.updateReminder(reminderId, userId, {
      message,
      scheduledTime,
    });

    if (!reminder) {
      sendUpdateError(callback, `Reminder not found: ${reminderId}`);
      return;
    }

    logger.info(`Reminder ${reminderId} updated`);
    sendSuccess(callback, { updated: true, reminder, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Error editing reminder:', error);
    sendUpdateError(callback, error.message);
  }
}

/**
 * Handle delete reminder request. Goes through the reminder service so the
 * pending timer is cleared too.
 * @param {Object} data - Delete request data
 * @param {Function} callback - Response callback
 */
async function handleDeleteReminder(data, callback) {
  try {
    const { reminderId, userId } = data || {};

    if (!reminderId || !userId) {
      sendDeleteError(callback, 'Missing required fields: reminderId, userId');
      return;
    }

    const deleted = await reminderService.deleteReminder(reminderId, userId);

    if (!deleted) {
      sendDeleteError(callback, `Reminder not found or already deleted: ${reminderId}`);
      return;
    }

    logger.info(`Reminder deleted: ${reminderId}`);
    sendSuccess(callback, { deleted: true, reminderId, timestamp: new Date().toISOString() });
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
    const result = processFilterReminders(databaseService, data);
    sendSuccess(callback, result);
    logger.debug(`Reminders filtered: ${result.total} results`);
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
