/**
 * Aszai Discord Bot - Main Entry Point
 * 
 * A Discord bot that specializes in gaming lore, game logic, guides, and advice,
 * powered by the Perplexity API.
 */
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const config = require('./config/config');
const handleChatMessage = require('./services/chat');
const commandHandler = require('./commands');
const conversationManager = require('./utils/conversation');
const logger = require('./utils/logger');

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

/**
 * Register slash commands with Discord
 */
async function registerSlashCommands() {
  if (!client.user) {
    logger.error('Cannot register slash commands: Client not ready');
    return;
  }
  
  const commands = commandHandler.getSlashCommandsData();
  
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_BOT_TOKEN);
  
  try {
    logger.info(`Registering ${commands.length} slash commands`);
    
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands },
    );
    
    logger.info('Slash commands registered successfully');
  } catch (error) {
    logger.error('Error registering slash commands:', error);
  }
}

// Handle ready event
client.once('ready', async () => {
  logger.info(`Discord bot is online as ${client.user.tag}!`);
  await registerSlashCommands();
});

// Handle chat messages
client.on('messageCreate', handleChatMessage);

// Handle slash commands
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  await commandHandler.handleSlashCommand(interaction);
});

// Handle errors
client.on('error', (error) => {
  logger.error('Discord client error:', error);
});

// Handle warnings
client.on('warn', (info) => {
  logger.warn('Discord client warning:', info);
});

// Handle shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  try {
    await client.destroy();
    await conversationManager.destroy();
  } catch (error) {
    logger.error('Error during shutdown:', error);
  } finally {
    process.exit(0);
  }
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  try {
    await client.destroy();
    await conversationManager.destroy();
  } catch (error) {
    logger.error('Error during shutdown:', error);
  } finally {
    process.exit(0);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection:', error);
});

// Log in to Discord
client.login(config.DISCORD_BOT_TOKEN)
  .then(() => {
    logger.info('Logged in to Discord');
  })
  .catch((error) => {
    logger.error('Failed to log in to Discord:', error);
    process.exit(1);
  });

// Export for testing
module.exports = {
  client,
  handleChatMessage,
  conversationManager,
};
