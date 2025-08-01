/**
 * Command handler for the bot
 */
const { ApplicationCommandOptionType } = require('discord.js');
const ConversationManager = require('../utils/conversation');
const perplexityService = require('../services/perplexity-secure');
const logger = require('../utils/logger');
const config = require('../config/config');

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
      const history = conversationManager.getHistory(userId);
      
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
        const errorMessage = logger.handleError(error, 'summary generation');
        return interaction.editReply(errorMessage);
      }
    },
    textCommand: '!summary'
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
      
      await interaction.deferReply();
      
      try {        // Create a message array with the text to summarize
        const messages = [
          {
            role: 'user', 
            content: text
          }
        ];
        
        const summary = await perplexityService.generateTextSummary(messages);
        conversationManager.updateUserStats(interaction.user.id, 'summaries');
          return interaction.editReply({ 
          embeds: [{
            color: config.COLORS.PRIMARY,
            title: 'Text Summary',
            description: summary,
            footer: { text: 'Aszai Bot' }
          }]
        });
      } catch (error) {
        const errorMessage = logger.handleError(error, 'text summary generation');
        return interaction.editReply(errorMessage);
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
        logger.error(`Error executing text command ${name}:`, error);
        return message.reply('There was an error executing this command.');
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
    logger.error(`Error executing slash command ${interaction.commandName}:`, error);
    
    const reply = { 
      content: 'There was an error executing this command.', 
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
