const databaseService = require('./database');
const logger = require('../utils/logger');
const EventEmitter = require('events');

class ReminderService extends EventEmitter {
  constructor() {
    super();
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

      // Schedule the reminder with maximum timeout protection
      // Use periodic check for very long delays (> 24 hours) to prevent memory leaks
      const MAX_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

      if (delay > MAX_TIMEOUT) {
        // For long delays, schedule a periodic check instead
        const checkInterval = setInterval(async () => {
          const now = new Date();
          if (now >= scheduledTime) {
            clearInterval(checkInterval);
            this.activeTimers.delete(reminder.id);
            await this.executeReminder(reminder);
          }
        }, 60000); // Check every minute

        this.activeTimers.set(reminder.id, { type: 'interval', timer: checkInterval });
      } else {
        const timer = setTimeout(async () => {
          await this.executeReminder(reminder);
        }, delay);

        this.activeTimers.set(reminder.id, { type: 'timeout', timer });
      }
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
      if (existingTimer.type === 'interval') {
        clearInterval(existingTimer.timer);
      } else if (existingTimer.type === 'timeout') {
        clearTimeout(existingTimer.timer);
      } else {
        // Legacy support for direct timer objects
        clearTimeout(existingTimer);
      }
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
      const reminder = databaseService.createReminder(
        userId,
        message,
        scheduledTime,
        timezone,
        channelId,
        serverId
      );

      if (!reminder) {
        throw new Error('Failed to create reminder in database');
      }

      // Schedule the reminder
      await this.scheduleReminder(reminder);

      logger.info(`Created reminder ${reminder.id} for user ${userId}`);
      return reminder;
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

  async setReminder(userId, timeString, message, channelId = null, serverId = null) {
    try {
      // Parse the time string using chrono-node for robust natural language parsing
      const chrono = require('chrono-node');
      const now = new Date();
      const parsedDate = chrono.parseDate(timeString, now, { forwardDate: true });

      if (!parsedDate) {
        throw new Error('Unsupported time format. Try "in 5 minutes", "tomorrow at 5pm", etc.');
      }

      // Ensure the date is in the future
      if (parsedDate <= now) {
        throw new Error('Reminder time must be in the future.');
      }

      const reminder = await this.createReminder(
        userId,
        message,
        parsedDate.toISOString(),
        'UTC',
        channelId,
        serverId
      );
      return reminder;
    } catch (error) {
      logger.error(`Failed to set reminder for user ${userId}:`, error);
      throw error;
    }
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
      return false;
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
    // Clear all active timers with proper type checking
    for (const timer of this.activeTimers.values()) {
      if (timer.type === 'interval') {
        clearInterval(timer.timer);
      } else {
        clearTimeout(timer.timer);
      }
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
