const { wrapAsyncHandler, sendValidationError, createApiResponse } = require('./routeHelper');

function registerReminderRoutes(app, service) {
  app.get('/api/reminders', handleGetReminders(service));
  app.post('/api/reminders', handleCreateReminder(service));
  app.put('/api/reminders/:id', handleUpdateReminder(service));
  app.delete('/api/reminders/:id', handleDeleteReminder(service));
}

function handleGetReminders(service) {
  return wrapAsyncHandler(async (req) => {
    const { status = 'all' } = req.query;
    const reminders = await service.getReminders(status);
    return { reminders, total: reminders.length };
  }, 'getting reminders');
}

function handleCreateReminder(service) {
  return wrapAsyncHandler(async (req, res) => {
    const { message, scheduledTime, userId, reminderType } = req.body;

    if (!message || !scheduledTime || !userId) {
      sendValidationError(res, 'Message, scheduledTime, and userId are required');
      return;
    }

    const reminder = await service.createReminder(message, scheduledTime, userId, reminderType);
    res.status(201).json(createApiResponse({ reminder, message: 'Reminder created successfully' }));
  }, 'creating reminder');
}

function handleUpdateReminder(service) {
  return wrapAsyncHandler(async (req) => {
    const { id } = req.params;
    const { message, scheduledTime } = req.body;
    const reminder = await service.updateReminder(id, message, scheduledTime);
    return { reminder, message: 'Reminder updated successfully' };
  }, 'updating reminder');
}

function handleDeleteReminder(service) {
  return wrapAsyncHandler(async (req) => {
    const { id } = req.params;
    await service.deleteReminder(id);
    return { message: 'Reminder deleted successfully' };
  }, 'deleting reminder');
}

module.exports = { registerReminderRoutes };
