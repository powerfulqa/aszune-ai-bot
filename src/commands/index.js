/**
 * Command handler for the bot
 */
const { ApplicationCommandOptionType } = require('discord.js');
const ConversationManager = require('../utils/conversation');
const perplexityService = require('../services/perplexity-secure');
const logger = require('../utils/logger');
const config = require('../config/config');
const { ErrorHandler, ERROR_TYPES } = require('../utils/error-handler');
const { InputValidator } = require('../utils/input-validator');

const conversationManager = new ConversationManager();

// Command definitions
const commands = {
  help: {
    data: {
      name: 'help',
      description: 'Show help for Aszai Bot'
    },
    async execute(interaction) {
      return interaction.reply(
        "**Aszai Bot Commands:**\n" +        "`/help` or `!help` - Show this help message\n" +
        "`/clearhistory` or `!clearhistory` - Clear your conversation history\n" +
        "`/summary` or `!summary` - Summarise your current conversation\n" +
        "`/summarise` or `!summarise <text>` or `!summerise <text>` - Summarise provided text\n" +
        "`/stats` or `!stats` - Show your usage stats\n" +
        "Simply chat as normal to talk to the bot!"
      );
    },
    textCommand: '!help'
  },
  
  clearhistory: {
    data: {
      name: 'clearhistory',
      description: 'Clear your conversation history'
    },
    async execute(interaction) {
      const userId = interaction.user.id;
      conversationManager.clearHistory(userId);
      return interaction.reply('Your conversation history has been cleared.');
    },
    textCommand: '!clearhistory'
  },
  
  summary: {
    data: {
      name: 'summary',
      description: 'Summarise your current conversation'
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
      return interaction.reply('No conversation history to summarise.');
    }
    
    // Ensure last message is from user or tool
    let cleanHistory = [...history];
    while (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === 'assistant') {
      cleanHistory.pop();
    }
    
    if (cleanHistory.length === 0) {
      return interaction.reply('No conversation history to summarise.');
    }
    
    await interaction.deferReply();
    
    try {
      const summary = await perplexityService.generateSummary(cleanHistory);
      conversationManager.updateUserStats(userId, 'summaries');
        return interaction.editReply({ 
        embeds: [{
          color: config.COLORS.PRIMARY,
          title: 'Conversation Summary',
          description: summary,
          footer: { text: 'Aszai Bot' }
        }]
      });
    } catch (error) {
      const errorResponse = ErrorHandler.handleError(error, 'summary generation', {
        userId: userId,
        historyLength: history?.length || 0
      });
      return interaction.editReply(errorResponse.message);
    }
  },
    textCommand: '!summary'
  },
  cache: {
    data: {
      name: 'cache',
      description: 'View cache statistics and information'
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
        
        // Create embed with cache information
        const embed = {
          color: config.COLORS.PRIMARY,
          title: 'Cache Statistics',
          fields: [
            {
              name: 'Performance',
              value: `Hit Rate: ${cacheStats.hitRate}%\nHits: ${cacheStats.hits}\nMisses: ${cacheStats.misses}`,
              inline: true
            },
            {
              name: 'Operations',
              value: `Sets: ${cacheStats.sets}\nDeletes: ${cacheStats.deletes}\nEvictions: ${cacheStats.evictions}`,
              inline: true
            },
            {
              name: 'Memory Usage',
              value: `${cacheStats.memoryUsageFormatted} / ${cacheStats.maxMemoryFormatted}\nEntries: ${cacheStats.entryCount} / ${cacheStats.maxSize}`,
              inline: true
            },
            {
              name: 'Configuration',
              value: `Strategy: ${cacheStats.evictionStrategy}\nUptime: ${cacheStats.uptimeFormatted}`,
              inline: true
            }
          ],
          footer: { text: 'Aszai Bot Cache' },
          timestamp: new Date()
        };
        
        // Add recent entries if available
        if (detailedInfo.entries && detailedInfo.entries.length > 0) {
          const recentEntries = detailedInfo.entries.slice(0, 5);
          const entriesText = recentEntries.map(entry => 
            `**${entry.key.substring(0, 20)}...** (${entry.accessCount} accesses)`
          ).join('\n');
          
          embed.fields.push({
            name: 'Recent Entries',
            value: entriesText || 'No entries',
            inline: false
          });
        }
        
        return interaction.editReply({ embeds: [embed] });
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'cache statistics retrieval', {
          userId: userId
        });
        return interaction.editReply(`❌ Error retrieving cache statistics: ${errorResponse.message}`);
      }
    },
    textCommand: '!cache'
  },
    stats: {
    data: {
      name: 'stats',
      description: 'Show your usage stats'
    },
    async execute(interaction) {
      const userId = interaction.user.id;
      const stats = conversationManager.getUserStats(userId);
        return interaction.reply(
        `**Your Aszai Bot Stats:**\n` +
        `Messages sent: ${stats.messages}\n` +
        `Summaries requested: ${stats.summaries}`
      );
    },
    textCommand: '!stats'
  },

  summarise: {
    data: {
      name: 'summarise',
      description: 'Summarise provided text',
      options: [{
        name: 'text',
        description: 'The text to summarise',
        type: 3, // ApplicationCommandOptionType.String = 3 in discord.js v14
        required: true
      }]
    },
  async execute(interaction) {
    const userId = interaction.user.id;
    
    // Validate user ID
    const userIdValidation = InputValidator.validateUserId(userId);
    if (!userIdValidation.valid) {
      return interaction.reply(`❌ Invalid user ID: ${userIdValidation.error}`);
    }
    
    let text;
    
    // Handle both text commands and slash commands
    if (interaction.options) {
      // This is a slash command
      text = interaction.options.getString('text');      } else {
      // This is a text command
      const commandText = interaction.content || '';
      // Match both spellings: summarise and summerise
      const match = commandText.match(/^!sum[me]?[ae]rise\s+(.+)/i);
      text = match ? match[1] : '';
      }
        
    if (!text || text.trim().length === 0) {
      return interaction.reply('Please provide the text you want summarised. Usage: `!summarise <text>` or `!summerise <text>`');
    }
    
    // Validate and sanitize the text input
    const textValidation = InputValidator.validateAndSanitize(text, {
      type: 'message',
      maxLength: 3000, // Reasonable limit for summarization
      strict: false
    });
    
    if (!textValidation.valid) {
      return interaction.reply(`❌ Invalid text input: ${textValidation.error}`);
    }
    
    // Use sanitized text
    const sanitizedText = textValidation.sanitized;
    
    await interaction.deferReply();
    
    try {        // Create a message array with the sanitized text to summarize
        const messages = [
          {
            role: 'user', 
            content: sanitizedText
          }
        ];
        
        const summary = await perplexityService.generateTextSummary(messages);
        conversationManager.updateUserStats(userId, 'summaries');
          return interaction.editReply({ 
          embeds: [{
            color: config.COLORS.PRIMARY,
            title: 'Text Summary',
            description: summary,
            footer: { text: 'Aszai Bot' }
          }]
        });
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, 'text summary generation', {
          userId: userId,
          textLength: sanitizedText?.length || 0,
          warnings: textValidation.warnings
        });
        return interaction.editReply(errorResponse.message);
      }
    },
    // Support both spellings as text commands
    textCommand: '!summarise',
    // Add alias commands that will be recognized
    aliases: ['!summerise']
  }
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
          editReply: (content) => message.reply(content)
        };
        
        return await command.execute(mockInteraction);
      } catch (error) {
        const errorResponse = ErrorHandler.handleError(error, `text command ${name}`, {
          userId: message.author.id,
          command: name,
          content: message.content
        });
        logger.error(`Error executing text command ${name}: ${errorResponse.message}`);
        return message.reply(errorResponse.message);
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
      ephemeral: true 
    });
  }
  
  try {
    await command.execute(interaction);
  } catch (error) {
    const errorResponse = ErrorHandler.handleError(error, `slash command ${interaction.commandName}`, {
      userId: interaction.user.id,
      command: interaction.commandName,
      guildId: interaction.guild?.id
    });
    
    logger.error(`Error executing slash command ${interaction.commandName}: ${errorResponse.message}`);
    
    const reply = { 
      content: errorResponse.message, 
      ephemeral: true 
    };
    
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(reply);
    } else {
      await interaction.reply(reply);
    }
  }
}

/**
 * Get all slash command data for registration
 * @returns {Array} - Array of command data
 */
function getSlashCommandsData() {
  return Object.values(commands).map(command => command.data);
}

module.exports = {
  handleTextCommand,
  handleSlashCommand,
  getSlashCommandsData,
};
