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
          '`/clearhistory` or `!clearhistory` - Clear your conversation history\n' +
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
      return interaction.reply('Conversation history cleared!');
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
      if (detailedInfo.entries && detailedInfo.entries.length > 0) {
        const recentEntries = detailedInfo.entries.slice(0, 5);
        const entriesText = recentEntries
          .map((entry) => `**${entry.key.substring(0, 20)}...** (${entry.accessCount} accesses)`)
          .join('\n');

        embed.fields.push({
          name: 'Recent Entries',
          value: entriesText || 'No entries',
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
          `Summaries requested: ${stats.summaries}`
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
        
        // Generate daily analytics report
        const serverId = interaction.guild?.id;
        const activityHistory = []; // TODO: Implement activity history collection
        const analyticsData = await DiscordAnalytics.generateDailyReport(activityHistory);
        const serverInsights = await DiscordAnalytics.generateServerInsights(serverId, activityHistory);
        
        const embed = {
          color: config.COLORS.PRIMARY,
          title: '📊 Discord Analytics Dashboard',
          fields: [
            {
              name: '🏢 Server Overview',
              value: `Servers: ${analyticsData.summary.totalServers}\nActive Users: ${analyticsData.summary.totalUsers}\nTotal Commands: ${analyticsData.summary.totalCommands}`,
              inline: true
            },
            {
              name: '📈 Performance',
              value: `Success Rate: ${analyticsData.summary.successRate}%\nError Rate: ${analyticsData.summary.errorRate}%\nAvg Response: ${analyticsData.summary.avgResponseTime}ms`,
              inline: true
            },
            {
              name: '🎯 Top Commands',
              value: analyticsData.commandStats.slice(0, 3).map((cmd, i) => 
                `${i + 1}. ${cmd.command} (${cmd.count})`
              ).join('\n') || 'No data yet',
              inline: true
            },
            {
              name: '💡 Server Insights',
              value: serverInsights.recommendations.slice(0, 2).join('\n') || 'All systems optimal!',
              inline: false
            }
          ],
          footer: { text: 'Aszai Bot Analytics' },
          timestamp: new Date().toISOString()
        };

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
        
        // Generate comprehensive dashboard
        const dashboardData = await PerformanceDashboard.generateDashboardReport();
        const realTimeStatus = PerformanceDashboard.getRealTimeStatus();
        
        const embed = {
          color: dashboardData.overview.status === 'healthy' ? '#00FF00' : 
            dashboardData.overview.status === 'warning' ? '#FFA500' : '#FF0000',
          title: '🖥️ Performance Dashboard',
          fields: [
            {
              name: '🚦 System Status',
              value: `Status: ${dashboardData.overview.status.toUpperCase()}\nUptime: ${realTimeStatus.uptime.formatted}\nMemory: ${dashboardData.overview.memoryUsage}`,
              inline: true
            },
            {
              name: '⚡ Performance',
              value: `Response Time: ${dashboardData.overview.responseTime}\nError Rate: ${dashboardData.overview.errorRate}\nOptimization: ${dashboardData.overview.optimizationTier}`,
              inline: true
            },
            {
              name: '📊 Activity',
              value: `Servers: ${dashboardData.overview.serverCount}\nActive Users: ${dashboardData.overview.activeUsers}\nCommands: ${dashboardData.overview.totalCommands}`,
              inline: true
            },
            {
              name: '🚨 Active Alerts',
              value: (dashboardData.alerts && dashboardData.alerts.length > 0) ?
                dashboardData.alerts.slice(0, 3).map(alert => 
                  `${alert.severity === 'critical' ? '🔴' : '🟡'} ${alert.message}`
                ).join('\n') : '✅ No active alerts',
              inline: false
            }
          ],
          footer: { text: 'Aszai Bot Dashboard • Real-time data' },
          timestamp: new Date().toISOString()
        };

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
        
        // Get resource optimization data
        const resourceStatus = await ResourceOptimizer.monitorResources();
        const analyticsData = await DiscordAnalytics.generateDailyReport();
        const recommendations = await ResourceOptimizer.generateOptimizationRecommendations(
          analyticsData, 
          { averageResponseTime: resourceStatus.performance.responseTime }
        );
        
        const embed = {
          color: resourceStatus.memory.status === 'good' ? '#00FF00' : 
            resourceStatus.memory.status === 'warning' ? '#FFA500' : '#FF0000',
          title: '🔧 Resource Optimization',
          fields: [
            {
              name: '💾 Memory Status',
              value: `Status: ${resourceStatus.memory.status.toUpperCase()}\nUsed: ${resourceStatus.memory.used}MB\nFree: ${resourceStatus.memory.free}MB\nUsage: ${Math.round(resourceStatus.memory.percentage)}%`,
              inline: true
            },
            {
              name: '⚙️ Performance',
              value: `Status: ${resourceStatus.performance.status.toUpperCase()}\nResponse Time: ${resourceStatus.performance.responseTime}ms\nLoad: ${resourceStatus.performance.load}`,
              inline: true
            },
            {
              name: '📈 Optimization Tier',
              value: `Current: ${resourceStatus.optimizationTier}\nServer Count: ${analyticsData.summary.totalServers}\nRecommended: Auto-scaling active`,
              inline: true
            },
            {
              name: '💡 Recommendations',
              value: recommendations.slice(0, 3).join('\n') || '✅ All systems optimized!',
              inline: false
            }
          ],
          footer: { text: 'Aszai Bot Resource Monitor' },
          timestamp: new Date().toISOString()
        };

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
};

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

        return await command.execute(mockInteraction);
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
          logger.error(
            `Failed to send error reply for text command ${name}: ${replyError.message}`
          );
        }
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
  return Object.values(commands).map((command) => command.data);
}

module.exports = {
  handleTextCommand,
  handleSlashCommand,
  getSlashCommandsData,
};
