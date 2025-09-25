require('dotenv').config();
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

// Set up logger early
const logger = require('./utils/logger');

// Initialize Pi-specific optimizations if enabled
async function bootWithOptimizations() {
  try {
    if (config.PI_OPTIMIZATIONS && config.PI_OPTIMIZATIONS.ENABLED) {
      logger.info('Initializing Raspberry Pi optimizations...');
      await config.initializePiOptimizations();
      logger.info('Pi optimizations initialized successfully');
    }
  } catch (error) {
    logger.error('Failed to initialize Pi optimizations:', error);
    // Continue with default settings
  }
}

// Core dependencies
const { handleChatMessage } = require('./services/chat');
const commandHandler = require('./commands');
const ConversationManager = require('./utils/conversation');
const conversationManager = new ConversationManager();
conversationManager.initializeIntervals();

// Conditionally load optimizations - don't load in test environment for easier testing
const isProd = process.env.NODE_ENV === 'production';
const enablePiOptimizations = config.PI_OPTIMIZATIONS && config.PI_OPTIMIZATIONS.ENABLED;

// Only initialize in production to avoid affecting tests
if (isProd && enablePiOptimizations) {
  // Initialize Pi-specific optimizations
  logger.info('Initializing Pi optimizations');

  try {
    // Lazy-load optimization modules only when needed
    const { lazyLoad } = require('./utils/lazy-loader');

    // Initialize monitors directly with lazy loading
    lazyLoad(() => require('./utils/memory-monitor'))().initialize();
    lazyLoad(() => require('./utils/performance-monitor'))().initialize();
  } catch (error) {
    logger.warn('Failed to initialize Pi optimizations:', error);
  }
}

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

    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });

    logger.info('Slash commands registered successfully');
  } catch (error) {
    logger.error('Error registering slash commands:', error);
  }
}

// Handle ready event
client.once('ready', async () => {
  logger.info(`Discord bot is online as ${client.user.tag}!`);

  // Initialize Pi optimizations after connection is established
  await bootWithOptimizations();
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

  // Perform shutdown steps and collect errors
  const errors = await performShutdownSteps();
  
  // Handle shutdown completion
  handleShutdownCompletion(errors);
};

async function performShutdownSteps() {
  const errors = [];

  // Step 1: Shutdown conversation manager
  const convError = await shutdownConversationManager();
  if (convError) errors.push(convError);

  // Step 2: Shutdown Discord client (always attempt, even if previous steps failed)
  const clientError = await shutdownDiscordClient();
  if (clientError) errors.push(clientError);

  return errors;
}

async function shutdownConversationManager() {
  try {
    logger.debug('Shutting down conversation manager...');
    await conversationManager.destroy();
    logger.debug('Conversation manager shutdown successful');
    return null;
  } catch (convError) {
    logger.error('Error shutting down conversation manager:', convError);
    return convError;
  }
}

async function shutdownDiscordClient() {
  try {
    logger.debug('Shutting down Discord client...');
    await client.destroy();
    logger.debug('Discord client shutdown successful');
    return null;
  } catch (clientError) {
    logger.error('Error shutting down Discord client:', clientError);
    return clientError;
  }
}

function handleShutdownCompletion(errors) {
  if (errors.length > 0) {
    errors.forEach((err, index) => {
      logger.error(`Shutdown error ${index + 1}/${errors.length}:`, err);
    });
    logger.error(`Shutdown completed with ${errors.length} error(s)`);
    // Don't exit in test environment
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  } else {
    logger.info('Shutdown complete.');
    // Don't exit in test environment
    if (process.env.NODE_ENV !== 'test') {
      process.exit(0);
    }
  }
}

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

// Log in to Discord, with special handling for test environment
if (process.env.NODE_ENV === 'test') {
  // In test mode, we still call login but with a mock token that will be resolved in the mock
  client
    .login('test-token')
    .then(() => {
      logger.info('Logged in to Discord (test mode)');
    })
    .catch((error) => {
      logger.error('Failed to log in to Discord:', error);
    });
} else {
  client
    .login(config.DISCORD_BOT_TOKEN)
    .then(() => {
      logger.info('Logged in to Discord');
    })
    .catch((error) => {
      logger.error('Failed to log in to Discord:', error);
      if (process.env.NODE_ENV !== 'test') {
        process.exit(1);
      }
    });
}

// Export for testing
module.exports = {
  client,
  handleChatMessage,
  conversationManager,
  shutdown, // Export shutdown function for testing
  unhandledRejectionHandler, // Export for direct testing
  uncaughtExceptionHandler, // Export for direct testing
  bootWithOptimizations, // Export for branch coverage testing
  registerSlashCommands, // Export for branch coverage testing
};
