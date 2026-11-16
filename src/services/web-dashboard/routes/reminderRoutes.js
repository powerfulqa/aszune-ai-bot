const { wrapAsyncHandler } = require('./routeHelper');

// Read-only: reminders are created, edited and deleted over the dashboard
// socket (handlers/reminderHandlers.js), which goes through the reminder
// service so timers stay in step with the database.
function registerReminderRoutes(app, service) {
  app.get('/api/reminders', handleGetReminders(service));
}

function handleGetReminders(service) {
  return wrapAsyncHandler(async (req) => {
    const { status = 'all' } = req.query;
    const reminders = await service.getReminders(status);
    return { reminders, total: reminders.length };
  }, 'getting reminders');
}

module.exports = { registerReminderRoutes };
