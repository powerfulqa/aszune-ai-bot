const databaseService = require('./database');
const logger = require('../utils/logger');

class ReminderService {
  constructor() {
    this.activeTimers = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Load all active reminders from database and schedule them
      await this.loadAndScheduleReminders();
      this.isInitialized = true;
      logger.info('ReminderService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize ReminderService:', error);
      throw error;
    }
  }

  async loadAndScheduleReminders() {
    try {
      const activeReminders = databaseService.getActiveReminders();

      for (const reminder of activeReminders) {
        await this.scheduleReminder(reminder);
      }

      logger.info(`Loaded and scheduled ${activeReminders.length} active reminders`);
    } catch (error) {
      logger.error('Failed to load and schedule reminders:', error);
      throw error;
    }
  }

  async scheduleReminder(reminder) {
    try {
      const scheduledTime = new Date(reminder.scheduled_time);
      const now = new Date();
      const delay = scheduledTime.getTime() - now.getTime();

      // Don't schedule reminders that are already past
      if (delay <= 0) {
        logger.warn(`Reminder ${reminder.id} is already past due, marking as completed`);
        await databaseService.completeReminder(reminder.id);
        return;
      }

      // Clear any existing timer for this reminder
      this.clearReminderTimer(reminder.id);

      // Schedule the reminder
      const timer = setTimeout(async () => {
        await this.executeReminder(reminder);
      }, delay);

      this.activeTimers.set(reminder.id, timer);
      logger.debug(`Scheduled reminder ${reminder.id} for ${scheduledTime.toISOString()}`);
    } catch (error) {
      logger.error(`Failed to schedule reminder ${reminder.id}:`, error);
      throw error;
    }
  }

  async executeReminder(reminder) {
    try {
      // Remove from active timers
      this.clearReminderTimer(reminder.id);

      // Mark as completed in database
      const completed = databaseService.completeReminder(reminder.id);
      if (!completed) {
        logger.warn(`Failed to mark reminder ${reminder.id} as completed`);
        return;
      }

      // Emit reminder event for the bot to handle
      this.emit('reminderDue', reminder);

      logger.info(`Executed reminder ${reminder.id} for user ${reminder.user_id}`);
    } catch (error) {
      logger.error(`Failed to execute reminder ${reminder.id}:`, error);
    }
  }

  clearReminderTimer(reminderId) {
    const existingTimer = this.activeTimers.get(reminderId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.activeTimers.delete(reminderId);
    }
  }

  async createReminder(
    userId,
    message,
    scheduledTime,
    timezone = 'UTC',
    channelId = null,
    serverId = null
  ) {
    try {
      // Validate scheduled time
      const scheduledDate = new Date(scheduledTime);
      if (isNaN(scheduledDate.getTime())) {
        throw new Error('Invalid scheduled time format');
      }

      if (scheduledDate <= new Date()) {
        throw new Error('Scheduled time must be in the future');
      }

      // Create reminder in database
      const reminderId = databaseService.createReminder(
        userId,
        message,
        scheduledTime,
        timezone,
        channelId,
        serverId
      );

      if (!reminderId) {
        throw new Error('Failed to create reminder in database');
      }

      // Get the created reminder
      const reminder = {
        id: reminderId,
        user_id: userId,
        message,
        scheduled_time: scheduledTime,
        timezone,
        channel_id: channelId,
        server_id: serverId,
        status: 'active',
      };

      // Schedule the reminder
      await this.scheduleReminder(reminder);

      logger.info(`Created reminder ${reminderId} for user ${userId}`);
      return reminderId;
    } catch (error) {
      logger.error(`Failed to create reminder for user ${userId}:`, error);
      throw error;
    }
  }

  async cancelReminder(reminderId, userId) {
    try {
      // Cancel in database
      const cancelled = databaseService.cancelReminder(reminderId, userId);
      if (!cancelled) {
        return false; // Reminder not found or not owned by user
      }

      // Clear the timer
      this.clearReminderTimer(reminderId);

      logger.info(`Cancelled reminder ${reminderId} for user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to cancel reminder ${reminderId}:`, error);
      throw error;
    }
  }

  getUserReminders(userId, includeCompleted = false) {
    return databaseService.getUserReminders(userId, includeCompleted);
  }

  async deleteReminder(reminderId, userId) {
    try {
      // Clear timer first
      this.clearReminderTimer(reminderId);

      // Delete from database
      const deleted = databaseService.deleteReminder(reminderId, userId);
      if (!deleted) {
        return false;
      }

      logger.info(`Deleted reminder ${reminderId} for user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete reminder ${reminderId}:`, error);
      throw error;
    }
  }

  // Event emitter functionality
  on(event, listener) {
    if (!this.eventListeners) {
      this.eventListeners = new Map();
    }
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(listener);
  }

  emit(event, ...args) {
    if (this.eventListeners && this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach((listener) => {
        try {
          listener(...args);
        } catch (error) {
          logger.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Cleanup method
  shutdown() {
    // Clear all active timers
    for (const timer of this.activeTimers.values()) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
    this.isInitialized = false;
    logger.info('ReminderService shut down');
  }
}

const reminderService = new ReminderService();
module.exports = reminderService;
module.exports.ReminderService = ReminderService;
module.exports.default = reminderService;
