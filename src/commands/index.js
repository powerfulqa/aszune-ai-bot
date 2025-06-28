/**
 * Command handler for the bot
 */
const { SlashCommandBuilder } = require('discord.js');
const conversationManager = require('../utils/conversation');
const perplexityService = require('../services/perplexity');
const logger = require('../utils/logger');
const config = require('../config/config');

// Command definitions
const commands = {  help: {
    data: new SlashCommandBuilder()
      .setName('help')
      .setDescription('Show help for Aszai Bot'),
    async execute(interaction) {
      return interaction.reply(
        "**Aszai Bot Commands:**\n" +
        "`/help` or `!help` - Show this help message\n" +
        "`/clearhistory` or `!clearhistory` - Clear your conversation history\n" +
        "`/summary` or `!summary` - Summarise your current conversation\n" +
        "`/summarise` or `!summarise <text>` - Summarise provided text\n" +
        "`/stats` or `!stats` - Show your usage stats\n" +
        "Simply chat as normal to talk to the bot!"
      );
    },
    textCommand: '!help'
  },
  
  clearhistory: {
    data: new SlashCommandBuilder()
      .setName('clearhistory')
      .setDescription('Clear your conversation history'),
    async execute(interaction) {
      const userId = interaction.user.id;
      conversationManager.clearHistory(userId);
      return interaction.reply('Your conversation history has been cleared.');
    },
    textCommand: '!clearhistory'
  },
  
  summary: {
    data: new SlashCommandBuilder()
      .setName('summary')
      .setDescription('Summarise your current conversation'),
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
    data: new SlashCommandBuilder()
      .setName('stats')
      .setDescription('Show your usage stats'),
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
    data: new SlashCommandBuilder()
      .setName('summarise')
      .setDescription('Summarise provided text')
      .addStringOption(option => 
        option.setName('text')
          .setDescription('The text to summarise')
          .setRequired(true)
      ),
    async execute(interaction) {
      let text;
      
      // Handle both text commands and slash commands
      if (interaction.options) {
        // This is a slash command
        text = interaction.options.getString('text');      } else {
        // This is a text command
        const commandText = interaction.content || '';
        const match = commandText.match(/^!summarise\s+(.+)/i);
        text = match ? match[1] : '';
      }
      
      if (!text || text.trim().length === 0) {
        return interaction.reply('Please provide the text you want summarised. Usage: `!summarise <text>`');
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
    textCommand: '!summarise'
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
    if (commandText === command.textCommand) {
      try {
        // Create a mock interaction object for text commands
        const mockInteraction = {
          user: message.author,
          channel: message.channel,
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
  return Object.values(commands).map(command => command.data.toJSON());
}

module.exports = {
  handleTextCommand,
  handleSlashCommand,
  getSlashCommandsData,
};
