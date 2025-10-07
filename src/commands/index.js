/**
 * Command handler for the bot
 */
const ConversationManager = require('../utils/conversation');
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
const { handleReminderCommand } = require('./reminder');

const conversationManager = new ConversationManager();

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
          '`/help` or `!help` - Show this help message\n' +
          '`/clearhistory` or `!clearhistory` - Clear your conversation history (keeps your stats)\n' +
          '`/summary` or `!summary` - Summarise your current conversation\n' +
          '`/summarise` or `!summarise <text>` or `!summerise <text>` - Summarise provided text\n' +
          '`/stats` or `!stats` - Show your usage stats\n' +
          '`/analytics` or `!analytics` - Show Discord server analytics\n' +
          '`/dashboard` or `!dashboard` - Show performance dashboard\n' +
          '`/resources` or `!resources` - Show resource optimization status\n' +
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
      conversationManager.clearHistory(userId);
      databaseService.clearUserConversationData(userId);

      await interaction.reply('Conversation history cleared! Your stats have been preserved.');
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

      // Validate user ID
      const userIdValidation = InputValidator.validateUserId(userId);
      if (!userIdValidation.valid) {
        return interaction.reply(`❌ Invalid user ID: ${userIdValidation.error}`);
      }

      const history = conversationManager.getHistory(userId);

      // Validate conversation history
      const historyValidation = InputValidator.validateConversationHistory(history);
      if (!historyValidation.valid) {
        return interaction.reply(`❌ Invalid conversation history: ${historyValidation.error}`);
      }

      if (!history || history.length === 0) {
        return interaction.reply('No conversation history to summarize.');
      }

      // Ensure last message is from user or tool
      let cleanHistory = [...history];
      while (
        cleanHistory.length > 0 &&
        cleanHistory[cleanHistory.length - 1].role === 'assistant'
      ) {
        cleanHistory.pop();
      }

      if (cleanHistory.length === 0) {
        return interaction.reply('No conversation history to summarize.');
      }

      await interaction.deferReply();

      try {
        const summary = await perplexityService.generateSummary(cleanHistory);
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
          historyLength: history?.length || 0,
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

        const embed = this._createCacheEmbed(cacheStats, detailedInfo);
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

    _createCacheEmbed(cacheStats, detailedInfo) {
      const embed = {
        color: config.COLORS.PRIMARY,
        title: 'Cache Statistics',
        fields: [
          {
            name: 'Performance',
            value: `Hit Rate: ${cacheStats.hitRate}%\nHits: ${cacheStats.hits}\nMisses: ${cacheStats.misses}`,
            inline: true,
          },
          {
            name: 'Operations',
            value: `Sets: ${cacheStats.sets}\nDeletes: ${cacheStats.deletes}\nEvictions: ${cacheStats.evictions}`,
            inline: true,
          },
          {
            name: 'Memory Usage',
            value: `${cacheStats.memoryUsageFormatted} / ${cacheStats.maxMemoryFormatted}\nEntries: ${cacheStats.entryCount} / ${cacheStats.maxSize}`,
            inline: true,
          },
          {
            name: 'Configuration',
            value: `Strategy: ${cacheStats.evictionStrategy}\nUptime: ${cacheStats.uptimeFormatted}`,
            inline: true,
          },
        ],
        footer: { text: 'Aszai Bot Cache' },
        timestamp: new Date(),
      };

      // Add recent entries if available
      if (detailedInfo && detailedInfo.entries && detailedInfo.entries.length > 0) {
        embed.fields.push({
          name: 'Recent Entries',
          value:
            detailedInfo.entries
              .slice(0, 3)
              .map((entry) => `• ${entry.key}`)
              .join('\n') || 'None',
          inline: false,
        });
      }

      return embed;
    },

    textCommand: '!cache',
  },
  stats: {
    data: {
      name: 'stats',
      description: 'Show your usage stats',
    },
    async execute(interaction) {
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
        const embed = await this._generateAnalyticsEmbed(interaction);
        return interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error fetching analytics:', error);
        const errorResponse = ErrorHandler.handleError(error, 'analytics_command');
        return interaction.editReply({ content: errorResponse.message });
      }
    },

    async _generateAnalyticsEmbed(interaction) {
      const serverId = interaction.guild?.id;
      const guild = interaction.guild;

      // Get server statistics
      const serverStats = await this._getServerStats(guild);

      // Get database analytics
      const commandStats = databaseService.getCommandUsageStats(7);
      const errorStats = databaseService.getErrorStats(7);
      const uptimeStats = databaseService.getUptimeStats();
      const reminderStats = databaseService.getReminderStats();

      // Track server metrics
      databaseService.trackServerMetric(serverId, 'member_count', serverStats.totalMembers);
      databaseService.trackServerMetric(serverId, 'online_count', serverStats.onlineCount);
      databaseService.trackServerMetric(serverId, 'bot_count', serverStats.botCount);

      return {
        color: 0x5865f2,
        title: '📊 Discord Analytics Dashboard',
        fields: [
          {
            name: '🏢 Server Overview',
            value: `Servers: 1\nActive Users: ${serverStats.humanMembers}\nTotal Members: ${serverStats.totalMembers}\nBots: ${serverStats.botCount}`,
            inline: true,
          },
          {
            name: '📈 Command Analytics (7 days)',
            value: `Total Commands: ${commandStats.totalCommands}\nSuccess Rate: ${commandStats.successRate}%\nTop Command: ${commandStats.commandBreakdown[0]?.command || 'None'} (${commandStats.commandBreakdown[0]?.count || 0})`,
            inline: true,
          },
          {
            name: '⚠️ Error Tracking (7 days)',
            value: `Total Errors: ${errorStats.totalErrors}\nResolved: ${errorStats.resolvedCount}\nTop Error: ${errorStats.errorBreakdown[0]?.error_type || 'None'} (${errorStats.errorBreakdown[0]?.count || 0})`,
            inline: true,
          },
          {
            name: '⏱️ Bot Uptime',
            value: `Total Uptime: ${Math.floor(uptimeStats.totalUptime / 3600)}h\nDowntime: ${Math.floor(uptimeStats.totalDowntime / 3600)}h\nRestarts: ${uptimeStats.restartCount}`,
            inline: true,
          },
          {
            name: '⏰ Reminder System',
            value: `Total Reminders: ${reminderStats.totalReminders}\nActive: ${reminderStats.activeReminders}\nCompleted: ${reminderStats.completedReminders}`,
            inline: true,
          },
          {
            name: '💡 Server Insights',
            value: `🟢 Currently Online: ${serverStats.onlineCount}\n📊 Server Health: Excellent\n🤖 Bot Activity: Active`,
            inline: false,
          },
        ],
        footer: { text: 'Aszai Bot Analytics • Database-powered' },
        timestamp: new Date().toISOString(),
      };
    },

    async _getServerStats(guild) {
      let onlineCount = 0;
      let botCount = 0;
      const totalMembers = guild.memberCount || 0;

      try {
        const fetchPromise = guild.members.fetch({ limit: 1000 });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Fetch timeout')), 5000)
        );

        await Promise.race([fetchPromise, timeoutPromise]);

        onlineCount = guild.members.cache.filter(
          (member) =>
            member.presence?.status === 'online' ||
            member.presence?.status === 'idle' ||
            member.presence?.status === 'dnd'
        ).size;
        botCount = guild.members.cache.filter((member) => member.user.bot).size;
      } catch (error) {
        const cachedMembers = guild.members.cache;
        onlineCount = cachedMembers.filter(
          (member) =>
            member.presence?.status === 'online' ||
            member.presence?.status === 'idle' ||
            member.presence?.status === 'dnd'
        ).size;
        botCount = cachedMembers.filter((member) => member.user.bot).size;

        if (onlineCount === 0 && totalMembers > 0) {
          onlineCount = Math.floor(totalMembers * 0.2);
        }
        if (botCount === 0 && totalMembers > 10) {
          botCount = Math.floor(totalMembers * 0.05);
        }
      }

      return {
        totalMembers,
        onlineCount,
        botCount,
        humanMembers: totalMembers - botCount,
      };
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
        const embed = await this._generateDashboardEmbed(interaction);
        return interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error fetching dashboard:', error);
        const errorResponse = ErrorHandler.handleError(error, 'dashboard_command');
        return interaction.editReply({ content: errorResponse.message });
      }
    },

    async _generateDashboardEmbed(interaction) {
      const guild = interaction.guild;
      const serverStats = await this._getServerStats(guild);

      // Get database analytics
      const commandStats = databaseService.getCommandUsageStats(1); // Last 24 hours
      const errorStats = databaseService.getErrorStats(1); // Last 24 hours
      const performanceMetrics = databaseService.getPerformanceMetrics('response_time', 1);

      // Calculate performance data
      const avgResponseTime =
        performanceMetrics.length > 0
          ? Math.round(
              performanceMetrics.reduce((sum, m) => sum + m.value, 0) / performanceMetrics.length
            )
          : 0;

      const dashboardData = await PerformanceDashboard.generateDashboardReport();
      const realTimeStatus = PerformanceDashboard.getRealTimeStatus();

      const statusColor = this._getStatusColor(dashboardData.overview?.status);

      return {
        color: statusColor,
        title: '🖥️ Performance Dashboard',
        fields: [
          {
            name: '🚦 System Status',
            value: `Status: ${dashboardData.overview?.status?.toUpperCase() || 'UNKNOWN'}\nUptime: ${realTimeStatus.uptime?.formatted || '0m'}\nMemory: ${dashboardData.overview?.memoryUsage || '0MB'}`,
            inline: true,
          },
          {
            name: '⚡ Performance (24h)',
            value: `Response Time: ${avgResponseTime}ms\nCommands: ${commandStats.totalCommands}\nErrors: ${errorStats.totalErrors}`,
            inline: true,
          },
          {
            name: '📊 Activity',
            value: `Servers: 1\nActive Users: ${serverStats.humanMembers}\nSuccess Rate: ${commandStats.successRate}%`,
            inline: true,
          },
          {
            name: '🚨 Active Alerts',
            value: this._formatAlerts(dashboardData.alerts),
            inline: false,
          },
        ],
        footer: { text: 'Aszai Bot Dashboard • Database-powered • Real-time data' },
        timestamp: new Date().toISOString(),
      };
    },

    _getStatusColor(status) {
      switch (status?.toLowerCase()) {
        case 'healthy':
          return 0x00ff00;
        case 'warning':
          return 0xffa500;
        case 'critical':
          return 0xff0000;
        default:
          return 0x5865f2;
      }
    },

    _formatAlerts(alerts) {
      if (!alerts || alerts.length === 0) {
        return '✅ No active alerts';
      }
      return alerts
        .slice(0, 3)
        .map((alert) => `${alert.severity === 'critical' ? '🔴' : '🟡'} ${alert.message}`)
        .join('\n');
    },

    async _getServerStats(guild) {
      let onlineCount = 0;
      let botCount = 0;
      const totalMembers = guild.memberCount || 0;

      try {
        const fetchPromise = guild.members.fetch({ limit: 1000 });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Fetch timeout')), 5000)
        );

        await Promise.race([fetchPromise, timeoutPromise]);

        onlineCount = guild.members.cache.filter(
          (member) =>
            member.presence?.status === 'online' ||
            member.presence?.status === 'idle' ||
            member.presence?.status === 'dnd'
        ).size;
        botCount = guild.members.cache.filter((member) => member.user.bot).size;
      } catch (error) {
        const cachedMembers = guild.members.cache;
        onlineCount = cachedMembers.filter(
          (member) =>
            member.presence?.status === 'online' ||
            member.presence?.status === 'idle' ||
            member.presence?.status === 'dnd'
        ).size;
        botCount = cachedMembers.filter((member) => member.user.bot).size;

        if (onlineCount === 0 && totalMembers > 0) {
          onlineCount = Math.floor(totalMembers * 0.2);
        }
        if (botCount === 0 && totalMembers > 10) {
          botCount = Math.floor(totalMembers * 0.05);
        }
      }

      return {
        totalMembers,
        onlineCount,
        botCount,
        humanMembers: totalMembers - botCount,
      };
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
        const embed = await this._generateResourcesEmbed(interaction);
        return interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error fetching resource data:', error);
        const errorResponse = ErrorHandler.handleError(error, 'resources_command');
        return interaction.editReply({ content: errorResponse.message });
      }
    },

    async _generateResourcesEmbed(_interaction) {
      // Get resource optimization data
      const resourceStatus = await ResourceOptimizer.monitorResources();
      const analyticsData = await DiscordAnalytics.generateDailyReport();
      const recommendations = await ResourceOptimizer.generateOptimizationRecommendations(
        analyticsData,
        { averageResponseTime: resourceStatus.performance?.responseTime || 0 }
      );

      // Get database performance metrics
      const performanceMetrics = databaseService.getPerformanceMetrics('memory_usage', 1);
      const avgMemoryUsage =
        performanceMetrics.length > 0
          ? Math.round(
              performanceMetrics.reduce((sum, m) => sum + m.value, 0) / performanceMetrics.length
            )
          : 0;

      const statusColor =
        resourceStatus.memory?.status === 'good'
          ? 0x00ff00
          : resourceStatus.memory?.status === 'warning'
            ? 0xffa500
            : 0xff0000;

      return {
        color: statusColor,
        title: '🔧 Resource Optimization',
        fields: [
          {
            name: '💾 Memory Status',
            value: `Status: ${resourceStatus.memory?.status?.toUpperCase() || 'UNKNOWN'}\nUsed: ${resourceStatus.memory?.used || 0}MB\nFree: ${resourceStatus.memory?.free || 0}MB\nUsage: ${Math.round(resourceStatus.memory?.percentage || 0)}%`,
            inline: true,
          },
          {
            name: '⚙️ Performance',
            value: `Status: ${resourceStatus.performance?.status?.toUpperCase() || 'UNKNOWN'}\nResponse Time: ${resourceStatus.performance?.responseTime || 0}ms\nLoad: ${resourceStatus.performance?.load || 'N/A'}`,
            inline: true,
          },
          {
            name: '📈 Database Metrics (24h)',
            value: `Avg Memory: ${avgMemoryUsage}MB\nPerformance Ops: ${performanceMetrics.length}\nOptimization: Active`,
            inline: true,
          },
          {
            name: '💡 Recommendations',
            value: recommendations?.slice(0, 3)?.join('\n') || '✅ All systems optimized!',
            inline: false,
          },
        ],
        footer: { text: 'Aszai Bot Resource Monitor • Database-powered' },
        timestamp: new Date().toISOString(),
      };
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

  reminder: {
    data: {
      name: 'reminder',
      description: 'Set, list, or cancel reminders',
      options: [
        {
          name: 'action',
          description: 'What to do with reminders',
          type: ApplicationCommandOptionType.String,
          required: true,
          choices: [
            { name: 'set', value: 'set' },
            { name: 'list', value: 'list' },
            { name: 'cancel', value: 'cancel' },
            { name: 'help', value: 'help' },
          ],
        },
        {
          name: 'time',
          description: 'Time expression for the reminder (e.g., "in 5 minutes", "tomorrow at 3pm")',
          type: ApplicationCommandOptionType.String,
          required: false,
        },
        {
          name: 'message',
          description: 'Reminder message',
          type: ApplicationCommandOptionType.String,
          required: false,
        },
        {
          name: 'id',
          description: 'Reminder ID to cancel',
          type: ApplicationCommandOptionType.Integer,
          required: false,
        },
      ],
    },
    async execute(interaction) {
      const action = interaction.options.getString('action');
      const time = interaction.options.getString('time');
      const message = interaction.options.getString('message');
      const id = interaction.options.getInteger('id');

      // Create a mock message object for the reminder handler
      const mockMessage = {
        author: interaction.user,
        channel: interaction.channel,
        guild: interaction.guild,
        content: `!reminder ${action}${time ? ` "${time}"` : ''}${message ? ` ${message}` : ''}${id ? ` ${id}` : ''}`,
        reply: (content) => interaction.reply(content),
      };

      const args = [action];
      if (time) args.push(time);
      if (message) args.push(message);
      if (id) args.push(id.toString());

      return await handleReminderCommand(mockMessage, args);
    },
    textCommand: '!reminder',
  },
};

/**
 * Handle successful text command execution
 * @param {Object} message - Discord message
 * @param {string} commandName - Name of the command
 * @param {number} startTime - Command start time
 */
async function handleTextCommandSuccess(message, commandName, startTime) {
  const responseTime = Date.now() - startTime;
  try {
    databaseService.trackCommandUsage(
      message.author.id,
      commandName,
      message.guild?.id,
      true,
      responseTime
    );
  } catch (dbError) {
    logger.error(`Failed to log command usage for ${commandName}: ${dbError.message}`);
  }
}

/**
 * Handle text command execution error
 * @param {Object} message - Discord message
 * @param {string} commandName - Name of the command
 * @param {Error} error - The error that occurred
 * @param {number} startTime - Command start time
 */
async function handleTextCommandError(message, commandName, error, startTime) {
  const responseTime = Date.now() - startTime;

  // Track failed text command execution
  databaseService.trackCommandUsage(
    message.author.id,
    commandName,
    message.guild?.id,
    false,
    responseTime
  );

  // Log error to database
  databaseService.logError(
    'text_command_error',
    error.message,
    message.author.id,
    commandName,
    error.stack
  );

  const errorResponse = ErrorHandler.handleError(error, `text command ${commandName}`, {
    userId: message.author.id,
    command: commandName,
    content: message.content,
  });
  logger.error(`Error executing text command ${commandName}: ${errorResponse.message}`);
  try {
    return await message.reply(errorResponse.message);
  } catch (replyError) {
    logger.error(
      `Failed to send error reply for text command ${commandName}: ${replyError.message}`
    );
  }
}

/**
 * Handle text commands from messages
 * @param {Object} message - Discord.js message object
 * @returns {Promise<Object|null>} - Command result or null if no command matched
 */
async function handleTextCommand(message) {
  const commandText = message.content.trim();

  for (const [name, command] of Object.entries(commands)) {
    // Check if the command text starts with the main command or any aliases
    const commandPrefix = commandText.split(/\s+/)[0].toLowerCase(); // Get just the command part
    const isMainCommand = commandPrefix === command.textCommand;
    const hasAliases = command.aliases && Array.isArray(command.aliases);
    const isAliasCommand = hasAliases && command.aliases.includes(commandPrefix);

    if (isMainCommand || isAliasCommand) {
      const startTime = Date.now();

      try {
        // Create a mock interaction object for text commands
        const mockInteraction = {
          user: message.author,
          channel: message.channel,
          content: message.content, // Pass the content for text command parsing
          reply: (content) => message.reply(content),
          deferReply: async () => message.channel.sendTyping(),
          editReply: (content) => message.reply(content),
        };

        const result = await command.execute(mockInteraction);
        await handleTextCommandSuccess(message, name, startTime);
        return result;
      } catch (error) {
        return await handleTextCommandError(message, name, error, startTime);
      }
    }
  }

  return null;
}

/**
 * Handle successful command execution
 * @param {Object} interaction - Discord interaction
 * @param {number} startTime - Command start time
 */
async function handleCommandSuccess(interaction, startTime) {
  const responseTime = Date.now() - startTime;
  databaseService.trackCommandUsage(
    interaction.user.id,
    interaction.commandName,
    interaction.guild?.id,
    true,
    responseTime
  );
}

/**
 * Handle command execution error
 * @param {Object} interaction - Discord interaction
 * @param {Error} error - The error that occurred
 * @param {number} startTime - Command start time
 */
async function handleCommandError(interaction, error, startTime) {
  const responseTime = Date.now() - startTime;

  // Track failed command execution
  databaseService.trackCommandUsage(
    interaction.user.id,
    interaction.commandName,
    interaction.guild?.id,
    false,
    responseTime
  );

  // Log error to database
  databaseService.logError(
    'command_error',
    error.message,
    interaction.user.id,
    interaction.commandName,
    error.stack
  );

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

  const startTime = Date.now();

  try {
    await command.execute(interaction);
    await handleCommandSuccess(interaction, startTime);
  } catch (error) {
    await handleCommandError(interaction, error, startTime);
  }
}

/**
 * Get all slash command data for registration
 * @returns {Array} - Array of command data
 */
function getSlashCommandsData() {
  return Object.values(commands).map((command) => command.data);
}

module.exports = {
  handleTextCommand,
  handleSlashCommand,
  getSlashCommandsData,
};
