/**
 * Aszai Discord Bot - Main Entry Point
 * 
 * A Discord bot that specializes in gaming lore, game logic, guides, and advice,
 * powered by the Perplexity API.
 */
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
let config;
try {
  config = require('./config/config');
} catch (error) {
  console.error('Failed to load configuration:', error.message);
  process.exit(1);
}
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

// Flag to prevent multiple shutdown executions
let isShuttingDown = false;

// Centralized shutdown function
const shutdown = async (signal) => {
  // Prevent multiple simultaneous shutdown attempts
  if (isShuttingDown) {
    logger.info(`Shutdown already in progress. Ignoring additional ${signal} signal.`);
    return;
  }
  
  isShuttingDown = true;
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  
  // Track any errors that occur during shutdown
  const errors = [];
  let shutdownStatus = true;
  
  // Step 1: Shutdown conversation manager
  try {
    logger.debug('Shutting down conversation manager...');
    await conversationManager.destroy();
    logger.debug('Conversation manager shutdown successful');
  } catch (convError) {
    shutdownStatus = false;
    logger.error('Error shutting down conversation manager:', convError);
    errors.push(convError);
  }
  
  // Step 2: Shutdown Discord client (always attempt, even if previous steps failed)
  try {
    logger.debug('Shutting down Discord client...');
    // Use await to ensure proper cleanup of connections
    await client.destroy();
    logger.debug('Discord client shutdown successful');
  } catch (clientError) {
    shutdownStatus = false;
    logger.error('Error shutting down Discord client:', clientError);
    errors.push(clientError);
  }
  
  // Log individual errors for easier debugging
  if (errors.length > 0) {
    errors.forEach((err, index) => {
      logger.error(`Shutdown error ${index + 1}/${errors.length}:`, err);
    });
    logger.error(`Shutdown completed with ${errors.length} error(s)`);
    process.exit(1);
  } else {
    logger.info('Shutdown complete.');
    process.exit(0);
  }
};

// Handle shutdown signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle unhandled promise rejections
function unhandledRejectionHandler(reason, promise) {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit here, just log
}
process.on('unhandledRejection', unhandledRejectionHandler);

// Handle uncaught exceptions
function uncaughtExceptionHandler(error) {
  logger.error('Uncaught Exception:', error);
  // Always exit with error code on uncaught exceptions
  shutdown('uncaughtException');
}
process.on('uncaughtException', uncaughtExceptionHandler);

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
  shutdown, // Export shutdown function for testing
  unhandledRejectionHandler, // Export for direct testing
  uncaughtExceptionHandler,  // Export for direct testing
};
