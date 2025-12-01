const { ErrorHandler } = require('../../../utils/error-handler');

function registerReminderRoutes(app, service) {
  app.get('/api/reminders', handleGetReminders(service));
  app.post('/api/reminders', handleCreateReminder(service));
  app.put('/api/reminders/:id', handleUpdateReminder(service));
  app.delete('/api/reminders/:id', handleDeleteReminder(service));
}

function handleGetReminders(service) {
  return async (req, res) => {
    try {
      const { status = 'all' } = req.query;
      const reminders = await service.getReminders(status);
      res.json({
        reminders,
        total: reminders.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'getting reminders');
      res.status(500).json({
        error: errorResponse.message,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

function handleCreateReminder(service) {
  return async (req, res) => {
    try {
      const { message, scheduledTime, userId, reminderType } = req.body;

      if (!message || !scheduledTime || !userId) {
        res.status(400).json({
          error: 'Message, scheduledTime, and userId are required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const reminder = await service.createReminder(message, scheduledTime, userId, reminderType);
      res.status(201).json({
        reminder,
        message: 'Reminder created successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'creating reminder');
      res.status(400).json({
        error: errorResponse.message,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

function handleUpdateReminder(service) {
  return async (req, res) => {
    try {
      const { id } = req.params;
      const { message, scheduledTime } = req.body;
      const reminder = await service.updateReminder(id, message, scheduledTime);
      res.json({
        reminder,
        message: 'Reminder updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'updating reminder');
      res.status(400).json({
        error: errorResponse.message,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

function handleDeleteReminder(service) {
  return async (req, res) => {
    try {
      const { id } = req.params;
      await service.deleteReminder(id);
      res.json({
        message: 'Reminder deleted successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'deleting reminder');
      res.status(400).json({
        error: errorResponse.message,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

module.exports = { registerReminderRoutes };
