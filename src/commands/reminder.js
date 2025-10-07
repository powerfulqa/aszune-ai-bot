const reminderService = require('../services/reminder-service');
const timeParser = require('../utils/time-parser');
const ErrorHandler = require('../utils/error-handler');
const logger = require('../utils/logger');

async function handleCommandAliases(message, args, originalCommand) {
  if (originalCommand === '!remind') {
    // !remind should directly set a reminder
    if (args.length < 2) {
      return await handleReminderHelp(message);
    }
    return await handleSetReminder(message, args);
  } else if (originalCommand === '!reminders') {
    // !reminders should list reminders
    return await handleListReminders(message);
  } else if (originalCommand === '!cancelreminder') {
    // !cancelreminder should cancel a reminder
    if (args.length === 0) {
      return message.reply({
        embeds: [
          {
            color: 0xffa500,
            title: 'Missing Reminder ID',
            description: 'Usage: `!cancelreminder <id>`\nUse `!reminders` to see your active reminders.',
            footer: { text: 'Aszai Bot' },
          },
        ],
      });
    }
    return await handleCancelReminder(message, args);
  }
  return null; // No alias match, continue to subcommands
}

async function handleReminderSubcommands(message, args) {
  const subcommand = args[0]?.toLowerCase();
  
  switch (subcommand) {
  case 'set':
  case 'create':
    return await handleSetReminder(message, args.slice(1));
  case 'list':
  case 'show':
    return await handleListReminders(message);
  case 'cancel':
  case 'delete':
    return await handleCancelReminder(message, args.slice(1));
  case 'help':
  default:
    return await handleReminderHelp(message);
  }
}

async function handleReminderCommand(message, args) {
  try {
    // Get the original command to determine behavior
    const originalCommand = message.content.trim().split(/\s+/)[0].toLowerCase();
    
    // Handle different command aliases
    const aliasResult = await handleCommandAliases(message, args, originalCommand);
    if (aliasResult) {
      return aliasResult;
    }

    // Handle !reminder subcommands
    return await handleReminderSubcommands(message, args);
  } catch (error) {
    logger.error('Error in reminder command:', error);
    const errorResponse = ErrorHandler.handleError(error, 'reminder_command', {
      userId: message.author.id,
    });
    return message.reply({
      embeds: [
        {
          color: 0xff0000,
          title: 'Reminder Error',
          description: errorResponse.message,
          footer: { text: 'Aszai Bot' },
        },
      ],
    });
  }
}

async function handleSetReminder(message, args) {
  if (args.length < 2) {
    return createInvalidFormatReply(message);
  }

  const timeExpression = args[0];
  const reminderMessage = args.slice(1).join(' ');

  try {
    const parsedTime = timeParser.parseTimeExpression(timeExpression);
    const reminderId = await createReminderInDatabase(message, reminderMessage, parsedTime);
    return createSuccessReply(message, reminderMessage, parsedTime, reminderId);
  } catch (error) {
    return createErrorReply(message, error);
  }
}

function createInvalidFormatReply(message) {
  return message.reply({
    embeds: [
      {
        color: 0xffa500,
        title: 'Invalid Reminder Format',
        description:
          'Usage: `!reminder set <time> <message>`\nExample: `!reminder set "in 5 minutes" Check the oven!`',
        footer: { text: 'Aszai Bot' },
      },
    ],
  });
}

async function createReminderInDatabase(message, reminderMessage, parsedTime) {
  return await reminderService.createReminder(
    message.author.id,
    reminderMessage,
    parsedTime.scheduledTime.toISOString(),
    parsedTime.timezone,
    message.channel.id,
    message.guild?.id
  );
}

function createSuccessReply(message, reminderMessage, parsedTime, reminderId) {
  const relativeTime = timeParser.getRelativeTime(parsedTime.scheduledTime);
  const formattedTime = timeParser.formatTime(parsedTime.scheduledTime, parsedTime.timezone);

  return message.reply({
    embeds: [
      {
        color: 0x00ff00,
        title: '✅ Reminder Set!',
        description: `**Message:** ${reminderMessage}\n**When:** ${relativeTime}\n**Exact Time:** ${formattedTime}`,
        footer: { text: `Reminder ID: ${reminderId} | Aszai Bot` },
      },
    ],
  });
}

function createErrorReply(message, error) {
  return message.reply({
    embeds: [
      {
        color: 0xff0000,
        title: 'Failed to Set Reminder',
        description: error.message,
        footer: { text: 'Aszai Bot' },
      },
    ],
  });
}

async function handleListReminders(message) {
  try {
    const reminders = reminderService.getUserReminders(message.author.id);

    if (reminders.length === 0) {
      return message.reply({
        embeds: [
          {
            color: 0x0099ff,
            title: 'Your Reminders',
            description: 'You have no active reminders.',
            footer: { text: 'Aszai Bot' },
          },
        ],
      });
    }

    const reminderList = reminders
      .map((reminder) => {
        const scheduledTime = new Date(reminder.scheduled_time);
        const relativeTime = timeParser.getRelativeTime(scheduledTime);
        const formattedTime = timeParser.formatTime(scheduledTime, reminder.timezone);

        return `**ID:** ${reminder.id}\n**Message:** ${reminder.message}\n**When:** ${relativeTime}\n**Time:** ${formattedTime}\n`;
      })
      .join('\n---\n');

    return message.reply({
      embeds: [
        {
          color: 0x0099ff,
          title: `Your Reminders (${reminders.length})`,
          description:
            reminderList.length > 4000 ? reminderList.substring(0, 4000) + '...' : reminderList,
          footer: { text: 'Aszai Bot' },
        },
      ],
    });
  } catch (error) {
    return message.reply({
      embeds: [
        {
          color: 0xff0000,
          title: 'Failed to List Reminders',
          description: 'An error occurred while retrieving your reminders.',
          footer: { text: 'Aszai Bot' },
        },
      ],
    });
  }
}

async function handleCancelReminder(message, args) {
  const validation = validateCancelArgs(args);
  if (!validation.valid) {
    return message.reply(validation.errorEmbed);
  }

  const reminderId = validation.reminderId;

  try {
    const cancelled = await reminderService.cancelReminder(reminderId, message.author.id);
    return handleCancelResult(message, reminderId, cancelled);
  } catch (error) {
    return handleCancelError(message, error);
  }
}

function validateCancelArgs(args) {
  if (args.length === 0) {
    return {
      valid: false,
      errorEmbed: {
        embeds: [
          {
            color: 0xffa500,
            title: 'Invalid Cancel Format',
            description:
              'Usage: `!reminder cancel <reminder_id>`\nUse `!reminder list` to see your reminder IDs.',
            footer: { text: 'Aszai Bot' },
          },
        ],
      },
    };
  }

  const reminderId = parseInt(args[0]);
  if (isNaN(reminderId)) {
    return {
      valid: false,
      errorEmbed: {
        embeds: [
          {
            color: 0xff0000,
            title: 'Invalid Reminder ID',
            description: 'Reminder ID must be a number.',
            footer: { text: 'Aszai Bot' },
          },
        ],
      },
    };
  }

  return { valid: true, reminderId };
}

function handleCancelResult(message, reminderId, cancelled) {
  if (cancelled) {
    return message.reply({
      embeds: [
        {
          color: 0x00ff00,
          title: '✅ Reminder Cancelled',
          description: `Reminder #${reminderId} has been cancelled.`,
          footer: { text: 'Aszai Bot' },
        },
      ],
    });
  } else {
    return message.reply({
      embeds: [
        {
          color: 0xffa500,
          title: 'Reminder Not Found',
          description: `Could not find active reminder #${reminderId} or it's not yours.`,
          footer: { text: 'Aszai Bot' },
        },
      ],
    });
  }
}

function handleCancelError(message, _error) {
  return message.reply({
    embeds: [
      {
        color: 0xff0000,
        title: 'Failed to Cancel Reminder',
        description: 'An error occurred while cancelling the reminder.',
        footer: { text: 'Aszai Bot' },
      },
    ],
  });
}

async function handleReminderHelp(message) {
  const helpText = `
**Reminder Commands Help**

**Set a Reminder:**
\`!reminder set "<time>" <message>\`
Examples:
• \`!reminder set "in 5 minutes" Check the oven!\`
• \`!reminder set "tomorrow at 3pm" Meeting with team\`
• \`!reminder set "next Monday 2:30 PM" Project deadline\`

**List Your Reminders:**
\`!reminder list\`

**Cancel a Reminder:**
\`!reminder cancel <reminder_id>\`
(Use \`!reminder list\` to find the ID)

**Supported Time Formats:**
• Relative: "in 5 minutes", "in 2 hours", "in 1 day"
• Specific: "tomorrow at 3pm", "Monday at 9am"
• Date/Time: "2024-01-15 14:30", "next Friday 2pm"
• Natural: "at noon", "this evening", "tonight at 8"

**Supported Timezones:**
UTC, EST, EDT, CST, CDT, MST, MDT, PST, PDT, GMT, BST, CET, CEST, JST, KST, IST, AEDT, AEST
`;

  return message.reply({
    embeds: [
      {
        color: 0x0099ff,
        title: '⏰ Reminder System Help',
        description: helpText,
        footer: { text: 'Aszai Bot' },
      },
    ],
  });
}

// Handle reminder execution (called when a reminder is due)
async function handleReminderDue(reminder) {
  try {
    // This function will be called by the reminder service when a reminder is due
    // We need to send the reminder message to the appropriate channel/user

    // For now, we'll try to send to the original channel
    // In a more advanced implementation, we could DM the user or use a dedicated reminder channel

    logger.info(`Reminder due: ${reminder.id} for user ${reminder.user_id}: ${reminder.message}`);

    // The actual Discord message sending will be handled by integrating this with the main bot client
    // This function signature allows the main bot to register a callback
  } catch (error) {
    logger.error(`Failed to handle reminder due for ${reminder.id}:`, error);
  }
}

module.exports = {
  handleReminderCommand,
  handleReminderDue,
};
