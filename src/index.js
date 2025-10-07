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
  // Use direct stderr write as fallback since logger is not yet available
  process.stderr.write(`Failed to load configuration: ${error.message}\n`);
  process.exit(1);
}

// Set up logger early
const logger = require('./utils/logger');

// Initialize license validation conditionally
let licenseValidator = null;

// Helper function to get config inside functions to avoid circular dependencies
function getConfig() {
  const config = require('./config/config');

  // Ensure FEATURES property exists (for backward compatibility and tests)
  if (!config.FEATURES) {
    config.FEATURES = {
      LICENSE_VALIDATION: false,
      LICENSE_SERVER: false,
      LICENSE_ENFORCEMENT: false,
      DEVELOPMENT_MODE: false,
    };
  }

  return config;
}

// Initialize Pi-specific optimizations if enabled
async function bootWithOptimizations() {
  const currentConfig = getConfig();

  // Initialize license validation only if enabled
  if (currentConfig.FEATURES.LICENSE_VALIDATION || currentConfig.FEATURES.DEVELOPMENT_MODE) {
    const LicenseValidator = require('./utils/license-validator');
    licenseValidator = new LicenseValidator();

    logger.info('Validating software license...');
    const licenseValid = await licenseValidator.enforceLicense();

    if (!licenseValid) {
      logger.error('License validation failed - see above for details');
      // Will exit in licenseValidator.enforceLicense() if needed
    } else {
      logger.info('License validation successful - starting bot...');
    }
  } else {
    logger.info('License validation disabled via feature flags - starting bot...');
  }

  // Start license server if enabled
  if (currentConfig.FEATURES.LICENSE_SERVER || currentConfig.FEATURES.DEVELOPMENT_MODE) {
    const LicenseServer = require('./utils/license-server');
    const server = new LicenseServer();
    server.start();
  }
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
const handleChatMessage = require('./services/chat');
const commandHandler = require('./commands');
const ConversationManager = require('./utils/conversation');
const conversationManager = new ConversationManager();
conversationManager.initializeIntervals();

// Initialize reminder service
const reminderService = require('./services/reminder-service');

// Set up reminder due handler
reminderService.on('reminderDue', async (reminder) => {
  try {
    // Send the reminder message to the channel
    const channel = await client.channels.fetch(reminder.channel_id);
    if (channel) {
      const embed = {
        color: 0x00ff00,
        title: '⏰ Reminder!',
        description: reminder.message,
        footer: {
          text: `Reminder set ${new Date(reminder.created_at).toLocaleDateString()} • Aszai Bot`,
        },
        timestamp: new Date().toISOString(),
      };

      await channel.send({ embeds: [embed] });
      logger.info(`Sent reminder ${reminder.id} to channel ${reminder.channel_id}`);
    } else {
      logger.error(`Could not find channel ${reminder.channel_id} for reminder ${reminder.id}`);
    }
  } catch (error) {
    logger.error(`Failed to handle reminder due for ${reminder.id}:`, error);
  }
});

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
client.once('clientReady', async () => {
  logger.info(`Discord bot is online as ${client.user.tag}!`);

  // Log bot startup event
  const databaseService = require('./services/database');
  databaseService.logBotEvent('start', 0, 'Bot started successfully');

  // Initialize reminder service
  try {
    await reminderService.initialize();
    logger.info('Reminder service initialized');
  } catch (error) {
    logger.error('Failed to initialize reminder service:', error);
  }

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

  // Log bot shutdown event
  const databaseService = require('./services/database');
  const uptimeSeconds = Math.floor(process.uptime());
  databaseService.logBotEvent('stop', uptimeSeconds, `Shutdown initiated by ${signal}`);

  // Perform shutdown steps and collect errors
  const errors = await performShutdownSteps();

  // Handle shutdown completion
  handleShutdownCompletion(errors);
};

async function performShutdownSteps() {
  const errors = [];

  // Step 1: Shutdown reminder service
  const reminderError = await shutdownReminderService();
  if (reminderError) errors.push(reminderError);

  // Step 2: Shutdown conversation manager
  const convError = await shutdownConversationManager();
  if (convError) errors.push(convError);

  // Step 3: Shutdown Discord client (always attempt, even if previous steps failed)
  const clientError = await shutdownDiscordClient();
  if (clientError) errors.push(clientError);

  return errors;
}

async function shutdownReminderService() {
  try {
    logger.debug('Shutting down reminder service...');
    reminderService.shutdown();
    logger.debug('Reminder service shutdown successful');
    return null;
  } catch (reminderError) {
    logger.error('Error shutting down reminder service:', reminderError);
    return reminderError;
  }
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

// Helper function to handle Discord login with appropriate error handling
function loginToDiscord(token, isTestMode = false) {
  return client
    .login(token)
    .then(() => {
      logger.info(`Logged in to Discord${isTestMode ? ' (test mode)' : ''}`);
    })
    .catch((error) => {
      logger.error('Failed to log in to Discord:', error);
      if (!isTestMode) {
        process.exit(1);
      }
    });
}

// Log in to Discord, with special handling for test environment
if (process.env.NODE_ENV === 'test') {
  // In test mode, we still call login but with a mock token that will be resolved in the mock
  loginToDiscord('test-token', true);
} else {
  loginToDiscord(config.DISCORD_BOT_TOKEN, false);
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
