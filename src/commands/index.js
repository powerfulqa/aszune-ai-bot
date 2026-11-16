/**
 * Command handler for the bot
 */
// Use singleton ConversationManager for consistent state across the app
const conversationManager = require('../state/conversationManager');
const perplexityService = require('../services/perplexity-secure');
const logger = require('../utils/logger');
const config = require('../config/config');
const { ErrorHandler } = require('../utils/error-handler');
const { InputValidator } = require('../utils/input-validator');
const { ApplicationCommandOptionType } = require('discord.js');
const ResourceOptimizer = require('../utils/resource-optimizer');
const databaseService = require('../services/database');
const reminderService = require('../services/reminder-service');
const { getGuildMemberStats } = require('../utils/guild-member-stats');
const { formatUptime } = require('../utils/system-info');
const { diagCommand } = require('./diag');

// Embed builders (extracted for maintainability)
const {
  buildAnalyticsEmbed,
  buildDashboardEmbed,
  buildResourcesEmbed,
  buildCacheEmbed,
  buildUserInfoEmbed,
  buildServerInfoEmbed,
  getJoinPosition,
} = require('./embeds');

/**
 * Helper function to ensure user metadata is updated in the database
 * @param {Object} interaction - Discord interaction object
 */
function ensureUserMetadata(interaction) {
  try {
    const userId = interaction.user.id;
    const username = interaction.user.username;

    // Ensure user exists and username is stored
    if (databaseService.ensureUserExists) {
      databaseService.ensureUserExists(userId, username);
    }
    if (databaseService.updateUsername) {
      databaseService.updateUsername(userId, username);
    }
  } catch (error) {
    logger.debug(`Failed to update user metadata: ${error.message}`);
  }
}

/**
 * Validate user ID and conversation history, prepare clean history for summarization
 * @param {string} userId - User ID to validate
 * @returns {{valid: boolean, error?: string, cleanHistory?: Array}} Validation result
 */
function validateAndPrepareHistory(userId) {
  const userIdValidation = InputValidator.validateUserId(userId);
  if (!userIdValidation.valid) {
    return { valid: false, error: `❌ Invalid user ID: ${userIdValidation.error}` };
  }

  const history = conversationManager.getHistory(userId);

  const historyValidation = InputValidator.validateConversationHistory(history);
  if (!historyValidation.valid) {
    return { valid: false, error: `❌ Invalid conversation history: ${historyValidation.error}` };
  }

  if (!history || history.length === 0) {
    return { valid: false, error: 'No conversation history to summarize.' };
  }

  // Keep removing assistant messages from end until non-assistant found
  const trimmedHistory = [...history];
  while (
    trimmedHistory.length > 0 &&
    trimmedHistory[trimmedHistory.length - 1].role === 'assistant'
  ) {
    trimmedHistory.pop();
  }

  if (trimmedHistory.length === 0) {
    return { valid: false, error: 'No conversation history to summarize.' };
  }

  return { valid: true, cleanHistory: trimmedHistory };
}

// Command definitions
/**
 * Reply payload for a failed command. User-facing errors are embeds, never
 * plain text.
 * @param {string} description - Error text for the user
 * @returns {{embeds: Array<Object>}} Discord reply payload
 */
function errorEmbed(description) {
  return { embeds: [{ color: config.COLORS.ERROR, description }] };
}

const commands = {
  help: {
    data: {
      name: 'help',
      description: 'Show help for Aszai Bot',
    },
    async execute(interaction) {
      return interaction.reply(
        `**Aszai Bot Commands:**
\`/help\` - Show this help message
\`/clearhistory\` - Clear your conversation history (keeps your stats)
\`/summary\` - Summarise your current conversation
\`/summarise <text>\` - Summarise provided text
\`/stats\` - Show your usage stats
\`/analytics\` - Show Discord server analytics
\`/dashboard\` - Show performance dashboard
\`/resources\` - Show resource optimization status
\`/cache\` - Show cache statistics
\`/remind <time> <message>\` - Set a reminder
\`/reminders\` - List your active reminders
\`/cancelreminder <id>\` - Cancel a specific reminder
\`/userinfo [user]\` - Show detailed user information
\`/serverinfo\` - Show detailed server information
\`/diag [live]\` - Bot diagnostics (owner only, private)
Simply chat as normal to talk to the bot!`
      );
    },
  },

  clearhistory: {
    data: {
      name: 'clearhistory',
      description: 'Clear your conversation history',
    },
    async execute(interaction) {
      const userId = interaction.user.id;
      databaseService.clearUserConversationData(userId);
      conversationManager.clearHistory(userId);

      return interaction.reply('Conversation history cleared! Your stats have been preserved.');
    },
  },

  summary: {
    data: {
      name: 'summary',
      description: 'Summarise your current conversation',
    },
    async execute(interaction) {
      const userId = interaction.user.id;

      // Validate and get clean history
      const historyResult = validateAndPrepareHistory(userId);
      if (!historyResult.valid) {
        return interaction.reply(historyResult.error);
      }

      await interaction.deferReply();

      try {
        const summary = await perplexityService.generateSummary(historyResult.cleanHistory);
        conversationManager.updateUserStats(userId, 'summaries');
        return interaction.editReply({
          embeds: [
            {
              color: config.COLORS.PRIMARY,
              title: 'Conversation Summary',
              description: summary,
              footer: { text: 'Aszai Bot' },
            },
          ],
        });
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'summary generation', {
          userId: userId,
          historyLength: historyResult.cleanHistory?.length || 0,
        });
        return interaction.editReply(errorEmbed(errorResponse.message));
      }
    },
  },
  cache: {
    data: {
      name: 'cache',
      description: 'View cache statistics and information',
    },
    async execute(interaction) {
      const userId = interaction.user.id;

      // Validate user ID
      const userIdValidation = InputValidator.validateUserId(userId);
      if (!userIdValidation.valid) {
        return interaction.reply(errorEmbed(`Invalid user ID: ${userIdValidation.error}`));
      }

      await interaction.deferReply();

      try {
        const cacheStats = perplexityService.getCacheStats();
        const detailedInfo = perplexityService.getDetailedCacheInfo();

        const embed = buildCacheEmbed(cacheStats, detailedInfo);
        return interaction.editReply({ embeds: [embed] });
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'cache statistics retrieval', {
          userId: userId,
        });
        return interaction.editReply(
          errorEmbed(`Error retrieving cache statistics: ${errorResponse.message}`)
        );
      }
    },
  },
  stats: {
    data: {
      name: 'stats',
      description: 'Show your usage stats',
    },
    async execute(interaction) {
      ensureUserMetadata(interaction);
      const userId = interaction.user.id;
      const stats = conversationManager.getUserStats(userId);
      return interaction.reply(
        '**Your Aszai Bot Stats:**\n' +
          `Messages sent: ${stats.messages}\n` +
          `Summaries requested: ${stats.summaries}\n` +
          `Active reminders: ${stats.reminders || 0}`
      );
    },
  },

  analytics: {
    data: {
      name: 'analytics',
      description: 'Show how many members and bots are in this server and online',
    },
    async execute(interaction) {
      try {
        await interaction.deferReply();
        const { onlineCount, botCount, humanMembers } = await getGuildMemberStats(
          interaction.guild
        );
        const embed = buildAnalyticsEmbed(onlineCount, humanMembers, botCount);
        return interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error fetching analytics:', error);
        const errorResponse = ErrorHandler.handleError(error, 'analytics_command');
        return interaction.editReply(errorEmbed(errorResponse.message));
      }
    },
  },

  dashboard: {
    data: {
      name: 'dashboard',
      description: 'Show comprehensive performance dashboard',
    },
    async execute(interaction) {
      try {
        await interaction.deferReply();
        const { humanMembers } = await getGuildMemberStats(interaction.guild);
        const resourceStatus = ResourceOptimizer.monitorResources();
        const serverCount = interaction.client?.guilds?.cache?.size || 1;
        const uptime = formatUptime(process.uptime()).formatted;
        const embed = buildDashboardEmbed(resourceStatus, uptime, humanMembers, serverCount);
        return interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error fetching dashboard:', error);
        const errorResponse = ErrorHandler.handleError(error, 'dashboard_command');
        return interaction.editReply(errorEmbed(errorResponse.message));
      }
    },
  },

  resources: {
    data: {
      name: 'resources',
      description: 'Show resource optimization status and recommendations',
    },
    async execute(interaction) {
      try {
        await interaction.deferReply();
        const resourceStatus = ResourceOptimizer.monitorResources();
        const actualServerCount = interaction.client?.guilds?.cache?.size || 1;
        const embed = buildResourcesEmbed(resourceStatus, actualServerCount);
        return interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error fetching resource data:', error);
        const errorResponse = ErrorHandler.handleError(error, 'resources_command');
        return interaction.editReply(errorEmbed(errorResponse.message));
      }
    },
  },

  summarise: {
    data: {
      name: 'summarise',
      description: 'Summarise provided text',
      options: [
        {
          name: 'text',
          description: 'The text to summarise',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    async execute(interaction) {
      const userId = interaction.user.id;

      // Validate user ID
      const userIdValidation = InputValidator.validateUserId(userId);
      if (!userIdValidation.valid) {
        return interaction.reply(`❌ Invalid user ID: ${userIdValidation.error}`);
      }

      // Extract and validate text input
      const textExtractionResult = this._extractTextFromInteraction(interaction);
      if (!textExtractionResult.success) {
        return interaction.reply(textExtractionResult.errorMessage);
      }

      const textValidation = InputValidator.validateAndSanitize(textExtractionResult.text, {
        type: 'message',
        maxLength: 3000, // Reasonable limit for summarization
        strict: false,
      });

      if (!textValidation.valid) {
        return interaction.reply(`❌ Invalid text input: ${textValidation.error}`);
      }

      // Reject input that becomes empty after sanitization (indicates dangerous content was removed)
      if (!textValidation.sanitized || textValidation.sanitized.trim().length === 0) {
        return interaction.reply(
          '❌ Invalid text input: Content contains unsafe elements that were removed.'
        );
      }

      // Generate summary
      return this._generateSummary(
        interaction,
        userId,
        textValidation.sanitized,
        textValidation.warnings
      );
    },

    _extractTextFromSlashCommand(interaction) {
      const text = interaction.options.getString('text');

      if (!text || text.trim().length === 0) {
        return {
          success: false,
          errorMessage: 'Please provide text to summarize.',
        };
      }

      return { success: true, text };
    },

    _extractTextFromTextCommand(interaction) {
      const commandText = interaction.content || '';
      // Match both spellings: summarise and summerise
      const match = commandText.match(/^!sum[me]?[ae]rise\s+(.+)/i);
      const text = match ? match[1] : '';

      if (!text || text.trim().length === 0) {
        return {
          success: false,
          errorMessage: 'Please provide text to summarize.',
        };
      }

      return { success: true, text };
    },

    _extractTextFromInteraction(interaction) {
      // Handle both text commands and slash commands
      if (interaction.options) {
        // This is a slash command
        return this._extractTextFromSlashCommand(interaction);
      } else {
        // This is a text command
        return this._extractTextFromTextCommand(interaction);
      }
    },

    async _generateSummary(interaction, userId, sanitizedText, warnings) {
      await interaction.deferReply();

      try {
        // Create a message array with the sanitized text to summarize
        const messages = [
          {
            role: 'user',
            content: sanitizedText,
          },
        ];

        const summary = await perplexityService.generateSummary(messages, true); // isText = true
        conversationManager.updateUserStats(userId, 'summaries');
        return interaction.editReply({
          embeds: [
            {
              color: config.COLORS.PRIMARY,
              title: 'Text Summary',
              description: summary,
              footer: { text: 'Aszai Bot' },
            },
          ],
        });
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'text summary generation', {
          userId: userId,
          textLength: sanitizedText?.length || 0,
          warnings: warnings,
        });
        return interaction.editReply(errorEmbed(errorResponse.message));
      }
    },
    // Support both spellings as text commands
    // Add alias commands that will be recognized
  },

  remind: {
    data: {
      name: 'remind',
      description: 'Set a reminder',
      options: [
        {
          name: 'time',
          description: 'When to remind you (e.g., "in 5 minutes", "tomorrow at 3pm")',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: 'message',
          description: 'The reminder message',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    async execute(interaction) {
      const userId = interaction.user.id;
      const time = interaction.options.getString('time');
      const message = interaction.options.getString('message');

      // Defer reply immediately to prevent timeout
      await interaction.deferReply();

      // Validate inputs
      const timeValidation = InputValidator.validateTimeString(time);
      if (!timeValidation.valid) {
        return interaction.editReply(`❌ Invalid time format: ${timeValidation.error}`);
      }

      const messageValidation = InputValidator.validateReminderMessage(message);
      if (!messageValidation.valid) {
        return interaction.editReply(`❌ Invalid reminder message: ${messageValidation.error}`);
      }

      try {
        const reminder = await reminderService.setReminder(
          userId,
          time,
          message,
          interaction.channelId,
          interaction.guildId
        );
        const timestamp = Math.floor(new Date(reminder.scheduled_time).getTime() / 1000);

        return interaction.editReply({
          embeds: [
            {
              color: 0x00ff00,
              title: '⏰ Reminder Set',
              description: `I'll remind you: **${message}**\n⏰ <t:${timestamp}:F>`,
              footer: { text: 'Aszai Bot' },
            },
          ],
        });
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'reminder creation', {
          userId,
          time,
          messageLength: message.length,
        });
        return interaction.editReply(errorEmbed(errorResponse.message));
      }
    },
  },

  reminders: {
    data: {
      name: 'reminders',
      description: 'List your active reminders',
    },
    async execute(interaction) {
      const userId = interaction.user.id;

      try {
        const reminders = await reminderService.getUserReminders(userId);

        if (!reminders || reminders.length === 0) {
          return interaction.reply({
            embeds: [
              {
                color: 0xffa500,
                title: '📝 Your Reminders',
                description: 'You have no active reminders.',
                footer: { text: 'Aszai Bot' },
              },
            ],
          });
        }

        const reminderList = reminders
          .map((r) => {
            const timestamp = Math.floor(new Date(r.scheduled_time).getTime() / 1000);
            return `**${r.id}**: ${r.message}\n⏰ <t:${timestamp}:R> (<t:${timestamp}:f>)`;
          })
          .join('\n\n');

        return interaction.reply({
          embeds: [
            {
              color: 0x0099ff,
              title: '📝 Your Active Reminders',
              description: reminderList,
              footer: { text: 'Aszai Bot' },
            },
          ],
        });
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'reminder listing', { userId });
        return interaction.reply(errorEmbed(errorResponse.message));
      }
    },
  },

  cancelreminder: {
    data: {
      name: 'cancelreminder',
      description: 'Cancel a specific reminder',
      options: [
        {
          name: 'id',
          description: 'The reminder ID to cancel',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    async execute(interaction) {
      const userId = interaction.user.id;
      const reminderId = interaction.options.getString('id');

      try {
        const success = await reminderService.cancelReminder(reminderId, userId);

        if (success) {
          return interaction.reply({
            embeds: [
              {
                color: 0x00ff00,
                title: '✅ Reminder Cancelled',
                description: `Reminder ${reminderId} has been cancelled.`,
                footer: { text: 'Aszai Bot' },
              },
            ],
          });
        } else {
          return interaction.reply({
            embeds: [
              {
                color: 0xff0000,
                title: '❌ Reminder Not Found',
                description: `Could not find reminder ${reminderId}. Use \`/reminders\` to see your active reminders.`,
                footer: { text: 'Aszai Bot' },
              },
            ],
          });
        }
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'reminder cancellation', {
          userId,
          reminderId,
        });
        return interaction.reply(errorEmbed(errorResponse.message));
      }
    },
  },

  userinfo: {
    data: {
      name: 'userinfo',
      description: 'Display detailed information about a user',
      options: [
        {
          name: 'user',
          description: 'The user to get info about (defaults to yourself)',
          type: ApplicationCommandOptionType.User,
          required: false,
        },
      ],
    },
    async execute(interaction) {
      try {
        await interaction.deferReply();

        const user = interaction.options.getUser('user') || interaction.user;
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        // Get join position
        const joinPosition = member ? await getJoinPosition(interaction.guild, member) : null;

        // Get presence
        const presence = member?.presence || null;

        const embed = buildUserInfoEmbed(user, member, { joinPosition, presence });
        return interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error fetching user info:', error);
        const errorResponse = ErrorHandler.handleError(error, 'userinfo_command');
        return interaction.editReply(errorEmbed(errorResponse.message));
      }
    },
  },

  serverinfo: {
    data: {
      name: 'serverinfo',
      description: 'Display detailed information about this server',
    },
    async execute(interaction) {
      try {
        await interaction.deferReply();

        const guild = interaction.guild;
        if (!guild) {
          return interaction.editReply('This command can only be used in a server.');
        }

        // Get member stats
        const { onlineCount, botCount, humanMembers } = await getGuildMemberStats(guild);
        const memberStats = { onlineCount, botCount, humanMembers };

        const embed = buildServerInfoEmbed(guild, { memberStats });
        return interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error fetching server info:', error);
        const errorResponse = ErrorHandler.handleError(error, 'serverinfo_command');
        return interaction.editReply(errorEmbed(errorResponse.message));
      }
    },
  },

  // Owner-only diagnostics (slash only, ephemeral) - see ./diag.js
  diag: diagCommand,
};

// Slash commands that call the paid Perplexity API
const PAID_COMMANDS = new Set(['summary', 'summarise']);

/**
 * Apply the chat path's per-user rate limit to paid commands
 * @param {Object} interaction - Discord.js interaction object
 * @returns {boolean} - true if the user must wait
 */
function isPaidCommandRateLimited(interaction) {
  if (!PAID_COMMANDS.has(interaction.commandName)) return false;
  const userId = interaction.user.id;
  if (conversationManager.isRateLimited(userId)) return true;
  conversationManager.updateTimestamp(userId);
  return false;
}

/**
 * Handle slash command interactions
 * @param {Object} interaction - Discord.js interaction object
 */
async function handleSlashCommand(interaction) {
  const command = commands[interaction.commandName];

  if (!command) {
    return interaction.reply({
      content: 'Unknown command',
      ephemeral: true,
    });
  }

  // Don't execute if already replied
  if (interaction.replied) {
    return;
  }

  if (isPaidCommandRateLimited(interaction)) {
    return interaction.reply({
      content: 'Please wait a few seconds before sending another request.',
      ephemeral: true,
    });
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    const errorResponse = ErrorHandler.handleError(
      error,
      `slash command ${interaction.commandName}`,
      {
        userId: interaction.user.id,
        command: interaction.commandName,
        guildId: interaction.guild?.id,
      }
    );

    logger.error(
      `Error executing slash command ${interaction.commandName}: ${errorResponse.message}`
    );

    const reply = {
      content: errorResponse.message,
      ephemeral: true,
    };

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(reply);
      } else {
        await interaction.reply(reply);
      }
    } catch (replyError) {
      logger.error(
        `Failed to send error reply for slash command ${interaction.commandName}: ${replyError.message}`
      );
    }
  }
}

/**
 * Get all slash command data for registration
 * @returns {Array} - Array of command data
 */
function getSlashCommandsData() {
  return Object.values(commands)
    .filter((command) => command && command.data && typeof command.data.name === 'string')
    .map((command) => command.data);
}

module.exports = {
  handleSlashCommand,
  getSlashCommandsData,
};
