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
const DiscordAnalytics = require('../utils/discord-analytics');
const ResourceOptimizer = require('../utils/resource-optimizer');
const PerformanceDashboard = require('../utils/performance-dashboard');
const databaseService = require('../services/database');
const reminderService = require('../services/reminder-service');
const { getGuildMemberStats } = require('../utils/guild-member-stats');
const os = require('os');

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
const commands = {
  help: {
    data: {
      name: 'help',
      description: 'Show help for Aszai Bot',
    },
    async execute(interaction) {
      return interaction.reply(
        '**Aszai Bot Commands:**\n' +
          '`/help` - Show this help message\n' +
          '`/clearhistory` - Clear your conversation history (keeps your stats)\n' +
          '`/newconversation` - Start fresh on a new topic\n' +
          '`/summary` - Summarise your current conversation\n' +
          '`/summarise <text>` - Summarise provided text\n' +
          '`/stats` - Show your usage stats\n' +
          '`/analytics` - Show Discord server analytics\n' +
          '`/dashboard` - Show performance dashboard\n' +
          '`/resources` - Show resource optimization status\n' +
          '`/remind <time> <message>` - Set a reminder\n' +
          '`/reminders` - List your active reminders\n' +
          '`/cancelreminder <id>` - Cancel a specific reminder\n' +
          '`/userinfo [user]` - Show detailed user information\n' +
          '`/serverinfo` - Show detailed server information\n' +
          'Simply chat as normal to talk to the bot!'
      );
    },
    textCommand: '!help',
  },

  clearhistory: {
    data: {
      name: 'clearhistory',
      description: 'Clear your conversation history',
    },
    async execute(interaction) {
      const userId = interaction.user.id;
      databaseService.clearUserData(userId);
      conversationManager.clearHistory(userId);

      return interaction.reply('Conversation history cleared! Your stats have been preserved.');
    },
    textCommand: '!clearhistory',
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
        return interaction.editReply(errorResponse.message);
      }
    },
    textCommand: '!summary',
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
        return interaction.reply(`❌ Invalid user ID: ${userIdValidation.error}`);
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
          `❌ Error retrieving cache statistics: ${errorResponse.message}`
        );
      }
    },

    textCommand: '!cache',
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
    textCommand: '!stats',
  },

  analytics: {
    data: {
      name: 'analytics',
      description: 'Show Discord server analytics and insights',
    },
    async execute(interaction) {
      try {
        await interaction.deferReply();
        const serverId = interaction.guild?.id;
        const guild = interaction.guild;
        const { onlineCount, botCount, _totalMembers, humanMembers } =
          await getGuildMemberStats(guild);
        const analyticsData = {
          summary: {
            totalServers: 1,
            totalUsers: humanMembers,
            totalCommands: 0,
            successRate: 100,
            errorRate: 0,
            avgResponseTime: 0,
          },
          commandStats: [],
        };
        const serverInsights = {
          serverId,
          uniqueUsers: onlineCount,
          commandsExecuted: 0,
          errorRate: 0,
          totalActivities: 0,
          averageResponseTime: 0,
          mostActiveUser: null,
          popularCommands: [],
        };
        const embed = buildAnalyticsEmbed(analyticsData, serverInsights, onlineCount, botCount);
        return interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error fetching analytics:', error);
        const errorResponse = ErrorHandler.handleError(error, 'analytics_command');
        return interaction.editReply({ content: errorResponse.message });
      }
    },
    textCommand: '!analytics',
  },

  dashboard: {
    data: {
      name: 'dashboard',
      description: 'Show comprehensive performance dashboard',
    },
    async execute(interaction) {
      try {
        await interaction.deferReply();
        const guild = interaction.guild;
        const { _onlineCount, _botCount, _totalMembers, humanMembers } =
          await getGuildMemberStats(guild);
        const dashboardData = await PerformanceDashboard.generateDashboardReport();
        const realTimeStatus = PerformanceDashboard.getRealTimeStatus();
        const embed = buildDashboardEmbed(dashboardData, realTimeStatus, humanMembers);
        return interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error fetching dashboard:', error);
        const errorResponse = ErrorHandler.handleError(error, 'dashboard_command');
        return interaction.editReply({ content: errorResponse.message });
      }
    },
    textCommand: '!dashboard',
  },

  resources: {
    data: {
      name: 'resources',
      description: 'Show resource optimization status and recommendations',
    },
    async execute(interaction) {
      try {
        await interaction.deferReply();
        const resourceStatus = await ResourceOptimizer.monitorResources();
        const analyticsData = await DiscordAnalytics.generateDailyReport();
        const recommendations = await ResourceOptimizer.generateOptimizationRecommendations(
          analyticsData,
          { averageResponseTime: resourceStatus.performance.responseTime }
        );
        const actualServerCount = interaction.client?.guilds?.cache?.size || 1;
        const hostname = os.hostname();
        const embed = buildResourcesEmbed(
          resourceStatus,
          actualServerCount,
          hostname,
          recommendations
        );
        return interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error fetching resource data:', error);
        const errorResponse = ErrorHandler.handleError(error, 'resources_command');
        return interaction.editReply({ content: errorResponse.message });
      }
    },
    textCommand: '!resources',
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
        return interaction.editReply(errorResponse.message);
      }
    },
    // Support both spellings as text commands
    textCommand: '!summarise',
    // Add alias commands that will be recognized
    aliases: ['!summerise'],
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
        return interaction.editReply(errorResponse.message);
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
        return interaction.reply(errorResponse.message);
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
        const success = await reminderService.cancelReminder(userId, reminderId);

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
        return interaction.reply(errorResponse.message);
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
        return interaction.editReply({ content: errorResponse.message });
      }
    },
    textCommand: '!userinfo',
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
        return interaction.editReply({ content: errorResponse.message });
      }
    },
    textCommand: '!serverinfo',
  },
};

/**
 * Check if command text matches a command's trigger
 * @param {string} commandPrefix - The command prefix from message
 * @param {Object} command - Command object to check
 * @returns {boolean} Whether command matches
 */
function isCommandMatch(commandPrefix, command) {
  const isMainCommand = commandPrefix === command.textCommand;
  const hasAliases = command.aliases && Array.isArray(command.aliases);
  return isMainCommand || (hasAliases && command.aliases.includes(commandPrefix));
}

/**
 * Create mock interaction for text commands
 * @param {Object} message - Discord message object
 * @returns {Object} Mock interaction object
 */
function createMockInteraction(message) {
  return {
    user: message.author,
    channel: message.channel,
    content: message.content,
    reply: (content) => message.reply(content),
    deferReply: async () => message.channel.sendTyping(),
    editReply: (content) => message.reply(content),
  };
}

/**
 * Handle text commands from messages
 *
 * @deprecated This function is maintained for testing compatibility only.
 * Text commands (messages starting with !) are no longer processed by chat.js.
 * All user-facing commands should use slash commands (/help, /remind, etc.)
 *
 * @param {Object} message - Discord.js message object
 * @returns {Promise<Object|null>} - Command result or null if no command matched
 */
async function handleTextCommand(message) {
  const commandText = message.content.trim();
  const commandPrefix = commandText.split(/\s+/)[0].toLowerCase();

  for (const [name, command] of Object.entries(commands)) {
    if (!isCommandMatch(commandPrefix, command)) continue;

    try {
      return await command.execute(createMockInteraction(message));
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, `text command ${name}`, {
        userId: message.author.id,
        command: name,
        content: message.content,
      });
      logger.error(`Error executing text command ${name}: ${errorResponse.message}`);
      try {
        return await message.reply(errorResponse.message);
      } catch (replyError) {
        logger.error(`Failed to send error reply for text command ${name}: ${replyError.message}`);
      }
    }
  }

  return null;
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
  handleTextCommand,
  handleSlashCommand,
  getSlashCommandsData,
};
